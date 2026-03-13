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
				<div style="padding:1rem; background:#fee; color:#900; font-family:sans-serif;">
					<b>Erreur de configuration pluvio :</b><br />
					<ul>{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
				</div>,
				app
			)
			return
		}
		render(<PluvioChart config={applyPluvioDefaults(config)} />, app)
	} else {
		const result = validateHydroConfig(config)
		if (!result.valid) {
			render(
				<div style="padding:1rem; background:#fee; color:#900; font-family:sans-serif;">
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
	const apiUrl = import.meta.env.VITE_ACYCLIQ_API_URL
	const token = import.meta.env.VITE_ACYCLIQ_TOKEN

	if (!apiUrl || !token) {
		render(
			<div style="padding:2rem; font-family:system-ui, sans-serif; color:#900;">
				<h2>Configuration manquante</h2>
				<p>Créez un fichier <code>.env</code> à la racine du projet avec :</p>
				<pre style="background:#f5f5f5; padding:1rem; border-radius:4px; color:#333;">{`VITE_ACYCLIQ_TOKEN=votre_token_ici
VITE_ACYCLIQ_API_URL=https://smmar.acycliq.fr/api`}</pre>
				<p>Puis relancez <code>yarn dev</code>.</p>
			</div>,
			document.getElementById('app')
		)
	} else {
		render(
			<div style="display: flex; flex-direction: column; gap: 2rem; padding: 1rem;">
				<div>
					<h2 style="margin: 0 0 0.5rem; font-family: system-ui, sans-serif;">Hydro — Station 17</h2>
					<HydroChart config={applyHydroDefaults({ apiUrl, token, idStation: 17, container: '#app' })} />
				</div>
				<div>
					<h2 style="margin: 0 0 0.5rem; font-family: system-ui, sans-serif;">Pluvio — Station 719</h2>
					<PluvioChart config={applyPluvioDefaults({ apiUrl, token, idStation: 719, container: '#app' })} />
				</div>
			</div>,
			document.getElementById('app')
		)
	}
} else {
	window.addEventListener('message', (event) => {
		const { type, ...config } = event.data || {}
		if (type === 'hydro' || type === 'pluvio') {
			renderWidget({ type, ...config })
		}
	})
}
