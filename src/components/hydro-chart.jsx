import { useCallback, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchHydroStation, fetchHydroMeasures, fetchHydroThresholds } from '../lib/api.js'
import { buildHydroPlotData } from '../lib/data-transform.js'
import { useChart, useDateRange, useAutoRefresh, xAxisConfig } from '../lib/hooks/use-chart.js'
import ChartControls from './chart-controls.jsx'
import Legend from './legend.jsx'
import './hydro-chart.css'

const HydroChart = ({ config }) => {
	const [state, setState] = useState({ loading: true, error: null, measures: null, thresholds: [], stationInfo: null })
	const [seriesVisibility, setSeriesVisibility] = useState(new Map())

	const { apiUrl, token, idStation, color = '#007BFF', dataType = 4, hours = 3, ngf: useNgf = true, threshold: showThresholds = true, refresh = 5, startDate, endDate } = config

	const isHeight = dataType === 4
	const unit = isHeight ? 'm' : 'm³/s'

	const { startMs, endMs } = useDateRange(startDate, endDate)

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

	useAutoRefresh(loadData, refresh)

	const altSystems = state.stationInfo?.link_altimetrySystems || []
	const altitude = altSystems.length > 0 ? altSystems[0].altitude || 0 : 0
	const applyNgf = useNgf && isHeight && altitude > 0
	const yLabel = isHeight
		? (applyNgf ? 'Hauteur (m NGF)' : 'Hauteur (m)')
		: 'Débit (m³/s)'

	const plotData = useMemo(
		() => buildHydroPlotData(state.measures, altitude, useNgf, isHeight, state.thresholds),
		[state.measures, state.stationInfo, state.thresholds, useNgf, isHeight]
	)

	const thresholdsSeries = useMemo(() =>
		(state.thresholds || []).map(th => ({
			label: th.name,
			stroke: th.htmlColor || '#999',
			width: 2,
			dash: [8, 4],
			value: () => `${th.name} (${formaterNombreFr(th.value)} m)`,
			points: { show: false },
			show: true
		}))
	, [state.thresholds])

	const { chartRef, rangerRef, uPlotRef, activeHours, handleZoom, handleExportPNG } = useChart({
		plotData,
		hours,
		color,
		buildChartOpts: (chartWidth, initMin, initMax) => ({
			width: chartWidth,
			height: 300,
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
				(state.thresholds || []).map(th => [th.name, true])
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
