import { describe, it, expect } from 'vitest'
import { clampWindow, renderRangerSelect } from '../../src/lib/hooks/use-chart.js'

const MIN_WINDOW_S = 3600 // 1h
const xVals = [0, 100000] // étendue des données : lo=0, hi=100000 s

describe('clampWindow — plancher de 1h, ancrage des bords et bornage aux données', () => {
	// --- plancher de 1h + quel bord reste ancré ---
	it('redimensionnement par la droite au milieu : ancre le bord gauche et fait grandir le max jusqu\'à 1h', () => {
		const { min, max } = clampWindow(xVals, 50000, 50050, 'R')
		expect(min).toBe(50000)          // bord gauche inchangé
		expect(max).toBe(50000 + MIN_WINDOW_S)
	})

	it('redimensionnement par la gauche au milieu : ancre le bord droit et repousse le min jusqu\'à 1h', () => {
		const { min, max } = clampWindow(xVals, 49950, 50000, 'L')
		expect(max).toBe(50000)          // bord droit inchangé
		expect(min).toBe(50000 - MIN_WINDOW_S)
	})

	// --- bug de revue confirmé : le plancher ne doit pas être re-cassé par le bornage aux données ---
	it('garde >= 1h pour une sélection étroite collée au bord DROIT (sans dépasser les données)', () => {
		const { min, max } = clampWindow(xVals, 99900, 99950, 'R')
		expect(max).toBeLessThanOrEqual(xVals[1])
		expect(max - min).toBeGreaterThanOrEqual(MIN_WINDOW_S)
	})

	it('garde >= 1h pour une sélection étroite collée au bord GAUCHE (sans passer sous les données)', () => {
		const { min, max } = clampWindow(xVals, 50, 100, 'L')
		expect(min).toBeGreaterThanOrEqual(xVals[0])
		expect(max - min).toBeGreaterThanOrEqual(MIN_WINDOW_S)
	})

	// --- cas dégénéré : données couvrant moins de 1h ---
	it('retourne la plage complète (sans inversion) quand les données couvrent moins de 1h', () => {
		const short = [0, 1800] // 30 min de données
		const { min, max } = clampWindow(short, 500, 550, 'R')
		expect(min).toBe(0)
		expect(max).toBe(1800)
		expect(max).toBeGreaterThan(min)
	})

	// --- no-op ---
	it('ne modifie pas une fenêtre déjà >= 1h', () => {
		const { min, max } = clampWindow(xVals, 20000, 40000, 'R')
		expect(min).toBe(20000)
		expect(max).toBe(40000)
	})

	// --- translation du corps : durée conservée, position bornée des deux côtés ---
	it('translation bornée au bord droit : conserve la durée', () => {
		const { min, max } = clampWindow(xVals, 98000, 108000, 'body')
		expect(max).toBe(100000)
		expect(max - min).toBe(10000)
	})

	it('translation bornée au bord gauche : conserve la durée', () => {
		const { min, max } = clampWindow(xVals, -5000, 5000, 'body')
		expect(min).toBe(0)
		expect(max - min).toBe(10000)
	})
})

// Faux uRanger : échelle x linéaire déterministe pour tester le rendu de la boîte
const fakeRanger = (width = 300, lo = 0, hi = 100000) => {
	const calls = []
	return {
		bbox: { width, height: 28 },
		valToPos: v => ((v - lo) / (hi - lo)) * width,
		setSelect: opts => calls.push(opts),
		get last() { return calls[calls.length - 1] }
	}
}

describe('renderRangerSelect — largeur minimale de la sélection (1h reste visible)', () => {
	it('rend la boîte exacte quand la fenêtre est assez large', () => {
		const r = fakeRanger()
		renderRangerSelect(r, 0, 50000) // 150px sur 300
		expect(r.last).toMatchObject({ left: 0, width: 150 })
	})

	it('impose une largeur minimale et centre la boîte pour une fenêtre sous-pixel', () => {
		const r = fakeRanger()
		renderRangerSelect(r, 90000, 90100) // ~0px réel → doit être floorée à 24, centrée sur 270
		expect(r.last.width).toBe(24)
		expect(r.last.left).toBe(258) // 270 - 24/2
	})

	it('borne la boîte minimale à l\'intérieur de la réglette au bord droit', () => {
		const r = fakeRanger()
		renderRangerSelect(r, 100000, 100000) // tout à droite
		expect(r.last.width).toBe(24)
		expect(r.last.left + r.last.width).toBeLessThanOrEqual(300)
		expect(r.last.left).toBe(276)
	})

	it('cape la largeur à celle de la réglette quand elle est plus étroite que le minimum', () => {
		const r = fakeRanger(16) // réglette de 16px < MIN_SEL_PX
		renderRangerSelect(r, 90000, 90100)
		expect(r.last.width).toBe(16)
		expect(r.last.left).toBe(0)
	})
})
