import { useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchPluvioMeasures } from '../lib/api.js'
import { buildPluvioPlotData, computeWindowedCumul } from '../lib/data-transform.js'
import { useChart, useDateRange, useAutoRefresh, xAxisConfig } from '../lib/hooks/use-chart.js'
import ChartControls from './chart-controls.jsx'
import './pluvio-chart.css'

const barSize = UPlot.paths.bars({ size: [0.8], align: 1 })

/**
 * Range function for uPlot scales that should always start at 0 and never
 * collapse when the visible window contains no data. Used as the `range`
 * config on both the rainfall (`y`) and cumul scales so that uPlot honors
 * our explicit `setScale(min, max)` calls instead of auto-overriding them.
 */
const nonNegativeAutoRange = (_u, dataMin, dataMax) => {
	if (dataMin == null || !Number.isFinite(dataMax)) return [0, 1]
	return [0, Math.max(dataMax, 1)]
}

/** Recompute the rainfall (bars) y scale to fit values in the visible window. */
function recomputeYScale(u, minX, maxX) {
	const xVals = u.data[0]
	const yVals = u.data[1]
	let yMax = 0
	for (let i = 0; i < xVals.length; i++) {
		if (xVals[i] < minX || xVals[i] > maxX) continue
		const v = yVals[i]
		if (v != null && v > yMax) yMax = v
	}
	u.setScale('y', { min: 0, max: yMax > 0 ? yMax * 1.1 : 1 })
}

/** Recompute the windowed cumul series and update its scale to match. */
function recomputeCumulScale(u, minX, maxX) {
	const xVals = u.data[0]
	const yVals = u.data[1]
	const { cumul: newCumul, max: cMax } = computeWindowedCumul(xVals, yVals, minX, maxX)
	u.setData([xVals, yVals, newCumul], false)
	u.setScale('cumul', { min: 0, max: cMax > 0 ? cMax : 1 })
}

const PluvioChart = ({ config }) => {
	const [state, setState] = useState({ loading: true, error: null, measures: null })

	const { apiUrl, token, idStation, color = '#007BFF', hours = 3, cumul = true, refresh = 5, startDate, endDate } = config

	const { startMs, getEndMs } = useDateRange(startDate, endDate)

	const loadData = useCallback(async () => {
		try {
			const measures = await fetchPluvioMeasures(apiUrl, token, {
				stationId: idStation,
				dataType: 1,
				groupFunc: 'all',
				chartMode: true,
				startDate: startMs,
				endDate: getEndMs(),
				distinctByCodePoint: true
			})

			setState({ loading: false, error: null, measures })
		}
		catch (err) {
			setState(s => ({ ...s, loading: false, error: err.message }))
		}
	}, [apiUrl, token, idStation, startMs, getEndMs])

	useAutoRefresh(loadData, refresh)

	const plotData = useMemo(() => {
		const base = buildPluvioPlotData(state.measures)
		if (!base) return null
		if (!cumul) return base
		// Placeholder for the cumul series; filled dynamically by onScaleChange
		// based on the currently visible x-range.
		return [base[0], base[1], new Array(base[0].length).fill(null)]
	}, [state.measures, cumul])

	const handleScaleChange = useCallback((u, minX, maxX) => {
		// Both scales must be re-derived from the visible window: uPlot's
		// auto-ranging would otherwise leave them stuck on values inherited
		// from a previous (wider) zoom.
		recomputeYScale(u, minX, maxX)
		if (cumul) recomputeCumulScale(u, minX, maxX)
	}, [cumul])

	const { chartRef, rangerRef, activeHours, handleZoom, handleExportPNG } = useChart({
		plotData,
		hours,
		color,
		buildChartOpts: (chartWidth, initMin, initMax) => {
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
				xAxisConfig(),
				{ label: 'pluviométrie (mm)', dir: -1 }
			]

			const scales = {
				x: { time: true, min: initMin, max: initMax },
				// `range` makes uPlot honor explicit setScale calls from
				// handleScaleChange (auto:true would override them).
				y: { dir: -1, range: nonNegativeAutoRange }
			}

			if (cumul) {
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

				// Same `range` strategy as the y scale: needed so that
				// recomputeCumulScale's explicit setScale calls stick.
				scales.cumul = { range: nonNegativeAutoRange }
			}

			return { width: chartWidth, height: 300, scales, axes, series }
		},
		formatTooltip: (u, idx) => {
			const xVal = u.data[0][idx]
			const yVal = u.data[1][idx]
			if (xVal == null || yVal == null) return null

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

			return html
		},
		exportPrefix: `pluvio-${idStation}`,
		onScaleChange: handleScaleChange
	})

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
