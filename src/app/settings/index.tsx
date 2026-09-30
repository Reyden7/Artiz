import { router, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppScreen } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { ARTIZ_ACCOUNT_DELETION_URL, ARTIZ_PRIVACY_URL, ARTIZ_TERMS_URL } from '@/constants/legal';

export default function SettingsScreen() {
  const [linkError, setLinkError] = useState('');
  async function openLegalPage(url: string) {
    setLinkError('');
    try { await Linking.openURL(url); }
    catch { setLinkError('Impossible d’ouvrir la page dans le navigateur. Réessayez plus tard.'); }
  }

  return <AppScreen title="Paramètres">
    <Pressable onPress={() => router.push('/settings/support' as Href)} style={styles.row} accessibilityRole="button">
      <View><Text style={styles.title}>Aide & support</Text><Text style={styles.caption}>Signaler un problème ou appeler le support</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
    <Text style={styles.sectionTitle}>Informations légales</Text>
    {[
      { label: 'Conditions d’utilisation', url: ARTIZ_TERMS_URL },
      { label: 'Politique de confidentialité', url: ARTIZ_PRIVACY_URL },
      { label: 'Suppression de compte et données', url: ARTIZ_ACCOUNT_DELETION_URL },
    ].map(({ label, url }) => <Pressable key={url} onPress={() => void openLegalPage(url)} style={styles.row} accessibilityRole="link" accessibilityLabel={label} accessibilityHint="Ouvre la page dans le navigateur">
      <Text style={styles.title}>{label}</Text><Text style={styles.arrow}>›</Text>
    </Pressable>)}
    {linkError ? <Text style={styles.linkError} accessibilityRole="alert">{linkError}</Text> : null}
    <Pressable onPress={() => router.push('/settings/delete-account' as Href)} style={styles.row} accessibilityRole="button" accessibilityLabel="Supprimer mon compte">
      <View><Text style={styles.danger}>Supprimer mon compte</Text><Text style={styles.caption}>Supprimer définitivement mon profil et mes données</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  </AppScreen>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 18, minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.navy, fontWeight: '700', fontSize: 16 },
  sectionTitle: { color: colors.navy, fontWeight: '700', fontSize: 18, marginTop: 10 },
  linkError: { color: '#A52929', fontSize: 14 },
  danger: { color: '#A52929', fontWeight: '700', fontSize: 16 },
  caption: { color: colors.muted, fontSize: 13, marginTop: 5 },
  arrow: { color: colors.blue, fontSize: 25 },
});
