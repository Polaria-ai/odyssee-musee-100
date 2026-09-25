# Modèles 3D — sources, licences, pipeline

## Sources autorisées

Uniquement des modèles **CC0** (domaine public), de sources officielles :

| Pack | Source | Licence |
|---|---|---|
| Furniture Kit 2.0 | https://kenney.nl/assets/furniture-kit | CC0 |
| Nature Kit | https://kenney.nl/assets/nature-kit | CC0 |
| Factory Kit 3.0 | https://kenney.nl/assets/factory-kit | CC0 |
| Space Kit | https://kenney.nl/assets/space-kit | CC0 |
| Building Kit | https://kenney.nl/assets/building-kit | CC0 |
| Holiday Kit | https://kenney.nl/assets/holiday-kit | CC0 |

Packs bruts téléchargés le 25/09/2026 dans `~/Dev/odyssee-musee-100-assets/kenney/` (hors Git, 140 Mo décompressés). Quaternius (https://quaternius.com) et Poly Pizza (https://poly.pizza) sont possibles **uniquement** pour des modèles marqués CC0, à consigner ci-dessous. Jamais de CC-BY sans validation, jamais de modèle Nintendo ou « inspiré de » récupéré en ligne.

## Pipeline

1. Copier le GLB brut choisi dans `assets-src/<module>/<nom>.glb` (ignoré par Git).
2. `node scripts/optimize-assets.mjs <module>` → `public/models/<module>/<nom>.glb` (meshopt, textures WebP ≤ 512 px).
3. Charger avec `useModel('/models/<module>/<nom>.glb')` (`src/assets/useModel.ts`), sous `<Suspense>`. Répéter un modèle : cloner la scène ou instancier, jamais recharger.
4. `pnpm verify:bundle` : ≤ 400 Ko par fichier, ≤ 6 Mo pour tous les modèles.

## Modèles utilisés

| Fichier publié | Pack d'origine | Modèle d'origine | Retouches |
|---|---|---|---|
| _(à compléter par chaque module)_ | | | |
