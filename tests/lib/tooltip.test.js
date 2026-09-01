import { describe, it, expect } from 'vitest'
import { placeTooltip } from '../../src/lib/tooltip.js'

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
