import { describe, it, expect } from 'vitest'
import { validatePluvioConfig, applyPluvioDefaults } from '../../src/lib/config.js'
import { buildPluvioPlotData, computeWindowedCumul } from '../../src/lib/data-transform.js'

// Mesures pluvio réalistes : 13 mars 2026, 1 mesure par heure, 06:00–11:00 UTC
const measuresResponse = [
	[1773568800000, 0.2],   // 06:00
	[1773572400000, 1.4],   // 07:00
	[1773576000000, 0.0],   // 08:00
	[1773579600000, null],  // 09:00 — trou
	[1773583200000, 3.8],   // 10:00
	[1773586800000, 0.6]    // 11:00
]

describe('pluvio pipeline: config → transform → données uPlot', () => {
	const userConfig = {
		apiUrl: 'https://api.example.com',
		token: 'abc123',
		container: '#chart',
		idStation: 719,
		cumul: true
	}

	it('valide et applique les defaults', () => {
		const { valid } = validatePluvioConfig(userConfig)
		expect(valid).toBe(true)

		const config = applyPluvioDefaults(userConfig)
		expect(config.hours).toBe(3)
		expect(config.cumul).toBe(true)
		expect(config.groupFunc).toBe('all')
		expect(config.colorCumul).toBe('#EA580C')
	})

	it('produit des données uPlot [x, y] à partir de la réponse API', () => {
		const plotData = buildPluvioPlotData(measuresResponse)

		expect(plotData).not.toBeNull()
		expect(plotData.length).toBe(2)

		// X en secondes Unix
		expect(plotData[0][0]).toBe(1773568800)
		expect(plotData[0][5]).toBe(1773586800)

		// Y arrondis à 2 décimales, null préservé
		expect(plotData[1]).toEqual([0.2, 1.4, 0.0, null, 3.8, 0.6])
	})

	it('le cumul est calculé sur la fenêtre visible et redémarre à 0 à chaque zoom', () => {
		const [xVals, yVals] = buildPluvioPlotData(measuresResponse)

		// Fenêtre complète : comportement équivalent à l'ancien cumul global
		const full = computeWindowedCumul(xVals, yVals, xVals[0], xVals[xVals.length - 1])
		expect(full.cumul).toEqual([0.2, 1.6, 1.6, 1.6, 5.4, 6.0])

		// Fenêtre restreinte aux mesures 08:00 → 10:00 : le cumul redémarre à 0
		// sur la mesure 08:00 (0.0), null conservé, puis +3.8.
		const zoomed = computeWindowedCumul(xVals, yVals, 1773576000, 1773583200)
		expect(zoomed.cumul).toEqual([null, null, 0.0, 0.0, 3.8, null])
		expect(zoomed.max).toBe(3.8)
	})

	it('données capteur aberrantes (Infinity/NaN) sont remplacées par null', () => {
		const mesuresBruitees = [
			[1773568800000, 0.5],
			[1773572400000, Infinity],
			[1773576000000, NaN],
			[1773579600000, 1.2]
		]

		const plotData = buildPluvioPlotData(mesuresBruitees)

		expect(plotData[1]).toEqual([0.5, null, null, 1.2])

		const { cumul } = computeWindowedCumul(
			plotData[0],
			plotData[1],
			plotData[0][0],
			plotData[0][plotData[0].length - 1]
		)
		expect(cumul[0]).toBe(0.5)
		expect(cumul[1]).toBe(0.5)  // Infinity → null → pas d'ajout
		expect(cumul[2]).toBe(0.5)  // NaN → null → pas d'ajout
		expect(cumul[3]).toBe(1.7)  // + 1.2
	})
})
