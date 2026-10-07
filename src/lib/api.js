const headers = (token) => ({
	'Content-Type': 'application/json',
	...(token && { Authorization: `Bearer ${token}` })
})

async function handleResponse(res, subject, token) {
	if (res.status === 401 || res.status === 403) {
		throw new Error(`Accès à l'API refusé : jeton manquant ou invalide (HTTP ${res.status})`)
	}
	if (!res.ok) {
		const detail = token ? '' : ', aucun jeton fourni'
		throw new Error(`Impossible de récupérer ${subject} (HTTP ${res.status}${detail})`)
	}
	return res.json()
}

export async function fetchHydroStation(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}`, {
		headers: headers(token)
	})
	return handleResponse(res, `la station hydrométrique ${stationId}`, token)
}

export async function fetchHydroMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/chronic/measures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return handleResponse(res, `les mesures de la station ${params.stationId}`, token)
}

export async function fetchHydroThresholds(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}/threshold`, {
		headers: headers(token)
	})
	return handleResponse(res, `les seuils de la station ${stationId}`, token)
}

export async function fetchPluvioStation(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/pluviometer/${stationId}`, {
		headers: headers(token)
	})
	return handleResponse(res, `la station pluviométrique ${stationId}`, token)
}

export async function fetchPluvioMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/pluviometer/chartMeasures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return handleResponse(res, `les mesures pluvio de la station ${params.stationId}`, token)
}
