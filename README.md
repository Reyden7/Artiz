# Artiz

Application mobile du réseau social du savoir-faire local. Ce dépôt contient les fondations du MVP en **Expo SDK 57, React Native, TypeScript et Expo Router**, avec Supabase et TanStack Query préparés pour les données serveur.

## Démarrer

```bash
npm install
npm run start
```

Appuyez sur `w` pour ouvrir le web, ou utilisez Expo Go sur Android ou iOS. `npm run web` lance directement la version web.

## Configuration Supabase

Copiez `.env.example` en `.env`, puis renseignez l’URL du projet et sa **publishable key**. Ne mettez jamais une clé `service_role` dans l’application.

```text
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

La connexion par e-mail fonctionne une fois Supabase Auth configuré. L’inscription particulier crée pour l’instant un utilisateur Auth ; la création du profil métier sera ajoutée avec la migration et les politiques RLS. L’inscription professionnel affiche les champs requis mais bloque l’envoi tant que la vérification serveur du SIRET et les règles RLS ne sont pas en place. Aucun droit professionnel n’est accordé depuis les données du client.

## Portée actuelle

- Navigation principale **en haut** et thème visuel inspiré des maquettes.
- Écrans : accueil, découverte, publication, réseau, profil, messages, notifications, connexion, inscription, profil professionnel, conversation et demande de devis.
- Contenus de démonstration locaux pour visualiser les parcours. Les likes, favoris, suivis et messages de démonstration ne sont pas persistés.
- Types distincts pour `account_type` et les futurs plans `FREE`, `PRO`, `PRO_PLUS`.

Les prochaines phases brancheront les tables Supabase, la vérification SIRET côté serveur, les politiques RLS, Storage, puis les interactions sociales et la messagerie réelles. Les images de démonstration sous `assets/artiz/` ont été générées pour cette maquette.

## Vérification

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Le build natif avec EAS nécessite une connexion à un compte Expo : `npx eas-cli@latest build --profile preview --platform android` (ou `ios`).
