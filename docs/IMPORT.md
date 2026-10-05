# Importer la vraie liste des 100

Guide pour remplir et envoyer la liste des 100 qui font l'IA en Europe. Tu n'as rien à installer ni à coder : un fichier Excel (ou Google Sheets) suffit.

## 1. Remplir le fichier

Pars du modèle [`data/template-les-100.csv`](../data/template-les-100.csv) — ouvre-le dans Excel, Numbers ou Google Sheets, supprime la ligne d'exemple (« Exemple À-Supprimer ») et remplis une ligne par personne.

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `nom` | oui | Nom complet affiché sur le cadre. |
| `organisation` | non | Entreprise, institution… (une seule valeur, pas de traduction). |
| `pays` | oui | Pays de la personne — nom en français ou en anglais (« France », « Germany »…) ou code à 2 lettres (« FR », « DE »). L'import convertit automatiquement. |
| `aile` | oui* | `infrastructures`, `industrialisation` ou `culture` (les trois tables rondes de la soirée). *Si une ligne n'a pas d'aile, tu peux la laisser vide et lancer l'import avec une aile par défaut (voir plus bas) — mais il vaut mieux la remplir. |
| `role` / `role_en` | oui / conseillé | Fonction affichée sous le nom, en français puis en anglais (ex. « Fondatrice », « Founder »). Si `role_en` est vide, le jeu réaffiche le français aux visiteurs anglophones. |
| `bio` / `bio_en` | oui / conseillé | Accroche courte affichée en gras sur la fiche. **220 caractères maximum en français.** |
| `histoire` / `histoire_en` | non | Texte plus long affiché plus bas sur la fiche. Peut faire plusieurs phrases. |
| `citation` / `citation_en` | non | Une citation affichée dans une bulle. Laisse vide s'il n'y en a pas. |
| `photo` | non | Un chemin vers une photo sur ton ordinateur, ou une URL (`https://…`). L'import la recadre et l'optimise automatiquement. Sans photo, un portrait dessiné générique est utilisé. |
| `source_photo` (ou `source photo`) | non | Si tu n'as pas encore la photo elle-même : l'adresse d'une page ou d'une image officielle où on pourra aller la chercher plus tard (site de l'organisation, page « À propos », profil officiel…). **N'est jamais utilisée comme photo directement** (une page web n'est pas une image) : elle sert seulement d'aide-mémoire dans le rapport d'import, pour que celui qui complètera les photos sache où regarder. |
| `credit_photo` (ou `licence`, `licence/crédit`) | non | Crédit et/ou licence de la photo, affiché en petit (ex. « Photo : Jean Dupont », « Photo officielle, tous droits réservés », « CC BY 4.0 »). Tant que ce n'est pas rempli, la fiche remonte dans le rapport « sans photo ni crédit » en fin d'import. |
| `liens` | non | Un ou plusieurs liens, séparés par `;`, sous la forme `Libellé\|https://...` (ex. `LinkedIn\|https://linkedin.com/in/...`). Une URL seule fonctionne aussi. |

Tu peux ajouter, retirer ou renommer légèrement des colonnes (en anglais si tu préfères : `name`, `country`, `wing`, `story`, `quote`…) : l'import reconnaît les deux langues pour les en-têtes.

**Enregistre en `.csv`** (Fichier → Enregistrer sous → CSV). Un export Excel en français (séparateur `;`) fonctionne aussi.

## 2. Envoyer le fichier

Envoie le `.csv` (et, si tu les as séparément, les photos dans un dossier ou des liens vers chaque photo) par le canal habituel du projet. Précise si certaines ailes ne sont pas encore connues pour que je lance l'import avec une aile par défaut en attendant.

## 3. Ce que fait l'import

Une fois le fichier reçu, l'import (`pnpm import:people ton-fichier.csv`) :

1. Lit chaque ligne et convertit les pays et les ailes.
2. Vérifie chaque fiche (nom présent, bio pas trop longue, pays et aile valides…). Les lignes qui ne passent pas la vérification sont **ignorées et listées dans le rapport**, elles n'empêchent pas les autres d'être importées.
3. Recadre et compresse chaque photo (carré, 512 pixels, centré sur le haut du visage).
4. Écrit la liste finale dans le jeu (`public/data/people.json`) et prépare le SQL à appliquer sur la base (`supabase/seed/people.sql`), **toujours en brouillon** (voir étape 4 ci-dessous).
5. Affiche un rapport : combien de fiches importées, les erreurs ligne par ligne, les photos manquantes, et la liste des fiches sans photo ni crédit à compléter avant la mise en ligne (avec la « source photo » indiquée, si tu en as renseigné une).

Rien n'est envoyé sur internet pendant cette étape : tout se passe sur l'ordinateur qui lance l'import. La mise en ligne (application du SQL sur Supabase) est une étape séparée, faite par l'équipe technique.

Options possibles pour qui lance l'import :
- `--dry-run` : fait tout le travail de vérification et affiche le rapport, sans rien écrire — pratique pour relire avant de valider.
- `--wing-default=infrastructures` (ou `industrialisation` / `culture`) : utilise cette aile pour les lignes où elle manque.
- `--no-photos` : n'essaie pas de traiter les photos (utile si elles ne sont pas encore prêtes).
- `--publish` : marque les fiches comme prêtes à publier (voir étape 4). **Sans cette option, aucune fiche n'est visible dans le jeu**, même une fois le SQL exécuté.

## 4. Relecture humaine obligatoire, puis publication

**Aucune fiche ne doit être visible par les visiteurs sans avoir été relue par un humain.** C'est pour ça que l'import écrit toujours les fiches en brouillon (`published = false`) par défaut : le SQL généré (`supabase/seed/people.sql`) peut être exécuté sans risque à tout moment pour préparer les données, sans rendre quoi que ce soit public.

Avant de publier, relis pour chaque fiche :
- **Le rapport d'import** : combien de fiches, quelles lignes ont été ignorées et pourquoi, quelles fiches n'ont ni photo ni crédit.
- **Les bios et histoires** (`bio`, `histoire`) une par une : ce sont les seuls textes qui décrivent une vraie personne dans le jeu, ils doivent être exacts et bien écrits avant d'être publics.
- **Le jeu avec la nouvelle liste** (une version de test), pour vérifier que les fiches s'affichent bien.

Une fois la relecture faite, deux façons de publier (seulement les fiches relues, pas besoin d'attendre les 100) :
1. Relancer l'import avec `--publish` en plus des autres options, puis exécuter le SQL généré dans le SQL editor Supabase.
2. Ou, dans le SQL editor, passer `published` à `true` à la main sur les lignes déjà en base qui ont été relues (`update public.people set published = true where id = '...';`).

Corriger une fiche déjà publiée (relancer l'import après une coquille) ne la repasse jamais en brouillon : seule une fiche qui n'existe pas encore en base peut être insérée en brouillon, une fiche existante garde son statut de publication tel quel.

Si une fiche est fausse ou mal orthographiée après la mise en ligne, il suffit de corriger la ligne dans le fichier et de relancer l'import : les fiches existantes sont mises à jour, pas dupliquées.
