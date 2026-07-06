import { toNgf } from './ngf.js'

export function buildHydroPlotData(measures, altitude, useNgf, isHeight, thresholds) {
	if (!measures || !Array.isArray(measures)) return null

	const applyNgf = useNgf && isHeight && altitude > 0

	const sorted = [...measures].sort((a, b) => a[0] - b[0])
	const xVals = sorted.map(d => d[0] / 1000)
	const yVals = sorted.map(d => {
		const val = d[1]
		if (val == null) return null
		return applyNgf ? toNgf(val, altitude) : Number(val.toFixed(3))
	})

	const thresholdArrays = (thresholds || []).map(th =>
		Array(xVals.length).fill(th.value)
	)

	return [xVals, yVals, ...thresholdArrays]
}

/**
 * Offset threshold values by the station altitude when NGF is active, so the
 * seuil lines and their displayed values line up with the (also-offset) height
 * curve. When NGF does not apply, values pass through unchanged.
 *
 * @param {Array<{value: number}>} thresholds - raw thresholds from the API
 * @param {number} altitude - station altitude (m)
 * @param {boolean} applyNgf - whether NGF conversion is active
 * @returns {Array<object>} thresholds with `value` adjusted (other fields kept)
 */
export function applyThresholdsNgf(thresholds, altitude, applyNgf) {
	return (thresholds || []).map(th => ({
		...th,
		value: applyNgf ? toNgf(th.value, altitude) : th.value
	}))
}

/**
 * Label for the rainfall bars series, reflecting the chosen aggregation:
 * a daily sum (`SUM_DAY`) accumulates over a day, the other modes stay hourly.
 *
 * @param {string} groupFunc - 'all' | 'SUM_HOUR' | 'SUM_DAY'
 * @returns {string}
 */
export function pluvioBarLabel(groupFunc) {
	return groupFunc === 'SUM_DAY' ? 'Cumul pluvio / jour' : 'Cumul pluvio / 1h'
}

export function buildPluvioPlotData(measures) {
	if (!measures || !Array.isArray(measures)) return null

	const sorted = [...measures].sort((a, b) => a[0] - b[0])
	const xVals = sorted.map(d => d[0] / 1000)
	const yVals = sorted.map(d => {
		const val = d[1]
		return val != null && Number.isFinite(val) ? Number(val.toFixed(2)) : null
	})

	return [xVals, yVals]
}

/**
 * Compute the rainfall cumulative sum restricted to a visible window.
 *
 * Behaviour:
 * - Points outside [minX, maxX] (inclusive bounds) get `null`.
 * - Points inside the window accumulate from 0, restarting at the first
 *   visible point (so each new zoom shows a fresh cumul curve).
 * - `null` values inside the window are kept as-is on the cumul output
 *   (the accumulator carries over) — except when the very first visible
 *   point is itself null: in that case the cumul starts at 0, because
 *   « 0 mm of rain accumulated so far » is the meaningful answer.
 * - Values are rounded to 2 decimals to avoid float drift.
 *
 * @param {number[]} xVals - x timestamps in seconds (sorted ascending)
 * @param {Array<number|null>} yVals - rainfall values (same length as xVals)
 * @param {number} minX - visible window start (seconds, inclusive)
 * @param {number} maxX - visible window end (seconds, inclusive)
 * @returns {{ cumul: Array<number|null>, max: number }}
 */
export function computeWindowedCumul(xVals, yVals, minX, maxX) {
	const cumul = new Array(xVals.length).fill(null)
	let acc = 0
	let max = 0
	for (let i = 0; i < xVals.length; i++) {
		const x = xVals[i]
		if (x < minX || x > maxX) continue
		const v = yVals[i]
		if (v != null) acc += v
		cumul[i] = Number(acc.toFixed(2))
		if (acc > max) max = acc
	}
	return { cumul, max }
}
