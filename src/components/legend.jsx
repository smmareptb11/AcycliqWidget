import { formaterNombreFr } from '../lib/util/number.js'
import { INACTIVE_RULE } from '../lib/theme.js'
import {
	groupByCategory,
	groupVisibilityState,
	isThresholdVisible,
	seriesStyleOf,
	thresholdColor,
	thresholdKey,
	GROUP_ACTIVE,
	GROUP_PARTIAL
} from '../lib/threshold-categories.js'
import './legend.css'

const ThresholdItem = ({ threshold, index, isActive, unit, onToggle }) => {
	// Un seuil masqué prend la teinte neutre : c'est le seul écart au tracé réel.
	const ruleColor = isActive ? thresholdColor(threshold) : INACTIVE_RULE

	const lineStyle = {
		display: 'inline-block',
		width: '25px',
		height: '2px',
		marginRight: '8px',
		verticalAlign: 'middle',
		// Le témoin reprend le tracé réel de la catégorie, source unique partagée
		// avec le canevas — sinon la légende mentirait sur ce qui est dessiné.
		borderBottom: `${seriesStyleOf(threshold).legendBorder} ${ruleColor}`
	}

	return (
		<button
			role="listitem"
			className={`threshold-legend-item ${isActive ? 'active' : 'inactive'}`}
			aria-pressed={isActive}
			onClick={() => onToggle(index)}
			title={`Cliquer pour ${isActive ? 'masquer' : 'afficher'} le seuil ${threshold.name}`}
		>
			<span aria-hidden="true" style={lineStyle} />
			<span className="threshold-legend-label">{threshold.name} ({formaterNombreFr(threshold.value)} {unit})</span>
		</button>
	)
}

const Legend = ({ thresholds, seriesVisibility, defaultKeys = [], onToggle, onToggleCategory, unit = 'm' }) => {
	if (!thresholds || thresholds.length === 0) return null

	const groups = groupByCategory(thresholds)

	// Les en-têtes n'apparaissent qu'à partir de deux catégories. Sur une station
	// mono-catégorie — le cas de la grande majorité du parc, entièrement en
	// « non classé » — la légende reste exactement celle d'avant : pas de libellé
	// interne exposé au visiteur, et pas de hauteur perdue sur un widget qui en
	// a peu.
	const showHeaders = groups.length > 1

	// Le conteneur porte le nom accessible de l'ensemble : sans lui, une légende
	// groupée n'aurait qu'un libellé par catégorie et aucun nom global.
	return (
		<div className={`thresholds-legend ${showHeaders ? 'grouped' : ''}`} role="group" aria-label="Légende des seuils">
			{groups.map(group => {
				const state = groupVisibilityState(group.items, seriesVisibility, defaultKeys)

				return (
					<div className="threshold-legend-group" key={group.key}>
						{showHeaders && (
							<button
								className={`threshold-legend-group-header ${state}`}
								// « mixed » et non « false » sur un groupe panaché : sinon un
								// lecteur d'écran annonce la catégorie masquée alors qu'une
								// partie de ses seuils est tracée.
								aria-pressed={state === GROUP_PARTIAL ? 'mixed' : state === GROUP_ACTIVE}
								// Un groupe entièrement visible se masque ; tout autre état
								// (grisé ou panaché) s'affiche entièrement.
								onClick={() => onToggleCategory(group.items, state !== GROUP_ACTIVE)}
								title={`Cliquer pour ${state === GROUP_ACTIVE ? 'masquer' : 'afficher'} les seuils « ${group.label} »`}
							>
								{group.label}
							</button>
						)}
						{/* Sans en-tête visible, le nom de catégorie ne doit pas non plus
						    fuiter vers les technologies d'assistance : sur une station non
						    taguée, « Seuils Non classé » exposerait à l'oreille le libellé
						    interne que `showHeaders` masque à l'œil. Le conteneur nomme
						    déjà l'ensemble, la liste n'a alors pas besoin de libellé. */}
						<div className="threshold-legend-items" role="list" aria-label={showHeaders ? `Seuils ${group.label}` : undefined}>
							{group.items.map(({ threshold, index }) => (
								<ThresholdItem
									key={thresholdKey(threshold, index)}
									threshold={threshold}
									index={index}
									isActive={isThresholdVisible(threshold, index, seriesVisibility, defaultKeys)}
									unit={unit}
									onToggle={onToggle}
								/>
							))}
						</div>
					</div>
				)
			})}
		</div>
	)
}

export default Legend
