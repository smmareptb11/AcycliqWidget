import SegmentedControl from './segmented-control.jsx'

const DATA_TYPES = [
	{ label: 'Hauteur', value: 4 },
	{ label: 'Débit', value: 5 }
]

const DataTypeToggle = ({ value, onChange }) => (
	<SegmentedControl options={DATA_TYPES} value={value} onChange={onChange} ariaLabel="Donnée affichée" className="data-type-toggle" />
)

export default DataTypeToggle
