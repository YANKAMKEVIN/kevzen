#!/usr/bin/env bash
# Kevblast : génère les images brutes avec le Codex de l'app ChatGPT.
# Usage : ./generer.sh PROMPTS_JSON OUT_DIR [fichier ...]   (sans fichier : toutes ; saute celles déjà présentes sauf FORCE=1 ; EXTRA="..." ajoute une consigne)
set -uo pipefail
CODEX="${CODEX:-/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex}"
JSON="$1"; OUT="$2"; shift 2
mkdir -p "$OUT/logs"
NOMS=("$@")
if [[ ${#NOMS[@]} -eq 0 ]]; then
  NOMS=($(python3 -c 'import json,sys;print(" ".join(i["fichier"] for i in json.load(open(sys.argv[1]))["images"]))' "$JSON"))
fi
for ID in "${NOMS[@]}"; do
  if [[ -f "$OUT/$ID.png" && "${FORCE:-0}" != 1 ]]; then echo "déjà $ID"; continue; fi
  TRAVAIL="$(mktemp -d)"
  python3 - "$JSON" "$ID" > "$TRAVAIL/prompt.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); im = next(i for i in d["images"] if i["fichier"] == sys.argv[2])
w, h = im["taille"].split("x")
from fractions import Fraction
r = Fraction(int(w), int(h))
fmt = "carré" if r == 1 else f"paysage, proportions {r.numerator}:{r.denominator} (largeur:hauteur)"
print("Utilise ton outil de génération d'images pour produire UNE image. N'écris pas de code et ne lance aucune commande. Quand l'image est produite, réponds seulement : FAIT.\n")
print(d["style"] + "\n")
print(im["prompt"] + "\n")
if im.get("detourer"): print(d["fond_detourage"] + "\n")
import os
if os.environ.get("EXTRA"): print(os.environ["EXTRA"] + "\n")
print(f"Format : image {fmt}, destinée à être ramenée à {w}x{h} pixels. Aucun texte, aucune lettre, aucun chiffre.")
PY
  ( cd "$TRAVAIL" && "$CODEX" exec --skip-git-repo-check -s read-only --json - < prompt.txt > sortie.jsonl 2> err.txt )
  cp "$TRAVAIL/sortie.jsonl" "$OUT/logs/$ID.jsonl"; cp "$TRAVAIL/err.txt" "$OUT/logs/$ID.err"
  SESSION="$(grep -o '"thread_id":"[^"]*"' "$TRAVAIL/sortie.jsonl" | head -1 | cut -d'"' -f4)"
  IMAGE="$(ls -t "$HOME/.codex/generated_images/$SESSION"/*.png 2>/dev/null | head -1 || true)"
  if [[ -z "$IMAGE" ]]; then echo "ECHEC $ID : $(grep -oiE '"message":"[^"]{0,200}' "$TRAVAIL/sortie.jsonl" | tail -1)"; continue; fi
  cp "$IMAGE" "$OUT/$ID.png"; echo "OK $ID"
done
