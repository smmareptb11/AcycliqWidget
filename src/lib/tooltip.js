/**
 * Placement de l'infobulle des graphes.
 *
 * Module pur (aucun accès au DOM, aucune dépendance Preact) : le repo n'embarque
 * ni jsdom ni testing-library, c'est la seule façon de couvrir cette logique
 * par des tests — même motivation que `threshold-categories.js`.
 */

// Écart entre le curseur et l'infobulle.
export const TOOLTIP_GAP = 10

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
