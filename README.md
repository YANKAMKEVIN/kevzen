# KevZen

Un jardin zen génératif à jouer dans le navigateur. Ratissez le sable, posez des pierres et écoutez le jardin vous répondre : chaque geste dessine un paysage et joue une musique uniques.

## Comment jouer

- **Râteau** : glissez le doigt ou la souris pour creuser le sable. Chaque geste joue une note, plus aiguë en haut de l'écran et plus grave en bas.
- **Pierre** : touchez le sable pour poser une pierre. Des cercles se tracent tout seuls autour, avec un son de cloche. Touchez une pierre pour la retirer.
- **Lisser** : efface les traces.
- **Largeur** : râteau fin, moyen ou large.
- **Lumières** : Aube (pétales de cerisier), Midi, Crépuscule (feuilles d'érable), Nuit (lucioles). La gamme musicale change avec la lumière.
- **Méditer** : un jardinier invisible ratisse à votre place.
- **Nouveau** compose un autre jardin, **Annuler** revient en arrière, **Rétablir** refait ce qui a été annulé.
- **Galerie** : enregistrez le jardin, rouvrez-le plus tard, renommez-le ou effacez-le (12 jardins, gardés dans ce navigateur).
- **Exporter / Importer** (dans la galerie) : le jardin part dans un petit fichier `.kevzen.json` à garder ou à envoyer ; « Importer » le rouvre, ici ou sur un autre appareil.
- **Jardin gardé tout seul** : le jardin en cours est enregistré quelques instants après chaque geste ; fermez la page, il vous attend au retour.

Raccourcis clavier : `1` râteau, `2` pierre, `3` lisser, `Z` annuler, `Maj+Z` ou `Ctrl+Y` rétablir, `N` nouveau jardin, `M` méditer, `G` galerie.

## Le son

Toute la musique est créée en direct par le navigateur : notes de koto, nappe grave, vent, et de temps en temps le « toc » d'un bambou. Annuler joue une note de koto, Rétablir en fait monter deux, plus légères, Enregistrer et Exporter tintent comme un petit carillon à vent. Un casque est conseillé.

## Lancer l'appli

```bash
npm ci
npm start          # serveur de développement Vite : http://localhost:8000
npm run build      # jeu construit dans dist/
npm run preview    # sert dist/ sur http://localhost:8000
```

En ligne, GitHub Pages publie `dist/` à chaque fusion sur `main` (`.github/workflows/pages.yml`,
réglage Settings > Pages > Source : « GitHub Actions »).

## Technique

TypeScript strict, construit par Vite. Le modèle du jardin est pur (aucun DOM) et séparé du rendu :

- `src/core/` : le jardin, passé en paramètre à chaque fonction. `garden.ts` (état, grille de sable,
  masque des pierres), `tools.ts` (râteau, lissage, pierres), `compose.ts` (composition, nouveau jardin,
  balayage), `gardener.ts` (jardinier automatique), `history.ts` (annuler, rétablir),
  `serialize.ts` (jardin en JSON compact et versionné), `config.ts` (constantes, lumières).
- `src/render/` : sable ombré seulement là où il a changé (rendu incrémental), pierres peintes une fois
  puis gardées en cache, particules et lumière sans allocation par image, résolution plafonnée à 2.
- `src/ui/` : outils et clavier, gestes (un pointeur, souris ou doigt), galerie, boucle d'animation
  (arrêtée quand l'onglet est caché, son mis en pause).
- `src/storage/` : réglages, galerie, jardin en cours (`autosave.ts`, regroupé par `debounce.ts`), fichier d'échange (`file.ts`), accès au stockage qui ne lève jamais.
- `src/audio.ts` (musique créée en direct), `src/art.ts` (visuels peints, dans `public/art/`).
- `?graine=N` dans l'adresse rend le jardin rejouable à l'identique (le jardin gardé n'est alors pas repris).

## Visuels

Les 6 visuels du dossier `art/` ont été peints avec Codex (prompts dans `tools/art/prompts.json`) :
le jardin à l'aube sous l'accueil, une tuile de sable sans couture (le grain posé sur le relief ratissé)
et les textures des 4 pierres (granit, basalte, grès, schiste). Le modelé, l'ombre, la mousse et
la teinte de l'ambiance restent calculés. Si une image manque, le jardin reste entièrement dessiné.

## Sauvegarde

Tout reste dans `localStorage`, avec un numéro de version et une règle : une donnée abîmée ou venant
d'une version plus récente est mise de côté (clé + `.abimee`), jamais écrasée en silence.

- **Réglages** (lumière, son) : clé `kevzen.sauvegarde`. L'ancien format (clé `kevzen`) est repris une fois puis effacé.
- **Galerie** : un index `kevzen.galerie` (noms, dates, vignettes) et un jardin par clé `kevzen.jardin.<id>`,
  pour qu'un jardin abîmé n'emporte pas les autres. Si l'index est abîmé ou perdu, il est reconstruit à partir
  des jardins. Le sable est stocké comme l'écart au sable ratissé droit, sur un octet, avec les zones intactes
  compressées : quelques kilo-octets par jardin. Stockage plein : on réessaie sans vignette, sinon on renonce
  sans rien laisser à moitié écrit. Un jardin rouvert sur un écran d'une autre taille est remis à l'échelle.
- **Jardin en cours** : clé `kevzen.encours` (version `CURRENT_VERSION`), écrite 1,2 s après le dernier changement
  (au plus tard toutes les 6 s pendant la méditation) et tout de suite quand l'onglet est caché ou la page fermée.
  Stockage plein : la dernière sauvegarde réussie reste intacte et un message discret le dit. Au rechargement,
  le jardin revient sans historique à annuler, et l'accueil l'annonce.
- **Fichier** `.kevzen.json` : `{ app: "kevzen", kind: "jardin", version, name, mood, exportedAt, garden }`.
  À l'import, tout est vérifié avant de toucher au jardin : taille (2 Mo au plus), JSON, origine, version
  (une version plus récente est refusée avec un message dédié), lumière, pierres, grille cohérente avec l'écran
  d'origine et sable entièrement décodable. Un fichier refusé laisse le jardin et l'historique intacts.

## Tests

```bash
npm ci
npm run typecheck  # TypeScript strict
npm run unit       # tests unitaires (vitest) : outils, composition, jardinier, annuler/rétablir, sérialisation, galerie, réglages, jardin en cours, fichier
npm run build
npm run e2e        # Playwright (@playwright/test) sur le jeu construit, 2 workers
npm run smoke      #   seulement la fumée : ordinateur, iPhone SE, Pixel 7
npm run partie     #   tout sauf la fumée : partie, galerie, sauvegarde, fichier, mobile
npm test           # tout, dans l'ordre
```

Les tests de navigateur (`tests/e2e/*.spec.ts`, réglages dans `playwright.config.ts`) demandent Chromium
(`npx playwright install chromium`). Le serveur du jeu construit est lancé tout seul sur un port pris au hasard entre 5200 et 5999
(ou `KZ_PORT=5555`). Le tactile est joué avec de vrais événements tactiles envoyés par CDP.
La CI (`.github/workflows/tests.yml`) lance tout sur chaque PR et bloque en cas d'échec ; captures et rapport en artefact.
