import { router } from 'expo-router';
import { AppScreen, EmptyState } from '@/components/artiz-ui';

export default function ProfessionalScreen() {
  return <AppScreen title="Profil professionnel">
    <EmptyState icon="person-outline" title="Profil indisponible" description="Ce profil professionnel n’est pas disponible pour le moment." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
  </AppScreen>;
}
