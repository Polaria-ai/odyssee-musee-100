# Le Musée des 100 — L'Odyssée de l'IA

Musée 3D à visiter depuis son téléphone : on se promène dans un grand hall et trois ailes, on découvre les **100 qui font l'IA en Europe**, on collectionne les tampons et on croise les autres visiteurs. Créé par Polaria pour L'Opinion (L'Odyssée de l'IA, 6 octobre 2026).

```bash
pnpm install
cp .env.example .env.local   # facultatif : sans Supabase, le jeu tourne sur les fiches locales
pnpm dev                     # http://localhost:5173
pnpm verify                  # lint, types, tests, build, budgets, sécurité, contenu
pnpm e2e                     # tests smartphone Playwright
```

- Direction artistique : [docs/DESIGN.md](docs/DESIGN.md)
- Architecture et contrat entre modules : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Intégrer la vraie liste des 100 : [docs/IMPORT.md](docs/IMPORT.md)
