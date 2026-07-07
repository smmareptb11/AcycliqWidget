import { useCallback, useEffect, useState, useMemo } from 'preact/hooks'
import UPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { formaterNombreFr } from '../lib/util/number.js'
import { fetchPluvioStation, fetchPluvioMeasures } from '../lib/api.js'
import { buildPluvioPlotData, computeWindowedCumul, pluvioBarLabel } from '../lib/data-transform.js'
import { useChart, useDateRange, useAutoRefresh, xAxisConfig, tooltipBaseRows } from '../lib/hooks/use-chart.js'
import { CHART_HEIGHT, FILL_ALPHA_SUFFIX, axisStroke } from '../lib/theme.js'
import { refreshStart, refreshSuccess, refreshFailure } from '../lib/refresh-state.js'
import ChartControls from './chart-controls.jsx'
import RefreshStatus from './refresh-status.jsx'
import { LoadingState, ErrorState, EmptyState } from './chart-states.jsx'
import './chart.css'
import './pluvio-chart.css'

const barSize = UPlot.paths.bars({ size: [0.8], align: 1 })

/**
 * Fonction de plage (range) pour les échelles uPlot qui doivent toujours démarrer
 * à 0 et ne jamais s'effondrer quand la fenêtre visible ne contient aucune donnée.
 * Utilisée comme config `range` sur les échelles pluie (`y`) et cumul, pour qu'uPlot
 * respecte nos appels explicites `setScale(min, max)` au lieu de les écraser
 * automatiquement.
 */
const nonNegativeAutoRange = (_u, dataMin, dataMax) => {
	if (dataMin == null || !Number.isFinite(dataMax)) return [0, 1]
	return [0, Math.max(dataMax, 1)]
}

/** Recalcule l'échelle y de la pluie (barres) pour s'ajuster aux valeurs de la fenêtre visible. */
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

/** Recalcule la série de cumul fenêtrée et met à jour son échelle en conséquence. */
function recomputeCumulScale(u, minX, maxX) {
	const xVals = u.data[0]
	const yVals = u.data[1]
	const { cumul: newCumul, max: cMax } = computeWindowedCumul(xVals, yVals, minX, maxX)
	u.setData([xVals, yVals, newCumul], false)
	u.setScale('cumul', { min: 0, max: cMax > 0 ? cMax : 1 })
}

const PluvioChart = ({ config }) => {
	const [state, setState] = useState({ loading: true, error: null, refreshing: false, refreshError: null, measures: null, stationInfo: null })

	const { apiUrl, token, idStation, color = '#0284C7', colorCumul = '#EA580C', hours = 3, cumul = true, groupFunc = 'all', refresh = 5, startDate, endDate } = config

	// SUM_DAY agrège la pluie par jour ; les autres modes gardent la cadence
	// horaire. Le libellé des barres doit refléter l'agrégation choisie.
	const barLabel = pluvioBarLabel(groupFunc)

	const { startMs, getEndMs } = useDateRange(startDate, endDate)

	// Les métadonnées de station sont quasi-immuables : récupérées une fois par
	// (station), jamais sur l'intervalle de rafraîchissement — même séparation que
	// le widget hydro. Elles n'alimentent que le titre affiché, donc un échec ne
	// doit pas faire tomber le graphe (fonctionnel) : on le journalise et on
	// retombe sur l'identifiant de la station comme titre.
	useEffect(() => {
		let cancelled = false
		fetchPluvioStation(apiUrl, token, idStation)
			.then(stationInfo => {
				if (!cancelled) setState(s => ({ ...s, stationInfo }))
			})
			.catch(err => {
				console.error(`Nom de la station pluviométrique ${idStation} indisponible :`, err)
				if (!cancelled) setState(s => ({ ...s, stationInfo: { name: `Station ${idStation}` } }))
			})
		return () => { cancelled = true }
	}, [apiUrl, token, idStation])

	const loadData = useCallback(async () => {
		setState(refreshStart)
		try {
			const measures = await fetchPluvioMeasures(apiUrl, token, {
				stationId: idStation,
				dataType: 1,
				groupFunc,
				chartMode: true,
				startDate: startMs,
				endDate: getEndMs(),
				distinctByCodePoint: true
			})

			setState(s => refreshSuccess(s, measures))
		}
		catch (err) {
			setState(s => refreshFailure(s, err.message, Date.now()))
		}
	}, [apiUrl, token, idStation, groupFunc, startMs, getEndMs])

	useAutoRefresh(loadData, refresh)

	const plotData = useMemo(() => {
		const base = buildPluvioPlotData(state.measures)
		if (!base) return null
		if (!cumul) return base
		// Emplacement réservé pour la série de cumul ; rempli dynamiquement par
		// onScaleChange selon la plage x actuellement visible.
		return [base[0], base[1], new Array(base[0].length).fill(null)]
	}, [state.measures, cumul])

	const handleScaleChange = useCallback((u, minX, maxX) => {
		// Les deux échelles doivent être redérivées de la fenêtre visible :
		// sinon l'auto-ranging d'uPlot les laisserait bloquées sur des valeurs
		// héritées d'un zoom précédent (plus large).
		recomputeYScale(u, minX, maxX)
		if (cumul) recomputeCumulScale(u, minX, maxX)
	}, [cumul])

	const { chartRef, rangerRef, activeHours, handleZoom, handleExportPNG } = useChart({
		plotData,
		hours,
		color,
		buildChartOpts: (chartWidth, initMin, initMax) => {
			const series = [
				{ label: 'Date' },
				{
					label: barLabel,
					stroke: color,
					fill: color + FILL_ALPHA_SUFFIX,
					width: 1,
					paths: barSize,
					points: { show: false },
					spanGaps: true
				}
			]

			const axes = [
				xAxisConfig(),
				{ label: 'pluviométrie (mm)', dir: -1, stroke: axisStroke() }
			]

			const scales = {
				x: { time: true, min: initMin, max: initMax },
				// `range` fait qu'uPlot respecte les appels setScale explicites de
				// handleScaleChange (auto:true les écraserait).
				y: { dir: -1, range: nonNegativeAutoRange }
			}

			if (cumul) {
				series.push({
					label: 'Cumul pluvio sur l\'intervalle',
					stroke: colorCumul,
					width: 2,
					scale: 'cumul',
					spanGaps: true,
					points: { show: false }
				})

				axes.push({
					label: 'pluviométrie cumulée (mm)',
					side: 1,
					scale: 'cumul',
					stroke: axisStroke(),
					grid: { show: false }
				})

				// Même stratégie `range` que l'échelle y : nécessaire pour que les
				// appels setScale explicites de recomputeCumulScale soient conservés.
				scales.cumul = { range: nonNegativeAutoRange }
			}

			return { width: chartWidth, height: CHART_HEIGHT, scales, axes, series }
		},
		formatTooltip: (u, idx) => {
			const xVal = u.data[0][idx]
			const yVal = u.data[1][idx]
			if (xVal == null || yVal == null) return null

			let html = tooltipBaseRows(xVal, yVal, 'mm')

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
		return <LoadingState />
	}

	if (state.error) {
		return <ErrorState message={state.error} />
	}

	if (!plotData || plotData[0].length === 0) {
		return <EmptyState />
	}

	return (
		<div className="acycliq-pluvio">
			{state.stationInfo?.name && (
				<div className="acycliq-title">
					{state.stationInfo.name}
					<RefreshStatus
						refreshing={state.refreshing}
						refreshError={state.refreshError}
						onForceRefresh={loadData}
					/>
				</div>
			)}

			<ChartControls activeHours={activeHours} onZoom={handleZoom} onExportPNG={handleExportPNG} />

			<div className="chart-wrapper">
				<div ref={chartRef} />
				<div ref={rangerRef} className="chart-ranger" />
			</div>

			<div className="pluvio-legend" role="list" aria-label="Légende pluviométrie">
				<span className="pluvio-legend-item" role="listitem">
					<span className="pluvio-legend-bar" style={{ backgroundColor: color }} aria-hidden="true" />
					<span>{barLabel} (mm)</span>
				</span>
				{cumul && (
					<span className="pluvio-legend-item" role="listitem">
						<span className="pluvio-legend-line" style={{ backgroundColor: colorCumul }} aria-hidden="true" />
						<span>Cumul pluvio sur l'intervalle (mm)</span>
					</span>
				)}
			</div>
		</div>
	)
}

export default PluvioChart
