# Base de données Artiz

Les migrations de ce dossier couvrent les profils, professionnels, catégories, abonnements, publications, demandes, conversations, avis, notifications et signalements. La migration `20260925070000_dispatch_push_webhooks.sql` est préparée mais **n’a pas été appliquée** : elle déclenche des appels externes et attend une autorisation explicite.

## Accès

- Toutes les tables exposées dans `public` ont RLS activé. Le rôle `anon` n’a aucun droit sur ces tables ; l’application requiert une session Auth.
- `profiles.account_type`, `professional_profiles.verification_status` et `subscriptions` sont modifiables seulement par du code serveur privilégié. Les métadonnées Auth saisies par l’utilisateur ne déterminent jamais ces droits.
- Le SIRET unique est conservé dans `app_private.professional_verifications`, sans accès depuis la Data API. Les coordonnées précises des particuliers sont dans `profile_locations`, lisibles seulement par leur propriétaire.
- Les règles privées `is_customer`, `is_verified_professional`, `can_publish_professionally`, `can_respond_to_request` et `can_create_conversation` centralisent les permissions. Un professionnel ne peut publier, proposer un service ou répondre commercialement qu’avec `account_type = professional` et un profil vérifié. La recherche et le fil retirent un profil dès qu’il perd l’un de ces deux attributs. Le plan d’abonnement (`FREE`, `PRO`, `PRO_PLUS`) reste une donnée distincte du type de compte.
- La fonction privée `can_create_conversation(sender, recipient, context, request_id)` applique les règles de messagerie avant toute création. Un particulier peut initier une conversation avec un professionnel vérifié, jamais avec un autre particulier. Un professionnel ne peut initier le contact avec un particulier qu’après avoir répondu à sa demande publiée ou après un contact préalable du particulier ; dans ce dernier cas, la conversation existante est réutilisée. Le contact professionnel à professionnel est fermé pour le MVP.
- La base ajoute automatiquement les deux membres lors de la création autorisée. Le client ne peut plus ajouter de membre directement. Les messages exigent une conversation dont les deux types de compte sont encore compatibles ; seuls ses membres peuvent les lire et y écrire. Un index empêche les doublons pour une même paire.
- Les devis ciblés sont enregistrés comme demandes `private` avec un `recipient_id`. Seuls le client et le professionnel destinataire vérifié peuvent les consulter ; une demande ouverte sans destinataire est visible aux professionnels vérifiés. La confidentialité est conservée si le profil professionnel destinataire est supprimé.
- Les besoins publics des particuliers sont consultables par leur auteur et par les professionnels vérifiés. Un autre particulier ou un professionnel en attente ne peut pas les lire via l’API.
- Les buckets `avatars`, `covers`, `post-images` et `request-images` sont privés, limités à 5 ou 10 Mo, et acceptent JPEG, PNG et WebP. Les objets sont rangés sous `<user_id>/...` ; Storage applique des politiques de lecture et d’écriture.

## Migrations

Les fichiers SQL sont versionnés avec les mêmes identifiants que les migrations distantes. Pour un nouvel environnement, connecter le projet avec le CLI Supabase puis appliquer les migrations avec `supabase db push`. Ne jamais mettre une clé secrète ou `service_role` dans `EXPO_PUBLIC_*`.

Après une modification du schéma, regénérer `src/services/supabase/database.types.ts` avec `supabase gen types typescript`, vérifier les migrations et lancer les conseillers de sécurité Supabase. Les politiques doivent être testées en simulant le rôle `authenticated`, pas seulement avec le propriétaire SQL qui contourne RLS.

Le scénario [`tests/conversation_rules.sql`](tests/conversation_rules.sql) exerce les quatre combinaisons de comptes, le contact lié à une demande, l’ajout automatique des membres et le refus d’un ajout direct. Il se termine par `ROLLBACK` et ne conserve aucun compte de test.
Le scénario [`tests/private_quotes.sql`](tests/private_quotes.sql) vérifie la visibilité des devis ciblés pour leur auteur, leur destinataire et un tiers.
Le scénario [`tests/permission_bypass.sql`](tests/permission_bypass.sql) tente directement les changements de rôle, créations de profil et services professionnels, publications, réponses et conversations interdites. Il vérifie aussi la disparition d’un ancien professionnel de la recherche et du fil.
Le scénario [`tests/professional_registration.sql`](tests/professional_registration.sql) vérifie qu’un client ne peut pas appeler la transaction d’inscription, que celle-ci crée un profil `pending`, un SIRET privé et un abonnement `FREE`, et qu’un SIRET dupliqué annule toute la transaction.
Le scénario [`tests/professional_registration_rate_limit.sql`](tests/professional_registration_rate_limit.sql) contrôle la limite de cinq tentatives par heure et refuse son appel direct par un client.
Le scénario [`tests/admin_manual_siret_review.sql`](tests/admin_manual_siret_review.sql) vérifie le refus des appels administrateur directs, le contrôle récent du registre et la traçabilité d’une validation manuelle.
Le scénario [`tests/publication_storage.sql`](tests/publication_storage.sql) vérifie les écritures Storage et publications autorisées, le refus des comptes particuliers ou en attente, puis le retrait du fil après révocation.
Le scénario [`tests/needs_storage.sql`](tests/needs_storage.sql) vérifie la publication d’un besoin et de ses photos par un particulier, puis le refus d’une publication ou réponse par un professionnel en attente.
Le scénario [`tests/realtime_unread.sql`](tests/realtime_unread.sql) vérifie les compteurs de messages non lus, le curseur de lecture et le refus d’une modification directe des dates.
Le scénario [`tests/server_professional_search.sql`](tests/server_professional_search.sql) vérifie la recherche par ville et par nom de métier, ainsi que l’exclusion des professionnels en attente.
Le scénario [`tests/push_events.sql`](tests/push_events.sql) vérifie la création serveur des notifications, la file par appareil, les préférences et les refus d’accès direct. Aucun push externe n’est envoyé par ces tests.

## Confirmation e-mail et téléphone

L’application possède la route `auth/callback`, associe l’inscription à `Linking.createURL('auth/callback')` et traite le `code`, les jetons ou le `token_hash` reçus dans la requête ou le fragment. Si la confirmation a abouti sans session utilisable, elle affiche un accès direct à la connexion. Le test utilisateur confirme que le lien ouvre Artiz et valide l’adresse côté Supabase. La configuration des URL Supabase reste inchangée pendant cette correction.

Expo Go Android ne permet pas de valider ce parcours complet avec le schéma `artiz://` ; il faut une version installée de l’application. Le callback a été vérifié sur téléphone avec un lien sans paramètres, un `code` de test, un `token_hash` de test et des jetons de test. Un nouveau lien valide reste nécessaire pour vérifier la création automatique de session de bout en bout.

## Notifications

Les déclencheurs SQL créent des notifications internes et des livraisons privées après les écritures validées en base : inscription professionnelle en attente, message et réponse à un besoin. Les jetons Expo sont associés au compte et aux appareils par `register_push_token`; chaque utilisateur contrôle ses préférences. Le client ne peut ni créer une notification, ni lire la file privée, ni exécuter les fonctions de livraison. Les notifications internes arrivent par Supabase Realtime. Les messages utilisent également Realtime et un compteur serveur de non lus.

Le code Edge `dispatch-push` et la migration `dispatch_push_webhooks` préparent l’envoi à `https://exp.host/--/api/v2/push/send` et la lecture des reçus Expo. L’envoi transmet à Expo le jeton de l’appareil et le nom affiché de l’auteur avec le texte de l’alerte. Le déploiement a été refusé par la revue automatique en attendant une autorisation explicite pour cet échange avec Expo. Après autorisation, déployer la fonction, puis appliquer la migration des webhooks, dans cet ordre. Le secret du webhook est généré dans Supabase Vault et n’est jamais envoyé à l’application.

Les notifications push distantes Android exigent une version de développement, un projet EAS et des identifiants FCM ; Expo Go ne les gère pas. Le CLI EAS indique actuellement « Not logged in ». L’application charge `expo-notifications` uniquement dans un build compatible, ce qui permet de continuer à utiliser Expo Go pour les autres parcours. Tester ensuite la réception en premier plan, en arrière-plan et application fermée, l’ouverture de la bonne route et la désactivation des jetons invalides.

La découverte utilise `search_professionals` : recherche par nom, métier/service ou ville, catégorie et pagination de 20 résultats. Les profils en attente ou dont le type de compte ne correspond plus à `professional` sont exclus côté serveur.

## Inscription professionnelle

Supabase Auth crée d’abord tous les comptes comme `customer`. Une inscription professionnelle soumet ensuite le SIRET à la fonction Edge `register-professional`, qui exige un JWT utilisateur valide et limite chaque compte à cinq contrôles par heure. La fonction consulte le registre officiel et n’accepte qu’un établissement actif correspondant exactement au SIRET. Une transaction réservée au rôle serveur crée alors le profil professionnel, conserve le SIRET hors de l’API publique, définit `account_type = professional`, `verification_status = pending` et un abonnement `FREE` actif. Le frontend ne peut modifier aucun de ces droits.

Si la confirmation e-mail est activée, le formulaire conserve temporairement le nom commercial et le SIRET sur l’appareil. Après connexion avec la même adresse, il soumet la demande au serveur. En cas d’échec, la page Profil permet de corriger le SIRET et de réessayer. Aucun mot de passe n’est conservé dans cette demande locale.

L’administrateur examine manuellement le SIRET et les informations du registre officiel, puis décide de valider ou refuser le compte. Aucun document supplémentaire n’est demandé au professionnel. Le serveur recontrôle que l’établissement est actif lors de la validation et conserve la décision, l’administrateur et la date. Tant que le statut est `pending`, les permissions professionnelles restent refusées. Un SIRET valide ne démontre pas à lui seul que le titulaire du compte représente l’entreprise : ce choix de vérification laisse donc un risque d’usurpation à surveiller.

Les migrations `professional_signup_intents` et `remove_public_signup_intents` documentent une voie préparatoire abandonnée : elle n’existe plus dans le schéma final et aucune fonction Edge publique n’a été déployée. La découverte, le fil, les devis et la messagerie utilisent les tables protégées par RLS. Les réalisations des professionnels vérifiés utilisent `posts`, `post_images` et le bucket privé `post-images`. Les besoins particuliers utilisent `service_requests`, `service_request_images` et `request-images`. L’application compresse les photos, publie d’abord un brouillon puis le rend visible quand tous les médias sont enregistrés. Le fil charge les réalisations par pages avec une liste virtualisée.
