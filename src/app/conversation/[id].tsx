import { router } from 'expo-router';
import { AppScreen, EmptyState } from '@/components/artiz-ui';

export default function ConversationScreen() {
  return <AppScreen title="Conversation">
    <EmptyState icon="chatbubble-ellipses-outline" title="Conversation indisponible" description="Cette conversation n’est pas disponible pour le moment." action="Voir mes messages" onPress={() => router.replace('/messages')} />
  </AppScreen>;
}
