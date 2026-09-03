import { describe, it, expect } from 'vitest'
import { xAxisConfig } from '../../src/lib/hooks/use-chart.js'

// Ces bornes reposent sur deux détails d'uPlot absents de son API publique, à
// revérifier à chaque montée de version (^1.6.31 au moment de l'écriture) : les
// splits et `foundIncr` arrivent dans l'unité de l'échelle x — des secondes ici —
// et le plus petit incrément mensuel de sa table vaut `d * 30` (uPlot.esm.js:1018).
// S'ils changent, ces tests restent verts pendant que l'axe régresse.
const HOUR_S = 3600
const DAY_S = 86400
const MONTH_S = 30 * DAY_S

const tick = (h, m) => new Date(2026, 8, 1, h, m).getTime() / 1000

describe('xAxisConfig — libellés de l\'axe X', () => {
	const { values } = xAxisConfig()

	it('empile jour/mois puis heure:minute sous la journée', () => {
		const splits = [tick(14, 30), tick(15, 0)]
		expect(values(null, splits, 0, 70, HOUR_S)).toEqual(['01/09\n14:30', '01/09\n15:00'])
	})

	it('omet l\'heure dès que les ticks sont espacés d\'un jour', () => {
		expect(values(null, [tick(0, 0)], 0, 70, DAY_S)).toEqual(['01/09'])
	})

	it('garde l\'heure juste sous la borne d\'un jour', () => {
		expect(values(null, [tick(14, 30)], 0, 70, DAY_S - 1)).toEqual(['01/09\n14:30'])
	})

	it('bascule en mois/année dès que les ticks sont espacés d\'un mois', () => {
		expect(values(null, [tick(0, 0)], 0, 70, MONTH_S)).toEqual(['09/2026'])
	})

	it('garde jour/mois juste sous la borne d\'un mois', () => {
		expect(values(null, [tick(0, 0)], 0, 70, MONTH_S - 1)).toEqual(['01/09'])
	})

	it('distingue les années sur un axe annuel', () => {
		const janvier = y => new Date(y, 0, 1).getTime() / 1000
		expect(values(null, [janvier(2025), janvier(2026)], 0, 70, 365 * DAY_S)).toEqual(['01/2025', '01/2026'])
	})
})
