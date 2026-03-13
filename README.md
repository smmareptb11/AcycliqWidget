# Acycliq Widget

<p align="center">
  <img src="assets/smmar-logo.png" alt="SMMAR" height="80" />
  <img src="assets/1_PREFET_AUDE-1.svg" alt="Préfecture de l'Aude" height="80" />
  <img src="assets/Flag_of_the_Department_of_Aude.svg.png" alt="Département de l'Aude" height="80" />
</p>

## Présentation

Acycliq Widget est un outil graphique embarquable (iframe) pour la visualisation en temps réel des données hydrométriques et pluviométriques issues de l'API Acycliq.

Développé pour le [SMMAR](https://www.smmar.fr) (Syndicat Mixte des Milieux Aquatiques et des Rivières) dans le cadre de l'observatoire **SIGN'EAU**, ce widget permet aux collectivités, services de l'État et partenaires d'intégrer facilement des graphiques de suivi hydrologique et pluviométrique sur leurs propres sites web.

### Fonctionnalités

- **Widget Hydrométrique** : visualisation des hauteurs d'eau (m / m NGF) et débits (m³/s) avec seuils d'alerte
- **Widget Pluviométrique** : visualisation des cumuls pluviométriques avec courbe cumulative optionnelle
- **Interactif** : zoom temporel (1h à 24h), frise chronologique avec sélection par glisser, export PNG
- **Embarquable** : intégration simple via une balise `<script>`, compatible avec tout site web
- **Temps réel** : rafraîchissement automatique configurable

## Démarrage rapide

```bash
cp .env.sample .env
# Renseigner VITE_ACYCLIQ_TOKEN et VITE_ACYCLIQ_API_URL dans .env
yarn install
yarn dev
```

## Tests

```bash
yarn test
```

## Documentation

Voir [docs/integration.md](docs/integration.md) pour le guide d'intégration complet.

## Licence

[AGPL-3.0](LICENSE)
