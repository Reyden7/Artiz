import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, Avatar, Field, SectionTitle } from '@/components/artiz-ui';
import { categories, demoProfessionals } from '@/features/demo/data';
import { colors } from '@/constants/artiz';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const visible = useMemo(() => demoProfessionals.filter((pro) => (category === 'Tous' || category === 'Travaux' || pro.job.toLowerCase().includes(category.toLowerCase())) && `${pro.name} ${pro.job} ${pro.city}`.toLowerCase().includes(search.toLowerCase())), [category, search]);
  return <AppScreen title="Découvrir" subtitle="Des talents locaux, des réalisations bien réelles.">
    <Field value={search} onChangeText={setSearch} placeholder="Un artisan, un métier, une ville…" accessibilityLabel="Rechercher" />
    <View style={styles.chips}>{['Tous', 'Travaux', 'Jardin', 'Photo'].map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
    <SectionTitle title="Nos artisans à la une" />
    {visible.length ? <View style={styles.proGrid}>{visible.map((pro) => <Pressable key={pro.name} style={styles.proCard} onPress={() => router.push({ pathname: '/professional/[id]', params: { id: pro.id } })}><Image source={pro.image} style={styles.proImage} /><View style={styles.proInfo}><Avatar name={pro.name} size={34} /><View style={{ flex: 1 }}><Text style={styles.proName}>{pro.name}</Text><Text style={styles.proMeta}>{pro.job} · {pro.city}</Text></View></View><Text style={styles.rating}>★ 4,9 <Text style={{ color: colors.muted, fontWeight: '400' }}>(56 avis)</Text></Text></Pressable>)}</View> : <Text style={styles.empty}>Aucun résultat. Essayez un autre métier ou une autre ville.</Text>}
    <SectionTitle title="Explorer par catégorie" />
    <View style={styles.categoryGrid}>{categories.map((item) => <Pressable key={item.label} style={styles.category} onPress={() => setCategory(item.label)}><Ionicons name={item.icon} size={27} color={colors.blue} /><Text style={styles.categoryText}>{item.label}</Text></Pressable>)}</View>
    <View style={styles.localBanner}><Text style={styles.bannerTitle}>Des projets près de chez vous</Text><Text style={styles.bannerText}>Trouvez des professionnels qualifiés dans votre région.</Text><Pressable onPress={() => setSearch('Dijon')}><Text style={styles.bannerLink}>Explorer Dijon et ses environs  ›</Text></Pressable></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { backgroundColor: colors.pale, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 }, chipActive: { backgroundColor: colors.blue }, chipText: { color: colors.navy, fontSize: 13 }, chipTextActive: { color: colors.white, fontWeight: '800' },
  proGrid: { gap: 12 }, proCard: { backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }, proImage: { height: 160, width: '100%' }, proInfo: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 }, proName: { color: colors.navy, fontSize: 16, fontWeight: '800' }, proMeta: { color: colors.muted, fontSize: 13 }, rating: { color: colors.orange, marginLeft: 13, marginBottom: 13, fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { width: '31.5%', minHeight: 95, borderRadius: 13, backgroundColor: colors.pale, justifyContent: 'center', alignItems: 'center', gap: 7 }, categoryText: { fontSize: 12, color: colors.navy, textAlign: 'center' },
  localBanner: { backgroundColor: '#D9ECF1', borderRadius: 16, padding: 20, gap: 5 }, bannerTitle: { fontSize: 18, fontWeight: '800', color: colors.navy }, bannerText: { color: colors.muted }, bannerLink: { color: colors.blue, fontWeight: '800', marginTop: 5 }, empty: { color: colors.muted, paddingVertical: 20 },
});
