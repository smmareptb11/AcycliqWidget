/* États de graphe partagés (chargement / erreur / données vides).
   Styles dans chart.css ; utilisés par les widgets hydro et pluvio. */

export const LoadingState = () => (
	<div className="acycliq-loading" role="status">
		<span className="acycliq-loading-spinner" aria-hidden="true" />
		Chargement…
	</div>
)

export const ErrorState = ({ message }) => (
	<div className="acycliq-error" role="alert">
		<svg className="acycliq-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
			stroke-linejoin="round" aria-hidden="true"
		>
			<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
		Erreur : {message}
	</div>
)

export const EmptyState = () => (
	<div className="acycliq-empty">
		<svg className="acycliq-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
			stroke-linejoin="round" aria-hidden="true"
		>
			<line x1="3" y1="21" x2="21" y2="21" />
			<polyline points="4 17 9 11 13 14 20 6" />
		</svg>
		Aucune donnée disponible
	</div>
)
