// fullDateTimeFormatter(new Date('2026-03-13T14:30:00')) → "13/03/2026 14:30"
export function fullDateTimeFormatter(stringDate) {
	return new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(new Date(stringDate))
}

// Hissés hors des fonctions : l'axe des graphes les rappelle sur chaque tick à chaque redessin.
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })
const hourMinute = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric' })

// dayMonthFormatter(new Date('2026-03-13T14:30:00').getTime()) → "13/03"
export function dayMonthFormatter(date) {
	return dayMonth.format(new Date(date))
}

// hourMinuteFormatter(new Date('2026-03-13T14:30:00').getTime()) → "14:30"
export function hourMinuteFormatter(date) {
	return hourMinute.format(new Date(date))
}

// monthYearFormatter(new Date('2026-03-13T14:30:00').getTime()) → "03/2026"
export function monthYearFormatter(date) {
	return monthYear.format(new Date(date))
}

// getShortIsoString(new Date('2026-03-13T14:30:00Z')) → "2026-03-13"
export function getShortIsoString(date) {
	return date.toISOString().split('T')[0]
}
