import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Alert, StyleSheet, View } from 'react-native';
import { AppScreen, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { SUPPORT_PHONE, SUPPORT_PHONE_ENABLED } from '@/constants/support';

export default function HelpSupportScreen() {
  async function callSupport() {
    try { await Linking.openURL(`tel:${SUPPORT_PHONE}`); }
    catch { Alert.alert('Appel indisponible', 'Cet appareil ne peut pas ouvrir l’application téléphone.'); }
  }

  return <AppScreen title="Aide & support" subtitle="Nous sommes là pour vous aider pendant les tests d’Artiz.">
    <View style={styles.card}>
      <Text style={styles.title}>Signaler un problème</Text>
      <Text style={styles.copy}>Décrivez ce qui s’est passé et ajoutez une capture si elle aide à comprendre le problème.</Text>
      <PrimaryButton title="Signaler un problème" icon="alert-circle-outline" onPress={() => router.push('/settings/support/new')} />
      <PrimaryButton title="Mes demandes de support" icon="list-outline" outline onPress={() => router.push('/settings/support/requests')} />
    </View>
    {SUPPORT_PHONE_ENABLED && <View style={styles.card}>
      <Text style={styles.title}>Support téléphonique</Text>
      <Text style={styles.copy}>Support téléphonique disponible pendant la phase de test.</Text>
      <PrimaryButton title="Appeler le support" icon="call-outline" outline onPress={() => void callSupport()} />
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, gap: 14 },
  title: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  copy: { color: colors.muted, lineHeight: 22 },
});
