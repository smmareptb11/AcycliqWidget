import { describe, it, expect } from 'vitest'
import { validateHydroConfig, validatePluvioConfig, applyHydroDefaults } from '../../src/lib/config.js'
import { ALL_CATEGORY_KEYS } from '../../src/lib/threshold-categories.js'

const validHydroConfig = {
	apiUrl: 'https://api.example.com',
	token: 'abc123',
	container: '#app',
	idStation: 17
}

const validPluvioConfig = {
	apiUrl: 'https://api.example.com',
	token: 'abc123',
	container: '#app',
	idStation: 719
}

describe('validateHydroConfig', () => {
	it('accepts a valid config', () => {
		const result = validateHydroConfig(validHydroConfig)
		expect(result.valid).toBe(true)
		expect(result.errors).toEqual([])
	})

	it('rejects null config', () => {
		const result = validateHydroConfig(null)
		expect(result.valid).toBe(false)
	})

	it('rejects non-object config', () => {
		const result = validateHydroConfig('string')
		expect(result.valid).toBe(false)
	})

	it('requires apiUrl', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, apiUrl: '' })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('apiUrl'))).toBe(true)
	})

	it('requires token', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, token: '' })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('token'))).toBe(true)
	})

	it('requires container', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, container: '' })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('container'))).toBe(true)
	})

	it('requires idStation', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, idStation: 0 })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('idStation'))).toBe(true)
	})

	it('rejects invalid dataType', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, dataType: 3 })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('dataType'))).toBe(true)
	})

	it('accepts dataType 4 and 5', () => {
		expect(validateHydroConfig({ ...validHydroConfig, dataType: 4 }).valid).toBe(true)
		expect(validateHydroConfig({ ...validHydroConfig, dataType: 5 }).valid).toBe(true)
	})

	it('rejects hours < 1', () => {
		const { valid } = validateHydroConfig({ ...validHydroConfig, hours: 0 })
		expect(valid).toBe(false)
	})

	it('rejects non-number hours', () => {
		const { valid } = validateHydroConfig({ ...validHydroConfig, hours: '3' })
		expect(valid).toBe(false)
	})

	it('rejects refresh < 1', () => {
		const { valid } = validateHydroConfig({ ...validHydroConfig, refresh: 0 })
		expect(valid).toBe(false)
	})

	it('collects multiple errors', () => {
		const { errors } = validateHydroConfig({})
		expect(errors.length).toBeGreaterThan(1)
	})

	it('accepte les catégories de seuils en libellés comme en codes', () => {
		expect(validateHydroConfig({ ...validHydroConfig, thresholdCategories: ['situation', 'autre'] }).valid).toBe(true)
		expect(validateHydroConfig({ ...validHydroConfig, thresholdCategories: [1, 2, 3] }).valid).toBe(true)
	})

	it('rejette une option de catégories qui n\'est pas un tableau', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, thresholdCategories: 'situation' })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('thresholdCategories'))).toBe(true)
	})

	it('rejette une catégorie inconnue en la nommant', () => {
		const { valid, errors } = validateHydroConfig({ ...validHydroConfig, thresholdCategories: ['situation', 'inexistant'] })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('inexistant'))).toBe(true)
	})

	it('rejette une catégorie active par défaut mais non proposée', () => {
		// Config silencieusement inopérante : le seuil ne serait ni affiché ni
		// activable depuis la légende.
		const { valid, errors } = validateHydroConfig({
			...validHydroConfig,
			thresholdCategories: ['situation'],
			thresholdCategoriesDefault: ['informatif']
		})
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('thresholdCategoriesDefault'))).toBe(true)
	})

	it('accepte un sous-ensemble cohérent des catégories proposées', () => {
		const { valid } = validateHydroConfig({
			...validHydroConfig,
			thresholdCategories: ['situation', 'informatif'],
			thresholdCategoriesDefault: ['situation']
		})
		expect(valid).toBe(true)
	})

	it('accepte de restreindre les catégories proposées sans préciser les actives', () => {
		// Contrat d'ordre : la validation s'applique à la config BRUTE, avant
		// applyHydroDefaults. Si l'appelant inversait les deux (main.jsx valide en
		// l.27 puis applique les défauts en l.38), les défauts rempliraient
		// thresholdCategoriesDefault avec les quatre catégories et le contrôle
		// croisé rejetterait cette config parfaitement légitime.
		const { valid, errors } = validateHydroConfig({
			...validHydroConfig,
			thresholdCategories: ['situation']
		})
		expect(valid).toBe(true)
		expect(errors).toEqual([])
	})

	it('reste valide sur la config une fois les défauts appliqués', () => {
		// Filet de sécurité pour le même contrat, vu depuis l'autre bout : même si
		// quelqu'un revalidait après coup, une config par défaut doit passer.
		const { valid } = validateHydroConfig(applyHydroDefaults(validHydroConfig))
		expect(valid).toBe(true)
	})
})

describe('applyHydroDefaults', () => {
	it('propose et active toutes les catégories de seuils par défaut', () => {
		// Non-régression : `threshold: true` affichait historiquement tous les
		// seuils, y compris ceux sans catégorie.
		const config = applyHydroDefaults(validHydroConfig)
		expect(config.thresholdCategories).toEqual(ALL_CATEGORY_KEYS)
		expect(config.thresholdCategoriesDefault).toEqual(ALL_CATEGORY_KEYS)
	})

	it('laisse la config de l\'hôte primer sur les défauts', () => {
		const config = applyHydroDefaults({ ...validHydroConfig, thresholdCategoriesDefault: ['situation'] })
		expect(config.thresholdCategoriesDefault).toEqual(['situation'])
	})
})

describe('validatePluvioConfig', () => {
	it('accepts a valid config', () => {
		expect(validatePluvioConfig(validPluvioConfig).valid).toBe(true)
	})

	it('requires all mandatory fields', () => {
		const { errors } = validatePluvioConfig({})
		expect(errors.some(e => e.includes('apiUrl'))).toBe(true)
		expect(errors.some(e => e.includes('token'))).toBe(true)
		expect(errors.some(e => e.includes('container'))).toBe(true)
		expect(errors.some(e => e.includes('idStation'))).toBe(true)
	})

	it('rejects invalid hours', () => {
		expect(validatePluvioConfig({ ...validPluvioConfig, hours: -1 }).valid).toBe(false)
	})

	it('rejects invalid refresh', () => {
		expect(validatePluvioConfig({ ...validPluvioConfig, refresh: 0 }).valid).toBe(false)
	})

	it('accepts the supported groupFunc values', () => {
		for (const groupFunc of ['all', 'SUM_HOUR', 'SUM_DAY']) {
			expect(validatePluvioConfig({ ...validPluvioConfig, groupFunc }).valid).toBe(true)
		}
	})

	it('rejects an unknown groupFunc', () => {
		const { valid, errors } = validatePluvioConfig({ ...validPluvioConfig, groupFunc: 'SUM_WEEK' })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('groupFunc'))).toBe(true)
	})

	it('accepts a string colorCumul', () => {
		expect(validatePluvioConfig({ ...validPluvioConfig, colorCumul: '#00A86B' }).valid).toBe(true)
	})

	it('rejects a non-string colorCumul', () => {
		const { valid, errors } = validatePluvioConfig({ ...validPluvioConfig, colorCumul: 123 })
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('colorCumul'))).toBe(true)
	})
})
