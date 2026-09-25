// This is shown only inside authenticated support screens.
export const SUPPORT_PHONE = '+33603509979';
export const SUPPORT_PHONE_ENABLED = true;

export const SUPPORT_CATEGORIES = [
  { value: 'login', label: 'Problème de connexion' },
  { value: 'account', label: 'Problème de compte' },
  { value: 'post', label: 'Problème avec une publication' },
  { value: 'messaging', label: 'Problème avec la messagerie' },
  { value: 'professional', label: 'Problème professionnel / SIRET' },
  { value: 'bug', label: 'Bug de l’application' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Autre' },
] as const;

export type SupportCategory = typeof SUPPORT_CATEGORIES[number]['value'];

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  in_progress: 'En cours',
  resolved: 'Résolue',
  closed: 'Fermée',
};
