# Accès aux bulles dans la salle des Archives

## Constat utilisateur

Le 7 octobre, Baptiste indique ne pas voir les bulles. Sa capture montre les trois vitrines corail des tables rondes, un indicateur « ! » et le panneau du programme provisoire du 24 septembre. Les 22 idées existent dans les archives publiées, mais leur accès passe par les longues fiches ouvertes depuis le HUD ; aucun thème n'est présenté dans la salle.

## Correction

- Les trois vitrines restent les seules tables rondes exposées.
- Chaque vitrine annonce ses idées publiées ; le nuage actif affiche les thèmes et s'ouvre aussi au toucher ou au clavier.
- Choisir une idée ouvre directement son titre, son résumé et son passage source, sans devoir parcourir le programme annoncé.
- Le panneau et l'accueil distinguent les contenus publiés des transcriptions encore absentes ; aucune relecture humaine n'est promise.
- Les compteurs et les boutons viennent des données publiées, sans dupliquer le texte des 22 idées.
- Le store valide les ids et la publication avant d'ouvrir une idée, conserve la visite de la table parente et retire une sélection périmée après rafraîchissement.

La transcription automatique, les résumés FR/EN et les extraits source du 6 octobre restent les mêmes. Aucun nouvel orateur ni repère temporel n'est déduit du programme annoncé.

## Contrôles de livraison

La livraison exige les contrôles unitaires du store et de l'interface, les parcours e2e par tap/clic sur les commandes visibles dans la salle, les contrôles de largeur 320 px et d'accessibilité, puis une vérification visuelle en production après CI de la PR, fusion et déploiement Vercel.

### Validation locale avant PR

- Lint, TypeScript et build passent ; les budgets de bundle, les invariants de sécurité et de contenu passent.
- 117 fichiers unitaires passent : 2 257 tests réussis, 7 ignorés par les conditions existantes.
- Les 12 nouveaux parcours E2E passent sur iPhone, Android et desktop : ouverture des 22 idées de chaque format, source exacte, clavier, défilement tactile, reprise du joystick, FR/EN et accessibilité à 320 px.
- Le parcours natif depuis le hall confirme le panneau 3/22, le déploiement des thèmes, le choix d'une autre table et l'ouverture directe d'un résumé avec sa source.
- Les cinq fichiers du corpus et du seed SQL sont identiques à la version publiée le 6 octobre. SHA-256 du transcript intégral : `9a7177cab47987a575536d56a026de95a02f6df428595eebabae967744349dc3`.

Une dernière passe locale des trois suites Archives et la CI complète de la PR valident le code figé avant fusion. La preuve de déploiement et du parcours public est ajoutée à la PR après publication.
