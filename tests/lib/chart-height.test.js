import { describe, it, expect } from 'vitest'
import { fittedChartHeight } from '../../src/lib/hooks/use-chart.js'
import { MIN_CHART_HEIGHT } from '../../src/lib/theme.js'

// Le reste du widget (en-tête, boutons, frise, légende) fait 100 px.
describe('fittedChartHeight — le graphique remplit la hauteur de l\'iframe', () => {
	it('rétrécit le graphique pour tenir dans une iframe basse', () => {
		expect(fittedChartHeight(250, 100)).toBe(150)
	})

	it('agrandit le graphique dans une iframe haute', () => {
		expect(fittedChartHeight(700, 100)).toBe(600)
	})

	it('ne descend pas sous le plancher : au-delà, l\'iframe défile', () => {
		expect(fittedChartHeight(150, 100)).toBe(MIN_CHART_HEIGHT)
	})

	it('arrondit à l\'inférieur quand le reste du widget a une hauteur fractionnaire', () => {
		// Un canevas de 300 px dépasserait la fenêtre de 0,4 px, assez pour une
		// barre de défilement sous Windows.
		expect(fittedChartHeight(400, 100.4)).toBe(299)
	})
})
