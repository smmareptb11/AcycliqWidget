import { useEffect, useRef, useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import { shortDateTimeFormatter } from '../util/date.js'
import { CHART_HEIGHT, axisStroke, RANGER_FILL_ALPHA } from '../theme.js'

const DEFAULT_CHART_HEIGHT = CHART_HEIGHT
const DEFAULT_RANGER_HEIGHT = 28
const RANGER_OFFSET = 100
const MIN_WINDOW_S = 3600 // fenêtre temporelle minimale sélectionnable : 1h
const MIN_SEL_PX = 24 // largeur de rendu minimale de la sélection du ranger (garde 1h visible + poignées séparées)

/**
 * Mesure la largeur disponible d'un conteneur sans qu'elle soit gonflée
 * par un canevas uPlot. Réduit temporairement à zéro le graphe du conteneur
 * (retrouvé dans le DOM) et toute racine supplémentaire passée en argument
 * (le ranger, qui est un frère) pour que offsetWidth reflète la contrainte
 * du parent, pas les canevas.
 *
 * Réduire le ranger aussi est essentiel au rétrécissement : sinon son canevas
 * garde l'ancêtre commun large, offsetWidth reste bloqué sur l'ancienne
 * largeur et le graphe ne rétrécit jamais (débordement au redimensionnement).
 */
function measureWidth(containerEl, ...extraRoots) {
	const roots = [containerEl.querySelector('.uplot'), ...extraRoots].filter(Boolean)
	const restore = roots.map(el => [el, el.style.width])
	roots.forEach(el => { el.style.width = '0' })
	const w = containerEl.offsetWidth
	restore.forEach(([el, prev]) => { el.style.width = prev })
	return w || 400
}

/**
 * Rend la boîte de sélection du ranger pour une fenêtre [min, max] (secondes),
 * en imposant une largeur visuelle minimale (MIN_SEL_PX) : une fenêtre très
 * courte (ex. 1h sur 30 jours ≈ sous-pixel) reste ainsi visible et ses deux
 * poignées séparées, la boîte étant centrée sur la fenêtre réelle. Le second
 * argument `false` empêche le re-déclenchement du hook setSelect (récursion).
 */
export function renderRangerSelect(uRanger, min, max) {
	const maxWidth = uRanger.bbox.width
	let left = Math.round(uRanger.valToPos(min, 'x'))
	let width = Math.round(uRanger.valToPos(max, 'x')) - left
	// Plancher de largeur, borné à la largeur de la réglette (cas d'une réglette très étroite)
	const minWidth = Math.min(MIN_SEL_PX, maxWidth)
	if (width < minWidth) {
		const center = left + width / 2
		left = Math.round(Math.max(0, Math.min(center - minWidth / 2, maxWidth - minWidth)))
		width = minWidth
	}
	uRanger.setSelect({ left, width, height: uRanger.bbox.height }, false)
}

/**
 * Borne une fenêtre [min, max] (secondes) à l'étendue des données et impose la
 * durée minimale MIN_WINDOW_S en faisant grandir le bord opposé à celui tiré
 * (`edge` : 'L' gauche, 'R' droite, 'body' translation à durée constante).
 */
export function clampWindow(xVals, min, max, edge) {
	const lo = xVals[0]
	const hi = xVals[xVals.length - 1]
	if (edge === 'body') {
		// Translation : conserve la durée, borne seulement la position.
		const dur = max - min
		if (min < lo) { min = lo; max = lo + dur }
		if (max > hi) { max = hi; min = hi - dur }
		return { min, max }
	}
	// Redimensionnement : borner d'abord aux données, PUIS garantir la durée
	// minimale en poussant le bord opposé à celui tiré (sinon le bornage aux
	// bornes pourrait re-rétrécir la fenêtre sous MIN_WINDOW_S, cf. bords).
	min = Math.max(lo, min)
	max = Math.min(hi, max)
	if (max - min < MIN_WINDOW_S) {
		if (edge === 'R') {
			max = Math.min(hi, min + MIN_WINDOW_S)
			min = Math.max(lo, max - MIN_WINDOW_S)
		}
		else {
			min = Math.max(lo, max - MIN_WINDOW_S)
			max = Math.min(hi, min + MIN_WINDOW_S)
		}
	}
	return { min, max }
}

export function useDateRange(startDate, endDate) {
	const startMs = useMemo(() => {
		if (startDate) return new Date(startDate).getTime()
		const d = new Date()
		d.setDate(d.getDate() - 30)
		d.setHours(0, 0, 0, 0)
		return d.getTime()
	}, [startDate])

	const fixedEndMs = useMemo(() => {
		if (endDate) return new Date(endDate).getTime()
		return null
	}, [endDate])

	const getEndMs = useCallback(() => fixedEndMs ?? Date.now(), [fixedEndMs])

	return { startMs, getEndMs }
}

export function useAutoRefresh(loadData, refreshMinutes) {
	useEffect(() => {
		loadData()
		if (refreshMinutes > 0) {
			const interval = setInterval(loadData, refreshMinutes * 60 * 1000)
			return () => clearInterval(interval)
		}
	}, [loadData, refreshMinutes])
}

/**
 * Hook de graphe partagé : gère le cycle de vie uPlot + ranger, l'infobulle, le redimensionnement, le zoom, l'export.
 *
 * @param {object} opts
 * @param {Array} opts.plotData - tableaux de données uPlot [xVals, yVals, ...]
 * @param {number} opts.hours - fenêtre visible initiale en heures
 * @param {string} opts.color - couleur de la série principale (utilisée pour le ranger)
 * @param {Function} opts.buildChartOpts - (chartWidth, initMin, initMax) => { width, height, scales, axes, series }
 * @param {Function} opts.formatTooltip - (uPlot, idx) => chaîne HTML ou null
 * @param {string} opts.exportPrefix - préfixe de nom de fichier pour l'export PNG
 * @param {Function} [opts.onChartReady] - appelé avec l'instance uPlot après création
 * @param {Function} [opts.onScaleChange] - (u, min, max) appelé à chaque changement d'échelle x (init, zoom, drag du ranger)
 */
export function useChart({ plotData, hours, color, buildChartOpts, formatTooltip, exportPrefix, onChartReady, onScaleChange }) {
	const chartRef = useRef(null)
	const rangerRef = useRef(null)
	const uPlotRef = useRef(null)
	const uRangerRef = useRef(null)
	const [activeHours, setActiveHours] = useState(hours)

	const buildOptsRef = useRef(buildChartOpts)
	buildOptsRef.current = buildChartOpts
	const formatTooltipRef = useRef(formatTooltip)
	formatTooltipRef.current = formatTooltip
	const onChartReadyRef = useRef(onChartReady)
	onChartReadyRef.current = onChartReady
	const onScaleChangeRef = useRef(onScaleChange)
	onScaleChangeRef.current = onScaleChange
	const reentryGuardRef = useRef(false)

	useEffect(() => {
		if (!chartRef.current || !rangerRef.current || !plotData || !plotData[0].length) return

		const xVals = plotData[0]
		const hoursS = hours * 3600
		const initMax = xVals[xVals.length - 1]
		const initMin = initMax - hoursS

		// Détruit les instances précédentes (graphe + ranger)
		if (uPlotRef.current) { uPlotRef.current.destroy(); uPlotRef.current = null }
		if (uRangerRef.current) { uRangerRef.current.destroy(); uRangerRef.current = null }

		const chartWidth = measureWidth(chartRef.current)

		// Construit les options spécifiques au graphe, puis fusionne la config partagée
		const specificOpts = buildOptsRef.current(chartWidth, initMin, initMax)
		const opts = {
			...specificOpts,
			cursor: { drag: { setScale: false, setSelect: false }, bind: { dblclick: () => null } },
			select: { show: false },
			legend: { show: false },
			hooks: {
				init: [
					u => {
						const tooltip = document.createElement('div')
						tooltip.className = 'acycliq-tooltip'
						document.body.appendChild(tooltip)
						u.over._tooltip = tooltip
						u.over.addEventListener('mouseenter', () => { tooltip.style.display = 'block' })
						u.over.addEventListener('mouseleave', () => { tooltip.style.display = 'none' })
					}
				],
				setScale: [
					(u, key) => {
						if (key !== 'x') return
						if (reentryGuardRef.current) return
						if (!onScaleChangeRef.current) return
						// Différé : uPlot n'a peut-être pas encore validé la nouvelle échelle
						// quand ce hook se déclenche, et tout appel setScale/setData
						// imbriqué entrerait en concurrence avec la mise à jour d'échelle externe.
						// queueMicrotask s'exécute après la fin du setScale courant.
						const cb = onScaleChangeRef.current
						queueMicrotask(() => {
							if (reentryGuardRef.current) return
							reentryGuardRef.current = true
							try {
								cb(u, u.scales.x.min, u.scales.x.max)
							}
							finally {
								reentryGuardRef.current = false
							}
						})
					}
				],
				setCursor: [
					u => {
						const tooltip = u.over._tooltip
						const { left, top, idx } = u.cursor

						if (idx == null || idx < 0 || idx >= u.data[0].length) {
							tooltip.style.display = 'none'
							return
						}

						const html = formatTooltipRef.current(u, idx)
						if (!html) {
							tooltip.style.display = 'none'
							return
						}

						tooltip.style.display = 'block'
						tooltip.innerHTML = html

						const bbox = u.over.getBoundingClientRect()
						let pageX = left + bbox.left + 10
						let pageY = top + bbox.top + 10
						if (pageX + 160 > window.innerWidth) pageX -= 170
						if (pageY + 60 > window.innerHeight) pageY -= 70
						tooltip.style.left = `${pageX}px`
						tooltip.style.top = `${pageY}px`
					}
				],
				destroy: [
					u => {
						const tooltip = u.over?._tooltip
						if (tooltip?.parentNode) tooltip.parentNode.removeChild(tooltip)
					}
				]
			}
		}

		uPlotRef.current = new UPlot(opts, plotData, chartRef.current)
		onChartReadyRef.current?.(uPlotRef.current)

		// --- Ranger ---
		const rangerOpts = {
			width: chartWidth - RANGER_OFFSET,
			height: DEFAULT_RANGER_HEIGHT,
			axes: [{ show: false }, { show: false }],
			scales: { x: { time: true } },
			series: [{}, { stroke: color, width: 1, fill: color, fillAlpha: RANGER_FILL_ALPHA }],
			cursor: { x: false, y: false, points: { show: false }, drag: { setScale: false, setSelect: true, x: true, y: false } },
			legend: { show: false },
			select: { show: true },
			hooks: {
				ready: [
					uRanger => {
						renderRangerSelect(uRanger, initMin, initMax)

						const debounce = fn => {
							let raf
							return (...args) => {
								if (raf) return
								raf = requestAnimationFrame(() => { fn(...args); raf = null })
							}
						}
						const on = (ev, el, fn) => el.addEventListener(ev, fn)
						const off = (ev, el, fn) => el.removeEventListener(ev, fn)

						let x0, min0, max0, secPerPx

						// Le drag de la réglette travaille en TEMPS (min/max), pas en pixels :
						// la boîte visuelle est recalculée ensuite avec un plancher de largeur,
						// pour que la fenêtre 1h reste visible et les poignées ne se chevauchent pas.
						function applyWindow(rawMin, rawMax, edge) {
							const { min, max } = clampWindow(plotData[0], rawMin, rawMax, edge)
							uPlotRef.current.setScale('x', { min, max })
							renderRangerSelect(uRanger, min, max)
						}

						function bindMove(e, onMove) {
							x0 = e.clientX
							const xs = uPlotRef.current.scales.x
							min0 = xs.min
							max0 = xs.max
							secPerPx = (uRanger.posToVal(uRanger.bbox.width, 'x') - uRanger.posToVal(0, 'x')) / uRanger.bbox.width
							// Pointer Events unifient souris/tactile/stylet ; capture pour fiabiliser le suivi hors de l'élément
							try { e.target.setPointerCapture(e.pointerId) }
							catch { /* pointeur déjà relâché */ }
							const _onMove = debounce(evt => onMove((evt.clientX - x0) * secPerPx))
							const _onUp = () => {
								off('pointermove', document, _onMove)
								off('pointerup', document, _onUp)
								off('pointercancel', document, _onUp)
							}
							on('pointermove', document, _onMove)
							on('pointerup', document, _onUp)
							on('pointercancel', document, _onUp)
							e.preventDefault()
							e.stopPropagation()
						}

						const selector = uRanger.root.querySelector('.u-select')
						const gripL = document.createElement('div')
						gripL.classList.add('u-grip-l')
						selector.appendChild(gripL)
						const gripR = document.createElement('div')
						gripR.classList.add('u-grip-r')
						selector.appendChild(gripR)

						on('pointerdown', selector, e => bindMove(e, dt => applyWindow(min0 + dt, max0 + dt, 'body')))
						on('pointerdown', gripL, e => bindMove(e, dt => applyWindow(min0 + dt, max0, 'L')))
						on('pointerdown', gripR, e => bindMove(e, dt => applyWindow(min0, max0 + dt, 'R')))
					}
				],
				setSelect: [
					// Drag natif d'uPlot (tracer une nouvelle sélection) : borne la fenêtre
					// dessinée au minimum de 1h et re-rend la boîte avec le plancher de largeur.
					u => {
						const { left, width: selWidth } = u.select
						const { min, max } = clampWindow(plotData[0], u.posToVal(left, 'x'), u.posToVal(left + selWidth, 'x'), 'R')
						uPlotRef.current.setScale('x', { min, max })
						renderRangerSelect(u, min, max)
					}
				]
			}
		}

		uRangerRef.current = new UPlot(rangerOpts, [plotData[0], plotData[1]], rangerRef.current)

		// Recale à la largeur du conteneur. Se déclenche aussi quand le conteneur
		// change de taille sans resize de fenêtre (iframe, rotation, layout tardif sur mobile).
		const handleResize = () => {
			if (!chartRef.current || !uPlotRef.current) return
			// Réduit le canevas du ranger aussi, sinon il maintient l'ancêtre
			// commun large et la mesure reste bloquée sur l'ancienne largeur.
			const w = measureWidth(chartRef.current, uRangerRef.current?.root)
			if (w <= 0) return
			uPlotRef.current.setSize({ width: w, height: DEFAULT_CHART_HEIGHT })
			uRangerRef.current?.setSize({ width: w - RANGER_OFFSET, height: DEFAULT_RANGER_HEIGHT })
			// Réaligne la fenêtre du ranger sur l'échelle x courante (les positions en px changent avec la largeur)
			const xScale = uPlotRef.current.scales.x
			if (uRangerRef.current && xScale?.min != null && xScale?.max != null) {
				renderRangerSelect(uRangerRef.current, xScale.min, xScale.max)
			}
		}
		window.addEventListener('resize', handleResize)
		const resizeObserver = new ResizeObserver(handleResize)
		resizeObserver.observe(chartRef.current)

		return () => {
			resizeObserver.disconnect()
			uPlotRef.current?.destroy()
			uPlotRef.current = null
			uRangerRef.current?.destroy()
			uRangerRef.current = null
			window.removeEventListener('resize', handleResize)
		}
	}, [plotData, color, hours])

	const handleZoom = useCallback((zoomHours) => {
		if (!uPlotRef.current || !uRangerRef.current || !plotData) return
		setActiveHours(zoomHours)
		const xVals = plotData[0]
		const max = xVals[xVals.length - 1]
		const min = zoomHours ? max - zoomHours * 3600 : xVals[0]
		uPlotRef.current.setScale('x', { min, max })
		renderRangerSelect(uRangerRef.current, min, max)
	}, [plotData])

	const handleExportPNG = useCallback(() => {
		const canvas = uPlotRef.current?.root.querySelector('canvas')
		if (!canvas) return
		const link = document.createElement('a')
		link.download = `acycliq-${exportPrefix}.png`
		link.href = canvas.toDataURL('image/png')
		link.click()
	}, [exportPrefix])

	return { chartRef, rangerRef, uPlotRef, activeHours, handleZoom, handleExportPNG }
}

export function xAxisConfig() {
	return {
		stroke: axisStroke(),
		grid: { show: false },
		space: 70,
		values: (u, vals) => vals.map(v => shortDateTimeFormatter(v * 1000))
	}
}
