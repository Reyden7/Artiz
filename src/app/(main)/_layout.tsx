import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopNavigation } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function MainLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      <TopNavigation />
      <Slot />
    </SafeAreaView>
  );
}
