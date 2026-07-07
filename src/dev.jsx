import { render } from 'preact'
import HydroChart from './components/hydro-chart.jsx'
import PluvioChart from './components/pluvio-chart.jsx'
import { applyHydroDefaults, applyPluvioDefaults } from './lib/config.js'
import './index.css'
import './dev.css'

const apiUrl = import.meta.env.VITE_ACYCLIQ_API_URL
const token = import.meta.env.VITE_ACYCLIQ_TOKEN

if (!apiUrl || !token) {
	render(
		<div className="acycliq-config-error">
			<h2>Configuration manquante</h2>
			<p>Créez un fichier <code>.env</code> à la racine du projet avec :</p>
			<pre>{`VITE_ACYCLIQ_TOKEN=votre_token_ici
VITE_ACYCLIQ_API_URL=https://smmar.acycliq.fr/api`}</pre>
			<p>Puis relancez <code>yarn dev</code>.</p>
		</div>,
		document.getElementById('app')
	)
}
else {
	const cases = [
		{
			title: 'Hydrométrie — config par défaut (station 17, hauteur, NGF, seuils)',
			component: <HydroChart config={applyHydroDefaults({ apiUrl, token, idStation: 17, container: '#app' })} />
		},
		{
			title: 'Pluviométrie — config par défaut (station 719, cumul activé)',
			component: <PluvioChart config={applyPluvioDefaults({ apiUrl, token, idStation: 719, container: '#app' })} />
		},
		{
			title: 'Échec de chargement — station inexistante (id 999999)',
			component: <HydroChart config={applyHydroDefaults({ apiUrl, token, idStation: 999999, container: '#app' })} />
		},
		{
			title: 'Pluviométrie — config max (6h, sans cumul, couleur custom, refresh 1min)',
			component: <PluvioChart config={applyPluvioDefaults({ apiUrl, token, idStation: 719, container: '#app', hours: 6, cumul: false, color: '#E91E63', refresh: 1 })} />
		},
		{
			title: 'Hydrométrie — config max (débit, 12h, sans NGF, sans seuils, couleur custom)',
			component: <HydroChart config={applyHydroDefaults({ apiUrl, token, idStation: 17, container: '#app', dataType: 5, hours: 12, ngf: false, threshold: false, color: '#4CAF50' })} />
		}
	]

	render(
		<div>
			<h1 className="dev-title">Acycliq Widget — Grille de test</h1>
			<div className="dev-grid">
				{cases.map((c, i) => (
					<div key={i} className="dev-card">
						<h2>{c.title}</h2>
						{c.component}
					</div>
				))}
			</div>
		</div>,
		document.getElementById('app')
	)
}
