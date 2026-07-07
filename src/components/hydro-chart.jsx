import { useCallback, useEffect, useState, useMemo } from 'preact/hooks'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchHydroStation, fetchHydroMeasures, fetchHydroThresholds } from '../lib/api.js'
import { buildHydroPlotData, applyThresholdsNgf } from '../lib/data-transform.js'
import { useChart, useDateRange, useAutoRefresh, xAxisConfig } from '../lib/hooks/use-chart.js'
import { CHART_HEIGHT, THRESHOLD_FALLBACK } from '../lib/theme.js'
import { refreshStart, refreshSuccess, refreshFailure } from '../lib/refresh-state.js'
import ChartControls from './chart-controls.jsx'
import Legend from './legend.jsx'
import RefreshStatus from './refresh-status.jsx'
import { LoadingState, ErrorState, EmptyState } from './chart-states.jsx'
import './chart.css'
import './hydro-chart.css'

const HydroChart = ({ config }) => {
	const [state, setState] = useState({ loading: true, error: null, refreshing: false, refreshError: null, measures: null, thresholds: [], stationInfo: null })
	const [seriesVisibility, setSeriesVisibility] = useState(new Map())

	const { apiUrl, token, idStation, color = '#0284C7', dataType = 4, hours = 3, ngf: useNgf = true, threshold: showThresholds = true, refresh = 5, startDate, endDate } = config

	const isHeight = dataType === 4
	const unit = isHeight ? 'm' : 'm³/s'

	const { startMs, getEndMs } = useDateRange(startDate, endDate)

	// Station metadata and thresholds are quasi-immutable and are fetched
	// exactly once per (station, dataType, showThresholds) combination —
	// never on the auto-refresh interval. This cuts the refresh traffic
	// from 3 calls down to 1 (measures only).
	useEffect(() => {
		let cancelled = false
		async function loadMeta() {
			try {
				const [stationInfo, thresholds] = await Promise.all([
					fetchHydroStation(apiUrl, token, idStation),
					showThresholds
						? fetchHydroThresholds(apiUrl, token, idStation)
						: Promise.resolve([])
				])
				if (cancelled) return
				const filteredThresholds = (thresholds || []).filter(th => String(th.dataType) === String(dataType))
				setState(s => ({ ...s, error: null, stationInfo, thresholds: filteredThresholds }))
			}
			catch (err) {
				if (cancelled) return
				setState(s => ({ ...s, loading: false, error: err.message }))
			}
		}
		loadMeta()
		return () => { cancelled = true }
	}, [apiUrl, token, idStation, dataType, showThresholds])

	// Measures are the only piece rebuilt on the refresh interval.
	const loadMeasures = useCallback(async () => {
		setState(refreshStart)
		try {
			const measures = await fetchHydroMeasures(apiUrl, token, {
				stationId: idStation,
				dataType,
				groupFunc: 'ALL',
				chartMode: true,
				startDate: startMs,
				endDate: getEndMs()
			})
			setState(s => refreshSuccess(s, measures))
		}
		catch (err) {
			setState(s => refreshFailure(s, err.message, Date.now()))
		}
	}, [apiUrl, token, idStation, dataType, startMs, getEndMs])

	useAutoRefresh(loadMeasures, refresh)

	const altSystems = state.stationInfo?.link_altimetrySystems || []
	const altitude = altSystems.length > 0 ? altSystems[0].altitude || 0 : 0
	const applyNgf = useNgf && isHeight && altitude > 0
	const yLabel = isHeight
		? (applyNgf ? 'Hauteur (m NGF)' : 'Hauteur (m)')
		: 'Débit (m³/s)'
	const thresholdUnit = applyNgf ? 'm NGF' : unit

	// When NGF is active, thresholds must be shifted by the station altitude
	// just like the measure curve — otherwise the seuil lines and their
	// displayed values wouldn't line up with the plotted heights. Computed
	// once here and reused for the plot data, the series and the legend.
	const displayThresholds = useMemo(
		() => applyThresholdsNgf(state.thresholds, altitude, applyNgf),
		[state.thresholds, altitude, applyNgf]
	)

	const plotData = useMemo(
		() => buildHydroPlotData(state.measures, altitude, useNgf, isHeight, displayThresholds),
		[state.measures, altitude, useNgf, isHeight, displayThresholds]
	)

	const thresholdsSeries = useMemo(() =>
		displayThresholds.map(th => ({
			label: th.name,
			stroke: th.htmlColor || THRESHOLD_FALLBACK,
			width: 2,
			dash: [8, 4],
			value: () => `${th.name} (${formaterNombreFr(th.value)} ${thresholdUnit})`,
			points: { show: false },
			show: true
		}))
	, [displayThresholds, thresholdUnit])

	const { chartRef, rangerRef, uPlotRef, activeHours, handleZoom, handleExportPNG } = useChart({
		plotData,
		hours,
		color,
		buildChartOpts: (chartWidth, initMin, initMax) => ({
			width: chartWidth,
			height: CHART_HEIGHT,
			scales: {
				x: { time: true, min: initMin, max: initMax },
				y: { auto: true }
			},
			axes: [
				xAxisConfig(),
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
			]
		}),
		formatTooltip: (u, idx) => {
			const xVal = u.data[0][idx]
			const yVal = u.data[1][idx]
			if (xVal == null || yVal == null) return null
			return `
				<div class="date">${fullDateTimeFormatter(new Date(xVal * 1000))}</div>
				<div class="value">${formaterNombreFr(yVal)} ${unit}</div>
			`
		},
		exportPrefix: `hydro-${idStation}`,
		onChartReady: () => {
			setSeriesVisibility(new Map(
				displayThresholds.map(th => [th.name, true])
			))
		}
	})

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

	const lastValue = plotData && plotData[1].length > 0
		? plotData[1][plotData[1].length - 1]
		: null
	const lastDate = plotData && plotData[0].length > 0
		? new Date(plotData[0][plotData[0].length - 1] * 1000)
		: null

	if (state.loading) {
		return <LoadingState />
	}

	if (state.error) {
		return <ErrorState message={state.error} />
	}

	if (!plotData || plotData[0].length === 0) {
		return <EmptyState />
	}

	return (
		<div className="acycliq-hydro">
			{state.stationInfo?.name && (
				<div className="acycliq-title">
					{state.stationInfo.name}
					<RefreshStatus
						refreshing={state.refreshing}
						refreshError={state.refreshError}
						onForceRefresh={loadMeasures}
					/>
				</div>
			)}

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
					thresholds={displayThresholds}
					unit={thresholdUnit}
					seriesVisibility={seriesVisibility}
					onToggle={toggleThreshold}
				/>
			)}
		</div>
	)
}

export default HydroChart
