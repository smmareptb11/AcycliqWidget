import { useEffect, useRef, useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import { shortDateTimeFormatter } from '../util/date.js'

const DEFAULT_CHART_HEIGHT = 300
const DEFAULT_RANGER_HEIGHT = 28
const RANGER_OFFSET = 100

/**
 * Measure the available width of a container without being inflated
 * by its uPlot child canvas. Temporarily collapses the uPlot root
 * so offsetWidth reflects the parent constraint, not the canvas.
 */
function measureWidth(containerEl) {
	const uWrap = containerEl.querySelector('.uplot')
	if (uWrap) {
		const prev = uWrap.style.width
		uWrap.style.width = '0'
		const w = containerEl.offsetWidth
		uWrap.style.width = prev
		return w || 400
	}
	return containerEl.offsetWidth || 400
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
 * Shared chart hook: handles uPlot + ranger lifecycle, tooltip, resize, zoom, export.
 *
 * @param {object} opts
 * @param {Array} opts.plotData - uPlot data arrays [xVals, yVals, ...]
 * @param {number} opts.hours - initial visible window in hours
 * @param {string} opts.color - primary series color (used for ranger)
 * @param {Function} opts.buildChartOpts - (chartWidth, initMin, initMax) => { width, height, scales, axes, series }
 * @param {Function} opts.formatTooltip - (uPlot, idx) => HTML string or null
 * @param {string} opts.exportPrefix - filename prefix for PNG export
 * @param {Function} [opts.onChartReady] - called with uPlot instance after creation
 * @param {Function} [opts.onScaleChange] - (u, min, max) called whenever x-scale changes (init, zoom, ranger drag)
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

		// Destroy previous
		if (uPlotRef.current) { uPlotRef.current.destroy(); uPlotRef.current = null }
		if (uRangerRef.current) { uRangerRef.current.destroy(); uRangerRef.current = null }

		const chartWidth = measureWidth(chartRef.current)

		// Build chart-specific options, then merge shared config
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
						// Defer: uPlot may not yet have committed the new scale
						// when this hook fires, and any nested setScale/setData
						// calls would race against the outer scale update.
						// queueMicrotask runs after the current setScale completes.
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
			series: [{}, { stroke: color, width: 1, fill: color, fillAlpha: 0.1 }],
			cursor: { x: false, y: false, points: { show: false }, drag: { setScale: false, setSelect: true, x: true, y: false } },
			legend: { show: false },
			select: { show: true },
			hooks: {
				ready: [
					uRanger => {
						const lPos = Math.round(uRanger.valToPos(initMin, 'x'))
						const wPos = Math.round(uRanger.valToPos(initMax, 'x')) - lPos
						uRanger.setSelect({ left: lPos, width: wPos, height: uRanger.bbox.height }, false)

						const debounce = fn => {
							let raf
							return (...args) => {
								if (raf) return
								raf = requestAnimationFrame(() => { fn(...args); raf = null })
							}
						}
						const on = (ev, el, fn) => el.addEventListener(ev, fn)
						const off = (ev, el, fn) => el.removeEventListener(ev, fn)

						let x0, lft0, wid0

						function update(newLft, newWid) {
							const newRgt = newLft + newWid
							const maxRgt = uRanger.bbox.width
							if (newLft >= 0 && newRgt <= maxRgt && newWid >= 10) {
								uRanger.setSelect({ left: newLft, width: newWid, height: uRanger.bbox.height }, false)
								const min = uRanger.posToVal(newLft, 'x')
								const max = uRanger.posToVal(newLft + newWid, 'x')
								uPlotRef.current.setScale('x', { min, max })
							}
						}

						function bindMove(e, onMove) {
							x0 = e.clientX
							lft0 = uRanger.select.left
							wid0 = uRanger.select.width
							// Pointer Events unifient souris/tactile/stylet ; capture pour fiabiliser le suivi hors de l'élément
							try { e.target.setPointerCapture(e.pointerId) }
							catch { /* pointeur déjà relâché */ }
							const _onMove = debounce(evt => onMove(evt.clientX - x0))
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

						on('pointerdown', selector, e => bindMove(e, diff => update(lft0 + diff, wid0)))
						on('pointerdown', gripL, e => bindMove(e, diff => update(lft0 + diff, wid0 - diff)))
						on('pointerdown', gripR, e => bindMove(e, diff => update(lft0, wid0 + diff)))
					}
				],
				setSelect: [
					u => {
						const { left, width: selWidth } = u.select
						const min = u.posToVal(left, 'x')
						const max = u.posToVal(left + selWidth, 'x')
						uPlotRef.current.setScale('x', { min, max })
					}
				]
			}
		}

		uRangerRef.current = new UPlot(rangerOpts, [plotData[0], plotData[1]], rangerRef.current)

		// Reflow to the container width. Also runs when the container is resized
		// without a window resize (iframe reflow, orientation change, late layout on mobile).
		const handleResize = () => {
			if (!chartRef.current || !uPlotRef.current) return
			const w = measureWidth(chartRef.current)
			if (w <= 0) return
			uPlotRef.current.setSize({ width: w, height: DEFAULT_CHART_HEIGHT })
			uRangerRef.current?.setSize({ width: w - RANGER_OFFSET, height: DEFAULT_RANGER_HEIGHT })
			// Réaligne la fenêtre du ranger sur l'échelle x courante (les positions en px changent avec la largeur)
			const xScale = uPlotRef.current.scales.x
			if (uRangerRef.current && xScale?.min != null && xScale?.max != null) {
				const left = Math.round(uRangerRef.current.valToPos(xScale.min, 'x'))
				const width = Math.round(uRangerRef.current.valToPos(xScale.max, 'x')) - left
				uRangerRef.current.setSelect({ left, width, height: uRangerRef.current.bbox.height }, false)
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

		const left = Math.round(uRangerRef.current.valToPos(min, 'x'))
		const width = Math.round(uRangerRef.current.valToPos(max, 'x')) - left
		uRangerRef.current.setSelect({ left, width, height: uRangerRef.current.bbox.height }, false)
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
		stroke: '#666',
		grid: { show: false },
		space: 70,
		values: (u, vals) => vals.map(v => shortDateTimeFormatter(v * 1000))
	}
}
