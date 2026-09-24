import { router } from 'expo-router';
import { EmptyState, MainScreen } from '@/components/artiz-ui';

export default function MessagesScreen() {
  return <MainScreen title="Messages" subtitle="Échangez simplement autour de vos projets.">
    <EmptyState icon="chatbubble-ellipses-outline" title="Aucune conversation" description="Vos échanges avec les professionnels apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
  </MainScreen>;
}
