import { AppScreen, EmptyState } from '@/components/artiz-ui';

export default function NotificationsScreen() {
  return <AppScreen title="Notifications">
    <EmptyState icon="notifications-outline" title="Aucune notification" description="Les nouvelles de votre réseau apparaîtront ici." />
  </AppScreen>;
}
