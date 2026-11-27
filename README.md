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

Le jeu est découpé en modules JavaScript, que les navigateurs refusent d'ouvrir en `file://` : lancez `npm start` puis ouvrez http://localhost:8000 (ou jouez en ligne sur GitHub Pages). Rien d'autre à installer.

## Technique

- `index.html` et `style.css` ; le code est dans `src/`, en modules ES sans étape de construction.
- `src/garden.js` : le jardin sans DOM (champ de hauteur du sable, râteau, pierres et cercles, annulation, nouveau jardin, jardinier automatique). Testable sous Node.
- `src/render.js` (sable ombré, pierres, particules, lumière), `src/audio.js` (musique créée en direct), `src/ui.js` (outils, gestes, boucle), `src/config.js` (constantes, lumières, version), `src/art.js` (visuels peints).
- Typage : `// @ts-check` et JSDoc, vérifiés par `npm run types` (TypeScript en mode strict).
- `?graine=N` dans l'adresse rend le jardin rejouable à l'identique.

## Visuels

Les 6 visuels du dossier `art/` ont été peints avec Codex (prompts dans `tools/art/prompts.json`) :
le jardin à l'aube sous l'accueil, une tuile de sable sans couture (le grain posé sur le relief ratissé)
et les textures des 4 pierres (granit, basalte, grès, schiste). Le modelé, l'ombre, la mousse et
la teinte de l'ambiance restent calculés. Si une image manque, le jardin reste entièrement dessiné.

## Sauvegarde

La lumière choisie et le son sont gardés dans `localStorage`, clé `kevzen.sauvegarde`, avec un numéro de version. Une sauvegarde abîmée ou venant d'une version plus récente est mise de côté (`kevzen.sauvegarde.abimee`) et le jardin repart de l'aube. L'ancien format (clé `kevzen`) est repris une fois puis effacé.

## Tests

```bash
npm install
npx playwright install chromium
npm run types    # typage
npm run unit     # tests unitaires : râteau, pierres, annulation, compositions, jardinier, sauvegarde
npm run smoke    # fumée sur ordinateur, iPhone SE et Pixel 7
npm run partie   # partie complète à la souris puis au doigt sur iPhone SE
npm test         # tout
```

La CI GitHub (`.github/workflows/tests.yml`) lance tout sur chaque PR ; captures dans `test-results/`.
