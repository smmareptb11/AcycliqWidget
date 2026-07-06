# Acycliq Widget — Guide d'intégration

<p align="center">
  <img src="../assets/smmar-logo.png" alt="SMMAR" height="80" />
  <img src="../assets/1_PREFET_AUDE-1.svg" alt="Préfecture de l'Aude" height="80" />
  <img src="../assets/Flag_of_the_Department_of_Aude.svg.png" alt="Département de l'Aude" height="80" />
</p>

Widget graphique embarquable pour la visualisation des données hydrométriques et pluviométriques issues de l'API Acycliq.

## Prérequis

- Un **token d'accès** à l'API Acycliq (Bearer Token)
- L'URL de l'API (par défaut : `https://smmar.acycliq.fr/api`)

## Installation

### Via CDN (unpkg)

```html
<script src="https://unpkg.com/acycliq-widget@latest/dist/embed/acycliq-widget.min.js"></script>
```

### Via npm

```bash
npm install acycliq-widget
```

## Utilisation

### Widget Hydro

```html
<div id="hydro1" style="width: 100%; height: 500px;"></div>

<script src="https://unpkg.com/acycliq-widget@latest/dist/embed/acycliq-widget.min.js"></script>
<script>
  acycliq.hydro({
    apiUrl: 'https://smmar.acycliq.fr/api',
    token: 'VOTRE_TOKEN',
    container: '#hydro1',
    idStation: 17
  })
</script>
```

### Widget Pluvio

```html
<div id="pluvio1" style="width: 100%; height: 500px;"></div>

<script src="https://unpkg.com/acycliq-widget@latest/dist/embed/acycliq-widget.min.js"></script>
<script>
  acycliq.pluvio({
    apiUrl: 'https://smmar.acycliq.fr/api',
    token: 'VOTRE_TOKEN',
    container: '#pluvio1',
    idStation: 719
  })
</script>
```

## Paramètres — Widget Hydro

| Paramètre | Obligatoire | Type | Default | Description |
|-----------|------------|------|---------|-------------|
| `apiUrl` | oui | string | — | URL de base de l'API Acycliq |
| `token` | oui | string | — | Token Bearer pour l'authentification |
| `container` | oui | string | — | Sélecteur CSS du conteneur |
| `idStation` | oui | number | — | Identifiant de la station hydrologique |
| `width` | non | string | `'100%'` | Largeur de l'iframe |
| `height` | non | string | `'100%'` | Hauteur de l'iframe |
| `color` | non | string | `'#007BFF'` | Couleur principale du graphique |
| `dataType` | non | number | `4` | Type de données : `4` (hauteur) ou `5` (débit) |
| `startDate` | non | string | Now - 30j | Date de début (ISO 8601) |
| `endDate` | non | string | Now | Date de fin (ISO 8601) |
| `hours` | non | number | `3` | Amplitude initiale de la fenêtre visible (en heures) |
| `ngf` | non | boolean | `true` | Conversion en mètres NGF (si altitude disponible) — appliquée aussi aux seuils |
| `threshold` | non | boolean | `true` | Afficher les seuils de la station |
| `refresh` | non | number | `5` | Intervalle de rafraîchissement (en minutes) |
| `src` | non | string | auto | URL de l'iframe (auto-détecté par défaut) |

> Le nom de la station est affiché en titre au-dessus du graphique (récupéré via l'API).

## Paramètres — Widget Pluvio

| Paramètre | Obligatoire | Type | Default | Description |
|-----------|------------|------|---------|-------------|
| `apiUrl` | oui | string | — | URL de base de l'API Acycliq |
| `token` | oui | string | — | Token Bearer pour l'authentification |
| `container` | oui | string | — | Sélecteur CSS du conteneur |
| `idStation` | oui | number | — | Identifiant de la station pluviométrique |
| `width` | non | string | `'100%'` | Largeur de l'iframe |
| `height` | non | string | `'100%'` | Hauteur de l'iframe |
| `color` | non | string | `'#007BFF'` | Couleur des barres de pluviométrie |
| `colorCumul` | non | string | `'#FF6B00'` | Couleur de la courbe de cumul de pluie |
| `startDate` | non | string | Now - 30j | Date de début (ISO 8601) |
| `endDate` | non | string | Now | Date de fin (ISO 8601) |
| `hours` | non | number | `3` | Amplitude initiale de la fenêtre visible (en heures) |
| `cumul` | non | boolean | `true` | Afficher la courbe cumulative |
| `groupFunc` | non | string | `'all'` | Niveau d'agrégation : `'all'`, `'SUM_HOUR'` (cumul horaire) ou `'SUM_DAY'` (cumul journalier) |
| `refresh` | non | number | `5` | Intervalle de rafraîchissement (en minutes) |
| `src` | non | string | auto | URL de l'iframe (auto-détecté par défaut) |

> Le nom de la station est affiché en titre au-dessus du graphique (récupéré via l'API).

## Multi-instances

Vous pouvez afficher plusieurs widgets sur la même page :

```html
<div id="hydro1" style="width: 100%; height: 450px;"></div>
<div id="pluvio1" style="width: 100%; height: 450px;"></div>

<script src="https://unpkg.com/acycliq-widget@latest/dist/embed/acycliq-widget.min.js"></script>
<script>
  acycliq.hydro({
    apiUrl: 'https://smmar.acycliq.fr/api',
    token: 'VOTRE_TOKEN',
    container: '#hydro1',
    idStation: 17
  })

  acycliq.pluvio({
    apiUrl: 'https://smmar.acycliq.fr/api',
    token: 'VOTRE_TOKEN',
    container: '#pluvio1',
    idStation: 719
  })
</script>
```

## Licence

AGPL-3.0 — [SMMAR](https://www.smmar.fr)
