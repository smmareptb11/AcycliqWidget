import { describe, it, expect } from 'vitest'
import { cssColor, escapeHtml, hydroTooltipRows, placeTooltip, renderTooltip } from '../../src/lib/tooltip.js'
import { thresholdKey, ALL_CATEGORY_KEYS } from '../../src/lib/threshold-categories.js'
import { THRESHOLD_FALLBACK } from '../../src/lib/theme.js'

// Reprend la forme réelle des réponses SMMAR : catégories renseignées ou non,
// `htmlColor` fréquemment absent.
const thresholds = [
	{ id: 1, name: 'Vigilance', value: 2.8, dataType: '4', htmlColor: '#ffff00', category: 1 },
	{ id: 2, name: 'Atteinte du Plateau', value: 7.29, dataType: '4', category: 2 },
	{ id: 3, name: 'Contrôle amont', value: 9.1, dataType: '4', htmlColor: '#000000', category: 3 },
	{ id: 4, name: 'Autre (Crue du 15/10/2018)', value: 4.95, dataType: '4' }
]

const baseArgs = {
	color: '#0284C7',
	yLabel: 'Hauteur (m)',
	yValue: 0.11,
	thresholds,
	seriesVisibility: new Map(),
	defaultKeys: ALL_CATEGORY_KEYS
}

describe('hydroTooltipRows', () => {
	it('place la mesure en première ligne, avec le libellé et la couleur de la courbe', () => {
		const [first] = hydroTooltipRows(baseArgs)
		expect(first).toEqual({ color: '#0284C7', label: 'Hauteur (m)', value: 0.11 })
	})

	it('liste les seuils dans l\'ordre reçu, après la mesure', () => {
		const rows = hydroTooltipRows(baseArgs)
		expect(rows.map(r => r.label)).toEqual([
			'Hauteur (m)',
			'Vigilance',
			'Atteinte du Plateau',
			'Contrôle amont',
			'Autre (Crue du 15/10/2018)'
		])
		expect(rows.map(r => r.value)).toEqual([0.11, 2.8, 7.29, 9.1, 4.95])
	})

	it('écarte un seuil masqué par le visiteur', () => {
		const seriesVisibility = new Map([[thresholdKey(thresholds[1], 1), false]])
		const rows = hydroTooltipRows({ ...baseArgs, seriesVisibility })
		expect(rows.map(r => r.label)).not.toContain('Atteinte du Plateau')
		expect(rows).toHaveLength(4)
	})

	it('écarte les seuils d\'une catégorie inactive par défaut', () => {
		const rows = hydroTooltipRows({ ...baseArgs, defaultKeys: ['situation'] })
		expect(rows.map(r => r.label)).toEqual(['Hauteur (m)', 'Vigilance'])
	})

	it('applique la couleur de repli quand l\'API n\'en fournit pas', () => {
		const rows = hydroTooltipRows(baseArgs)
		expect(rows.find(r => r.label === 'Atteinte du Plateau').color).toBe(THRESHOLD_FALLBACK)
		expect(rows.find(r => r.label === 'Vigilance').color).toBe('#ffff00')
	})

	it('ne garde que la mesure quand la station n\'a aucun seuil affichable', () => {
		expect(hydroTooltipRows({ ...baseArgs, thresholds: [] })).toHaveLength(1)
		expect(hydroTooltipRows({ ...baseArgs, thresholds: undefined })).toHaveLength(1)
	})

	it('transmet les valeurs telles quelles — le recalage NGF est fait en amont', () => {
		const ngfThresholds = [{ id: 1, name: 'Vigilance', value: 102.8, category: 1 }]
		const rows = hydroTooltipRows({ ...baseArgs, yValue: 100.11, thresholds: ngfThresholds })
		expect(rows.map(r => r.value)).toEqual([100.11, 102.8])
	})
})

describe('renderTooltip', () => {
	// 2026-09-01T13:55:00 en heure locale, comme les timestamps de l'API une fois
	// convertis en secondes par les transformations.
	const xSeconds = new Date(2026, 8, 1, 13, 55).getTime() / 1000

	it('ouvre sur la date survolée', () => {
		const html = renderTooltip(xSeconds, [])
		expect(html).toContain('<div class="date">01/09/2026 13:55</div>')
	})

	it('rend une ligne par série : témoin coloré, libellé, valeur en français', () => {
		const html = renderTooltip(xSeconds, [
			{ color: '#0284C7', label: 'Hauteur (m)', value: 0.11 },
			{ color: '#ffff00', label: 'Vigilance', value: 2.8 }
		])
		expect(html).toContain('style="background:#0284C7"')
		expect(html).toContain('<span class="label">Hauteur (m)</span>')
		expect(html).toContain('<span class="num">0,11</span>')
		expect(html).toContain('<span class="num">2,80</span>')
	})

	it('ajoute l\'unité quand la ligne en porte une', () => {
		const html = renderTooltip(xSeconds, [{ color: '#0284C7', label: 'Cumul pluvio / 1h', value: 0.4, unit: 'mm' }])
		expect(html).toContain('<span class="num">0,40 mm</span>')
	})

	it('écarte les lignes sans valeur exploitable', () => {
		const html = renderTooltip(xSeconds, [
			{ color: '#0284C7', label: 'Hauteur (m)', value: null },
			{ color: '#ffff00', label: 'Vigilance', value: 2.8 }
		])
		expect(html).not.toContain('Hauteur (m)')
		expect(html).toContain('Vigilance')
	})

	it('échappe un libellé de seuil qui contiendrait du balisage', () => {
		const html = renderTooltip(xSeconds, [
			{ color: '#0284C7', label: '<img src=x onerror=alert(1)>', value: 1 }
		])
		expect(html).not.toContain('<img')
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
	})

	it('n\'écrit jamais une couleur non valide dans l\'attribut style', () => {
		const html = renderTooltip(xSeconds, [
			{ color: 'red;background-image:url(https://exfil.example/x.png)', label: 'Seuil', value: 1 }
		])
		expect(html).not.toContain('exfil.example')
		expect(html).toContain(`style="background:${THRESHOLD_FALLBACK}"`)
	})
})

describe('escapeHtml', () => {
	it('neutralise les caractères qui ouvriraient une balise ou un attribut', () => {
		expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
	})

	it('rend une chaîne vide pour une valeur absente', () => {
		expect(escapeHtml(null)).toBe('')
		expect(escapeHtml(undefined)).toBe('')
	})
})

describe('cssColor', () => {
	it('laisse passer les couleurs que renvoie l\'API', () => {
		expect(cssColor('#ffff00')).toBe('#ffff00')
		expect(cssColor('#FFF')).toBe('#FFF')
		expect(cssColor('#0284C7ff')).toBe('#0284C7ff')
		expect(cssColor('red')).toBe('red')
	})

	it('remplace par le repli tout ce qui ajouterait des déclarations CSS', () => {
		// Sans guillemet à échapper, ces valeurs resteraient dans l'attribut et y
		// glisseraient leurs propres déclarations.
		expect(cssColor('red;background-image:url(https://exfil.example/x.png)')).toBe(THRESHOLD_FALLBACK)
		expect(cssColor('url(https://exfil.example/x.png)')).toBe(THRESHOLD_FALLBACK)
		expect(cssColor('rgb(1,2,3)')).toBe(THRESHOLD_FALLBACK)
	})

	it('remplace par le repli une couleur absente ou vide', () => {
		expect(cssColor(null)).toBe(THRESHOLD_FALLBACK)
		expect(cssColor(undefined)).toBe(THRESHOLD_FALLBACK)
		expect(cssColor('  ')).toBe(THRESHOLD_FALLBACK)
	})
})

describe('placeTooltip', () => {
	const viewport = { viewportWidth: 1000, viewportHeight: 600 }
	const size = { width: 200, height: 150 }

	it('place l\'infobulle en bas à droite du curseur quand elle y tient', () => {
		expect(placeTooltip({ anchorX: 100, anchorY: 100, ...size, ...viewport }))
			.toEqual({ left: 110, top: 110 })
	})

	it('bascule vers la gauche quand elle dépasserait le bord droit', () => {
		expect(placeTooltip({ anchorX: 900, anchorY: 100, ...size, ...viewport }))
			.toEqual({ left: 690, top: 110 })
	})

	it('bascule vers le haut quand elle dépasserait le bord bas', () => {
		// Le cas de l'infobulle hydro survolée en bas d'une iframe courte.
		expect(placeTooltip({ anchorX: 100, anchorY: 500, ...size, ...viewport }))
			.toEqual({ left: 110, top: 340 })
	})

	it('bascule dans les deux directions dans le coin bas-droit', () => {
		expect(placeTooltip({ anchorX: 900, anchorY: 500, ...size, ...viewport }))
			.toEqual({ left: 690, top: 340 })
	})

	it('colle l\'infobulle au bord haut quand elle est plus haute que la fenêtre', () => {
		// Une station à nombreux repères de crue dans une iframe de 150 px.
		const placed = placeTooltip({ anchorX: 100, anchorY: 100, width: 200, height: 400, viewportWidth: 1000, viewportHeight: 150 })
		expect(placed.top).toBe(0)
	})

	it('colle l\'infobulle au bord gauche quand elle est plus large que la fenêtre', () => {
		const placed = placeTooltip({ anchorX: 100, anchorY: 100, width: 400, height: 150, viewportWidth: 300, viewportHeight: 600 })
		expect(placed.left).toBe(0)
	})
})
