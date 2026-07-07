import { describe, it, expect } from 'vitest'
import { buildHydroPlotData, buildPluvioPlotData, computeWindowedCumul, applyThresholdsNgf, pluvioBarLabel } from '../../src/lib/data-transform.js'

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
		const result = buildPluvioPlotData(measures)
		expect(result[0]).toEqual([t1 / 1000, t2 / 1000, t3 / 1000])
	})

	it('rounds y-values to 2 decimals', () => {
		const result = buildPluvioPlotData(measures)
		expect(result[1]).toEqual([1.23, 0.79, 2.46])
	})

	it('returns [xVals, yVals] only (cumul is computed later per visible window)', () => {
		const result = buildPluvioPlotData(measures)
		expect(result.length).toBe(2)
	})

	it('handles Infinity values', () => {
		const data = [[t1, Infinity], [t2, 1.0]]
		const result = buildPluvioPlotData(data)
		expect(result[1][0]).toBeNull()
		expect(result[1][1]).toBe(1.0)
	})

	it('handles NaN values', () => {
		const data = [[t1, NaN], [t2, 1.0]]
		const result = buildPluvioPlotData(data)
		expect(result[1][0]).toBeNull()
		expect(result[1][1]).toBe(1.0)
	})

	it('returns null for null measures', () => {
		expect(buildPluvioPlotData(null)).toBeNull()
	})

	it('returns null for non-array measures', () => {
		expect(buildPluvioPlotData({})).toBeNull()
	})

	it('returns empty arrays for empty measures', () => {
		const result = buildPluvioPlotData([])
		expect(result[0]).toEqual([])
		expect(result[1]).toEqual([])
	})
})

describe('applyThresholdsNgf', () => {
	const thresholds = [
		{ name: 'Vigilance', value: 2.5, htmlColor: '#FFCC00' },
		{ name: 'Alerte', value: 3.8, htmlColor: '#FF8800' }
	]

	it('offsets threshold values by the altitude when NGF applies', () => {
		const result = applyThresholdsNgf(thresholds, 42.35, true)
		expect(result[0].value).toBeCloseTo(44.85, 3)
		expect(result[1].value).toBeCloseTo(46.15, 3)
	})

	it('preserves the other threshold fields', () => {
		const result = applyThresholdsNgf(thresholds, 42.35, true)
		expect(result[0].name).toBe('Vigilance')
		expect(result[0].htmlColor).toBe('#FFCC00')
	})

	it('leaves values untouched when NGF does not apply', () => {
		const result = applyThresholdsNgf(thresholds, 42.35, false)
		expect(result.map(t => t.value)).toEqual([2.5, 3.8])
	})

	it('returns a new array (does not mutate the input)', () => {
		const result = applyThresholdsNgf(thresholds, 42.35, true)
		expect(result).not.toBe(thresholds)
		expect(thresholds[0].value).toBe(2.5)
	})

	it('handles null/undefined thresholds', () => {
		expect(applyThresholdsNgf(null, 42.35, true)).toEqual([])
		expect(applyThresholdsNgf(undefined, 42.35, true)).toEqual([])
	})
})

describe('pluvioBarLabel', () => {
	it('labels daily aggregation "/ jour"', () => {
		expect(pluvioBarLabel('SUM_DAY')).toBe('Cumul pluvio / jour')
	})

	it('labels hourly and raw aggregation "/ 1h"', () => {
		expect(pluvioBarLabel('SUM_HOUR')).toBe('Cumul pluvio / 1h')
		expect(pluvioBarLabel('all')).toBe('Cumul pluvio / 1h')
	})
})

describe('computeWindowedCumul', () => {
	const xVals = [100, 200, 300, 400, 500]

	it('accumulates only values inside [minX, maxX]', () => {
		const yVals = [1, 2, 3, 4, 5]
		const { cumul, max } = computeWindowedCumul(xVals, yVals, 200, 400)
		expect(cumul).toEqual([null, 2, 5, 9, null])
		expect(max).toBe(9)
	})

	it('resets accumulator to 0 at the first visible point', () => {
		const yVals = [10, 1, 2, 3, 20]
		const { cumul } = computeWindowedCumul(xVals, yVals, 200, 400)
		// La première valeur visible est 1, sans reprendre depuis 10.
		expect(cumul[1]).toBe(1)
		expect(cumul[2]).toBe(3)
		expect(cumul[3]).toBe(6)
	})

	it('returns all-null when window contains no points', () => {
		const yVals = [1, 2, 3, 4, 5]
		const { cumul, max } = computeWindowedCumul(xVals, yVals, 600, 700)
		expect(cumul).toEqual([null, null, null, null, null])
		expect(max).toBe(0)
	})

	it('includes boundary points (inclusive range)', () => {
		const yVals = [1, 2, 3, 4, 5]
		const { cumul } = computeWindowedCumul(xVals, yVals, 100, 500)
		expect(cumul).toEqual([1, 3, 6, 10, 15])
	})

	it('skips null values without breaking the accumulator', () => {
		const yVals = [null, 1.0, null, 2.0, null]
		const { cumul } = computeWindowedCumul(xVals, yVals, 100, 500)
		expect(cumul[0]).toBe(0)
		expect(cumul[1]).toBe(1)
		expect(cumul[2]).toBe(1)
		expect(cumul[3]).toBe(3)
		expect(cumul[4]).toBe(3)
	})

	it('rounds accumulated values to 2 decimals (no float drift)', () => {
		const yVals = [0.1, 0.2, 0.3, 0, 0]
		const { cumul } = computeWindowedCumul(xVals, yVals, 100, 500)
		expect(cumul[2]).toBe(0.6)
	})

	it('handles an empty dataset', () => {
		const { cumul, max } = computeWindowedCumul([], [], 0, 1000)
		expect(cumul).toEqual([])
		expect(max).toBe(0)
	})
})
