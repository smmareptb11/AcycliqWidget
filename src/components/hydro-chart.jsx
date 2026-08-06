import { useCallback, useEffect, useState, useMemo } from 'preact/hooks'
import 'uplot/dist/uPlot.min.css'
import { fullDateTimeFormatter } from '../lib/util/date.js'
import { formaterNombreFr } from '../lib/util/number.js'
import { buildExportName } from '../lib/util/download.js'
import { fetchHydroStation, fetchHydroMeasures, fetchHydroThresholds } from '../lib/api.js'
import { buildHydroPlotData, applyThresholdsNgf, THRESHOLD_SERIES_OFFSET } from '../lib/data-transform.js'
import { shouldApplyNgf } from '../lib/ngf.js'
import {
	normalizeCategoryKeys,
	filterByCategories,
	withVisibility,
	isThresholdVisible,
	seriesStyleOf,
	thresholdColor,
	categoryOptionSignature,
	thresholdKey
} from '../lib/threshold-categories.js'
import { useChart, useDateRange, useAutoRefresh, xAxisConfig, tooltipBaseRows } from '../lib/hooks/use-chart.js'
import { CHART_HEIGHT, axisStroke } from '../lib/theme.js'
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

	const { apiUrl, token, idStation, color = '#0284C7', dataType = 4, hours = 3, ngf: useNgf = true, threshold: showThresholds = true, thresholdCategories, thresholdCategoriesDefault, refresh = 5, startDate, endDate } = config

	const isHeight = dataType === 4
	const unit = isHeight ? 'm' : 'm³/s'

	// Les options de catégories arrivent sous forme de tableaux, dont l'identité
	// change à chaque rendu si l'hôte passe un littéral. Mémoïser sur une
	// signature textuelle évite de recalculer — et de réinitialiser les
	// visibilités — sans changement réel.
	const availableSignature = categoryOptionSignature(thresholdCategories)
	const defaultSignature = categoryOptionSignature(thresholdCategoriesDefault)

	const availableKeys = useMemo(() => normalizeCategoryKeys(thresholdCategories), [availableSignature])
	const defaultKeys = useMemo(() => normalizeCategoryKeys(thresholdCategoriesDefault), [defaultSignature])

	const { startMs, getEndMs } = useDateRange(startDate, endDate)

	// Les métadonnées de station et les seuils sont quasi-immuables et sont
	// récupérés exactement une fois par combinaison (station, dataType,
	// showThresholds) — jamais sur l'intervalle de rafraîchissement automatique.
	// Cela réduit le trafic de rafraîchissement de 3 appels à 1 (mesures seules).
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

	// Les mesures sont la seule partie reconstruite sur l'intervalle de rafraîchissement.
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

	const altitude = state.stationInfo?.link_altimetrySystems?.[0]?.altitude || 0
	const applyNgf = shouldApplyNgf(useNgf, isHeight, altitude)
	const yLabel = isHeight
		? (applyNgf ? 'Hauteur (m NGF)' : 'Hauteur (m)')
		: 'Débit (m³/s)'
	const thresholdUnit = applyNgf ? 'm NGF' : unit

	// Quand le NGF est actif, les seuils doivent être décalés de l'altitude de la
	// station, tout comme la courbe de mesure — sinon les lignes de seuil et leurs
	// valeurs affichées ne s'aligneraient pas avec les hauteurs tracées. Calculés
	// une fois ici et réutilisés pour les données du graphe, les séries et la légende.
	//
	// Le filtre par catégorie s'applique APRÈS le recalage NGF, pour que celui-ci
	// reste appliqué uniformément. Les seuils écartés ne deviennent ni colonne de
	// plotData ni série uPlot : c'est ce filtre unique qui garantit que les deux
	// restent alignés index par index.
	const displayThresholds = useMemo(
		() => filterByCategories(applyThresholdsNgf(state.thresholds, altitude, applyNgf), availableKeys),
		[state.thresholds, altitude, applyNgf, availableKeys]
	)

	const plotData = useMemo(
		() => buildHydroPlotData(state.measures, altitude, useNgf, isHeight, displayThresholds),
		[state.measures, altitude, useNgf, isHeight, displayThresholds]
	)

	// L'état de visibilité n'est réinitialisé que lorsque l'ensemble des seuils
	// change (nouvelle station, changement de dataType ou de catégories
	// proposées), et surtout pas à chaque reconstruction du graphe : useChart
	// détruit et recrée l'instance uPlot à chaque rafraîchissement des mesures
	// (toutes les 5 min par défaut). Accrocher cette réinitialisation à la
	// construction du graphe rallumerait les seuils masqués à chaque cycle.
	const thresholdsSignature = displayThresholds.map((th, i) => thresholdKey(th, i)).join('|')

	// Signature des clés normalisées, et non de l'option brute : deux écritures
	// différentes de la même intention — ordre permuté, doublon, valeur ignorée —
	// donnent la même liste effective et ne doivent pas jeter les choix du
	// visiteur. `defaultSignature` (l'option brute) les distinguerait à tort.
	const defaultKeysSignature = defaultKeys.join('|')

	// Purge les choix du visiteur, sans rien pré-remplir : une Map vide fait
	// retomber chaque seuil sur sa catégorie par défaut via isThresholdVisible,
	// seul propriétaire de cette règle.
	useEffect(() => {
		setSeriesVisibility(new Map())
	}, [thresholdsSignature, defaultKeysSignature])

	const thresholdsSeries = useMemo(() =>
		displayThresholds.map((th, i) => {
			const style = seriesStyleOf(th)
			return {
				label: th.name,
				stroke: thresholdColor(th),
				width: style.width,
				// Copie : le style est figé et partagé par toutes les instances de
				// widget, on ne transmet pas nos constantes telles quelles à uPlot.
				dash: [...style.dash],
				points: { show: false },
				// Lu à chaque (re)construction du graphe via le ref buildChartOpts :
				// c'est ce qui fait survivre un seuil masqué au rafraîchissement.
				show: isThresholdVisible(th, i, seriesVisibility, defaultKeys)
			}
		})
	, [displayThresholds, seriesVisibility, defaultKeys])

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
				{ label: yLabel, stroke: axisStroke() }
			],
			series: [
				{ label: 'Date' },
				{
					label: yLabel,
					stroke: color,
					spanGaps: false,
					width: 2
				},
				...thresholdsSeries
			]
		}),
		formatTooltip: (u, idx) => {
			const xVal = u.data[0][idx]
			const yVal = u.data[1][idx]
			if (xVal == null || yVal == null) return null
			return tooltipBaseRows(xVal, yVal, unit)
		},
		exportPrefix: buildExportName('hydro', state.stationInfo?.name, state.stationInfo?.code ?? idStation)
	})

	// Aligne l'instance uPlot sur l'état Preact, pour les changements de
	// visibilité qui ne reconstruisent pas le graphe.
	//
	// Deux chemins écrivent `show` sur l'instance, et il faut les garder
	// cohérents :
	//  1. la (re)construction, où useChart relit `thresholdsSeries` via le ref
	//     buildChartOpts — mais son effet ne dépend que de [plotData, color, hours] ;
	//  2. cet effet, pour tout le reste — un seuil masqué ne change pas plotData,
	//     donc rien ne serait redessiné sans lui.
	//
	// L'ordre compte : cet effet est déclaré APRÈS l'appel à useChart, il s'exécute
	// donc après celui qui crée ou détruit l'instance. Déplacer l'un des deux ferait
	// écrire sur une instance en cours de destruction.
	useEffect(() => {
		const u = uPlotRef.current
		if (!u) return
		thresholdsSeries.forEach((serie, i) => {
			const seriesIdx = i + THRESHOLD_SERIES_OFFSET
			if (seriesIdx >= u.series.length) return
			if (u.series[seriesIdx].show !== serie.show) u.setSeries(seriesIdx, { show: serie.show })
		})
	}, [thresholdsSeries])

	// Bascule par index plutôt que par recherche sur le label : l'API renvoie des
	// seuils homonymes (id non uniques d'un dataType à l'autre), et l'ordre des
	// séries est aligné sur displayThresholds par construction.
	//
	// L'état à inverser est lu dans `prev`, et non dans la variable capturée par
	// le rendu : deux bascules émises dans le même tick liraient sinon la même
	// Map périmée, et la seconde écraserait la première.
	const toggleThreshold = useCallback((index) => {
		const threshold = displayThresholds[index]
		if (!threshold) return
		setSeriesVisibility(prev => withVisibility(
			prev,
			[{ threshold, index }],
			!isThresholdVisible(threshold, index, prev, defaultKeys)
		))
	}, [displayThresholds, defaultKeys])

	// Bascule tout un groupe de catégorie. C'est la légende qui décide de `next`,
	// à partir de l'état déduit du groupe : entièrement visible → tout masquer,
	// sinon → tout afficher (un groupe panaché se complète donc au premier clic).
	//
	// Une seule écriture pour tout le groupe : enchaîner un setState par seuil
	// provoquerait autant de rendus.
	const toggleCategory = useCallback((items, next) => {
		setSeriesVisibility(prev => withVisibility(prev, items, next))
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
					defaultKeys={defaultKeys}
					onToggle={toggleThreshold}
					onToggleCategory={toggleCategory}
				/>
			)}
		</div>
	)
}

export default HydroChart
