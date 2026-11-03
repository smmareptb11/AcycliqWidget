import './chart-controls.css'

/**
 * Groupe de boutons dont un seul est actif (durée affichée, donnée affichée).
 *
 * @param {object} props
 * @param {Array<{label: string, value: *}>} props.options
 * @param {*} props.value - valeur de l'option active
 * @param {Function} props.onChange - appelé avec la valeur de l'option cliquée
 * @param {string} props.ariaLabel - nom du groupe pour les lecteurs d'écran
 * @param {string} [props.className]
 */
const SegmentedControl = ({ options, value, onChange, ariaLabel, className = '' }) => (
	<div className={`segmented ${className}`.trim()} role="group" aria-label={ariaLabel}>
		{options.map(option => (
			<button
				key={option.label}
				type="button"
				className={`segmented-btn${option.value === value ? ' active' : ''}`}
				aria-pressed={option.value === value}
				onClick={() => onChange(option.value)}
			>
				{option.label}
			</button>
		))}
	</div>
)

export default SegmentedControl
