// fullDateTimeFormatter(new Date('2026-03-13T14:30:00')) → "13/03/2026 14:30"
export function fullDateTimeFormatter(stringDate) {
	return new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(new Date(stringDate))
}

// shortDateTimeFormatter(new Date('2026-03-13T14:30:00').getTime()) → "13/03/2026"
export function shortDateTimeFormatter(stringDate) {
	return new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'short'
	}).format(new Date(stringDate))
}

// getShortIsoString(new Date('2026-03-13T14:30:00Z')) → "2026-03-13"
export function getShortIsoString(date) {
	return date.toISOString().split('T')[0]
}
