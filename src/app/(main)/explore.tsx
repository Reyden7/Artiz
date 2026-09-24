import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { EmptyState, Field, MainScreen, SectionTitle } from '@/components/artiz-ui';
import { categories, colors } from '@/constants/artiz';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  return <MainScreen title="Découvrir" subtitle="Explorez les métiers et les réalisations près de chez vous.">
    <Field value={search} onChangeText={setSearch} placeholder="Un artisan, un métier, une ville…" accessibilityLabel="Rechercher" />
    <View style={styles.chips}>{['Tous', 'Travaux', 'Jardin', 'Photo'].map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <SectionTitle title="Artisans" />
    <EmptyState icon="search-outline" title={search || category !== 'Tous' ? 'Aucun résultat' : 'Aucun artisan pour le moment'} description={search || category !== 'Tous' ? 'Essayez un autre métier, une autre ville ou un autre filtre.' : 'Les profils professionnels apparaîtront ici dès leur publication.'} />
    <SectionTitle title="Explorer par catégorie" />
    <View style={styles.categoryGrid}>{categories.map((item) => <Pressable key={item.label} style={styles.category} onPress={() => setCategory(item.label)}><Ionicons name={item.icon} size={27} color={colors.blue} /><Text style={styles.categoryText}>{item.label}</Text></Pressable>)}</View>
  </MainScreen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 9999 },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.blue, fontSize: 14 },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { width: '31.5%', minHeight: 96, borderRadius: 12, backgroundColor: colors.pale, justifyContent: 'center', alignItems: 'center', gap: 8 },
  categoryText: { fontSize: 13, color: colors.navy, textAlign: 'center' },
});
