import { toNgf, shouldApplyNgf } from './ngf.js'

/**
 * Prépare les mesures brutes pour uPlot : rejette une entrée absente/non-tableau,
 * trie par timestamp croissant et extrait l'axe x en secondes (l'API renvoie des
 * millisecondes). Garde et prétraitement partagés par les deux constructeurs.
 *
 * @param {Array<[number, number|null]>} measures
 * @returns {{ sorted: Array, xVals: number[] } | null}
 */
function prepareMeasures(measures) {
	if (!measures || !Array.isArray(measures)) return null
	const sorted = [...measures].sort((a, b) => a[0] - b[0])
	const xVals = sorted.map(d => d[0] / 1000)
	return { sorted, xVals }
}

/**
 * Décalage entre l'index d'un seuil et celui de sa série uPlot : la colonne 0
 * est l'axe x, la colonne 1 la courbe de mesure, les seuils suivent.
 *
 * Déclaré ici, auprès de la fonction qui décide de cette disposition : le
 * décalage en découle, et le nommer côté consommateur laisserait l'invariant
 * sans propriétaire.
 */
export const THRESHOLD_SERIES_OFFSET = 2

export function buildHydroPlotData(measures, altitude, useNgf, isHeight, thresholds) {
	const prepared = prepareMeasures(measures)
	if (!prepared) return null
	const { sorted, xVals } = prepared

	const applyNgf = shouldApplyNgf(useNgf, isHeight, altitude)

	const yVals = sorted.map(d => {
		const val = d[1]
		if (val == null) return null
		return applyNgf ? toNgf(val, altitude) : Number(val.toFixed(3))
	})

	const thresholdArrays = (thresholds || []).map(th =>
		Array(xVals.length).fill(th.value)
	)

	return [xVals, yVals, ...thresholdArrays]
}

/**
 * Index du dernier point réellement mesuré d'une colonne uPlot.
 *
 * Les séries hydro contiennent des trous (`null`, tracés avec `spanGaps: false`).
 * Lire directement la dernière case ferait disparaître la dernière valeur de
 * l'en-tête dès que la station n'a rien émis sur le dernier pas de temps, alors
 * qu'une valeur récente existe juste avant.
 *
 * @param {Array<number|null>} yVals
 * @returns {number} index du dernier point non nul, ou -1 s'il n'y en a aucun
 */
export function lastMeasuredIndex(yVals) {
	if (!yVals) return -1
	for (let i = yVals.length - 1; i >= 0; i--) {
		if (yVals[i] != null) return i
	}
	return -1
}

/**
 * Décale les valeurs de seuil de l'altitude de la station quand le NGF est actif,
 * pour que les lignes de seuil et leurs valeurs affichées s'alignent sur la courbe
 * de hauteur (elle aussi décalée). Quand le NGF ne s'applique pas, les valeurs
 * passent inchangées.
 *
 * @param {Array<{value: number}>} thresholds - seuils bruts issus de l'API
 * @param {number} altitude - altitude de la station (m)
 * @param {boolean} applyNgf - indique si la conversion NGF est active
 * @returns {Array<object>} seuils avec `value` ajustée (les autres champs conservés)
 */
export function applyThresholdsNgf(thresholds, altitude, applyNgf) {
	return (thresholds || []).map(th => ({
		...th,
		value: applyNgf ? toNgf(th.value, altitude) : th.value
	}))
}

/**
 * Libellé de la série de barres de pluie, reflétant l'agrégation choisie :
 * une somme journalière (`SUM_DAY`) cumule sur une journée, les autres modes
 * restent horaires.
 *
 * @param {string} groupFunc - 'all' | 'SUM_HOUR' | 'SUM_DAY'
 * @returns {string}
 */
export function pluvioBarLabel(groupFunc) {
	return groupFunc === 'SUM_DAY' ? 'Cumul pluvio / jour' : 'Cumul pluvio / 1h'
}

export function buildPluvioPlotData(measures) {
	const prepared = prepareMeasures(measures)
	if (!prepared) return null
	const { sorted, xVals } = prepared

	const yVals = sorted.map(d => {
		const val = d[1]
		return val != null && Number.isFinite(val) ? Number(val.toFixed(2)) : null
	})

	return [xVals, yVals]
}

/**
 * Calcule la somme cumulée de pluie restreinte à une fenêtre visible.
 *
 * Comportement :
 * - Les points hors de [minX, maxX] (bornes incluses) reçoivent `null`.
 * - Les points dans la fenêtre s'accumulent depuis 0, en repartant du premier
 *   point visible (chaque nouveau zoom affiche donc une courbe de cumul neuve).
 * - Un point `null` dans la fenêtre ne s'ajoute pas au total, mais reçoit en
 *   sortie l'accumulateur courant : la courbe de cumul reste plate sur un trou
 *   de mesure au lieu de retomber à null. Le premier point visible, s'il est
 *   null, vaut donc 0 : « 0 mm de pluie cumulés jusqu'ici ».
 * - Les valeurs sont arrondies à 2 décimales pour éviter la dérive des flottants.
 *
 * @param {number[]} xVals - timestamps x en secondes (triés croissants)
 * @param {Array<number|null>} yVals - valeurs de pluie (même longueur que xVals)
 * @param {number} minX - début de la fenêtre visible (secondes, incluse)
 * @param {number} maxX - fin de la fenêtre visible (secondes, incluse)
 * @returns {{ cumul: Array<number|null>, max: number }}
 */
export function computeWindowedCumul(xVals, yVals, minX, maxX) {
	const cumul = new Array(xVals.length).fill(null)
	let acc = 0
	let max = 0
	for (let i = 0; i < xVals.length; i++) {
		const x = xVals[i]
		if (x < minX || x > maxX) continue
		const v = yVals[i]
		if (v != null) acc += v
		cumul[i] = Number(acc.toFixed(2))
		if (acc > max) max = acc
	}
	return { cumul, max }
}
