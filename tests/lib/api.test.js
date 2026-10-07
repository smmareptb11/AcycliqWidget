import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
	fetchHydroStation,
	fetchHydroMeasures,
	fetchHydroThresholds,
	fetchPluvioStation,
	fetchPluvioMeasures
} from '../../src/lib/api.js'

const API_URL = 'https://api.example.com'

const calls = [
	['fetchHydroStation', token => fetchHydroStation(API_URL, token, 17)],
	['fetchHydroMeasures', token => fetchHydroMeasures(API_URL, token, { stationId: 17 })],
	['fetchHydroThresholds', token => fetchHydroThresholds(API_URL, token, 17)],
	['fetchPluvioStation', token => fetchPluvioStation(API_URL, token, 719)],
	['fetchPluvioMeasures', token => fetchPluvioMeasures(API_URL, token, { stationId: 719 })]
]

describe('requêtes API', () => {
	let fetchMock

	beforeEach(() => {
		fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	const sentHeaders = () => fetchMock.mock.calls[0][1].headers

	describe.each([undefined, ''])('jeton %j', (token) => {
		it.each(calls)('%s n\'envoie pas d\'en-tête Authorization', async (_, call) => {
			await call(token)
			expect(sentHeaders()).not.toHaveProperty('Authorization')
			expect(sentHeaders()['Content-Type']).toBe('application/json')
		})
	})

	it.each(calls)('%s transmet le jeton quand il est fourni', async (_, call) => {
		await call('abc123')
		expect(sentHeaders().Authorization).toBe('Bearer abc123')
	})

	const respondWith = status => fetchMock.mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve({}) })

	it.each([401, 403])('%i : signale un accès refusé plutôt qu\'une ressource absente', async (status) => {
		respondWith(status)
		await expect(fetchHydroStation(API_URL, undefined, 17))
			.rejects.toThrow(`Accès à l'API refusé : jeton manquant ou invalide (HTTP ${status})`)
	})

	it('autre erreur : nomme la ressource et le statut', async () => {
		respondWith(500)
		await expect(fetchHydroStation(API_URL, 'abc123', 17))
			.rejects.toThrow(/^Impossible de récupérer la station hydrométrique 17 \(HTTP 500\)$/)
	})

	it('autre erreur sans jeton : le signale', async () => {
		respondWith(500)
		await expect(fetchHydroStation(API_URL, undefined, 17))
			.rejects.toThrow('Impossible de récupérer la station hydrométrique 17 (HTTP 500, aucun jeton fourni)')
	})
})
