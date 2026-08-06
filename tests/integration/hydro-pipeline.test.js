import { describe, it, expect } from 'vitest'
import { validateHydroConfig, applyHydroDefaults } from '../../src/lib/config.js'
import { buildHydroPlotData, applyThresholdsNgf, THRESHOLD_SERIES_OFFSET } from '../../src/lib/data-transform.js'
import {
	normalizeCategoryKeys,
	filterByCategories,
	withVisibility,
	isThresholdVisible,
	groupByCategory,
	groupVisibilityState,
	seriesStyleOf,
	GROUP_ACTIVE,
	GROUP_INACTIVE,
	GROUP_PARTIAL
} from '../../src/lib/threshold-categories.js'

// Simule une réponse API réaliste : station hydro avec altitude NGF et seuils de vigilance
const stationResponse = {
	id: 17,
	name: 'Aisne à Soissons',
	link_altimetrySystems: [{ altitude: 42.35 }]
}

const thresholdsResponse = [
	{ name: 'Vigilance jaune', value: 2.5, htmlColor: '#FFCC00', dataType: 4, category: 1 },
	{ name: 'Vigilance orange', value: 3.8, htmlColor: '#FF8800', dataType: 4, category: 1 },
	{ name: 'Débit seuil', value: 50, htmlColor: '#FF0000', dataType: 5, category: 1 }
]

// Réponse reflétant la diversité réelle relevée sur l'API SMMAR : catégories 1 à
// 3, `dataType` en chaîne, seuil informatif sans htmlColor, et seuil hérité sans
// aucune clé `category` (cas majoritaire sur les stations pas encore taguées).
//
// La catégorie 1 porte volontairement DEUX seuils, à des positions non
// contiguës : c'est la seule façon d'éprouver l'état panaché d'un groupe et la
// préservation des index d'origine par groupByCategory. Un groupe à un seul
// élément ne peut jamais être panaché.
const mixedThresholdsResponse = [
	{ id: 1, name: 'Vigilance', value: 2.8, dataType: '4', htmlColor: '#ffff00', category: 1 },
	{ id: 2, name: 'Atteinte du Plateau', value: 7.29, dataType: '4', category: 2 },
	{ id: 3, name: 'Contrôle amont', value: 9.1, dataType: '4', htmlColor: '#000000', category: 3 },
	{ id: 4, name: 'Autre (Crue du 15/10/2018)', value: 4.95, dataType: '4' },
	{ id: 5, name: 'Alerte', value: 3.4, dataType: '4', htmlColor: '#ffa500', category: 1 }
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
		expect(config.color).toBe('#0284C7')
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

	it('applique l\'altitude NGF aux seuils comme à la courbe (ticket #1)', () => {
		const config = applyHydroDefaults(userConfig)
		const isHeight = config.dataType === 4
		const altitude = stationResponse.link_altimetrySystems[0].altitude
		const applyNgf = config.ngf && isHeight && altitude > 0

		// Utilise la vraie fonction de production (celle du composant) : une
		// régression de l'offset des seuils ferait échouer ce test.
		const filteredThresholds = applyThresholdsNgf(
			thresholdsResponse.filter(th => String(th.dataType) === String(config.dataType)),
			altitude,
			applyNgf
		)

		const plotData = buildHydroPlotData(measuresResponse, altitude, config.ngf, isHeight, filteredThresholds)

		// 2.5 + 42.35 et 3.8 + 42.35 : les lignes de seuil suivent la courbe NGF
		expect(plotData[2][0]).toBeCloseTo(44.85, 3)
		expect(plotData[3][0]).toBeCloseTo(46.15, 3)
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

describe('hydro pipeline : filtrage des seuils par catégorie', () => {
	const altitude = stationResponse.link_altimetrySystems[0].altitude

	/**
	 * Reproduit la chaîne exacte du composant : filtre dataType, recalage NGF,
	 * puis filtre par catégorie proposée. L'ordre compte — le NGF doit s'appliquer
	 * avant le filtrage pour rester uniforme.
	 */
	function pipeline(userConfig, thresholds = mixedThresholdsResponse) {
		const config = applyHydroDefaults(userConfig)
		const isHeight = config.dataType === 4
		const applyNgf = config.ngf && isHeight && altitude > 0

		const displayThresholds = filterByCategories(
			applyThresholdsNgf(
				thresholds.filter(th => String(th.dataType) === String(config.dataType)),
				altitude,
				applyNgf
			),
			normalizeCategoryKeys(config.thresholdCategories)
		)

		return {
			config,
			displayThresholds,
			plotData: buildHydroPlotData(measuresResponse, altitude, config.ngf, isHeight, displayThresholds)
		}
	}

	const baseConfig = {
		apiUrl: 'https://api.example.com',
		token: 'abc123',
		container: '#chart',
		idStation: 17,
		dataType: 4,
		ngf: false
	}

	it('conserve tous les seuils par défaut, y compris ceux sans catégorie', () => {
		// Non-régression : avant l'introduction des catégories, `threshold: true`
		// affichait l'intégralité des seuils de la station.
		const { displayThresholds, plotData } = pipeline(baseConfig)

		expect(displayThresholds).toHaveLength(5)
		expect(plotData.length).toBe(2 + 5)
	})

	it('restreint les colonnes de plotData aux catégories proposées', () => {
		const { displayThresholds, plotData } = pipeline({ ...baseConfig, thresholdCategories: ['situation'] })

		expect(displayThresholds.map(t => t.name)).toEqual(['Vigilance', 'Alerte'])
		expect(plotData.length).toBe(2 + 2)
		expect(plotData[2]).toEqual([2.8, 2.8, 2.8, 2.8, 2.8])
	})

	it('écarte totalement un seuil non proposé, ni colonne ni série', () => {
		const { displayThresholds, plotData } = pipeline({ ...baseConfig, thresholdCategories: ['informatif', 'controle'] })

		expect(displayThresholds.map(t => t.name)).toEqual(['Atteinte du Plateau', 'Contrôle amont'])
		expect(plotData.length).toBe(2 + 2)
		// Aucune colonne ne porte la valeur du seuil « Vigilance » écarté.
		expect(plotData.slice(2).some(col => col[0] === 2.8)).toBe(false)
	})

	it('retient les seuils hérités via la catégorie « non classé »', () => {
		const { displayThresholds } = pipeline({ ...baseConfig, thresholdCategories: ['autre'] })

		expect(displayThresholds.map(t => t.name)).toEqual(['Autre (Crue du 15/10/2018)'])
	})

	it('accepte les catégories exprimées en codes numériques', () => {
		const { displayThresholds } = pipeline({ ...baseConfig, thresholdCategories: [1, 3] })

		// L'ordre d'origine est conservé : le filtrage ne réordonne jamais.
		expect(displayThresholds.map(t => t.name)).toEqual(['Vigilance', 'Contrôle amont', 'Alerte'])
	})

	it('applique le recalage NGF aux seuils conservés après filtrage', () => {
		// Le filtrage ne doit pas court-circuiter le décalage d'altitude (ticket #1).
		const { plotData } = pipeline({ ...baseConfig, ngf: true, thresholdCategories: ['situation'] })

		expect(plotData[2][0]).toBeCloseTo(45.15, 3)  // 2.8 + 42.35
	})

	it('grise les catégories proposées mais non actives par défaut', () => {
		const { displayThresholds } = pipeline({
			...baseConfig,
			thresholdCategories: ['situation', 'informatif'],
			thresholdCategoriesDefault: ['situation']
		})

		// Avant tout clic, l'état de visibilité est vide : c'est le repli sur les
		// catégories actives par défaut qui décide, comme au premier rendu.
		const defaultKeys = normalizeCategoryKeys(['situation'])

		expect(isThresholdVisible(displayThresholds[0], 0, new Map(), defaultKeys)).toBe(true)   // Vigilance
		expect(isThresholdVisible(displayThresholds[1], 1, new Map(), defaultKeys)).toBe(false)  // Atteinte du Plateau
	})

	it('valide une config restreignant les catégories', () => {
		const { valid } = validateHydroConfig({
			...baseConfig,
			thresholdCategories: ['situation', 'informatif'],
			thresholdCategoriesDefault: ['situation']
		})

		expect(valid).toBe(true)
	})
})

describe('hydro pipeline: légende groupée par catégorie', () => {
	const displayed = mixedThresholdsResponse.filter(th => String(th.dataType) === '4')

	it('produit un groupe par catégorie présente, dans l\'ordre canonique', () => {
		expect(groupByCategory(displayed).map(g => g.key)).toEqual(['situation', 'informatif', 'controle', 'autre'])
	})

	it('aligne les index de groupe sur les colonnes de plotData', () => {
		// Chaque index de groupe doit adresser la bonne colonne : plotData vaut
		// [x, mesures, ...seuils] : la colonne d'un seuil est index + THRESHOLD_SERIES_OFFSET.
		const plotData = buildHydroPlotData(measuresResponse, 0, false, true, displayed)
		for (const group of groupByCategory(displayed)) {
			for (const { threshold, index } of group.items) {
				expect(plotData[index + THRESHOLD_SERIES_OFFSET][0]).toBe(threshold.value)
			}
		}
	})

	it('grise le groupe informatif quand il est proposé mais pas actif par défaut', () => {
		const defaultKeys = normalizeCategoryKeys(['situation'])
		const visibility = new Map()
		const groups = groupByCategory(displayed)

		const situation = groups.find(g => g.key === 'situation')
		const informatif = groups.find(g => g.key === 'informatif')

		expect(groupVisibilityState(situation.items, visibility, defaultKeys)).toBe(GROUP_ACTIVE)
		expect(groupVisibilityState(informatif.items, visibility, defaultKeys)).toBe(GROUP_INACTIVE)
	})

	it('affiche tout le groupe au premier clic sur un en-tête grisé', () => {
		const defaultKeys = normalizeCategoryKeys(['situation'])
		const informatif = groupByCategory(displayed).find(g => g.key === 'informatif')

		const after = withVisibility(new Map(), informatif.items, true)

		expect(groupVisibilityState(informatif.items, after, defaultKeys)).toBe(GROUP_ACTIVE)
		for (const { threshold, index } of informatif.items) {
			expect(isThresholdVisible(threshold, index, after, defaultKeys)).toBe(true)
		}
	})

	it('masque tout le groupe au clic sur un en-tête entièrement actif', () => {
		const defaultKeys = normalizeCategoryKeys(['situation'])
		const situation = groupByCategory(displayed).find(g => g.key === 'situation')

		const after = withVisibility(new Map(), situation.items, false)

		expect(groupVisibilityState(situation.items, after, defaultKeys)).toBe(GROUP_INACTIVE)
	})

	it('signale un groupe panaché puis le complète au clic', () => {
		const defaultKeys = normalizeCategoryKeys(['situation'])
		const situation = groupByCategory(displayed).find(g => g.key === 'situation')

		// Vrai groupe de catégorie, à deux seuils d'index non contigus (0 et 4) :
		// c'est la configuration que produit réellement groupByCategory.
		expect(situation.items.map(i => i.index)).toEqual([0, 4])

		// Un seul des deux masqué à la main → l'en-tête doit passer en panaché.
		const mixed = withVisibility(new Map(), [situation.items[0]], false)
		expect(groupVisibilityState(situation.items, mixed, defaultKeys)).toBe(GROUP_PARTIAL)

		// Un clic sur un en-tête panaché rallume tout le groupe, il ne le masque pas.
		const completed = withVisibility(mixed, situation.items, true)
		expect(groupVisibilityState(situation.items, completed, defaultKeys)).toBe(GROUP_ACTIVE)
	})

	it('conserve l\'état de groupe à travers un rafraîchissement automatique', () => {
		// useChart détruit et recrée l'instance uPlot à chaque nouveau plotData.
		// La visibilité vit côté Preact et doit survivre à cette reconstruction :
		// c'est la régression qui rendait la fonctionnalité inopérante au bout de
		// 5 minutes.
		const defaultKeys = normalizeCategoryKeys(['situation', 'informatif'])
		const situation = groupByCategory(displayed).find(g => g.key === 'situation')
		const visibility = withVisibility(new Map(), situation.items, false)

		const before = buildHydroPlotData(measuresResponse, 0, false, true, displayed)
		const after = buildHydroPlotData([...measuresResponse, [1773570300000, 1.31]], 0, false, true, displayed)
		expect(before[0].length).toBe(5)
		expect(after[0].length).toBe(6)

		// Les colonnes de seuils gardent le même rang après reconstruction : c'est
		// ce qui permet aux clés de visibilité, indexées sur cette position, de
		// rester valides. Si ce nombre changeait, la Map adresserait les mauvaises
		// séries au cycle suivant.
		expect(after.length).toBe(before.length)
		for (const { threshold, index } of situation.items) {
			expect(after[index + THRESHOLD_SERIES_OFFSET][0]).toBe(threshold.value)
		}

		// Et la visibilité, portée par Preact et non par l'instance uPlot détruite,
		// n'a pas été réinitialisée.
		expect(groupVisibilityState(situation.items, visibility, defaultKeys)).toBe(GROUP_INACTIVE)
	})

	it('distingue le tracé des seuils informatifs de celui des seuils de situation', () => {
		const situation = displayed.find(th => th.category === 1)
		const informatif = displayed.find(th => th.category === 2)

		expect(seriesStyleOf(situation).width).toBe(2)
		expect(seriesStyleOf(informatif).width).toBe(1)
		expect(seriesStyleOf(informatif).dash).not.toEqual(seriesStyleOf(situation).dash)
	})

	it('rend la légende à plat sur une station sans aucune catégorie', () => {
		// Cas majoritaire du parc SMMAR : aucun seuil tagué. Un seul groupe → pas
		// d'en-tête, donc apparence strictement identique à celle d'avant.
		const untagged = [
			{ id: 1, name: 'Vigilance', value: 2.5, dataType: '4', htmlColor: '#ffff00' },
			{ id: 2, name: 'Alerte', value: 3.2, dataType: '4', htmlColor: '#ffa500' }
		]
		const groups = groupByCategory(untagged)
		expect(groups).toHaveLength(1)
		expect(groups[0].key).toBe('autre')
		expect(seriesStyleOf(untagged[0])).toEqual(seriesStyleOf({ category: 1 }))
	})
})
