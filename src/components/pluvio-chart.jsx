import { useEffect, useRef, useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter, shortDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchPluvioMeasures } from '../lib/api.js'
import ChartControls from './chart-controls.jsx'
import './pluvio-chart.css'

const DEFAULT_CHART_HEIGHT = 300
const DEFAULT_RANGER_HEIGHT = 28
const RANGER_OFFSET = 100

const PluvioChart = ({ config }) => {
	const chartRef = useRef(null)
	const rangerRef = useRef(null)
	const uPlotRef = useRef(null)
	const uRangerRef = useRef(null)
	const [state, setState] = useState({ loading: true, error: null, measures: null })
	const [activeHours, setActiveHours] = useState(config.hours || 24)

	const { apiUrl, token, idStation, color = '#007BFF', hours = 3, cumul = true, refresh = 5, startDate, endDate } = config

	const startMs = useMemo(() => {
		if (startDate) return new Date(startDate).getTime()
		const d = new Date()
		d.setDate(d.getDate() - 30)
		d.setHours(0, 0, 0, 0)
		return d.getTime()
	}, [startDate])

	const endMs = useMemo(() => {
		if (endDate) return new Date(endDate).getTime()
		return Date.now()
	}, [endDate])

	const loadData = useCallback(async () => {
		try {
			const measures = await fetchPluvioMeasures(apiUrl, token, {
				stationId: idStation,
				dataType: 1,
				groupFunc: 'all',
				chartMode: true,
				startDate: startMs,
				endDate: endMs,
				distinctByCodePoint: true
			})

			setState({ loading: false, error: null, measures })
		} catch (err) {
			setState(s => ({ ...s, loading: false, error: err.message }))
		}
	}, [apiUrl, token, idStation, startMs, endMs])

	useEffect(() => {
		loadData()
		if (refresh > 0) {
			const interval = setInterval(loadData, refresh * 60 * 1000)
			return () => clearInterval(interval)
		}
	}, [loadData, refresh])

	const plotData = useMemo(() => {
		if (!state.measures || !Array.isArray(state.measures)) return null

		const sorted = [...state.measures].sort((a, b) => a[0] - b[0])
		const xVals = sorted.map(d => d[0] / 1000)
		const yVals = sorted.map(d => {
			const val = d[1]
			return val != null && Number.isFinite(val) ? Number(val.toFixed(2)) : null
		})

		if (cumul) {
			let acc = 0
			const cumulVals = yVals.map(v => {
				if (v != null) acc += v
				return Number(acc.toFixed(2))
			})
			return [xVals, yVals, cumulVals]
		}

		return [xVals, yVals]
	}, [state.measures, cumul])

	// Main chart + ranger — single useEffect
	useEffect(() => {
		if (!chartRef.current || !rangerRef.current || !plotData || !plotData[0].length) return

		const xVals = plotData[0]
		const hoursS = hours * 3600
		const initMax = xVals[xVals.length - 1]
		const initMin = initMax - hoursS

		// Destroy previous
		if (uPlotRef.current) {
			uPlotRef.current.destroy()
			uPlotRef.current = null
		}
		if (uRangerRef.current) {
			uRangerRef.current.destroy()
			uRangerRef.current = null
		}

		const chartWidth = chartRef.current.offsetWidth || 400

		const barSize = UPlot.paths.bars({ size: [0.8], align: 1 })

		const series = [
			{
				label: 'Date',
				value: (u, raw) => raw ? fullDateTimeFormatter(new Date(raw * 1000)) : '-'
			},
			{
				label: 'Cumul pluvio / 1h',
				stroke: color,
				fill: color + '80',
				width: 1,
				paths: barSize,
				points: { show: false },
				spanGaps: true,
				value: (u, v) => (v != null && !isNaN(v)) ? `${formaterNombreFr(v)} mm` : '-'
			}
		]

		const axes = [
			{
				stroke: '#666',
				grid: { show: false },
				space: 70,
				values: (u, vals) => vals.map(v => shortDateTimeFormatter(v * 1000))
			},
			{
				label: 'pluviométrie (mm)',
				dir: -1
			}
		]

		const scales = {
			x: { time: true, min: initMin, max: initMax },
			y: { auto: true, dir: -1 }
		}

		if (cumul && plotData.length > 2) {
			series.push({
				label: 'Cumul pluvio sur l\'intervalle',
				stroke: '#FF6B00',
				width: 2,
				scale: 'cumul',
				spanGaps: true,
				points: { show: false },
				value: (u, v) => (v != null && !isNaN(v)) ? `${formaterNombreFr(v)} mm` : '-'
			})

			axes.push({
				label: 'pluviométrie cumulée (mm)',
				side: 1,
				scale: 'cumul',
				grid: { show: false }
			})

			scales.cumul = { auto: true }
		}

		const opts = {
			width: chartWidth,
			height: DEFAULT_CHART_HEIGHT,
			scales,
			axes,
			series,
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
				setCursor: [
					u => {
						const tooltip = u.over._tooltip
						const { left, top, idx } = u.cursor

						if (idx == null || idx < 0 || idx >= u.data[0].length) {
							tooltip.style.display = 'none'
							return
						}

						const xVal = u.data[0][idx]
						const yVal = u.data[1][idx]

						if (xVal == null || yVal == null) {
							tooltip.style.display = 'none'
							return
						}

						let html = `
							<div class="date">${fullDateTimeFormatter(new Date(xVal * 1000))}</div>
							<div class="value">${formaterNombreFr(yVal)} mm</div>
						`

						if (cumul && u.data[2]) {
							const cumulVal = u.data[2][idx]
							if (cumulVal != null) {
								html += `<div class="value">Cumul sur l'intervalle : ${formaterNombreFr(cumulVal)} mm</div>`
							}
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
						const left = Math.round(uRanger.valToPos(initMin, 'x'))
						const width = Math.round(uRanger.valToPos(initMax, 'x')) - left
						const height = uRanger.bbox.height
						uRanger.setSelect({ left, width, height }, false)

						const debounce = fn => {
							let raf
							return (...args) => {
								if (raf) return
								raf = requestAnimationFrame(() => { fn(...args); raf = null })
							}
						}
						const on = (ev, el, fn) => el.addEventListener(ev, fn)
						const off = (ev, el, fn) => el.removeEventListener(ev, fn)
						const placeDiv = cls => {
							const el = document.createElement('div')
							el.classList.add(cls)
							selector.appendChild(el)
							return el
						}

						let x0, lft0, wid0

						function update(newLft, newWid) {
							const newRgt = newLft + newWid
							const maxRgt = uRanger.bbox.width
							const minWidth = 10

							if (newLft >= 0 && newRgt <= maxRgt && newWid >= minWidth) {
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
							const _onMove = debounce(evt => onMove(evt.clientX - x0))
							const _onUp = () => {
								off('mousemove', document, _onMove)
								off('mouseup', document, _onUp)
							}
							on('mousemove', document, _onMove)
							on('mouseup', document, _onUp)
							e.stopPropagation()
						}

						const selector = uRanger.root.querySelector('.u-select')
						placeDiv('u-grip-l')
						placeDiv('u-grip-r')
						on('mousedown', selector, e => bindMove(e, diff => update(lft0 + diff, wid0)))
						const gripL = selector.querySelector('.u-grip-l')
						const gripR = selector.querySelector('.u-grip-r')
						on('mousedown', gripL, e => bindMove(e, diff => update(lft0 + diff, wid0 - diff)))
						on('mousedown', gripR, e => bindMove(e, diff => update(lft0, wid0 + diff)))
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

		// Resize handler
		const handleResize = () => {
			if (!chartRef.current) return
			const w = chartRef.current.offsetWidth || 400
			uPlotRef.current?.setSize({ width: w, height: DEFAULT_CHART_HEIGHT })
			uRangerRef.current?.setSize({ width: w - RANGER_OFFSET, height: DEFAULT_RANGER_HEIGHT })
		}
		window.addEventListener('resize', handleResize)

		return () => {
			uPlotRef.current?.destroy()
			uPlotRef.current = null
			uRangerRef.current?.destroy()
			uRangerRef.current = null
			window.removeEventListener('resize', handleResize)
		}
	}, [plotData])

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
		link.download = `acycliq-pluvio-${idStation}.png`
		link.href = canvas.toDataURL('image/png')
		link.click()
	}, [idStation])

	if (state.loading) {
		return <div className="acycliq-loading">Chargement...</div>
	}

	if (state.error) {
		return <div className="acycliq-error">Erreur : {state.error}</div>
	}

	if (!plotData || plotData[0].length === 0) {
		return <div className="acycliq-empty">Aucune donnée disponible</div>
	}

	return (
		<div className="acycliq-pluvio">
			<ChartControls activeHours={activeHours} onZoom={handleZoom} onExportPNG={handleExportPNG} />

			<div className="chart-wrapper">
				<div ref={chartRef} />
				<div ref={rangerRef} className="chart-ranger" />
			</div>

			<div className="pluvio-legend" role="list" aria-label="Légende pluviométrie">
				<span className="pluvio-legend-item" role="listitem">
					<span className="pluvio-legend-bar" style={{ backgroundColor: color }} aria-hidden="true" />
					<span>Cumul pluvio / 1h (mm)</span>
				</span>
				{cumul && (
					<span className="pluvio-legend-item" role="listitem">
						<span className="pluvio-legend-line" aria-hidden="true" />
						<span>Cumul pluvio sur l'intervalle (mm)</span>
					</span>
				)}
			</div>
		</div>
	)
}

export default PluvioChart
