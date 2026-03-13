import { useEffect, useRef, useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter, shortDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchHydroStation, fetchHydroMeasures, fetchHydroThresholds } from '../lib/api.js'
import { toNgf } from '../lib/ngf.js'
import ChartControls from './chart-controls.jsx'
import Legend from './legend.jsx'
import './hydro-chart.css'

const DEFAULT_CHART_HEIGHT = 300
const DEFAULT_RANGER_HEIGHT = 28
const RANGER_OFFSET = 100

const HydroChart = ({ config }) => {
	const chartRef = useRef(null)
	const rangerRef = useRef(null)
	const uPlotRef = useRef(null)
	const uRangerRef = useRef(null)
	const [state, setState] = useState({ loading: true, error: null, measures: null, thresholds: [], stationInfo: null })
	const [seriesVisibility, setSeriesVisibility] = useState(new Map())
	const [activeHours, setActiveHours] = useState(config.hours || 24)

	const { apiUrl, token, idStation, color = '#007BFF', dataType = 4, hours = 3, ngf: useNgf = true, threshold: showThresholds = true, refresh = 5, startDate, endDate } = config

	const isHeight = dataType === 4
	const unit = isHeight ? 'm' : 'm³/s'

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
			const [stationInfo, measures, thresholds] = await Promise.all([
				fetchHydroStation(apiUrl, token, idStation),
				fetchHydroMeasures(apiUrl, token, {
					stationId: idStation,
					dataType,
					groupFunc: 'ALL',
					chartMode: true,
					startDate: startMs,
					endDate: endMs
				}),
				showThresholds
					? fetchHydroThresholds(apiUrl, token, idStation)
					: Promise.resolve([])
			])

			const filteredThresholds = (thresholds || []).filter(th => String(th.dataType) === String(dataType))
			setState({ loading: false, error: null, measures, thresholds: filteredThresholds, stationInfo })
		} catch (err) {
			setState(s => ({ ...s, loading: false, error: err.message }))
		}
	}, [apiUrl, token, idStation, dataType, showThresholds, startMs, endMs])

	useEffect(() => {
		loadData()
		if (refresh > 0) {
			const interval = setInterval(loadData, refresh * 60 * 1000)
			return () => clearInterval(interval)
		}
	}, [loadData, refresh])

	const plotData = useMemo(() => {
		if (!state.measures || !Array.isArray(state.measures)) return null

		const altSystems = state.stationInfo?.link_altimetrySystems || []
		const altitude = altSystems.length > 0 ? altSystems[0].altitude || 0 : 0
		const applyNgf = useNgf && isHeight && altitude > 0

		const sorted = [...state.measures].sort((a, b) => a[0] - b[0])
		const xVals = sorted.map(d => d[0] / 1000)
		const yVals = sorted.map(d => {
			const val = d[1]
			if (val == null) return null
			return applyNgf ? toNgf(val, altitude) : Number(val.toFixed(3))
		})

		const thresholdArrays = (state.thresholds || []).map(th =>
			Array(xVals.length).fill(th.value)
		)

		return [xVals, yVals, ...thresholdArrays]
	}, [state.measures, state.stationInfo, state.thresholds, useNgf, isHeight])

	// Main chart + ranger — single useEffect, like debiclic
	useEffect(() => {
		if (!chartRef.current || !rangerRef.current || !plotData || !plotData[0].length) return

		const xVals = plotData[0]
		const hoursS = hours * 3600
		const initMax = xVals[xVals.length - 1]
		const initMin = initMax - hoursS

		const altSystems = state.stationInfo?.link_altimetrySystems || []
		const altitude = altSystems.length > 0 ? altSystems[0].altitude || 0 : 0
		const applyNgf = useNgf && isHeight && altitude > 0
		const yLabel = isHeight
			? (applyNgf ? 'Hauteur (m NGF)' : 'Hauteur (m)')
			: 'Débit (m³/s)'

		const thresholdsSeries = (state.thresholds || []).map(th => ({
			label: th.name,
			stroke: th.htmlColor || '#999',
			width: 2,
			dash: [8, 4],
			value: () => `${th.name} (${formaterNombreFr(th.value)} m)`,
			points: { show: false },
			show: true
		}))

		// Destroy previous instances
		if (uPlotRef.current) {
			uPlotRef.current.destroy()
			uPlotRef.current = null
		}
		if (uRangerRef.current) {
			uRangerRef.current.destroy()
			uRangerRef.current = null
		}

		const chartWidth = chartRef.current.offsetWidth || 400

		// --- Main chart ---
		const opts = {
			width: chartWidth,
			height: DEFAULT_CHART_HEIGHT,
			scales: {
				x: { time: true, min: initMin, max: initMax },
				y: { auto: true }
			},
			axes: [
				{
					stroke: '#666',
					grid: { show: false },
					space: 70,
					values: (u, vals) => vals.map(v => shortDateTimeFormatter(v * 1000))
				},
				{ label: yLabel }
			],
			series: [
				{
					label: 'Date',
					value: (u, raw) => raw ? fullDateTimeFormatter(new Date(raw * 1000)) : '-'
				},
				{
					label: yLabel,
					stroke: color,
					spanGaps: false,
					width: 2,
					value: (u, v) => (v != null && !isNaN(v)) ? `${formaterNombreFr(v)} ${unit}` : '-'
				},
				...thresholdsSeries
			],
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

						tooltip.style.display = 'block'
						tooltip.innerHTML = `
							<div class="date">${fullDateTimeFormatter(new Date(xVal * 1000))}</div>
							<div class="value">${formaterNombreFr(yVal)} ${unit}</div>
						`

						const bbox = u.over.getBoundingClientRect()
						let pageX = left + bbox.left + 10
						let pageY = top + bbox.top + 10
						if (pageX + 160 > window.innerWidth) pageX -= 170
						if (pageY + 50 > window.innerHeight) pageY -= 60
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

		// Init visibility
		setSeriesVisibility(new Map(
			(state.thresholds || []).map(th => [th.name, true])
		))

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

		// Sync ranger selection
		const left = Math.round(uRangerRef.current.valToPos(min, 'x'))
		const width = Math.round(uRangerRef.current.valToPos(max, 'x')) - left
		uRangerRef.current.setSelect({ left, width, height: uRangerRef.current.bbox.height }, false)
	}, [plotData])

	const handleExportPNG = useCallback(() => {
		const canvas = uPlotRef.current?.root.querySelector('canvas')
		if (!canvas) return
		const link = document.createElement('a')
		link.download = `acycliq-hydro-${idStation}.png`
		link.href = canvas.toDataURL('image/png')
		link.click()
	}, [idStation])

	const toggleThreshold = useCallback((name) => {
		if (!uPlotRef.current) return
		const idx = uPlotRef.current.series.findIndex(s => s.label === name)
		if (idx > -1) {
			uPlotRef.current.setSeries(idx, { show: !uPlotRef.current.series[idx].show })
			setSeriesVisibility(prev => {
				const next = new Map(prev)
				next.set(name, !prev.get(name))
				return next
			})
		}
	}, [])

	// Last value
	const lastValue = plotData && plotData[1].length > 0
		? plotData[1][plotData[1].length - 1]
		: null
	const lastDate = plotData && plotData[0].length > 0
		? new Date(plotData[0][plotData[0].length - 1] * 1000)
		: null

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
		<div className="acycliq-hydro">
			<div className="acycliq-header">
				{lastValue != null && (
					<span className="last-value">
						{formaterNombreFr(lastValue)} {unit}
						{lastDate && <span className="last-date"> — {fullDateTimeFormatter(lastDate)}</span>}
					</span>
				)}
			</div>

			<ChartControls activeHours={activeHours} onZoom={handleZoom} onExportPNG={handleExportPNG} />

			<div className="chart-wrapper">
				<div ref={chartRef} />
				<div ref={rangerRef} className="chart-ranger" />
			</div>

			{showThresholds && (
				<Legend
					thresholds={state.thresholds}
					seriesVisibility={seriesVisibility}
					onToggle={toggleThreshold}
				/>
			)}
		</div>
	)
}

export default HydroChart
