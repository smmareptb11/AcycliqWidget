export function toNgf(value, altitude) {
	if (value == null || altitude == null) return value
	return Number((value + altitude).toFixed(3))
}

/**
 * Règle métier unique d'activation du recalage NGF : uniquement pour les hauteurs
 * (dataType 4), quand l'option est active et qu'on dispose d'une altitude de
 * station exploitable. Centralisée ici pour que la courbe de mesure et les lignes
 * de seuil partagent exactement le même critère (sinon elles pourraient diverger).
 *
 * @param {boolean} useNgf - option NGF demandée par la config
 * @param {boolean} isHeight - la donnée est une hauteur (dataType 4)
 * @param {number} altitude - altitude de la station (m)
 * @returns {boolean}
 */
export function shouldApplyNgf(useNgf, isHeight, altitude) {
	return useNgf && isHeight && altitude > 0
}
