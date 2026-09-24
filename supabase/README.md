# Base de données Artiz

Les migrations de ce dossier ont été appliquées au projet Supabase Artiz. Elles couvrent les profils, professionnels, catégories, abonnements, publications, demandes, conversations, avis, notifications et signalements.

## Accès

- Toutes les tables exposées dans `public` ont RLS activé. Le rôle `anon` n’a aucun droit sur ces tables ; l’application requiert une session Auth.
- `profiles.account_type`, `professional_profiles.verification_status` et `subscriptions` sont modifiables seulement par du code serveur privilégié. Les métadonnées Auth saisies par l’utilisateur ne déterminent jamais ces droits.
- Le SIRET unique est conservé dans `app_private.professional_verifications`, sans accès depuis la Data API. Les coordonnées précises des particuliers sont dans `profile_locations`, lisibles seulement par leur propriétaire.
- Un professionnel ne peut publier ou répondre commercialement qu’avec un profil professionnel vérifié. Le plan d’abonnement (`FREE`, `PRO`, `PRO_PLUS`) est une donnée distincte du type de compte ; les fonctions payantes futures devront contrôler un abonnement actif côté serveur.
- La fonction privée `can_create_conversation(sender, recipient, context, request_id)` applique les règles de messagerie avant toute création. Un particulier peut initier une conversation avec un professionnel vérifié, jamais avec un autre particulier. Un professionnel ne peut initier le contact avec un particulier qu’après avoir répondu à sa demande publiée ou après un contact préalable du particulier ; dans ce dernier cas, la conversation existante est réutilisée. Le contact professionnel à professionnel est fermé pour le MVP.
- La base ajoute automatiquement les deux membres lors de la création autorisée. Le client ne peut plus ajouter de membre directement. Les messages exigent une conversation dont les deux types de compte sont encore compatibles ; seuls ses membres peuvent les lire et y écrire. Un index empêche les doublons pour une même paire.
- Les devis ciblés sont enregistrés comme demandes `private` avec un `recipient_id`. Seuls le client et le professionnel destinataire peuvent les consulter ; une demande ouverte sans destinataire reste publique. La confidentialité est conservée si le profil professionnel destinataire est supprimé.
- Les buckets `avatars`, `covers`, `post-images` et `request-images` sont privés, limités à 5 ou 10 Mo, et acceptent JPEG, PNG et WebP. Les objets sont rangés sous `<user_id>/...` ; Storage applique des politiques de lecture et d’écriture.

## Migrations

Les fichiers SQL sont versionnés avec les mêmes identifiants que les migrations distantes. Pour un nouvel environnement, connecter le projet avec le CLI Supabase puis appliquer les migrations avec `supabase db push`. Ne jamais mettre une clé secrète ou `service_role` dans `EXPO_PUBLIC_*`.

Après une modification du schéma, regénérer `src/services/supabase/database.types.ts` avec `supabase gen types typescript`, vérifier les migrations et lancer les conseillers de sécurité Supabase. Les politiques doivent être testées en simulant le rôle `authenticated`, pas seulement avec le propriétaire SQL qui contourne RLS.

Le scénario [`tests/conversation_rules.sql`](tests/conversation_rules.sql) exerce les quatre combinaisons de comptes, le contact lié à une demande, l’ajout automatique des membres et le refus d’un ajout direct. Il se termine par `ROLLBACK` et ne conserve aucun compte de test.
Le scénario [`tests/private_quotes.sql`](tests/private_quotes.sql) vérifie la visibilité des devis ciblés pour leur auteur, leur destinataire et un tiers.

## Parcours encore à relier

Le compte particulier est créé par Supabase Auth puis par le trigger `on_auth_user_created`. Le formulaire professionnel est volontairement bloqué tant que le service de vérification SIRET, l’attribution du rôle, la création du profil métier et de son abonnement `FREE` ne sont pas déployés ensemble. La découverte, le fil, les devis et la messagerie utilisent les tables protégées par RLS. La publication de réalisations et de médias reste à connecter.
