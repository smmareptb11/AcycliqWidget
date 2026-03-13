const headers = (token) => ({
	Authorization: `Bearer ${token}`,
	'Content-Type': 'application/json'
})

async function handleResponse(res, context) {
	if (!res.ok) {
		throw new Error(`${context} (HTTP ${res.status})`)
	}
	return res.json()
}

export async function fetchHydroStation(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}`, {
		headers: headers(token)
	})
	return handleResponse(res, `Station hydrométrique ${stationId} introuvable`)
}

export async function fetchHydroMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/chronic/measures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return handleResponse(res, `Impossible de récupérer les mesures de la station ${params.stationId}`)
}

export async function fetchHydroThresholds(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}/threshold`, {
		headers: headers(token)
	})
	return handleResponse(res, `Impossible de récupérer les seuils de la station ${stationId}`)
}

export async function fetchPluvioMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/pluviometer/chartMeasures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return handleResponse(res, `Impossible de récupérer les mesures pluvio de la station ${params.stationId}`)
}
