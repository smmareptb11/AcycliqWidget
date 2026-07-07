import { fullDateTimeFormatter } from '../lib/util/date.js'
import './refresh-status.css'

// Indicateur d'état du rafraîchissement automatique, affiché à côté du nom de
// la station. Trois états :
//   - rien : le dernier rafraîchissement a réussi et aucun n'est en cours ;
//   - spinner : un rafraîchissement est en cours ;
//   - triangle d'alerte : le dernier rafraîchissement a échoué. Son survol
//     affiche un tooltip (date/heure de l'échec) et un clic force un nouveau
//     fetch.
const RefreshStatus = ({ refreshing, refreshError, onForceRefresh }) => {
	if (refreshing) {
		return (
			<span
				className="refresh-spinner"
				role="status"
				aria-label="Rafraîchissement des données en cours…"
			/>
		)
	}

	if (refreshError) {
		const failedAt = fullDateTimeFormatter(new Date(refreshError.at))
		const label = `Échec du dernier rafraîchissement des données (${failedAt}). Cliquer pour réessayer.`
		return (
			<span className="refresh-status">
				<button
					type="button"
					className="refresh-warning"
					onClick={onForceRefresh}
					aria-label={label}
				>
					!
				</button>
				<span className="refresh-tooltip" role="tooltip">{label}</span>
			</span>
		)
	}

	return null
}

export default RefreshStatus
