// formaterNombreFr(1000) → "1 000"  |  formaterNombreFr(1.23) → "1,23"  |  formaterNombreFr(0) → "0"
export function formaterNombreFr(valeur) {
	const nombre = Number(valeur.toFixed(2))
	return nombre.toLocaleString('fr-FR', {
		minimumFractionDigits: nombre % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2
	})
}
