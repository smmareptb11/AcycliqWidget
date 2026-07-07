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

const ChartControls = ({ activeHours, onZoom, onExportPNG }) => (
	<div className="chart-controls">
		<div className="zoom-buttons" role="group" aria-label="Plage de temps">
			{ZOOM_LEVELS.map(level => (
				<button
					key={level.label}
					type="button"
					className={`zoom-btn${level.hours === activeHours ? ' active' : ''}`}
					aria-pressed={level.hours === activeHours}
					onClick={() => onZoom(level.hours)}
				>
					{level.label}
				</button>
			))}
		</div>
		<button
			type="button"
			className="export-btn"
			title="Télécharger le graphique en image PNG"
			aria-label="Télécharger le graphique en image PNG"
			onClick={onExportPNG}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			<span className="export-btn-label">PNG</span>
		</button>
	</div>
)

export default ChartControls
