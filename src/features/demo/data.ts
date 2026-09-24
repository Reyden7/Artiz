import { ImageSourcePropType } from 'react-native';
import { photos } from '@/constants/artiz';

export type DemoPost = {
  id: string; author: string; job: string; city: string; time: string;
  description: string; image: ImageSourcePropType; likes: number; comments: number;
};

export const demoPosts: DemoPost[] = [
  { id: 'oak-library', author: 'Thomas Moreau', job: 'Menuisier', city: 'Annecy (74)', time: 'Il y a 2 h', description: 'Bibliothèque sur mesure en chêne massif, pensée pour accompagner les moments de lecture et profiter de la lumière. ✨', image: photos.bookshelf, likes: 128, comments: 24 },
  { id: 'ceramics', author: 'Sophie Martin', job: 'Céramiste', city: 'Toulouse (31)', time: 'Il y a 5 h', description: 'De nouvelles pièces sorties de l’atelier. Grès émaillé, couleurs naturelles et chaque pièce est unique. 🌿', image: photos.ceramics, likes: 96, comments: 12 },
];

export const demoProfessionals = [
  { id: 'thomas-moreau', name: 'Thomas Moreau', job: 'Menuisier', city: 'Annecy (74)', image: photos.bookshelf, bio: 'Je conçois des aménagements en bois durables et esthétiques. Bois local, design et savoir-faire artisanal au service de vos projets.', specialties: ['Terrasses', 'Mobilier sur mesure', 'Aménagement intérieur'] },
  { id: 'sophie-martin', name: 'Sophie Martin', job: 'Céramiste', city: 'Toulouse (31)', image: photos.ceramics, bio: 'Je crée des pièces en grès émaillé inspirées de la nature. Chaque objet est façonné à la main dans mon atelier.', specialties: ['Arts de la table', 'Grès émaillé', 'Création sur mesure'] },
  { id: 'lucas-bernard', name: 'Lucas Bernard', job: 'Ébéniste', city: 'Lyon (69)', image: photos.bookshelf, bio: 'Je réalise du mobilier en bois sur mesure avec une attention particulière aux détails et aux matériaux durables.', specialties: ['Mobilier', 'Restauration', 'Bois massif'] },
] as const;

export const categories = [
  { label: 'Travaux', icon: 'hammer-outline' }, { label: 'Jardin', icon: 'leaf-outline' },
  { label: 'Automobile', icon: 'car-outline' }, { label: 'Informatique', icon: 'laptop-outline' },
  { label: 'Photo', icon: 'camera-outline' }, { label: 'Événementiel', icon: 'sparkles-outline' },
] as const;
