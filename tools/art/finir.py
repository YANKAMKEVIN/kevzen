#!/usr/bin/env python3
"""Kevblast : finit les images brutes de Codex.
Usage : python finir.py PROMPTS_JSON DOSSIER_BRUT DOSSIER_SORTIE [fichier ...]
- recadre (centre, cover) puis redimensionne à la taille exacte demandée ;
- si detourer : fond magenta #FF00FF -> transparent (tolérance + bord adouci + suppression du halo rose) ;
- si raccord: N (JSON) ou RACCORD="nom:N" (environnement) : fond les N px des bords gauche/droite ; "nom:N:hv" fait aussi haut/bas ;
- enregistre <fichier>.webp qualité 85.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import os
# RACCORD="ciel_a:128,ciel_b:128" : fond les bords gauche/droite de ces images
# RACCORD="sable:96:hv" : hv = raccord aussi haut/bas (textures à paver sur 4 bords)
RACCORD = dict((e.split(":")[0], ":".join(e.split(":")[1:])) for e in os.environ.get("RACCORD", "").split(",") if e)
TOL_DUR, TOL_DOUX = 45.0, 95.0  # distance RGB au magenta : <dur = transparent, >doux = opaque

def cover(img, w, h):
    """Recadre sans déformer. Panoramas (largeur >= 3x hauteur) : on garde le bas (ligne d'horizon)."""
    sw, sh = img.size
    r = max(w / sw, h / sh)
    img = img.resize((round(sw * r), round(sh * r)), Image.LANCZOS)
    l = (img.width - w) // 2
    t = img.height - h if w >= 3 * h else (img.height - h) // 2
    return img.crop((l, t, l + w, t + h))

def detourer(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # distance au magenta pur
    d = np.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2)
    alpha = np.clip((d - TOL_DUR) / (TOL_DOUX - TOL_DUR), 0, 1)
    # ne détoure que le magenta relié au bord : un sujet rose/magenta au centre reste opaque
    proche = Image.fromarray(((d < TOL_DUR) * 255).astype(np.uint8))
    hh, ww = d.shape
    for x, y in [(x, 0) for x in range(0, ww, 8)] + [(x, hh - 1) for x in range(0, ww, 8)] + \
                [(0, y) for y in range(0, hh, 8)] + [(ww - 1, y) for y in range(0, hh, 8)]:
        if proche.getpixel((x, y)) == 255: ImageDraw.floodfill(proche, (x, y), 128)
    fond = np.asarray(proche.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(3))) > 0
    alpha = np.where(fond, alpha, 1.0)
    # adoucissement léger du bord
    am = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(am).astype(np.float32) / 255
    alpha[d < TOL_DUR * 0.8] = 0
    # dé-contamination : retire la part de magenta mélangée dans les pixels de bord
    mag = np.array([255, 0, 255], np.float32)
    bord = (alpha > 0) & (alpha < 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        rec = (a - (1 - alpha[..., None]) * mag) / np.maximum(alpha[..., None], 1e-3)
    a = np.where(bord[..., None], np.clip(rec, 0, 255), a)
    # anti-halo : sur les bords, limite r et b au-dessus de g (teinte rose résiduelle)
    spill = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    lim = bord & (spill > 40)
    a[..., 0] = np.where(lim, a[..., 0] - (spill - 40) * 0.5, a[..., 0])
    a[..., 2] = np.where(lim, a[..., 2] - (spill - 40) * 0.5, a[..., 2])
    # bouche les petits trous (pixels du sujet presque magenta) : fermeture 3x3 du masque,
    # et les pixels rebouchés prennent la couleur médiane de leurs voisins opaques
    m = Image.fromarray((alpha * 255).astype(np.uint8))
    ferme = np.asarray(m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    trou = ferme > alpha + 0.5
    if trou.any():
        opaque = np.where((alpha > 0.9)[..., None], a, 0).astype(np.uint8)
        med = np.asarray(Image.fromarray(opaque).filter(ImageFilter.MaxFilter(3))).astype(np.float32)
        a[trou] = med[trou]
        alpha = np.maximum(alpha, ferme)
    out = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out)

def raccorder(img, bande):
    """Rend une image raccordable gauche/droite : les `bande` px de droite sont fondus dans
    ceux de gauche puis retirés ; l'image est ensuite ramenée à sa largeur d'origine."""
    a = np.asarray(img).astype(np.float32); h, w = a.shape[:2]
    t = np.linspace(0, 1, bande)[None, :, None]
    out = a[:, : w - bande].copy()
    out[:, :bande] = a[:, w - bande:] * (1 - t) + a[:, :bande] * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)

def main():
    js, brut, sortie, *noms = sys.argv[1:]
    d = json.load(open(js)); Path(sortie).mkdir(parents=True, exist_ok=True)
    for im in d["images"]:
        if noms and im["fichier"] not in noms: continue
        src = Path(brut) / f"{im['fichier']}.png"
        if not src.exists(): print("absent", src); continue
        w, h = map(int, im["taille"].split("x"))
        img = cover(Image.open(src).convert("RGB"), w, h)
        spec = str(im.get("raccord") or RACCORD.get(im["fichier"]) or "")
        if spec:
            bande, *mode = spec.split(":")
            img = raccorder(img, int(bande))
            if mode and mode[0] == "hv":
                img = raccorder(img.transpose(Image.Transpose.TRANSPOSE), int(bande)).transpose(Image.Transpose.TRANSPOSE)
        if im.get("detourer"): img = detourer(img)
        dst = Path(sortie) / f"{im['fichier']}.webp"
        img.save(dst, "WEBP", quality=85, method=6)
        print(f"{dst.name} {w}x{h} {dst.stat().st_size // 1024} Ko")

if __name__ == "__main__":
    main()
