import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Avatar, Field, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { demoProfessionals } from '@/features/demo/data';

export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pro = demoProfessionals.find((person) => person.id === id) ?? demoProfessionals[0];
  const [project, setProject] = useState('');
  const [city, setCity] = useState('');
  const [details, setDetails] = useState('');
  return <AppScreen title="Demande de devis" subtitle={`Parlez de votre projet à ${pro.name}.`}>
    <View style={styles.pro}><Avatar name={pro.name} size={58} /><View><Text style={styles.name}>{pro.name}</Text><Text style={styles.meta}>{pro.job} · {pro.city}</Text><Text style={styles.rating}>★ 4,9  <Text style={styles.meta}>(56 avis)</Text></Text></View></View>
    <View style={styles.form}><Text style={styles.heading}>Votre projet</Text><Text style={styles.meta}>Quelques informations pour recevoir une réponse personnalisée.</Text><Field label="Type de projet *" value={project} onChangeText={setProject} placeholder="Ex. Bibliothèque sur mesure" /><Field label="Ville du projet *" value={city} onChangeText={setCity} placeholder="Ville ou code postal" /><Field label="Décrivez votre besoin *" value={details} onChangeText={setDetails} placeholder="Dimensions, style, matériaux souhaités…" multiline maxLength={800} /><Text style={styles.counter}>{details.length} / 800</Text><PrimaryButton title="Envoyer ma demande" icon="paper-plane-outline" disabled={!project.trim() || !city.trim() || !details.trim()} onPress={() => Alert.alert('Connexion nécessaire', 'Connectez-vous pour envoyer votre demande.', [{ text: 'Se connecter', onPress: () => router.push('/login') }])} /><Text style={styles.privacy}>Votre demande sera transmise uniquement au professionnel choisi.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({ pro: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, name: { color: colors.navy, fontSize: 17, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 13 }, rating: { color: colors.orange, marginTop: 4 }, form: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 17, gap: 15 }, heading: { color: colors.navy, fontSize: 21, fontWeight: '800' }, counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -12 }, privacy: { color: colors.muted, fontSize: 12, textAlign: 'center' } });
