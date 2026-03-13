import { describe, it, expect } from 'vitest'
import { validatePluvioConfig, applyPluvioDefaults } from '../../src/lib/config.js'
import { buildPluvioPlotData } from '../../src/lib/data-transform.js'

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
	})

	it('produit des données uPlot avec cumul à partir de la réponse API', () => {
		const config = applyPluvioDefaults(userConfig)
		const plotData = buildPluvioPlotData(measuresResponse, config.cumul)

		expect(plotData).not.toBeNull()
		expect(plotData.length).toBe(3) // x, y, cumul

		// X en secondes Unix
		expect(plotData[0][0]).toBe(1773568800)
		expect(plotData[0][5]).toBe(1773586800)

		// Y arrondis à 2 décimales, null préservé
		expect(plotData[1]).toEqual([0.2, 1.4, 0.0, null, 3.8, 0.6])

		// Cumul : le null ne casse pas l'accumulateur
		expect(plotData[2][0]).toBe(0.2)
		expect(plotData[2][1]).toBe(1.6)   // 0.2 + 1.4
		expect(plotData[2][2]).toBe(1.6)   // + 0.0
		expect(plotData[2][3]).toBe(1.6)   // null → accumulateur inchangé
		expect(plotData[2][4]).toBe(5.4)   // + 3.8
		expect(plotData[2][5]).toBe(6.0)   // + 0.6
	})

	it('sans cumul, retourne uniquement x et y', () => {
		const plotData = buildPluvioPlotData(measuresResponse, false)

		expect(plotData.length).toBe(2)
		expect(plotData[0].length).toBe(6)
		expect(plotData[1].length).toBe(6)
	})

	it('données capteur aberrantes (Infinity/NaN) sont remplacées par null', () => {
		const mesuresBruitees = [
			[1773568800000, 0.5],
			[1773572400000, Infinity],
			[1773576000000, NaN],
			[1773579600000, 1.2]
		]

		const plotData = buildPluvioPlotData(mesuresBruitees, true)

		expect(plotData[1]).toEqual([0.5, null, null, 1.2])
		// Le cumul ignore les null
		expect(plotData[2][0]).toBe(0.5)
		expect(plotData[2][1]).toBe(0.5)  // Infinity → null → pas d'ajout
		expect(plotData[2][2]).toBe(0.5)  // NaN → null → pas d'ajout
		expect(plotData[2][3]).toBe(1.7)  // + 1.2
	})
})
