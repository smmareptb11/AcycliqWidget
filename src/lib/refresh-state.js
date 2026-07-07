// Transitions d'état du cycle de rafraîchissement des mesures, partagées par
// les widgets hydro et pluvio. Elles centralisent l'invariant clé : un échec
// TRANSITOIRE d'un rafraîchissement de fond ne doit jamais effacer un graphe
// déjà affiché — on conserve les mesures et on ne signale l'échec que via
// `refreshError` (l'écran d'erreur plein cadre est réservé au tout premier
// chargement, quand il n'y a encore aucune donnée à préserver).

/** Un fetch de mesures démarre (intervalle ou clic manuel). */
export function refreshStart(state) {
	return { ...state, refreshing: true }
}

/** Le fetch a réussi : on remet à zéro toute erreur et on pose les mesures. */
export function refreshSuccess(state, measures) {
	return { ...state, loading: false, refreshing: false, error: null, refreshError: null, measures }
}

/**
 * Le fetch a échoué. `at` est l'horodatage (ms) de l'échec.
 * - Des mesures existent déjà → rafraîchissement de fond : on garde le graphe
 *   et on n'expose l'échec que par `refreshError`.
 * - Aucune mesure → premier chargement : erreur fatale plein cadre.
 */
export function refreshFailure(state, errMessage, at) {
	return state.measures
		? { ...state, refreshing: false, refreshError: { at } }
		: { ...state, loading: false, refreshing: false, error: errMessage }
}
