export function toNgf(value, altitude) {
	if (value == null || altitude == null) return value
	return Number((value + altitude).toFixed(3))
}
