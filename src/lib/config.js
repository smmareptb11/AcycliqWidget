const HYDRO_DEFAULTS = {
	width: '100%',
	height: '100%',
	color: '#0284C7',
	dataType: 4,
	hours: 3,
	ngf: true,
	threshold: true,
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
