import { describe, it, expect } from 'vitest'
import { clampWindow } from '../../src/lib/hooks/use-chart.js'

const MIN_WINDOW_S = 3600 // 1h
const xVals = [0, 100000] // étendue des données : lo=0, hi=100000 s

describe('clampWindow — plancher de 1h et bornage aux données', () => {
	it('impose le minimum de 1h pour une sélection étroite au milieu de la plage', () => {
		const { min, max } = clampWindow(xVals, 50000, 50050, 'R')
		expect(max - min).toBeGreaterThanOrEqual(MIN_WINDOW_S)
	})

	it('impose le minimum de 1h pour une sélection étroite au bord DROIT (ticket revue #bord-droit)', () => {
		// Tracé natif d'une petite sélection collée au bord droit des données
		const { min, max } = clampWindow(xVals, 99900, 99950, 'R')
		expect(max).toBeLessThanOrEqual(xVals[1]) // ne dépasse pas les données
		expect(max - min).toBeGreaterThanOrEqual(MIN_WINDOW_S) // <-- doit rester >= 1h
	})

	it('impose le minimum de 1h pour une sélection étroite au bord GAUCHE', () => {
		const { min, max } = clampWindow(xVals, 50, 100, 'L')
		expect(min).toBeGreaterThanOrEqual(xVals[0])
		expect(max - min).toBeGreaterThanOrEqual(MIN_WINDOW_S)
	})

	it('ne modifie pas une fenêtre déjà >= 1h', () => {
		const { min, max } = clampWindow(xVals, 20000, 40000, 'R')
		expect(min).toBe(20000)
		expect(max).toBe(40000)
	})

	it('borne aux données sans casser une translation du corps (durée conservée)', () => {
		// translation au-delà du bord droit : la durée doit être préservée
		const { min, max } = clampWindow(xVals, 98000, 108000, 'body')
		expect(max).toBe(100000)
		expect(max - min).toBe(10000)
	})
})
