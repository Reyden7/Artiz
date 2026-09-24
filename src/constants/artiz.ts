export const colors = {
  navy: '#102A43',
  blue: '#123A63',
  blueDark: '#0B2742',
  orange: '#D89A1D',
  orangeDark: '#C48812',
  orangeLight: '#F8E9C2',
  background: '#F7F9FB',
  backgroundWarm: '#FBF8F2',
  white: '#FFFFFF',
  pale: '#F1F4F7',
  border: '#DFE6EC',
  divider: '#E8EDF1',
  muted: '#60758A',
  mutedLight: '#8A9AAA',
  green: '#2F9E67',
  red: '#D94C4C',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 } as const;

export const categories = [
  { label: 'Travaux', icon: 'hammer-outline' },
  { label: 'Jardin', icon: 'leaf-outline' },
  { label: 'Automobile', icon: 'car-outline' },
  { label: 'Informatique', icon: 'laptop-outline' },
  { label: 'Photo', icon: 'camera-outline' },
  { label: 'Événementiel', icon: 'sparkles-outline' },
] as const;

export type AccountType = 'customer' | 'professional';
export type SubscriptionPlan = 'FREE' | 'PRO' | 'PRO_PLUS';
