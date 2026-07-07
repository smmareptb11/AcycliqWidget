import { render } from 'preact'
import HydroChart from './components/hydro-chart.jsx'
import PluvioChart from './components/pluvio-chart.jsx'
import { validateHydroConfig, validatePluvioConfig, applyHydroDefaults, applyPluvioDefaults } from './lib/config.js'
import './index.css'

const isDev = import.meta.env.MODE === 'development'

function renderWidget(config) {
	const app = document.getElementById('app')

	if (config.type === 'pluvio') {
		const result = validatePluvioConfig(config)
		if (!result.valid) {
			render(
				<div className="acycliq-config-error">
					<b>Erreur de configuration pluvio :</b><br />
					<ul>{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
				</div>,
				app
			)
			return
		}
		render(<PluvioChart config={applyPluvioDefaults(config)} />, app)
	}
	else {
		const result = validateHydroConfig(config)
		if (!result.valid) {
			render(
				<div className="acycliq-config-error">
					<b>Erreur de configuration hydro :</b><br />
					<ul>{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
				</div>,
				app
			)
			return
		}
		render(<HydroChart config={applyHydroDefaults(config)} />, app)
	}
}

if (isDev) {
	import('./dev.jsx')
}
else {
	window.addEventListener('message', (event) => {
		const { type, ...config } = event.data || {}
		if (type === 'hydro' || type === 'pluvio') {
			renderWidget({ type, ...config })
		}
	})
}
