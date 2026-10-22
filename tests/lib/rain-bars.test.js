import { describe, it, expect } from 'vitest'
import {
	startOfParisDay,
	medianStep,
	regroupByStep,
	rainPeriods,
	withLastPeriodEnd,
	firstOverlappingStart
} from '../../src/lib/rain-bars.js'

const H = 3600
const D = 86400
const utc = (...args) => Date.UTC(...args) / 1000

describe('startOfParisDay', () => {
	it('ramène midi au minuit de Paris, en heure d\'été', () => {
		// 21 octobre 2026, midi à Paris = 10 h UTC ; minuit à Paris = 22 h UTC la veille.
		expect(startOfParisDay(utc(2026, 9, 21, 10))).toBe(utc(2026, 9, 20, 22))
	})

	it('ramène midi au minuit de Paris, en heure d\'hiver', () => {
		expect(startOfParisDay(utc(2026, 11, 15, 11))).toBe(utc(2026, 11, 14, 23))
	})

	it('reste juste le jour du passage à l\'heure d\'été', () => {
		// 29 mars 2026 : minuit à UTC+1, midi à UTC+2.
		expect(startOfParisDay(utc(2026, 2, 29, 10))).toBe(utc(2026, 2, 28, 23))
	})

	it('reste juste le jour du passage à l\'heure d\'hiver', () => {
		// 25 octobre 2026 : minuit à UTC+2, midi à UTC+1.
		expect(startOfParisDay(utc(2026, 9, 25, 11))).toBe(utc(2026, 9, 24, 22))
	})
})

describe('medianStep', () => {
	it('rend l\'écart médian entre deux mesures', () => {
		expect(medianStep([0, H, 2 * H, 3 * H])).toBe(H)
	})

	it('ignore un trou ponctuel et une mesure rapprochée', () => {
		expect(medianStep([0, H, 2 * H, 2 * H + 60, 3 * H, 10 * H, 11 * H])).toBe(H)
	})

	it('ne rend rien sans au moins deux instants distincts', () => {
		expect(medianStep([0])).toBeNull()
		expect(medianStep([5, 5])).toBeNull()
	})
})

describe('regroupByStep — mesures brutes ramenées au pas régulier', () => {
	it('une mesure intermédiaire rejoint la période qui commence avant elle', () => {
		// 1,5 mm à 16 h 05 s'ajoutent à la période 16 h - 17 h, comme dans les
		// cumuls horaires de l'API.
		const data = [[15 * H, 16 * H, 16 * H + 300, 17 * H], [2, 6.2, 1.5, 3.5]]
		expect(regroupByStep(data, H)).toEqual([[15 * H, 16 * H, 17 * H], [2, 7.7, 3.5]])
	})

	it('deux mesures au même instant s\'additionnent', () => {
		expect(regroupByStep([[H, H], [1, 2]], H)).toEqual([[H], [3]])
	})

	it('des mesures horaires à la demie restent datées à la demie', () => {
		const data = [[10.5 * H, 11.5 * H, 12.5 * H], [1, 2, 3]]
		expect(regroupByStep(data, H)).toEqual(data)
	})

	it('des relevés journaliers du matin restent datés du même matin', () => {
		// Relevés à 6 h, heure de Paris : la grille suit les relevés, pas minuit UTC.
		const mornings = [0, 1, 2].map(day => utc(2026, 9, 20 + day, 4))
		expect(regroupByStep([mornings, [5, 0, 8]], D)).toEqual([mornings, [5, 0, 8]])
	})

	it('une période sans aucune valeur reste sans valeur', () => {
		expect(regroupByStep([[H, 2 * H], [null, 1]], H)).toEqual([[H, 2 * H], [null, 1]])
	})

	it('une période sans mesure ne crée pas de barre', () => {
		expect(regroupByStep([[H, 5 * H], [1, 2]], H)[0]).toEqual([H, 5 * H])
	})

	it('une mesure intermédiaire arrivée en dernier ne décale pas la grille', () => {
		const data = [[15 * H, 16 * H, 16 * H + 300], [2, 6.2, 1.5]]
		expect(regroupByStep(data, H)).toEqual([[15 * H, 16 * H], [2, 7.7]])
	})

	it('les cumuls sont arrondis au centième, sans erreur de virgule flottante', () => {
		expect(regroupByStep([[H, 1.5 * H, 2 * H], [0.1, 0.2, 1]], H)[1]).toEqual([0.3, 1])
	})
})

describe('rainPeriods — la convention de l\'API : un instant marque le début de sa période', () => {
	it('mesures brutes : regroupées à leur pas habituel', () => {
		const measures = [[0, 300, 600, 650], [1, 2, 3, 4]]
		expect(rainPeriods(measures, 'all')).toEqual({ data: [[0, 300, 600], [1, 2, 7]], step: 300 })
	})

	it('cumuls horaires : déjà datés par le début de l\'heure', () => {
		const measures = [[0, H], [1, 2]]
		expect(rainPeriods(measures, 'SUM_HOUR')).toEqual({ data: measures, step: H })
	})

	it('cumuls journaliers : datés de midi par l\'API, ramenés au minuit de Paris', () => {
		const noon = utc(2026, 9, 21, 10)
		expect(rainPeriods([[noon], [12.2]], 'SUM_DAY')).toEqual({ data: [[utc(2026, 9, 20, 22)], [12.2]], step: D })
	})
})

describe('withLastPeriodEnd — la dernière barre reste dans la vue', () => {
	it('ajoute la fin de la dernière période, sans valeur', () => {
		const columns = [[0, H], [1, 2], [null, null]]
		expect(withLastPeriodEnd(columns, H, 10 * H)).toEqual([[0, H, 2 * H], [1, 2, null], [null, null, null]])
	})

	it('une période en cours s\'arrête à l\'instant présent', () => {
		expect(withLastPeriodEnd([[0, D], [1, 2]], D, D + 6 * H)[0]).toEqual([0, D, D + 6 * H])
	})

	it('rien à ajouter quand la dernière mesure est encore à venir', () => {
		const columns = [[0, H], [1, 2]]
		expect(withLastPeriodEnd(columns, H, H)).toBe(columns)
	})

	it('aucune mesure : rien à ajouter', () => {
		const columns = [[], []]
		expect(withLastPeriodEnd(columns, H, 10 * H)).toBe(columns)
	})
})

describe('firstOverlappingStart — barres qui comptent pour une vue', () => {
	it('compte la barre commencée avant la vue et qui y déborde', () => {
		// Vue à partir de 21 h sur des cumuls journaliers : la barre du jour,
		// commencée à minuit, compte.
		expect(firstOverlappingStart(21 * H, D)).toBeLessThanOrEqual(0)
	})

	it('ne compte pas la barre qui s\'arrête pile au début de la vue', () => {
		expect(firstOverlappingStart(2 * H, H)).toBe(H + 1)
	})
})
