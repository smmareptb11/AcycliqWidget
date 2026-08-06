/**
 * Catégories de seuils Acycliq.
 *
 * L'API expose une catégorie sur `GET /hydrologicalStation/{id}/threshold`, sous
 * la forme d'un entier `category` (1 = Situation, 2 = Informatif, 3 = Contrôle).
 * Deux particularités relevées sur les données réelles du SMMAR commandent tout
 * ce module :
 *
 * 1. `category` est facultative : de nombreux seuils ne portent pas la clé du
 *    tout (repères de crue historiques, stations pas encore taguées). Ils sont
 *    regroupés dans une catégorie implicite « non classé » (`autre`), proposée
 *    et active par défaut — sans elle, ces stations perdraient tous leurs seuils.
 * 2. Comme `dataType`, l'entier peut arriver sous forme de chaîne (`"1"`). Les
 *    comparaisons passent donc par `String()`, comme le fait déjà le filtre
 *    `dataType` de `hydro-chart.jsx`.
 *
 * Ce module est volontairement pur (aucun accès au DOM, aucune dépendance
 * Preact) : c'est la seule façon de le couvrir par des tests dans ce repo, qui
 * n'embarque ni jsdom ni testing-library.
 */

import { THRESHOLD_FALLBACK } from './theme.js'

export const THRESHOLD_CATEGORIES = [
	{ key: 'situation', code: 1, label: 'Situation' },
	{ key: 'informatif', code: 2, label: 'Informatif' },
	{ key: 'controle', code: 3, label: 'Contrôle' },
	{ key: 'autre', code: null, label: 'Non classé' }
]

// Figée : cette liste sert de valeur par défaut dans HYDRO_DEFAULTS, la même
// référence se retrouve donc dans la config de chaque widget de la page.
export const ALL_CATEGORY_KEYS = Object.freeze(THRESHOLD_CATEGORIES.map(c => c.key))

/** Clé de la catégorie implicite qui recueille les seuils sans catégorie exploitable. */
export const UNCATEGORIZED_KEY = 'autre'

/**
 * Résout la catégorie d'un seuil renvoyé par l'API.
 *
 * Tout ce qui n'est pas un code connu (clé absente, `null`, code futur inconnu)
 * retombe sur `autre` : un code inconnu ne doit jamais faire disparaître un
 * seuil du graphe.
 *
 * @param {object} threshold - seuil brut de l'API
 * @returns {string} clé de catégorie
 */
export function categoryKeyOf(threshold) {
	const raw = threshold?.category
	if (raw == null || raw === '') return UNCATEGORIZED_KEY
	const found = THRESHOLD_CATEGORIES.find(c => c.code != null && String(c.code) === String(raw))
	return found ? found.key : UNCATEGORIZED_KEY
}

/**
 * Résout une entrée de configuration en clé de catégorie, ou `null` si elle
 * n'en désigne aucune. Accepte indifféremment un libellé (casse et espaces
 * libres) et un code numérique, pour que l'intégrateur puisse écrire l'un ou
 * l'autre.
 *
 * Distincte de `categoryKeyOf`, qui lit la donnée renvoyée par l'API et n'y
 * accepte que le code : côté API un libellé n'est pas une valeur attendue, et
 * l'accepter reviendrait à inventer un contrat que le serveur n'offre pas.
 *
 * Extraite pour que la règle de correspondance de la config ait un seul
 * propriétaire : `normalizeCategoryKeys` l'applique en lot, `validateHydroConfig`
 * a besoin de la même question posée entrée par entrée pour nommer les fautives.
 *
 * @param {string|number} entry
 * @returns {string|null}
 */
export function resolveCategoryKey(entry) {
	const raw = String(entry).trim()
	const found = THRESHOLD_CATEGORIES.find(c =>
		c.key === raw.toLowerCase()
		|| (c.code != null && String(c.code) === raw)
	)
	return found ? found.key : null
}

// Tracé historique des seuils, celui d'avant les catégories. Figé : trois
// catégories pointent sur ce même objet, dont les valeurs sont partagées par
// toutes les instances de widget d'une page. Une mutation accidentelle
// (`seriesStyleOf(th).width = 3`) se propagerait silencieusement partout ; ici
// elle lève. Les appelants qui transmettent `dash` à uPlot en passent une copie,
// pour ne rien figer au-delà de notre propre code.
const HISTORICAL_STYLE = Object.freeze({ width: 2, dash: Object.freeze([8, 4]), legendBorder: '2px solid' })

/**
 * Tracé de chaque catégorie de seuil, pour le canevas comme pour le témoin de la
 * légende. Source unique délibérée : définir ces valeurs des deux côtés les
 * ferait diverger dès la première retouche.
 *
 * `situation`, `controle` et `autre` conservent exactement le rendu d'avant les
 * catégories — c'est ce qui garantit l'absence de régression visuelle sur les
 * stations pas encore taguées, largement majoritaires en base.
 *
 * `informatif` s'efface volontairement devant la donnée : ce sont des repères
 * ponctuels, à lire par rapport à l'échelle de vigilance et non à sa place. Cet
 * effacement porte sur le seul tracé, jamais sur la couleur : ces seuils portent
 * parfois un `htmlColor` très contrasté (`#000000` sur la station 14).
 */
export const CATEGORY_STYLES = Object.freeze({
	situation: HISTORICAL_STYLE,
	informatif: Object.freeze({ width: 1, dash: Object.freeze([2, 3]), legendBorder: '1px dotted' }),
	controle: HISTORICAL_STYLE,
	autre: HISTORICAL_STYLE
})

/**
 * @param {object} threshold - seuil brut de l'API
 * @returns {{width: number, dash: number[], legendBorder: string}}
 */
export function seriesStyleOf(threshold) {
	return CATEGORY_STYLES[categoryKeyOf(threshold)]
}

/**
 * Couleur effective d'un seuil : celle de l'API, ou le repli.
 *
 * De nombreux seuils n'ont pas de `htmlColor` (repères de crue, seuils
 * informatifs). Même motivation que `seriesStyleOf` : le canevas et le témoin
 * de la légende doivent lire la même valeur, sans quoi la légende annoncerait
 * une couleur que le graphe ne trace pas.
 *
 * @param {object} threshold
 * @returns {string}
 */
export function thresholdColor(threshold) {
	return threshold?.htmlColor || THRESHOLD_FALLBACK
}

/**
 * Normalise une option de configuration en liste de clés de catégories.
 * Accepte indifféremment des libellés (`'situation'`, casse libre) et des codes
 * numériques (`1`, `'1'`), pour que l'intégrateur puisse écrire l'un ou l'autre.
 * Les valeurs inconnues sont ignorées silencieusement — `validateHydroConfig`
 * les rejette en amont, cette fonction ne doit pas faire échouer un rendu.
 *
 * @param {Array|undefined} input - valeur brute de la config
 * @param {string[]} fallback - clés à retenir si `input` n'est pas un tableau
 * @returns {string[]} clés dédupliquées, dans l'ordre canonique
 */
export function normalizeCategoryKeys(input, fallback = ALL_CATEGORY_KEYS) {
	if (!Array.isArray(input)) return [...fallback]

	const wanted = new Set()
	for (const entry of input) {
		const key = resolveCategoryKey(entry)
		if (key) wanted.add(key)
	}

	// L'ordre canonique (et non celui de la config) garde un rendu stable.
	return ALL_CATEGORY_KEYS.filter(key => wanted.has(key))
}

/**
 * Signature stable d'une option de catégories, pour mémoïser ce qui en dérive :
 * l'hôte passe le plus souvent un littéral de tableau, dont l'identité change à
 * chaque rendu.
 *
 * Les crochets ne sont pas décoratifs, ils distinguent le tableau vide de
 * l'option absente. Sans eux, les deux donneraient la même chaîne alors que
 * `normalizeCategoryKeys` en tire des résultats opposés : aucune catégorie pour
 * `[]`, toutes pour `undefined`. Une même clé de cache pour deux résultats
 * contraires, c'est une collision silencieuse.
 *
 * @param {Array|undefined} value - valeur brute de la config
 * @returns {string}
 */
export function categoryOptionSignature(value) {
	return Array.isArray(value) ? `[${value.join('|')}]` : 'absent'
}

/**
 * Ne conserve que les seuils dont la catégorie est proposée à l'affichage.
 * Les seuils écartés ne deviennent ni colonne de `plotData` ni série uPlot :
 * l'alignement entre les deux repose sur ce filtre appliqué une seule fois.
 *
 * @param {Array} thresholds
 * @param {string[]} keys - catégories proposées
 * @returns {Array}
 */
export function filterByCategories(thresholds, keys) {
	if (!thresholds) return []
	const allowed = new Set(keys)
	return thresholds.filter(th => allowed.has(categoryKeyOf(th)))
}

/**
 * Identité stable d'un seuil, utilisée comme clé de visibilité et de rendu.
 *
 * Le `name` seul ne suffit pas : l'API renvoie des `id` non uniques d'un
 * `dataType` à l'autre, et rien ne garantit l'unicité des noms au sein d'une
 * station. L'index, lui, est la position du seuil dans la liste affichée : il
 * rend la clé unique par construction.
 *
 * @param {object} threshold
 * @param {number} index - position dans la liste des seuils affichés
 * @returns {string}
 */
export function thresholdKey(threshold, index) {
	return `${threshold?.id ?? 'na'}:${index}:${threshold?.name ?? ''}`
}

/**
 * Regroupe les seuils par catégorie pour l'affichage, sans jamais réordonner la
 * liste d'origine.
 *
 * L'ordre de `displayThresholds` porte trois choses couplées : les colonnes de
 * `plotData`, l'index des séries uPlot (`index + THRESHOLD_SERIES_OFFSET`) et
 * l'argument des fonctions de bascule. Chaque entrée transporte donc son index
 * d'origine, et le regroupement n'est qu'une vue construite au moment du rendu.
 *
 * @param {Array} thresholds - seuils déjà filtrés par catégorie proposée
 * @returns {Array<{key: string, label: string, items: Array<{threshold: object, index: number}>}>}
 */
export function groupByCategory(thresholds) {
	const byKey = new Map()

	;(thresholds || []).forEach((threshold, index) => {
		const key = categoryKeyOf(threshold)
		if (!byKey.has(key)) byKey.set(key, [])
		byKey.get(key).push({ threshold, index })
	})

	// L'ordre canonique (et non celui de l'API) garde un rendu stable.
	return THRESHOLD_CATEGORIES
		.filter(c => byKey.has(c.key))
		.map(c => ({ key: c.key, label: c.label, items: byKey.get(c.key) }))
}

/**
 * Applique une visibilité à un lot de seuils, sans muter l'état reçu.
 *
 * Placée ici plutôt que dans le composant pour que la seule logique d'écriture
 * de la visibilité soit couverte par des tests : le repo n'a ni jsdom ni
 * testing-library, un gestionnaire de clic n'y est pas testable.
 *
 * @param {Map<string, boolean>} previous - état de visibilité courant
 * @param {Array<{threshold: object, index: number}>} items - seuils visés, tels que produits par groupByCategory
 * @param {boolean} visible
 * @returns {Map<string, boolean>} nouvel état
 */
export function withVisibility(previous, items, visible) {
	const next = new Map(previous)
	for (const { threshold, index } of items || []) {
		next.set(thresholdKey(threshold, index), visible)
	}
	return next
}

/**
 * Visibilité effective d'un seuil : le choix du visiteur s'il en a fait un,
 * sinon les catégories actives par défaut.
 *
 * Seule propriétaire de la règle « pas de choix explicite → catégorie par
 * défaut ». L'état de visibilité démarre volontairement vide et n'est jamais
 * pré-rempli : matérialiser les valeurs par défaut dans la Map en ferait un
 * second propriétaire de la même règle, à tenir en phase à la main.
 *
 * Partagée par le graphe et par la légende, qui doivent appliquer le même repli
 * — sans quoi le tout premier rendu afficherait une légende active sur un seuil
 * qui n'est pas tracé.
 *
 * @param {object} threshold
 * @param {number} index - position dans la liste des seuils affichés
 * @param {Map<string, boolean>} seriesVisibility
 * @param {string[]} defaultKeys - catégories actives au chargement
 * @returns {boolean}
 */
export function isThresholdVisible(threshold, index, seriesVisibility, defaultKeys) {
	const key = thresholdKey(threshold, index)
	return seriesVisibility.has(key)
		? seriesVisibility.get(key)
		: defaultKeys.includes(categoryKeyOf(threshold))
}

export const GROUP_ACTIVE = 'active'
export const GROUP_INACTIVE = 'inactive'
export const GROUP_PARTIAL = 'partial'

/**
 * État d'affichage d'un groupe de catégorie, déduit de ses seuils : aucun état
 * de groupe n'est stocké, seule la visibilité de chaque seuil l'est. Un seul
 * état de référence, donc aucune désynchronisation possible entre l'en-tête de
 * groupe et les seuils qu'il chapeaute.
 *
 * @param {Array<{threshold: object, index: number}>} items
 * @param {Map<string, boolean>} seriesVisibility
 * @param {string[]} defaultKeys
 * @returns {'active'|'inactive'|'partial'}
 */
export function groupVisibilityState(items, seriesVisibility, defaultKeys) {
	// Sans cette garde, un groupe vide passerait le test `shown === items.length`
	// (0 === 0) et se déclarerait actif. `groupByCategory` n'émet jamais de groupe
	// vide, mais la fonction est exportée et appelable seule.
	if (!items || items.length === 0) return GROUP_INACTIVE

	const shown = items.filter(({ threshold, index }) =>
		isThresholdVisible(threshold, index, seriesVisibility, defaultKeys)
	).length

	if (shown === items.length) return GROUP_ACTIVE
	if (shown === 0) return GROUP_INACTIVE
	return GROUP_PARTIAL
}
