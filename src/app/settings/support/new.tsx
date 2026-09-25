import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { SUPPORT_CATEGORIES, type SupportCategory } from '@/constants/support';
import { useAuth } from '@/features/auth/auth-context';
import { createSupportRequest } from '@/features/support/requests';

export default function NewSupportRequestScreen() {
  const { session } = useAuth();
  const { screen } = useLocalSearchParams<{ screen?: string }>();
  const [category, setCategory] = useState<SupportCategory>(screen ? 'bug' : 'other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(session?.user.email ?? '');
  const [screenshot, setScreenshot] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseScreenshot() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) setScreenshot(result.assets[0]);
    } catch { Alert.alert('Image indisponible', 'Impossible d’ouvrir la galerie.'); }
  }

  async function submit() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const id = await createSupportRequest({
        userId: session.user.id, category, subject, description, contactEmail,
        screenPath: screen, screenshot,
      });
      Alert.alert('Demande envoyée', 'Votre problème a été transmis au support Artiz.');
      router.replace({ pathname: '/settings/support/[id]', params: { id } });
    } catch (error) {
      Alert.alert('Envoi impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally { setBusy(false); }
  }

  return <AppScreen title="Signaler un problème" subtitle="Votre demande sera visible uniquement par vous et l’équipe Artiz.">
    {screen && <Text style={styles.context}>Écran concerné : {screen}</Text>}
    <View style={styles.group}>
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.categories}>{SUPPORT_CATEGORIES.map((item) =>
        <Pressable key={item.value} onPress={() => setCategory(item.value)}
          style={[styles.category, category === item.value && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected: category === item.value }}>
          <Text style={[styles.categoryText, category === item.value && styles.selectedText]}>{item.label}</Text>
        </Pressable>)}</View>
    </View>
    <Field label="Sujet" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Ex. Je ne peux pas envoyer un message" />
    <Field label="Description" value={description} onChangeText={setDescription} maxLength={4000} multiline placeholder="Que s’est-il passé ? À quel moment ?" />
    <Field label="E-mail de contact" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
    <View style={styles.group}>
      <Text style={styles.label}>Capture d’écran (facultative)</Text>
      {screenshot && <Image source={{ uri: screenshot.uri }} style={styles.preview} contentFit="contain" />}
      <PrimaryButton title={screenshot ? 'Changer la capture' : 'Ajouter une capture'} icon="image-outline" outline onPress={() => void chooseScreenshot()} />
      {screenshot && <PrimaryButton title="Retirer la capture" outline onPress={() => setScreenshot(null)} />}
    </View>
    <Text style={styles.context}>La version de l’application, votre appareil et votre identifiant de compte seront ajoutés automatiquement.</Text>
    <PrimaryButton title={busy ? 'Envoi en cours…' : 'Envoyer le signalement'} disabled={busy} onPress={() => void submit()} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  group: { gap: 10 }, label: { color: colors.navy, fontWeight: '700' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.pale },
  selected: { backgroundColor: colors.blue }, categoryText: { color: colors.navy, fontSize: 13 }, selectedText: { color: colors.white, fontWeight: '700' },
  context: { color: colors.muted, lineHeight: 20, fontSize: 13 },
  preview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.pale },
});
