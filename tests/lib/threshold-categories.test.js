import { describe, it, expect } from 'vitest'
import {
	ALL_CATEGORY_KEYS,
	CATEGORY_STYLES,
	categoryKeyOf,
	resolveCategoryKey,
	thresholdColor,
	normalizeCategoryKeys,
	filterByCategories,
	thresholdKey,
	withVisibility,
	seriesStyleOf,
	isThresholdVisible,
	groupByCategory,
	groupVisibilityState,
	categoryOptionSignature,
	GROUP_ACTIVE,
	GROUP_INACTIVE,
	GROUP_PARTIAL
} from '../../src/lib/threshold-categories.js'

describe('categoryKeyOf', () => {
	it('résout les trois catégories Acycliq', () => {
		expect(categoryKeyOf({ category: 1 })).toBe('situation')
		expect(categoryKeyOf({ category: 2 })).toBe('informatif')
		expect(categoryKeyOf({ category: 3 })).toBe('controle')
	})

	it('tolère une catégorie transmise en chaîne', () => {
		// L'API renvoie déjà dataType en chaîne : même prudence ici.
		expect(categoryKeyOf({ category: '1' })).toBe('situation')
		expect(categoryKeyOf({ category: '3' })).toBe('controle')
	})

	it('rattache à « autre » un seuil sans clé category', () => {
		// Cas majoritaire en base SMMAR (stations 1, 15, 20, 25, 30…).
		expect(categoryKeyOf({ name: 'Vigilance', value: 3 })).toBe('autre')
	})

	it('rattache à « autre » une catégorie nulle ou vide', () => {
		expect(categoryKeyOf({ category: null })).toBe('autre')
		expect(categoryKeyOf({ category: '' })).toBe('autre')
	})

	it('rattache à « autre » un code inconnu plutôt que de perdre le seuil', () => {
		expect(categoryKeyOf({ category: 99 })).toBe('autre')
	})

	it('ne casse pas sur un seuil absent', () => {
		expect(categoryKeyOf(undefined)).toBe('autre')
	})
})

describe('normalizeCategoryKeys', () => {
	it('accepte des libellés', () => {
		expect(normalizeCategoryKeys(['situation', 'controle'])).toEqual(['situation', 'controle'])
	})

	it('accepte des codes numériques', () => {
		expect(normalizeCategoryKeys([1, 2])).toEqual(['situation', 'informatif'])
	})

	it('accepte un mélange de libellés et de codes, casse libre', () => {
		expect(normalizeCategoryKeys(['SITUATION', 2, ' controle '])).toEqual(['situation', 'informatif', 'controle'])
	})

	it('ignore les valeurs inconnues sans échouer', () => {
		expect(normalizeCategoryKeys(['situation', 'inexistant', 42])).toEqual(['situation'])
	})

	it('déduplique', () => {
		expect(normalizeCategoryKeys(['situation', 1, 'situation'])).toEqual(['situation'])
	})

	it('restitue toujours l\'ordre canonique, pas celui de la config', () => {
		expect(normalizeCategoryKeys(['autre', 'situation'])).toEqual(['situation', 'autre'])
	})

	it('retombe sur le fallback quand l\'entrée n\'est pas un tableau', () => {
		expect(normalizeCategoryKeys(undefined)).toEqual(ALL_CATEGORY_KEYS)
		expect(normalizeCategoryKeys('situation')).toEqual(ALL_CATEGORY_KEYS)
		expect(normalizeCategoryKeys(undefined, ['situation'])).toEqual(['situation'])
	})

	it('retourne une copie, jamais le fallback lui-même', () => {
		const fallback = ['situation']
		expect(normalizeCategoryKeys(undefined, fallback)).not.toBe(fallback)
	})

	it('retourne une liste vide pour un tableau vide explicite', () => {
		expect(normalizeCategoryKeys([])).toEqual([])
	})
})

describe('filterByCategories', () => {
	const thresholds = [
		{ name: 'Vigilance', category: 1 },
		{ name: 'Atteinte du Plateau', category: 2 },
		{ name: 'Contrôle amont', category: 3 },
		{ name: 'Autre (Crue du 15/10/2018)' }
	]

	it('ne garde que les catégories proposées', () => {
		expect(filterByCategories(thresholds, ['situation']).map(t => t.name)).toEqual(['Vigilance'])
	})

	it('conserve les seuils non catégorisés via la catégorie « autre »', () => {
		expect(filterByCategories(thresholds, ['autre']).map(t => t.name)).toEqual(['Autre (Crue du 15/10/2018)'])
	})

	it('conserve tout quand toutes les catégories sont proposées', () => {
		expect(filterByCategories(thresholds, ALL_CATEGORY_KEYS)).toHaveLength(4)
	})

	it('retourne une liste vide sans catégorie proposée', () => {
		expect(filterByCategories(thresholds, [])).toEqual([])
	})

	it('gère l\'absence de seuils', () => {
		expect(filterByCategories(null, ALL_CATEGORY_KEYS)).toEqual([])
		expect(filterByCategories(undefined, ALL_CATEGORY_KEYS)).toEqual([])
	})
})

describe('thresholdKey', () => {
	it('distingue deux seuils homonymes de même id', () => {
		// L'API renvoie des id non uniques d'un dataType à l'autre : seul l'index
		// garantit l'unicité.
		const a = { id: 1, name: 'Vigilance' }
		const b = { id: 1, name: 'Vigilance' }
		expect(thresholdKey(a, 0)).not.toBe(thresholdKey(b, 1))
	})

	it('reste stable pour un même seuil à une même position', () => {
		const th = { id: 3, name: 'Crise' }
		expect(thresholdKey(th, 2)).toBe(thresholdKey(th, 2))
	})

	it('gère un seuil sans id', () => {
		expect(thresholdKey({ name: 'Crise' }, 0)).toBe('na:0:Crise')
	})
})

describe('seriesStyleOf', () => {
	it('laisse les seuils de situation au rendu historique', () => {
		// Non-régression : dash [8, 4] et width 2 sont le tracé d'avant les
		// catégories. Le changer modifierait l'apparence de toutes les stations.
		expect(seriesStyleOf({ category: 1 })).toEqual({ width: 2, dash: [8, 4], legendBorder: '2px solid' })
	})

	it('applique le même rendu historique aux seuils de contrôle et non classés', () => {
		expect(seriesStyleOf({ category: 3 })).toEqual(CATEGORY_STYLES.situation)
		expect(seriesStyleOf({ name: 'Repère de crue' })).toEqual(CATEGORY_STYLES.situation)
	})

	it('fait reculer les seuils informatifs derrière la donnée', () => {
		const style = seriesStyleOf({ category: 2 })
		expect(style.width).toBe(1)
		expect(style.dash).toEqual([2, 3])
		expect(style.legendBorder).toBe('1px dotted')
	})

	it('ne casse pas sur un seuil absent', () => {
		expect(seriesStyleOf(undefined)).toEqual(CATEGORY_STYLES.autre)
	})
})

describe('isThresholdVisible', () => {
	const th = { id: 1, name: 'Atteinte du Plateau', category: 2 }

	it('respecte un choix explicite du visiteur', () => {
		const vis = new Map([[thresholdKey(th, 0), false]])
		expect(isThresholdVisible(th, 0, vis, ['situation', 'informatif'])).toBe(false)
	})

	it('retombe sur les catégories par défaut avant tout choix', () => {
		// Cas du tout premier rendu : la Map est encore vide, l'effet
		// d'initialisation ne s'est pas encore exécuté.
		expect(isThresholdVisible(th, 0, new Map(), ['situation'])).toBe(false)
		expect(isThresholdVisible(th, 0, new Map(), ['situation', 'informatif'])).toBe(true)
	})

	it('distingue deux seuils homonymes par leur index', () => {
		const vis = new Map([[thresholdKey(th, 1), false]])
		expect(isThresholdVisible(th, 0, vis, ['informatif'])).toBe(true)
		expect(isThresholdVisible(th, 1, vis, ['informatif'])).toBe(false)
	})
})

describe('groupByCategory', () => {
	// Ordre volontairement mélangé : c'est la garantie que le groupement ne
	// suppose rien de l'ordre renvoyé par l'API.
	const thresholds = [
		{ id: 1, name: 'Atteinte du Plateau', category: 2 },
		{ id: 2, name: 'Vigilance', category: 1 },
		{ id: 3, name: 'Repère de crue' },
		{ id: 4, name: 'Alerte', category: 1 }
	]

	it('restitue les groupes dans l\'ordre canonique des catégories', () => {
		expect(groupByCategory(thresholds).map(g => g.key)).toEqual(['situation', 'informatif', 'autre'])
	})

	it('porte le libellé lisible de la catégorie', () => {
		expect(groupByCategory(thresholds)[0].label).toBe('Situation')
	})

	it('préserve l\'index d\'origine de chaque seuil', () => {
		// C'est LA propriété critique : cet index adresse la colonne de plotData
		// et la série uPlot (index + 2). Le perdre décalerait toutes les bascules.
		const situation = groupByCategory(thresholds)[0]
		expect(situation.items.map(i => i.index)).toEqual([1, 3])
		expect(situation.items.map(i => i.threshold.name)).toEqual(['Vigilance', 'Alerte'])
	})

	it('omet les catégories sans aucun seuil', () => {
		expect(groupByCategory([{ name: 'Vigilance', category: 1 }]).map(g => g.key)).toEqual(['situation'])
	})

	it('gère l\'absence de seuils', () => {
		expect(groupByCategory(null)).toEqual([])
		expect(groupByCategory([])).toEqual([])
	})
})

describe('groupVisibilityState', () => {
	const items = [
		{ threshold: { id: 1, name: 'Vigilance', category: 1 }, index: 0 },
		{ threshold: { id: 2, name: 'Alerte', category: 1 }, index: 1 }
	]
	const keyOf = i => thresholdKey(items[i].threshold, items[i].index)

	it('est actif quand tous les seuils du groupe sont visibles', () => {
		const vis = new Map([[keyOf(0), true], [keyOf(1), true]])
		expect(groupVisibilityState(items, vis, [])).toBe(GROUP_ACTIVE)
	})

	it('est grisé quand aucun ne l\'est', () => {
		const vis = new Map([[keyOf(0), false], [keyOf(1), false]])
		expect(groupVisibilityState(items, vis, ['situation'])).toBe(GROUP_INACTIVE)
	})

	it('est intermédiaire quand le groupe est panaché', () => {
		const vis = new Map([[keyOf(0), true], [keyOf(1), false]])
		expect(groupVisibilityState(items, vis, [])).toBe(GROUP_PARTIAL)
	})

	it('déduit l\'état des catégories par défaut avant tout choix', () => {
		expect(groupVisibilityState(items, new Map(), ['situation'])).toBe(GROUP_ACTIVE)
		expect(groupVisibilityState(items, new Map(), ['informatif'])).toBe(GROUP_INACTIVE)
	})

	it('ne déclare pas actif un groupe vide', () => {
		// `0 === 0` passerait le test « tous visibles » sans la garde explicite.
		expect(groupVisibilityState([], new Map(), ALL_CATEGORY_KEYS)).toBe(GROUP_INACTIVE)
		expect(groupVisibilityState(null, new Map(), ALL_CATEGORY_KEYS)).toBe(GROUP_INACTIVE)
	})
})

describe('categoryOptionSignature', () => {
	it('distingue le tableau vide de l\'option absente', () => {
		// La collision entre ces deux cas ferait servir une valeur mémoïsée pour
		// l'autre, alors que normalizeCategoryKeys en tire des résultats opposés.
		expect(categoryOptionSignature([])).not.toBe(categoryOptionSignature(undefined))
	})

	it('est stable pour un même contenu', () => {
		expect(categoryOptionSignature(['situation', 'autre']))
			.toBe(categoryOptionSignature(['situation', 'autre']))
	})

	it('change dès que le contenu change', () => {
		expect(categoryOptionSignature(['situation']))
			.not.toBe(categoryOptionSignature(['situation', 'autre']))
	})

	it('traite toute valeur non tableau comme absente', () => {
		expect(categoryOptionSignature('situation')).toBe(categoryOptionSignature(undefined))
		expect(categoryOptionSignature(null)).toBe(categoryOptionSignature(undefined))
	})
})

describe('constantes partagées', () => {
	it('gèle les styles pour empêcher une mutation entre instances', () => {
		// Trois catégories partagent le même objet de style, lui-même partagé par
		// tous les widgets de la page : une mutation doit lever, pas se propager.
		expect(() => { CATEGORY_STYLES.situation.width = 99 }).toThrow()
		expect(CATEGORY_STYLES.situation.width).toBe(2)
	})

	it('gèle la liste des clés, qui sert de valeur par défaut de config', () => {
		expect(() => { ALL_CATEGORY_KEYS.push('inexistant') }).toThrow()
		expect(ALL_CATEGORY_KEYS).toHaveLength(4)
	})
})

describe('resolveCategoryKey', () => {
	it('résout une clé, quelles que soient la casse et les espaces', () => {
		expect(resolveCategoryKey('situation')).toBe('situation')
		expect(resolveCategoryKey('  Controle  ')).toBe('controle')
		expect(resolveCategoryKey('INFORMATIF')).toBe('informatif')
	})

	// La clé canonique est `controle`, sans accent : c'est ce que documente
	// docs/integration.md et ce que produisent les cases du playground. Le libellé
	// affiché « Contrôle » n'est pas une valeur de configuration acceptée, et la
	// validation le signale explicitement plutôt que de l'ignorer.
	it('ne résout pas le libellé accentué, qui n’est pas la clé de configuration', () => {
		expect(resolveCategoryKey('Contrôle')).toBeNull()
	})

	it('résout un code numérique, entier ou chaîne', () => {
		expect(resolveCategoryKey(1)).toBe('situation')
		expect(resolveCategoryKey('2')).toBe('informatif')
	})

	it('résout la clé de la catégorie « non classé », qui n’a pas de code', () => {
		expect(resolveCategoryKey('autre')).toBe('autre')
	})

	it('renvoie null sur une valeur qui ne désigne aucune catégorie', () => {
		expect(resolveCategoryKey('inconnue')).toBeNull()
		expect(resolveCategoryKey(99)).toBeNull()
		expect(resolveCategoryKey('')).toBeNull()
	})

	// Contrat distinct de categoryKeyOf, qui lit la donnée de l'API : côté API un
	// libellé n'est pas une valeur attendue et ne doit pas être interprété.
	it('accepte des libellés là où categoryKeyOf ne lit que des codes', () => {
		expect(resolveCategoryKey('situation')).toBe('situation')
		expect(categoryKeyOf({ category: 'situation' })).toBe('autre')
	})
})

describe('thresholdColor', () => {
	it('renvoie la couleur de l’API quand elle existe', () => {
		expect(thresholdColor({ htmlColor: '#ffa500' })).toBe('#ffa500')
	})

	it('retombe sur la couleur de repli sans htmlColor', () => {
		const repli = thresholdColor({ name: 'Repère' })
		expect(repli).toBeTruthy()
		expect(thresholdColor({ htmlColor: '' })).toBe(repli)
		expect(thresholdColor(null)).toBe(repli)
	})
})

describe('withVisibility', () => {
	const situation = { id: 1, name: 'Vigilance', category: 1 }
	const informatif = { id: 2, name: 'Atteinte du Plateau', category: 2 }
	const items = [{ threshold: situation, index: 0 }, { threshold: informatif, index: 1 }]

	it('écrit la visibilité de tout un lot en une passe', () => {
		const next = withVisibility(new Map(), items, false)
		expect(next.get(thresholdKey(situation, 0))).toBe(false)
		expect(next.get(thresholdKey(informatif, 1))).toBe(false)
	})

	it('ne mute pas l’état reçu', () => {
		const before = new Map()
		const after = withVisibility(before, items, true)
		expect(before.size).toBe(0)
		expect(after).not.toBe(before)
		expect(after.size).toBe(2)
	})

	it('conserve les entrées hors du lot', () => {
		const autre = { id: 9, name: 'Repère' }
		const before = new Map([[thresholdKey(autre, 5), false]])
		const after = withVisibility(before, items, true)
		expect(after.get(thresholdKey(autre, 5))).toBe(false)
		expect(after.size).toBe(3)
	})

	it('écrase un choix antérieur sur les mêmes seuils', () => {
		const masque = withVisibility(new Map(), items, false)
		const reaffiche = withVisibility(masque, items, true)
		expect(reaffiche.get(thresholdKey(situation, 0))).toBe(true)
	})

	it('gère un lot absent ou vide', () => {
		expect(withVisibility(new Map(), [], true).size).toBe(0)
		expect(withVisibility(new Map(), null, true).size).toBe(0)
	})
})
