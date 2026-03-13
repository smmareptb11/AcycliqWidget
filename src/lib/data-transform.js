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

export function buildPluvioPlotData(measures, cumul) {
	if (!measures || !Array.isArray(measures)) return null

	const sorted = [...measures].sort((a, b) => a[0] - b[0])
	const xVals = sorted.map(d => d[0] / 1000)
	const yVals = sorted.map(d => {
		const val = d[1]
		return val != null && Number.isFinite(val) ? Number(val.toFixed(2)) : null
	})

	if (cumul) {
		let acc = 0
		const cumulVals = yVals.map(v => {
			if (v != null) acc += v
			return Number(acc.toFixed(2))
		})
		return [xVals, yVals, cumulVals]
	}

	return [xVals, yVals]
}
