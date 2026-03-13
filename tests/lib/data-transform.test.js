import { describe, it, expect } from 'vitest'
import { buildHydroPlotData, buildPluvioPlotData } from '../../src/lib/data-transform.js'

// Timestamps réalistes : mesures hydro du 13 mars 2026, toutes les 5 minutes
const t1 = 1773568800000 // 2026-03-13T06:00:00Z
const t2 = 1773569100000 // 2026-03-13T06:05:00Z
const t3 = 1773569400000 // 2026-03-13T06:10:00Z

describe('buildHydroPlotData', () => {
	const measures = [
		[t3, 0.87],
		[t1, 1.23],
		[t2, 0.45]
	]

	it('sorts measures chronologically and converts ms timestamps to seconds', () => {
		const result = buildHydroPlotData(measures, 0, false, true, [])
		expect(result[0]).toEqual([t1 / 1000, t2 / 1000, t3 / 1000])
	})

	it('rounds y-values to 3 decimals without NGF', () => {
		const result = buildHydroPlotData(measures, 0, false, true, [])
		expect(result[1]).toEqual([1.23, 0.45, 0.87])
	})

	it('applies NGF conversion when useNgf=true, isHeight=true, altitude > 0', () => {
		const result = buildHydroPlotData([[t1, 0.5]], 100, true, true, [])
		expect(result[1][0]).toBeCloseTo(100.5, 3)
	})

	it('does not apply NGF when useNgf=false', () => {
		const result = buildHydroPlotData([[t1, 0.5]], 100, false, true, [])
		expect(result[1][0]).toBe(0.5)
	})

	it('does not apply NGF when isHeight=false (débit)', () => {
		const result = buildHydroPlotData([[t1, 0.5]], 100, true, false, [])
		expect(result[1][0]).toBe(0.5)
	})

	it('does not apply NGF when altitude=0', () => {
		const result = buildHydroPlotData([[t1, 0.5]], 0, true, true, [])
		expect(result[1][0]).toBe(0.5)
	})

	it('handles null y-values', () => {
		const result = buildHydroPlotData([[t1, null], [t2, 0.5]], 0, false, true, [])
		expect(result[1]).toEqual([null, 0.5])
	})

	it('creates threshold arrays filled with constant values', () => {
		const thresholds = [
			{ value: 1.5 },
			{ value: 3.0 }
		]
		const result = buildHydroPlotData(measures, 0, false, true, thresholds)
		expect(result.length).toBe(4)
		expect(result[2]).toEqual([1.5, 1.5, 1.5])
		expect(result[3]).toEqual([3.0, 3.0, 3.0])
	})

	it('returns null for null measures', () => {
		expect(buildHydroPlotData(null, 0, false, true, [])).toBeNull()
	})

	it('returns null for non-array measures', () => {
		expect(buildHydroPlotData('invalid', 0, false, true, [])).toBeNull()
	})

	it('returns empty arrays for empty measures', () => {
		const result = buildHydroPlotData([], 0, false, true, [])
		expect(result[0]).toEqual([])
		expect(result[1]).toEqual([])
	})

	it('handles undefined thresholds gracefully', () => {
		const result = buildHydroPlotData(measures, 0, false, true, undefined)
		expect(result.length).toBe(2)
	})
})

describe('buildPluvioPlotData', () => {
	const measures = [
		[t3, 2.456],
		[t1, 1.234],
		[t2, 0.789]
	]

	it('sorts measures chronologically and converts ms timestamps to seconds', () => {
		const result = buildPluvioPlotData(measures, false)
		expect(result[0]).toEqual([t1 / 1000, t2 / 1000, t3 / 1000])
	})

	it('rounds y-values to 2 decimals', () => {
		const result = buildPluvioPlotData(measures, false)
		expect(result[1]).toEqual([1.23, 0.79, 2.46])
	})

	it('returns [xVals, yVals] without cumul', () => {
		const result = buildPluvioPlotData(measures, false)
		expect(result.length).toBe(2)
	})

	it('returns [xVals, yVals, cumulVals] with cumul', () => {
		const result = buildPluvioPlotData(measures, true)
		expect(result.length).toBe(3)
	})

	it('computes cumulative sum correctly', () => {
		const result = buildPluvioPlotData(measures, true)
		// sorted: 1.23, 0.79, 2.46
		expect(result[2][0]).toBeCloseTo(1.23, 2)
		expect(result[2][1]).toBeCloseTo(2.02, 2)
		expect(result[2][2]).toBeCloseTo(4.48, 2)
	})

	it('handles null values in cumul (skips them, keeps accumulator)', () => {
		const data = [[t1, 1.0], [t2, null], [t3, 2.0]]
		const result = buildPluvioPlotData(data, true)
		expect(result[1]).toEqual([1.0, null, 2.0])
		expect(result[2]).toEqual([1.0, 1.0, 3.0])
	})

	it('handles Infinity values', () => {
		const data = [[t1, Infinity], [t2, 1.0]]
		const result = buildPluvioPlotData(data, false)
		expect(result[1][0]).toBeNull()
		expect(result[1][1]).toBe(1.0)
	})

	it('handles NaN values', () => {
		const data = [[t1, NaN], [t2, 1.0]]
		const result = buildPluvioPlotData(data, false)
		expect(result[1][0]).toBeNull()
		expect(result[1][1]).toBe(1.0)
	})

	it('returns null for null measures', () => {
		expect(buildPluvioPlotData(null, false)).toBeNull()
	})

	it('returns null for non-array measures', () => {
		expect(buildPluvioPlotData({}, false)).toBeNull()
	})

	it('returns empty arrays for empty measures', () => {
		const result = buildPluvioPlotData([], false)
		expect(result[0]).toEqual([])
		expect(result[1]).toEqual([])
	})

	it('avoids floating point drift in cumul', () => {
		const data = [[t1, 0.1], [t2, 0.2], [t3, 0.3]]
		const result = buildPluvioPlotData(data, true)
		expect(result[2][2]).toBe(0.6)
	})
})
