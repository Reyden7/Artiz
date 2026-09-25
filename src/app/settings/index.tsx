import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppScreen } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';

export default function SettingsScreen() {
  return <AppScreen title="Paramètres">
    <Pressable onPress={() => router.push('/settings/support' as Href)} style={styles.row} accessibilityRole="button">
      <View><Text style={styles.title}>Aide & support</Text><Text style={styles.caption}>Signaler un problème ou appeler le support</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  </AppScreen>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 18, minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.navy, fontWeight: '700', fontSize: 16 },
  caption: { color: colors.muted, fontSize: 13, marginTop: 5 },
  arrow: { color: colors.blue, fontSize: 25 },
});
