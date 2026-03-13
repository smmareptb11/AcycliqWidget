import { formaterNombreFr } from '../lib/util/number.js'
import './legend.css'

const Legend = ({ thresholds, seriesVisibility, onToggle }) => {
	if (!thresholds || thresholds.length === 0) return null

	return (
		<div className="thresholds-legend" role="list" aria-label="Légende des seuils">
			{thresholds.map(th => {
				const isActive = seriesVisibility.has(th.name)
					? seriesVisibility.get(th.name)
					: true

				const ruleColor = isActive ? th.htmlColor : '#bbb'

				const lineStyle = {
					display: 'inline-block',
					width: '25px',
					height: '2px',
					marginRight: '8px',
					verticalAlign: 'middle',
					borderBottom: `2px solid ${ruleColor}`
				}

				return (
					<button
						key={th.name}
						role="listitem"
						className={`threshold-legend-item ${isActive ? 'active' : 'inactive'}`}
						aria-pressed={isActive}
						onClick={() => onToggle(th.name)}
						title={`Cliquer pour ${isActive ? 'masquer' : 'afficher'} le seuil ${th.name}`}
					>
						<span aria-hidden="true" style={lineStyle} />
						<span>{th.name} ({formaterNombreFr(th.value)} m)</span>
					</button>
				)
			})}
		</div>
	)
}

export default Legend
