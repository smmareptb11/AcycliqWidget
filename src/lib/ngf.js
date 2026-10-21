export function toNgf(value, altitude) {
	if (value == null || altitude == null) return value
	return Number((value + altitude).toFixed(3))
}

/**
 * Le recalage NGF n'a de sens que pour une hauteur (dataType 4) et n'est
 * calculable qu'avec une altitude de station exploitable.
 *
 * @param {boolean} isHeight - la donnée est une hauteur (dataType 4)
 * @param {number} altitude - altitude de la station (m)
 * @returns {boolean}
 */
export function isNgfAvailable(isHeight, altitude) {
	return isHeight && altitude > 0
}

/**
 * Règle métier unique d'activation du recalage NGF : l'option est active et le
 * NGF est disponible. Centralisée ici pour que la courbe de mesure et les lignes
 * de seuil partagent exactement le même critère (sinon elles pourraient diverger).
 *
 * @param {boolean} useNgf - unité NGF demandée (config ou sélecteur)
 * @param {boolean} isHeight - la donnée est une hauteur (dataType 4)
 * @param {number} altitude - altitude de la station (m)
 * @returns {boolean}
 */
export function shouldApplyNgf(useNgf, isHeight, altitude) {
	return useNgf && isNgfAvailable(isHeight, altitude)
}
