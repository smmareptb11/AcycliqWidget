import { describe, it, expect } from 'vitest'
import { toNgf } from '../../src/lib/ngf.js'

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
