import { router } from 'expo-router';
import { EmptyState, MainScreen } from '@/components/artiz-ui';

export default function NetworkScreen() {
  return <MainScreen title="Mon réseau" subtitle="Les professionnels que vous suivez apparaîtront ici.">
    <EmptyState icon="people-outline" title="Votre réseau commence ici" description="Vous ne suivez encore aucun professionnel." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
  </MainScreen>;
}
