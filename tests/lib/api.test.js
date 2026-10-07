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

describe('en-têtes des requêtes API', () => {
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

})
