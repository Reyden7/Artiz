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

La connexion par e-mail utilise Supabase Auth. L’inscription particulier crée automatiquement un profil `customer` grâce à un trigger SQL. L’inscription professionnel reste bloquée dans l’application jusqu’à la mise en place de la vérification du SIRET côté serveur. Aucun droit professionnel n’est accordé depuis les données du client.

La base du projet Artiz contient maintenant les migrations versionnées dans [`supabase/migrations`](supabase/migrations) : 22 tables publiques avec RLS, une table privée pour les SIRET, et quatre buckets Storage privés. Les types de la base sont générés dans [`src/services/supabase/database.types.ts`](src/services/supabase/database.types.ts). Voir [`supabase/README.md`](supabase/README.md) pour le modèle d’accès et le déploiement.

## Portée actuelle

- Navigation principale **en haut** et thème visuel inspiré des maquettes.
- Écrans : accueil, découverte, publication, réseau, profil, messages, notifications, connexion, inscription, profil professionnel, conversation et demande de devis.
- Les écrans ne contiennent plus de faux comptes ni de fausses publications. La découverte des professionnels, le fil des réalisations, les demandes de devis et les conversations lisent ou écrivent désormais dans Supabase. Les likes, favoris et suivis restent à relier.
- Types distincts pour `account_type` et les futurs plans `FREE`, `PRO`, `PRO_PLUS`.

Les prochaines phases activeront l’inscription professionnelle après vérification du SIRET côté serveur, puis l’envoi des médias et les autres interactions sociales. Les images de marque sous `assets/artiz/` servent à l’interface.

## Vérification

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Le build natif avec EAS nécessite une connexion à un compte Expo : `npx eas-cli@latest build --profile preview --platform android` (ou `ios`).
