# KevZen

Un jardin zen génératif à jouer dans le navigateur. Ratissez le sable, posez des pierres et écoutez le jardin vous répondre : chaque geste dessine un paysage et joue une musique uniques.

## Comment jouer

- **Râteau** : glissez le doigt ou la souris pour creuser le sable. Chaque geste joue une note, plus aiguë en haut de l'écran et plus grave en bas.
- **Pierre** : touchez le sable pour poser une pierre. Des cercles se tracent tout seuls autour, avec un son de cloche. Touchez une pierre pour la retirer.
- **Lisser** : efface les traces.
- **Largeur** : râteau fin, moyen ou large.
- **Lumières** : Aube (pétales de cerisier), Midi, Crépuscule (feuilles d'érable), Nuit (lucioles). La gamme musicale change avec la lumière.
- **Méditer** : un jardinier invisible ratisse à votre place.
- **Nouveau** compose un autre jardin, **Annuler** revient en arrière.

Raccourcis clavier : `1` râteau, `2` pierre, `3` lisser, `Z` annuler, `N` nouveau jardin, `M` méditer.

## Le son

Toute la musique est créée en direct par le navigateur : notes de koto, nappe grave, vent, et de temps en temps le « toc » d'un bambou. Un casque est conseillé.

## Lancer l'appli

Ouvrez `index.html` dans un navigateur récent. Il n'y a rien à installer : tout tient dans ce seul fichier.

## Tests
Un test de fumée joue le jeu tout seul sur ordinateur, iPhone SE et Pixel 7 couché (Chromium) : il échoue sur toute erreur console, un bouton hors de l'écran impossible à atteindre, une page qui déborde ou une chute d'images/s.

```bash
npm install
npx playwright install chromium
npm test            # captures dans test-results/
```
Réglages propres au jeu : `tests/smoke.config.mjs`. La CI GitHub (`.github/workflows/tests.yml`) le lance sur chaque PR.
