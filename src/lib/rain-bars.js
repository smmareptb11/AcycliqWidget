/**
 * Préparation des mesures de pluie pour un tracé en hyétogramme : un pas
 * régulier, une barre par période, chaque instant marquant le début de sa
 * période. C'est la convention de l'API Acycliq, relevée sur la station 719 :
 *
 * - le cumul horaire daté de 14 h est la somme des mesures brutes de 14 h 00 à
 *   14 h 55 : une mesure appartient à la période qui commence à son instant ;
 * - le cumul journalier couvre la journée calendaire à Paris, mais il est daté
 *   de midi.
 */

const HOUR = 3600
const DAY = 24 * HOUR

const parisClock = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'Europe/Paris',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric',
	hourCycle: 'h23'
})

function parisSecondsSinceMidnight(t) {
	const parts = Object.fromEntries(parisClock.formatToParts(new Date(t * 1000)).map(p => [p.type, p.value]))
	return Number(parts.hour) * HOUR + Number(parts.minute) * 60 + Number(parts.second)
}

/** Début (s) de la journée, à Paris, qui contient l'instant `t` (s). */
export function startOfParisDay(t) {
	const guess = t - parisSecondsSinceMidnight(t)
	// Un changement d'heure entre minuit et `t` décale l'estimation d'une heure.
	const drift = parisSecondsSinceMidnight(guess)
	if (drift === 0) return guess
	return drift > DAY / 2 ? guess + DAY - drift : guess - drift
}

/**
 * Écart médian (s) entre deux instants distincts consécutifs, `null` s'il n'y
 * en a pas. Médian plutôt que minimal : une mesure rapprochée ou un trou ne
 * change pas le pas retenu.
 */
export function medianStep(xVals) {
	const deltas = []
	for (let i = 1; i < xVals.length; i++) {
		const delta = xVals[i] - xVals[i - 1]
		if (delta > 0) deltas.push(delta)
	}
	if (deltas.length === 0) return null
	deltas.sort((a, b) => a - b)
	return deltas[Math.floor(deltas.length / 2)]
}

const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor

function mostFrequent(values) {
	const counts = new Map()
	values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1))
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

/**
 * Regroupe des mesures brutes par pas régulier : chaque mesure s'ajoute à la
 * période qui la contient, datée par son début. Une mesure arrivée entre deux
 * pas habituels rejoint ainsi le cumul de sa période, au lieu de produire une
 * barre étroite dont la hauteur sous-estimerait l'intensité.
 *
 * Les périodes sont calées sur le rythme le plus fréquent des mesures, et non
 * sur minuit UTC : des relevés à la demie ou à 6 h du matin restent à leur
 * heure, même si une mesure intermédiaire arrive en dernier.
 *
 * @param {Array} data - colonnes [x (s), pluie (mm)], triées
 * @returns {Array} colonnes [débuts de période (s), cumuls (mm)]
 */
export function regroupByStep([xVals, yVals], step) {
	const phase = mostFrequent(xVals.map(x => modulo(x, step)))
	const sums = new Map()
	xVals.forEach((x, i) => {
		const start = x - modulo(x - phase, step)
		const previous = sums.has(start) ? sums.get(start) : null
		const value = yVals[i]
		sums.set(start, value == null ? previous : (previous ?? 0) + value)
	})
	const starts = [...sums.keys()]
	return [starts, starts.map(start => (sums.get(start) == null ? null : Number(sums.get(start).toFixed(2))))]
}

/**
 * Pluie au pas régulier, chaque instant marquant le début de sa période, et
 * ce pas (s).
 *
 * @param {Array} measures - colonnes [x (s), pluie (mm)] telles que l'API les donne, triées
 * @param {string} groupFunc - 'all' | 'SUM_HOUR' | 'SUM_DAY'
 * @returns {{ data: Array, step: number }}
 */
export function rainPeriods(measures, groupFunc) {
	if (groupFunc === 'SUM_HOUR') return { data: measures, step: HOUR }
	if (groupFunc === 'SUM_DAY') return { data: [measures[0].map(startOfParisDay), measures[1]], step: DAY }
	const step = medianStep(measures[0]) ?? HOUR
	return { data: regroupByStep(measures, step), step }
}

/**
 * Ajoute en fin un instant sans valeur à la fin de la dernière période, sans
 * dépasser l'instant présent : sans lui, la vue s'arrêterait au début de la
 * dernière barre et la laisserait hors cadre.
 *
 * @param {Array} columns - colonnes uPlot [x (s), pluie, ...autres séries]
 * @param {number} nowS - maintenant (s) : une période en cours s'arrête là
 */
export function withLastPeriodEnd(columns, step, nowS) {
	const xVals = columns[0]
	if (xVals.length === 0) return columns
	const last = xVals[xVals.length - 1]
	const end = Math.min(last + step, Math.max(last, nowS))
	if (end <= last) return columns
	return columns.map((column, i) => [...column, i === 0 ? end : null])
}

/**
 * Premier début de période (s) à prendre en compte pour une vue qui commence à
 * `min` : la barre commencée avant la vue y déborde encore, et compte dans son
 * échelle et son cumul. Les instants sont des secondes entières.
 */
export function firstOverlappingStart(min, step) {
	return Math.floor(min - step) + 1
}
