const DEFAULT_BACKGROUND = '#ffffff'

// Au-delà, le nom devient impraticable ; certains systèmes de fichiers plafonnent
// d'ailleurs à 255 octets, et le nom de station est la seule partie extensible.
const MAX_STATION_NAME_LENGTH = 60

/**
 * Aplatit un canvas sur un fond opaque.
 *
 * uPlot ne peint jamais de fond : le canvas est transparent partout où rien
 * n'est tracé. À l'écran le fond blanc du widget fait illusion, mais le PNG
 * exporté sort en RGBA transparent — illisible dès qu'il est ouvert sur un
 * fond sombre ou collé dans un document. On recompose donc sur un canvas
 * intermédiaire rempli de la couleur de fond du widget.
 */
function flattenOnBackground(canvas, background) {
	const flattened = document.createElement('canvas')
	flattened.width = canvas.width
	flattened.height = canvas.height
	const ctx = flattened.getContext('2d')
	ctx.fillStyle = background
	ctx.fillRect(0, 0, flattened.width, flattened.height)
	ctx.drawImage(canvas, 0, 0)
	return flattened
}

/**
 * Réduit un libellé de station à un segment de nom de fichier sûr :
 * accents dépliés puis retirés, tout ce qui n'est pas alphanumérique ramené à
 * un tiret. « Ruisseau de la Nère à Villefranche » → `ruisseau-de-la-nere-a-villefranche`.
 */
export function slugify(text) {
	if (!text) return ''
	return String(text)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_STATION_NAME_LENGTH)
		.replace(/-+$/g, '')
}

/**
 * Construit le nom du fichier exporté : type de widget, nom de station, code.
 * Ex. : `hydro-ruisseau-de-la-nere-a-villefranche-17`.
 *
 * Les segments vides sont écartés : tant que les métadonnées ne sont pas
 * revenues de l'API, l'export reste possible et retombe sur `hydro-17`.
 *
 * @param {string} type - `hydro` ou `pluvio`
 * @param {string} [stationName] - libellé de la station, tel que renvoyé par l'API
 * @param {string|number} [code] - code de la station, à défaut son identifiant
 */
export function buildExportName(type, stationName, code) {
	return [type, slugify(stationName), slugify(code)].filter(Boolean).join('-')
}

/**
 * Télécharge un canvas en PNG sous le nom demandé, sur fond opaque.
 *
 * Passe par un Blob + URL d'objet plutôt que par `canvas.toDataURL()` : une
 * URL `data:` embarque toute l'image dans la chaîne, ce qui la soumet aux
 * limites de taille d'URL des navigateurs sur les gros graphes, là où une URL
 * `blob:` ne transporte qu'une référence. L'ancre est ajoutée au DOM avant le
 * clic (certains navigateurs ignorent le clic sur un élément détaché) puis
 * retirée, et l'URL d'objet est libérée.
 *
 * @param {HTMLCanvasElement} canvas - canvas source (celui du graphe uPlot)
 * @param {string} filename - nom du fichier téléchargé, extension comprise
 * @param {string} [background] - couleur de fond appliquée sous le graphe
 */
export function downloadCanvasPng(canvas, filename, background = DEFAULT_BACKGROUND) {
	if (!canvas) return

	flattenOnBackground(canvas, background).toBlob((blob) => {
		if (!blob) return
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.download = filename
		link.href = url
		link.style.display = 'none'
		document.body.appendChild(link)
		link.click()
		link.remove()
		// Libération différée : l'URL doit rester valide au-delà du clic.
		setTimeout(() => URL.revokeObjectURL(url), 1000)
	}, 'image/png')
}
