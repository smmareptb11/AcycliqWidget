import { THRESHOLD_CATEGORIES, ALL_CATEGORY_KEYS, normalizeCategoryKeys, resolveCategoryKey } from './threshold-categories.js'

const HYDRO_DEFAULTS = {
	width: '100%',
	height: '100%',
	color: '#0284C7',
	dataType: 4,
	hours: 3,
	ngf: true,
	threshold: true,
	// Toutes les catégories sont proposées, et toutes sont actives au
	// chargement : c'est ce qui préserve le comportement historique de
	// `threshold: true`, qui affichait l'intégralité des seuils de la station.
	thresholdCategories: ALL_CATEGORY_KEYS,
	thresholdCategoriesDefault: ALL_CATEGORY_KEYS,
	refresh: 5
}

const PLUVIO_DEFAULTS = {
	width: '100%',
	height: '100%',
	color: '#0284C7',
	colorCumul: '#EA580C',
	hours: 3,
	cumul: true,
	groupFunc: 'all',
	refresh: 5
}

const GROUP_FUNCS = ['all', 'SUM_HOUR', 'SUM_DAY']

const CATEGORY_HINT = THRESHOLD_CATEGORIES
	.map(c => (c.code != null ? `"${c.key}" (${c.code})` : `"${c.key}"`))
	.join(', ')

/**
 * Valide une option de catégories de seuils. Renvoie `false` dès qu'une erreur
 * est signalée, pour que l'appelant sache s'il peut enchaîner sur le contrôle
 * croisé des deux options.
 */
function validateCategoryOption(value, name, errors) {
	if (value === undefined) return true

	if (!Array.isArray(value)) {
		errors.push(`"${name}" doit être un tableau de catégories de seuils.`)
		return false
	}

	// normalizeCategoryKeys ignore silencieusement les valeurs inconnues : on
	// repère donc les entrées fautives une à une pour les nommer dans le message.
	const unknown = value.filter(entry => resolveCategoryKey(entry) === null)
	if (unknown.length > 0) {
		errors.push(`"${name}" contient des catégories inconnues (${unknown.join(', ')}). Valeurs acceptées : ${CATEGORY_HINT}.`)
		return false
	}

	return true
}

export function validateHydroConfig(config) {
	const errors = []

	if (!config || typeof config !== 'object') {
		return { valid: false, errors: ['Configuration invalide : doit être un objet.'] }
	}

	if (!config.apiUrl) errors.push('"apiUrl" est obligatoire.')
	if (!config.token) errors.push('"token" est obligatoire.')
	if (!config.container) errors.push('"container" est obligatoire.')
	if (!config.idStation) errors.push('"idStation" est obligatoire.')

	if (config.dataType !== undefined && ![4, 5].includes(config.dataType)) {
		errors.push('"dataType" doit être 4 (hauteur) ou 5 (débit).')
	}

	if (config.hours !== undefined && (typeof config.hours !== 'number' || config.hours < 1)) {
		errors.push('"hours" doit être un nombre positif.')
	}

	if (config.refresh !== undefined && (typeof config.refresh !== 'number' || config.refresh < 1)) {
		errors.push('"refresh" doit être un nombre positif (en minutes).')
	}

	const categoriesOk = validateCategoryOption(config.thresholdCategories, 'thresholdCategories', errors)
	const defaultsOk = validateCategoryOption(config.thresholdCategoriesDefault, 'thresholdCategoriesDefault', errors)

	// Une catégorie active par défaut mais non proposée ne serait ni affichée ni
	// activable depuis la légende : une configuration silencieusement
	// inopérante, qui mérite une erreur explicite plutôt qu'un filtrage discret.
	if (categoriesOk && defaultsOk) {
		const proposed = normalizeCategoryKeys(config.thresholdCategories)
		const orphans = normalizeCategoryKeys(config.thresholdCategoriesDefault, [])
			.filter(key => !proposed.includes(key))
		if (orphans.length > 0) {
			errors.push(`"thresholdCategoriesDefault" contient des catégories absentes de "thresholdCategories" : ${orphans.join(', ')}.`)
		}
	}

	return { valid: errors.length === 0, errors }
}

export function validatePluvioConfig(config) {
	const errors = []

	if (!config || typeof config !== 'object') {
		return { valid: false, errors: ['Configuration invalide : doit être un objet.'] }
	}

	if (!config.apiUrl) errors.push('"apiUrl" est obligatoire.')
	if (!config.token) errors.push('"token" est obligatoire.')
	if (!config.container) errors.push('"container" est obligatoire.')
	if (!config.idStation) errors.push('"idStation" est obligatoire.')

	if (config.hours !== undefined && (typeof config.hours !== 'number' || config.hours < 1)) {
		errors.push('"hours" doit être un nombre positif.')
	}

	if (config.refresh !== undefined && (typeof config.refresh !== 'number' || config.refresh < 1)) {
		errors.push('"refresh" doit être un nombre positif (en minutes).')
	}

	if (config.groupFunc !== undefined && !GROUP_FUNCS.includes(config.groupFunc)) {
		errors.push(`"groupFunc" doit valoir ${GROUP_FUNCS.map(g => `"${g}"`).join(', ')}.`)
	}

	if (config.colorCumul !== undefined && typeof config.colorCumul !== 'string') {
		errors.push('"colorCumul" doit être une chaîne (couleur CSS).')
	}

	return { valid: errors.length === 0, errors }
}

export function applyHydroDefaults(config) {
	return { ...HYDRO_DEFAULTS, ...config }
}

export function applyPluvioDefaults(config) {
	return { ...PLUVIO_DEFAULTS, ...config }
}
