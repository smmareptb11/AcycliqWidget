import { describe, it, expect } from 'vitest'
import { validateHydroConfig, applyHydroDefaults } from '../../src/lib/config.js'
import { buildHydroPlotData } from '../../src/lib/data-transform.js'

// Simule une réponse API réaliste : station hydro avec altitude NGF et seuils de vigilance
const stationResponse = {
	id: 17,
	name: 'Aisne à Soissons',
	link_altimetrySystems: [{ altitude: 42.35 }]
}

const thresholdsResponse = [
	{ name: 'Vigilance jaune', value: 2.5, htmlColor: '#FFCC00', dataType: 4 },
	{ name: 'Vigilance orange', value: 3.8, htmlColor: '#FF8800', dataType: 4 },
	{ name: 'Débit seuil', value: 50, htmlColor: '#FF0000', dataType: 5 }
]

// Mesures toutes les 5 min, 13 mars 2026 06:00–06:20 UTC
const measuresResponse = [
	[1773568800000, 1.234],  // 06:00
	[1773569100000, 1.187],  // 06:05
	[1773569400000, null],   // 06:10 — trou de mesure
	[1773569700000, 1.302],  // 06:15
	[1773570000000, 1.295]   // 06:20
]

describe('hydro pipeline: config → transform → données uPlot', () => {
	const userConfig = {
		apiUrl: 'https://api.example.com',
		token: 'abc123',
		container: '#chart',
		idStation: 17,
		dataType: 4,
		hours: 3,
		ngf: true,
		threshold: true
	}

	it('valide et applique les defaults sur la config utilisateur', () => {
		const { valid } = validateHydroConfig(userConfig)
		expect(valid).toBe(true)

		const config = applyHydroDefaults(userConfig)
		expect(config.color).toBe('#007BFF')
		expect(config.refresh).toBe(5)
	})

	it('produit des données uPlot exploitables à partir de la réponse API', () => {
		const config = applyHydroDefaults(userConfig)
		const isHeight = config.dataType === 4
		const altitude = stationResponse.link_altimetrySystems[0].altitude
		const filteredThresholds = thresholdsResponse.filter(th => String(th.dataType) === String(config.dataType))

		const plotData = buildHydroPlotData(measuresResponse, altitude, config.ngf, isHeight, filteredThresholds)

		// uPlot attend [xVals, yVals, ...thresholds] avec x en secondes Unix
		expect(plotData).not.toBeNull()
		expect(plotData[0].length).toBe(5)

		// Les x sont en secondes (pas millisecondes)
		expect(plotData[0][0]).toBe(1773568800)
		expect(plotData[0][4]).toBe(1773570000)

		// Les y sont en NGF (valeur + altitude 42.35)
		expect(plotData[1][0]).toBeCloseTo(43.584, 3)  // 1.234 + 42.35
		expect(plotData[1][1]).toBeCloseTo(43.537, 3)  // 1.187 + 42.35

		// Le trou de mesure reste null
		expect(plotData[1][2]).toBeNull()

		// 2 seuils de hauteur filtrés (pas le seuil de débit)
		expect(plotData.length).toBe(4)
		expect(plotData[2]).toEqual([2.5, 2.5, 2.5, 2.5, 2.5])
		expect(plotData[3]).toEqual([3.8, 3.8, 3.8, 3.8, 3.8])
	})

	it('sans NGF, les valeurs brutes sont préservées', () => {
		const config = applyHydroDefaults({ ...userConfig, ngf: false })
		const altitude = stationResponse.link_altimetrySystems[0].altitude

		const plotData = buildHydroPlotData(measuresResponse, altitude, config.ngf, true, [])

		expect(plotData[1][0]).toBe(1.234)
		expect(plotData[1][3]).toBe(1.302)
	})

	it('en mode débit (dataType=5), NGF n\'est jamais appliqué même si activé', () => {
		const config = applyHydroDefaults({ ...userConfig, dataType: 5 })
		const altitude = stationResponse.link_altimetrySystems[0].altitude
		const isHeight = config.dataType === 4

		const plotData = buildHydroPlotData(measuresResponse, altitude, config.ngf, isHeight, [])

		// Pas de conversion NGF sur le débit
		expect(plotData[1][0]).toBe(1.234)
	})

	it('station sans altitude : NGF désactivé automatiquement', () => {
		const stationSansAltitude = { id: 17, link_altimetrySystems: [] }
		const altitude = stationSansAltitude.link_altimetrySystems.length > 0
			? stationSansAltitude.link_altimetrySystems[0].altitude || 0
			: 0

		const plotData = buildHydroPlotData(measuresResponse, altitude, true, true, [])

		expect(plotData[1][0]).toBe(1.234)
	})
})
