/**
 * Palette et dimensions consommées par le canevas uPlot et le JS.
 *
 * uPlot dessine sur un <canvas> et ne peut pas lire les variables CSS
 * `--acq-*` : ces valeurs doivent donc exister en dur côté JS. Garder ce
 * module synchronisé avec les tokens de `src/index.css`.
 *
 * Les couleurs de séries configurables par l'hôte (`color`, `colorCumul`)
 * ne sont volontairement PAS ici : elles vivent dans `src/lib/config.js`
 * (défauts surchargeables par embed) et transitent en props.
 */

// Hauteur du canevas principal du graphe (px).
export const CHART_HEIGHT = 300

// Couleur des axes (remplace l'ancien '#666' — tokens --acq-text-muted).
// Réglée pour un fond clair : le canevas ne suit pas prefers-color-scheme
// (contrairement au « chrome » HTML). Un réglage sombre dédié (via matchMedia)
// reste un suivi optionnel si la lisibilité des axes en dark pose problème.
export const AXIS_STROKE = '#64748b'

// Couleur de repli d'un seuil sans htmlColor (tokens --acq-text-faint).
export const THRESHOLD_FALLBACK = '#94a3b8'

// Couleur d'un seuil désactivé dans la légende (gris clair, --acq-border+).
export const INACTIVE_RULE = '#cbd5e1'

// Suffixe hexadécimal d'alpha (~50 %) pour le remplissage des barres pluvio.
export const FILL_ALPHA_SUFFIX = '80'

// Opacité du remplissage de la sélection du ranger.
export const RANGER_FILL_ALPHA = 0.1
