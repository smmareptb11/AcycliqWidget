/**
 * Composition de l'infobulle des graphes.
 *
 * Le rendu passe par `innerHTML` (use-chart.js), et les libellés comme les
 * couleurs viennent de l'API : tout ce qui traverse ce module doit être
 * échappé. C'est la seule surface du widget où une réponse serveur atteint du
 * HTML sans passer par le JSX de Preact.
 *
 * Module pur (aucun accès au DOM, aucune dépendance Preact) : le repo n'embarque
 * ni jsdom ni testing-library, c'est la seule façon de couvrir cette logique
 * par des tests — même motivation que `threshold-categories.js`.
 */

import { fullDateTimeFormatter } from './util/date.js'
import { formaterNombreFr } from './util/number.js'
import { isThresholdVisible, thresholdColor } from './threshold-categories.js'
import { THRESHOLD_FALLBACK } from './theme.js'

// Écart entre le curseur et l'infobulle.
export const TOOLTIP_GAP = 10

// Un code hexadécimal, ou un nom de couleur CSS. Volontairement plus étroit que
// ce que CSS accepte : `rgb()` et consorts n'apparaissent pas dans les réponses
// de l'API, et les autoriser rouvrirait la parenthèse et la virgule.
const CSS_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+)$/i

const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }

/**
 * @param {*} value - texte d'origine quelconque (nom de seuil, unité)
 * @returns {string} texte inerte, insérable dans du HTML comme dans un attribut
 *   entre guillemets
 */
export function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ENTITIES[ch])
}

/**
 * Couleur sûre à écrire dans un attribut `style`.
 *
 * Échapper ne suffit pas ici : sans guillemet à neutraliser, une couleur comme
 * `red;background-image:url(https://…)` reste enfermée dans l'attribut mais y
 * ajoute ses propres déclarations — de quoi faire charger une ressource
 * distante depuis une réponse de l'API. Une couleur n'étant pas du texte libre,
 * on la valide au lieu de l'échapper, et tout ce qui n'est pas une couleur
 * retombe sur le repli des seuils.
 *
 * @param {*} value - `htmlColor` d'un seuil, ou couleur de config
 * @returns {string}
 */
export function cssColor(value) {
	return CSS_COLOR.test(String(value ?? '').trim()) ? String(value).trim() : THRESHOLD_FALLBACK
}

/**
 * Coin haut-gauche de l'infobulle, en coordonnées de fenêtre.
 *
 * Extraite du hook `setCursor` d'uPlot pour être couverte par des tests, comme
 * l'ont été `clampWindow` et `renderRangerSelect` — le repo n'embarque pas de
 * DOM de test.
 *
 * L'infobulle se place sous et à droite du curseur, et bascule de l'autre côté
 * quand elle déborderait. Le clamp final traite le cas où elle est plus grande
 * que la fenêtre : l'iframe fait quelques centaines de pixels de haut, et
 * l'infobulle hydro grandit avec le nombre de seuils. Elle se colle alors au
 * bord plutôt que de sortir.
 *
 * @param {object} args
 * @param {number} args.anchorX - abscisse du curseur dans la fenêtre
 * @param {number} args.anchorY - ordonnée du curseur dans la fenêtre
 * @param {number} args.width - largeur mesurée de l'infobulle
 * @param {number} args.height - hauteur mesurée de l'infobulle
 * @param {number} args.viewportWidth
 * @param {number} args.viewportHeight
 * @returns {{left: number, top: number}}
 */
export function placeTooltip({ anchorX, anchorY, width, height, viewportWidth, viewportHeight }) {
	let left = anchorX + TOOLTIP_GAP
	let top = anchorY + TOOLTIP_GAP

	if (left + width > viewportWidth) left = anchorX - width - TOOLTIP_GAP
	if (top + height > viewportHeight) top = anchorY - height - TOOLTIP_GAP

	return {
		left: Math.max(0, Math.min(left, viewportWidth - width)),
		top: Math.max(0, Math.min(top, viewportHeight - height))
	}
}

/**
 * Lignes d'infobulle du graphe hydro : la mesure, puis les seuils actuellement
 * tracés, dans l'ordre de la légende.
 *
 * La visibilité est déléguée à `isThresholdVisible`, seul propriétaire de la
 * règle « pas de choix explicite → catégorie par défaut » : un seuil masqué
 * dans la légende doit disparaître de l'infobulle par le même chemin qu'il
 * disparaît du canevas.
 *
 * Les seuils reçus sont ceux de `displayThresholds`, dont la valeur est déjà
 * recalée en NGF le cas échéant — cette fonction ne convertit rien.
 *
 * @param {object} args
 * @param {string} args.color - couleur de la courbe de mesure
 * @param {string} args.yLabel - libellé de l'axe Y, unité comprise
 * @param {number} args.yValue - valeur mesurée au point survolé
 * @param {Array} args.thresholds - seuils affichés (`displayThresholds`)
 * @param {Map<string, boolean>} args.seriesVisibility
 * @param {string[]} args.defaultKeys - catégories actives au chargement
 * @returns {Array<{color: string, label: string, value: number}>}
 */
export function hydroTooltipRows({ color, yLabel, yValue, thresholds, seriesVisibility, defaultKeys }) {
	const rows = [{ color, label: yLabel, value: yValue }]

	;(thresholds || []).forEach((threshold, index) => {
		if (!isThresholdVisible(threshold, index, seriesVisibility, defaultKeys)) return
		rows.push({
			color: thresholdColor(threshold),
			label: threshold.name,
			value: threshold.value
		})
	})

	return rows
}

/**
 * Fragment HTML d'une infobulle : la date survolée en en-tête, puis une ligne
 * par série — témoin de couleur, libellé, valeur.
 *
 * Les lignes sans valeur exploitable sont écartées plutôt que rendues vides :
 * `formaterNombreFr` lève sur `null`.
 *
 * @param {number} xSeconds - timestamp x en secondes (unité des données uPlot)
 * @param {Array<{color: string, label: string, value: number, unit?: string}>} rows
 * @returns {string}
 */
export function renderTooltip(xSeconds, rows) {
	const body = (rows || [])
		.filter(row => Number.isFinite(row?.value))
		.map(row => `
			<div class="row">
				<span class="swatch" style="background:${cssColor(row.color)}"></span>
				<span class="label">${escapeHtml(row.label)}</span>
				<span class="num">${escapeHtml(formaterNombreFr(row.value))}${row.unit ? ` ${escapeHtml(row.unit)}` : ''}</span>
			</div>
		`)
		.join('')

	return `<div class="date">${escapeHtml(fullDateTimeFormatter(new Date(xSeconds * 1000)))}</div>${body}`
}
