import { describe, it, expect } from 'vitest'
import { fullDateTimeFormatter, dayMonthFormatter, hourMinuteFormatter, monthYearFormatter } from '../../src/lib/util/date.js'

// Dates construites avec le constructeur local puis formatées en heure locale :
// le résultat attendu ne dépend pas du fuseau de la machine qui exécute les tests.

describe('fullDateTimeFormatter', () => {
	// Seule surface qui porte encore l'année depuis que l'axe X ne l'affiche plus :
	// c'est elle qui lève l'ambiguïté d'un « 01/09 » sur une plage pluriannuelle.
	it('formate date et heure complètes avec l\'année', () => {
		expect(fullDateTimeFormatter(new Date(2026, 8, 1, 14, 30))).toBe('01/09/2026 14:30')
	})
})

describe('dayMonthFormatter', () => {
	it('formate en jour/mois sur deux chiffres chacun', () => {
		expect(dayMonthFormatter(new Date(2026, 8, 1, 14, 30))).toBe('01/09')
	})
})

describe('hourMinuteFormatter', () => {
	it('formate en heures:minutes sur deux chiffres chacun', () => {
		expect(hourMinuteFormatter(new Date(2026, 8, 1, 14, 30))).toBe('14:30')
	})

	it('formate minuit sans passer en 12h', () => {
		expect(hourMinuteFormatter(new Date(2026, 8, 1, 0, 5))).toBe('00:05')
	})
})

describe('monthYearFormatter', () => {
	it('formate en mois sur deux chiffres et année sur quatre', () => {
		expect(monthYearFormatter(new Date(2026, 8, 1, 14, 30))).toBe('09/2026')
	})
})
