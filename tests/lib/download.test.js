import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadCanvasPng, buildExportName, slugify } from '../../src/lib/util/download.js'

// Faux DOM minimal : on ne teste que le contrat du téléchargement (nom de
// fichier, recomposition sur fond opaque, ancre attachée puis retirée).
function installFakeDom(flattenedBlob = new Blob(['png'], { type: 'image/png' })) {
	const link = {
		download: '',
		href: '',
		style: {},
		click: vi.fn(),
		remove: vi.fn()
	}
	// Canvas intermédiaire sur lequel le graphe est recomposé.
	const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
	const flattened = {
		width: 0,
		height: 0,
		getContext: vi.fn(() => ctx),
		toBlob: vi.fn((cb) => cb(flattenedBlob))
	}
	globalThis.document = {
		createElement: vi.fn((tag) => (tag === 'canvas' ? flattened : link)),
		body: { appendChild: vi.fn() }
	}
	globalThis.URL = {
		createObjectURL: vi.fn(() => 'blob:fake-url'),
		revokeObjectURL: vi.fn()
	}
	return { link, flattened, ctx }
}

const fakeCanvas = () => ({ width: 900, height: 300 })

describe('downloadCanvasPng', () => {
	let dom

	beforeEach(() => {
		vi.useFakeTimers()
		dom = installFakeDom()
	})

	afterEach(() => {
		vi.useRealTimers()
		delete globalThis.document
		delete globalThis.URL
	})

	it('télécharge un blob PNG sous le nom demandé', () => {
		downloadCanvasPng(fakeCanvas(), 'acycliq-hydro-A1234.png')

		expect(dom.flattened.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
		expect(dom.link.download).toBe('acycliq-hydro-A1234.png')
		expect(dom.link.href).toBe('blob:fake-url')
		expect(dom.link.click).toHaveBeenCalled()
	})

	it('recompose le graphe sur un fond opaque aux dimensions du canvas source', () => {
		const source = fakeCanvas()
		downloadCanvasPng(source, 'graphe.png', '#ffffff')

		expect(dom.flattened.width).toBe(900)
		expect(dom.flattened.height).toBe(300)
		expect(dom.ctx.fillStyle).toBe('#ffffff')
		expect(dom.ctx.fillRect).toHaveBeenCalledWith(0, 0, 900, 300)
		// Le fond est peint AVANT le graphe, sinon il le recouvrirait.
		expect(dom.ctx.fillRect.mock.invocationCallOrder[0])
			.toBeLessThan(dom.ctx.drawImage.mock.invocationCallOrder[0])
		expect(dom.ctx.drawImage).toHaveBeenCalledWith(source, 0, 0)
	})

	it('retombe sur le blanc quand aucune couleur de fond n’est fournie', () => {
		downloadCanvasPng(fakeCanvas(), 'graphe.png')

		expect(dom.ctx.fillStyle).toBe('#ffffff')
	})

	it('applique la couleur de fond du thème quand elle est fournie', () => {
		downloadCanvasPng(fakeCanvas(), 'graphe.png', '#101828')

		expect(dom.ctx.fillStyle).toBe('#101828')
	})

	it('attache l’ancre au document avant de cliquer puis la retire', () => {
		downloadCanvasPng(fakeCanvas(), 'graphe.png')

		expect(document.body.appendChild).toHaveBeenCalledWith(dom.link)
		expect(dom.link.remove).toHaveBeenCalled()
	})

	it('libère l’URL d’objet après le clic', () => {
		downloadCanvasPng(fakeCanvas(), 'graphe.png')

		expect(URL.revokeObjectURL).not.toHaveBeenCalled()
		vi.runAllTimers()
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
	})

	it('ne fait rien sans canvas', () => {
		downloadCanvasPng(null, 'graphe.png')

		expect(document.createElement).not.toHaveBeenCalled()
	})

	it('ne télécharge rien si le blob est vide', () => {
		dom = installFakeDom(null)
		downloadCanvasPng(fakeCanvas(), 'graphe.png')

		expect(URL.createObjectURL).not.toHaveBeenCalled()
		expect(dom.link.click).not.toHaveBeenCalled()
	})
})

describe('slugify', () => {
	it('déplie les accents français', () => {
		expect(slugify('Ruisseau de la Nère à Villefranche')).toBe('ruisseau-de-la-nere-a-villefranche')
		expect(slugify('Aude à Carcassonne')).toBe('aude-a-carcassonne')
		expect(slugify('Fresquel amont — Pézens')).toBe('fresquel-amont-pezens')
	})

	it('réduit apostrophes, parenthèses et ponctuation à des tirets uniques', () => {
		expect(slugify("L'Orbiel (pont d'Aragon)")).toBe('l-orbiel-pont-d-aragon')
	})

	it('ne laisse jamais de tiret en début ou en fin', () => {
		expect(slugify('  --Ségala--  ')).toBe('segala')
	})

	it('tronque les libellés très longs sans finir sur un tiret', () => {
		const nom = slugify('a'.repeat(40) + ' ' + 'b'.repeat(40))
		expect(nom.length).toBeLessThanOrEqual(60)
		expect(nom.endsWith('-')).toBe(false)
	})

	it('renvoie une chaîne vide pour une entrée absente', () => {
		expect(slugify(null)).toBe('')
		expect(slugify(undefined)).toBe('')
		expect(slugify('')).toBe('')
	})

	it('accepte un nombre comme code', () => {
		expect(slugify(17)).toBe('17')
	})
})

describe('buildExportName', () => {
	it('assemble type, nom de station et code', () => {
		expect(buildExportName('hydro', 'Ruisseau de la Nère à Villefranche', 17))
			.toBe('hydro-ruisseau-de-la-nere-a-villefranche-17')
		expect(buildExportName('pluvio', 'Carcassonne', 719))
			.toBe('pluvio-carcassonne-719')
	})

	it('retombe sur type + code tant que les métadonnées ne sont pas chargées', () => {
		expect(buildExportName('hydro', null, 17)).toBe('hydro-17')
		expect(buildExportName('hydro', undefined, 17)).toBe('hydro-17')
	})

	it('reste exploitable même sans code', () => {
		expect(buildExportName('hydro', 'Villefranche', null)).toBe('hydro-villefranche')
	})

	it('gère un code alphanumérique renvoyé par l’API', () => {
		expect(buildExportName('hydro', 'Aude à Trèbes', 'Y1234010')).toBe('hydro-aude-a-trebes-y1234010')
	})
})
