import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AppScreen, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [project, setProject] = useState('');
  const [city, setCity] = useState('');
  const [details, setDetails] = useState('');

  return <AppScreen title="Demande de devis" subtitle="Décrivez votre projet pour préparer une demande personnalisée.">
    {!id && <View style={styles.notice}><Text style={styles.noticeTitle}>Aucun professionnel sélectionné</Text><Text style={styles.meta}>Choisissez un professionnel avant d’envoyer votre demande.</Text><Pressable onPress={() => router.replace('/explore')} accessibilityRole="link"><Text style={styles.link}>Découvrir les artisans ›</Text></Pressable></View>}
    <View style={styles.form}>
      <Text style={styles.heading}>Votre projet</Text>
      <Field label="Type de projet *" value={project} onChangeText={setProject} placeholder="Type de réalisation souhaitée" />
      <Field label="Ville du projet *" value={city} onChangeText={setCity} placeholder="Ville ou code postal" />
      <Field label="Décrivez votre besoin *" value={details} onChangeText={setDetails} placeholder="Dimensions, style, matériaux souhaités…" multiline maxLength={800} />
      <Text style={styles.counter}>{details.length} / 800</Text>
      <PrimaryButton title="Envoyer ma demande" icon="paper-plane-outline" disabled={!id || !project.trim() || !city.trim() || !details.trim()} onPress={() => Alert.alert('Envoi indisponible', 'L’envoi des demandes de devis sera disponible lorsque ce service sera activé.')} />
      <Text style={styles.privacy}>La demande sera adressée au professionnel que vous aurez choisi.</Text>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.backgroundWarm, borderRadius: 16, padding: 16, gap: 8 },
  noticeTitle: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  link: { color: colors.blue, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  form: { backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 },
  heading: { color: colors.navy, fontSize: 20, fontWeight: '700' },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -12 },
  privacy: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
