# Acycliq Widget — Guide d'intégration

<p align="center">
  <img src="../assets/smmar-logo.png" alt="SMMAR" height="80" />
  <img src="../assets/1_PREFET_AUDE-1.svg" alt="Préfecture de l'Aude" height="80" />
  <img src="../assets/Flag_of_the_Department_of_Aude.svg.png" alt="Département de l'Aude" height="80" />
</p>

Widget graphique embarquable pour la visualisation des données hydrométriques et pluviométriques issues de l'API Acycliq.

## Prérequis

- L'URL de l'API (par défaut : `https://smmar.acycliq.fr/api`)
- Si l'API l'exige, un **token d'accès** (Bearer Token)

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
| `container` | oui | string | — | Sélecteur CSS du conteneur |
| `idStation` | oui | number | — | Identifiant de la station hydrologique |
| `token` | non | string | — | Token Bearer envoyé dans l'en-tête `Authorization`. Sans token, les requêtes partent sans en-tête d'authentification |
| `width` | non | string | `'100%'` | Largeur de l'iframe |
| `height` | non | string | `'100%'` | Hauteur de l'iframe |
| `color` | non | string | `'#0284C7'` | Couleur principale du graphique |
| `dataType` | non | number | `4` | Type de données : `4` (hauteur) ou `5` (débit) |
| `startDate` | non | string | Now - 30j | Date de début (ISO 8601) |
| `endDate` | non | string | Now | Date de fin (ISO 8601) |
| `hours` | non | number | `3` | Amplitude initiale de la fenêtre visible (en heures) |
| `ngf` | non | boolean | `true` | Conversion en mètres NGF (si altitude disponible) — appliquée aussi aux seuils |
| `threshold` | non | boolean | `true` | Afficher les seuils de la station |
| `thresholdCategories` | non | string[] | toutes | Catégories de seuils proposées dans la légende (voir ci-dessous) |
| `thresholdCategoriesDefault` | non | string[] | toutes | Catégories actives au chargement ; les autres apparaissent grisées |
| `refresh` | non | number | `5` | Intervalle de rafraîchissement (en minutes) |
| `src` | non | string | auto | URL de l'iframe (auto-détecté par défaut) |

> Le nom de la station, la dernière valeur mesurée et sa date d'acquisition sont affichés sur une seule ligne au-dessus du graphique (récupérés via l'API).

### Catégories de seuils

L'API Acycliq classe chaque seuil dans une catégorie. Le widget accepte
indifféremment le libellé ou le code numérique correspondant :

| Libellé | Code API | Description |
|---------|----------|-------------|
| `situation` | `1` | Seuils de situation (vigilance, alerte, crise) |
| `informatif` | `2` | Seuils informatifs (repères, atteintes remarquables) |
| `controle` | `3` | Seuils de contrôle |
| `autre` | *(absent)* | Seuils sans catégorie renseignée par l'API |

La catégorie `autre` n'existe pas côté API : c'est le repli du widget pour les
seuils dont la réponse ne porte pas de champ `category` — cas fréquent sur les
stations dont les seuils n'ont pas encore été classés. Elle est proposée et
active par défaut, afin que ces seuils continuent de s'afficher.

Les deux options se combinent ainsi :

- `thresholdCategories` détermine ce qui **existe** dans la légende. Une
  catégorie absente de cette liste n'est ni tracée ni cliquable.
- `thresholdCategoriesDefault` détermine ce qui est **actif au chargement**. Une
  catégorie proposée mais absente de cette liste apparaît grisée et barrée dans
  la légende, sans ligne sur le graphique ; un clic l'affiche.

`thresholdCategoriesDefault` doit être un sous-ensemble de
`thresholdCategories` : sinon la configuration est rejetée à la validation.

#### Rendu dans la légende

Dès que la station porte au moins deux catégories, la légende les regroupe et
affiche un en-tête par catégorie. Cet en-tête est cliquable : il affiche ou masque
tous les seuils de sa catégorie d'un coup. Son état est déduit de ses seuils —
actif si tous sont tracés, grisé et barré si aucun ne l'est, marqué d'un point
si le groupe est panaché. Un clic sur un groupe panaché l'affiche entièrement.

Quand la station ne porte qu'une seule catégorie — cas de toutes les stations
dont les seuils ne sont pas encore classés côté Acycliq — la légende reste une
simple liste de seuils, sans en-tête.

Les seuils **informatifs** sont tracés en pointillé fin, plus discret que les
seuils de situation : ce sont des repères ponctuels, destinés à être lus par
rapport à l'échelle de vigilance plutôt qu'à sa place. Les autres catégories
conservent le tracé habituel (tireté, épaisseur 2, couleur de l'API).

#### Rendu dans l'infobulle

Au survol du graphique, l'infobulle rappelle la date, la mesure, puis chaque
seuil actuellement tracé — nom et valeur, précédés du témoin de sa couleur.
Masquer une catégorie dans la légende la retire donc aussi de l'infobulle :
c'est le moyen de raccourcir la liste sur les stations qui portent de nombreux
repères de crue.

```html
<script>
  acycliq.hydro({
    apiUrl: 'https://smmar.acycliq.fr/api',
    token: 'VOTRE_TOKEN',
    container: '#mon-graphique',
    idStation: 12,
    // Seuils de situation et informatifs disponibles…
    thresholdCategories: ['situation', 'informatif'],
    // …mais seuls les seuils de situation sont tracés au chargement.
    thresholdCategoriesDefault: ['situation']
  })
</script>
```

La visibilité choisie par le visiteur est conservée d'un rafraîchissement
automatique à l'autre.

## Paramètres — Widget Pluvio

| Paramètre | Obligatoire | Type | Default | Description |
|-----------|------------|------|---------|-------------|
| `apiUrl` | oui | string | — | URL de base de l'API Acycliq |
| `container` | oui | string | — | Sélecteur CSS du conteneur |
| `idStation` | oui | number | — | Identifiant de la station pluviométrique |
| `token` | non | string | — | Token Bearer envoyé dans l'en-tête `Authorization`. Sans token, les requêtes partent sans en-tête d'authentification |
| `width` | non | string | `'100%'` | Largeur de l'iframe |
| `height` | non | string | `'100%'` | Hauteur de l'iframe |
| `color` | non | string | `'#0284C7'` | Couleur des barres de pluviométrie |
| `colorCumul` | non | string | `'#EA580C'` | Couleur de la courbe de cumul de pluie |
| `startDate` | non | string | Now - 30j | Date de début (ISO 8601) |
| `endDate` | non | string | Now | Date de fin (ISO 8601) |
| `hours` | non | number | `3` | Amplitude initiale de la fenêtre visible (en heures) |
| `cumul` | non | boolean | `true` | Afficher la courbe cumulative |
| `groupFunc` | non | string | `'all'` | Niveau d'agrégation : `'all'`, `'SUM_HOUR'` (cumul horaire) ou `'SUM_DAY'` (cumul journalier) |
| `refresh` | non | number | `5` | Intervalle de rafraîchissement (en minutes) |
| `src` | non | string | auto | URL de l'iframe (auto-détecté par défaut) |

> Le nom de la station est affiché en titre au-dessus du graphique (récupéré via l'API).

## Export du graphique en image

Chaque graphique dispose d'un bouton permettant de télécharger l'image du graphique tel qu'il est affiché (fenêtre temporelle et seuils
visibles compris). Le fichier est nommé d'après le widget et la station, par exemple
`acycliq-hydro-ruisseau-de-la-nere-a-villefranche-17.png`.

Aucun paramètre à renseigner : la fonctionnalité est toujours disponible.

## Rafraîchissement des données

Lorsque le paramètre `refresh` est renseigné (5 minutes par défaut), le graphique
recharge ses mesures à cet intervalle. Un indicateur d'état est affiché à côté du
nom de la station :

- **Rien** : le dernier rafraîchissement a réussi.
- **Spinner** : un rafraîchissement est en cours.
- **Triangle d'alerte** : le dernier rafraîchissement a échoué. Son survol indique
  la date et l'heure de l'échec ; un **clic force un nouveau rafraîchissement**.

Un échec transitoire (API momentanément indisponible) **ne détruit pas** le
graphique déjà affiché : les dernières données valides restent visibles et seul
le triangle d'alerte signale le problème. L'écran d'erreur plein cadre n'apparaît
que si le **tout premier** chargement échoue (aucune donnée à afficher).

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
