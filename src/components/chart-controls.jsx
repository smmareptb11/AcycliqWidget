import './chart-controls.css'

const ZOOM_LEVELS = [
	{ label: '1h', hours: 1 },
	{ label: '2h', hours: 2 },
	{ label: '3h', hours: 3 },
	{ label: '6h', hours: 6 },
	{ label: '12h', hours: 12 },
	{ label: '1j', hours: 24 },
	{ label: 'Tout', hours: null }
]

const ChartControls = ({ activeHours, onZoom, onExportPNG }) => {
	return (
		<div className="chart-controls">
			<div className="zoom-buttons">
				{ZOOM_LEVELS.map(level => (
					<button
						key={level.label}
						type="button"
						className={`zoom-btn${level.hours === activeHours ? ' active' : ''}`}
						onClick={() => onZoom(level.hours)}
					>
						{level.label}
					</button>
				))}
			</div>
			<button
				type="button"
				className="export-btn"
				title="Exporter en PNG"
				onClick={onExportPNG}
			>
				PNG
			</button>
		</div>
	)
}

export default ChartControls
