export const colors = {
  navy: '#102A3D', blue: '#126684', blueDark: '#0A5472', pale: '#EDF6FA',
  background: '#F5FAFC', border: '#DAE6EC', muted: '#607488',
  orange: '#F7941D', white: '#FFFFFF', green: '#27AE60',
} as const;

export const photos = {
  bookshelf: require('../../assets/artiz/oak-bookshelf.png'),
  ceramics: require('../../assets/artiz/ceramics.png'),
};

export type AccountType = 'customer' | 'professional';
export type SubscriptionPlan = 'FREE' | 'PRO' | 'PRO_PLUS';
