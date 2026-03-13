function resolveIframeSrc() {
	const scripts = document.querySelectorAll('script[src]')
	for (const script of scripts) {
		if (script.src.includes('acycliq-widget')) {
			const base = script.src.replace(/\/embed\/.*$/, '')
			return `${base}/iframe/index.html`
		}
	}
	return null
}

function createWidget(type, config) {
	const container = typeof config.container === 'string'
		? document.querySelector(config.container)
		: config.container

	if (!container) {
		console.warn('[acycliq] Conteneur non trouvé :', config.container)
		return
	}

	const iframe = document.createElement('iframe')
	iframe.src = config.src || resolveIframeSrc() || 'https://unpkg.com/acycliq-widget@latest/dist/iframe/index.html'
	iframe.width = config.width || '100%'
	iframe.height = config.height || '100%'
	iframe.style.border = 'none'

	container.appendChild(iframe)

	iframe.addEventListener('load', () => {
		iframe.contentWindow.postMessage({ type, ...config }, '*')
	})
}

window.acycliq = {
	hydro(config) {
		createWidget('hydro', config)
	},
	pluvio(config) {
		createWidget('pluvio', config)
	}
}
