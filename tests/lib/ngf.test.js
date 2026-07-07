import { describe, it, expect } from 'vitest'
import { toNgf, shouldApplyNgf } from '../../src/lib/ngf.js'

describe('toNgf', () => {
	it('adds value and altitude', () => {
		expect(toNgf(0.87, 100)).toBeCloseTo(100.87, 3)
	})

	it('rounds to 3 decimals', () => {
		expect(toNgf(0.1234, 100)).toBe(100.123)
	})

	it('returns value unchanged when altitude is null', () => {
		expect(toNgf(0.5, null)).toBe(0.5)
	})

	it('returns value unchanged when value is null', () => {
		expect(toNgf(null, 100)).toBeNull()
	})

	it('handles zero values', () => {
		expect(toNgf(0, 100)).toBe(100)
		expect(toNgf(0.5, 0)).toBe(0.5)
	})

	it('handles negative values', () => {
		expect(toNgf(-0.5, 100)).toBeCloseTo(99.5, 3)
	})
})

describe('shouldApplyNgf', () => {
	it('active le NGF pour une hauteur avec altitude connue', () => {
		expect(shouldApplyNgf(true, true, 100)).toBe(true)
	})

	it('reste inactif quand l\'option NGF est désactivée', () => {
		expect(shouldApplyNgf(false, true, 100)).toBe(false)
	})

	it('reste inactif pour une donnée non-hauteur (débit)', () => {
		expect(shouldApplyNgf(true, false, 100)).toBe(false)
	})

	it('reste inactif sans altitude exploitable', () => {
		expect(shouldApplyNgf(true, true, 0)).toBe(false)
	})
})
