import { describe, it, expect } from 'vitest'
import { refreshStart, refreshSuccess, refreshFailure } from '../../src/lib/refresh-state.js'

// État initial d'un widget avant tout chargement.
const initial = { loading: true, error: null, refreshing: false, refreshError: null, measures: null }

// État d'un widget dont le graphe est déjà affiché (premier chargement réussi).
const loaded = { loading: false, error: null, refreshing: false, refreshError: null, measures: [[1], [2]] }

describe('refresh-state : transitions du cycle de rafraîchissement', () => {
	it('refreshStart marque le rafraîchissement en cours sans toucher au reste', () => {
		const next = refreshStart(loaded)
		expect(next.refreshing).toBe(true)
		expect(next.measures).toBe(loaded.measures)
		expect(next.error).toBeNull()
	})

	it('refreshSuccess pose les mesures et efface toute erreur/alerte', () => {
		const failed = { ...loaded, refreshing: true, refreshError: { at: 123 } }
		const measures = [[9], [8]]
		const next = refreshSuccess(failed, measures)
		expect(next.measures).toBe(measures)
		expect(next.loading).toBe(false)
		expect(next.refreshing).toBe(false)
		expect(next.error).toBeNull()
		expect(next.refreshError).toBeNull()
	})

	it('échec de fond (mesures déjà présentes) : le graphe est préservé, seul refreshError est posé', () => {
		const next = refreshFailure(refreshStart(loaded), 'boom', 1000)
		expect(next.measures).toBe(loaded.measures)   // graphe conservé
		expect(next.error).toBeNull()                 // pas d'erreur fatale
		expect(next.refreshError).toEqual({ at: 1000 })
		expect(next.refreshing).toBe(false)
	})

	it('échec au premier chargement (aucune mesure) : erreur fatale plein cadre', () => {
		const next = refreshFailure(refreshStart(initial), 'boom', 1000)
		expect(next.error).toBe('boom')
		expect(next.loading).toBe(false)
		expect(next.refreshing).toBe(false)
		expect(next.refreshError).toBeNull()
	})

	// Un premier chargement réussi mais VIDE ([]) est une réponse valide, pas une
	// erreur : un échec de MAJ ultérieur ne doit donc pas basculer en erreur
	// fatale rouge. [] est truthy → branche « préservation », comme des données.
	it('tableau vide déjà chargé : un échec de MAJ ne bascule pas en erreur fatale', () => {
		const emptyLoaded = { loading: false, error: null, refreshing: false, refreshError: null, measures: [] }
		const next = refreshFailure(refreshStart(emptyLoaded), 'boom', 1000)
		expect(next.error).toBeNull()                 // pas d'écran d'erreur rouge
		expect(next.measures).toBe(emptyLoaded.measures)
		expect(next.refreshError).toEqual({ at: 1000 })
	})
})
