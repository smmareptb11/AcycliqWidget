const headers = (token) => ({
	'Authorization': `Bearer ${token}`,
	'Content-Type': 'application/json'
})

export async function fetchHydroStation(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}`, {
		headers: headers(token)
	})
	return res.json()
}

export async function fetchHydroMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/chronic/measures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return res.json()
}

export async function fetchHydroThresholds(apiUrl, token, stationId) {
	const res = await fetch(`${apiUrl}/hydrologicalStation/${stationId}/threshold`, {
		headers: headers(token)
	})
	return res.json()
}

export async function fetchPluvioMeasures(apiUrl, token, params) {
	const res = await fetch(`${apiUrl}/pluviometer/chartMeasures`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify(params)
	})
	return res.json()
}
