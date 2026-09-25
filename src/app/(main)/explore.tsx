import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Avatar, EmptyState, Field, MainScreen, SectionTitle } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const account = useAccountType();
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setDebouncedCity(city.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [search, city]);
  const categories = useQuery({
    queryKey: ['professional-categories'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('professional_categories').select('id,name').order('name');
      if (error) throw error;
      return data;
    },
  });
  const directory = useInfiniteQuery({
    queryKey: ['professional-directory', debouncedSearch, debouncedCity, category],
    enabled: Boolean(supabase),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc('search_professionals', {
        search_text: debouncedSearch,
        filter_city: debouncedCity || undefined,
        filter_category: category ?? undefined,
        page_number: pageParam,
        page_size: 20,
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) => lastPage.length === 20 ? pages.length : undefined,
  });
  const visible = directory.data?.pages.flat() ?? [];

  async function contact(professionalId: string) {
    if (busyId) return;
    setBusyId(professionalId);
    try {
      const conversationId = await openConversation(professionalId, 'search');
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Contact impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusyId(null);
    }
  }

  return <MainScreen title="Découvrir" subtitle="Explorez les métiers et les réalisations près de chez vous.">
    <Field value={search} onChangeText={setSearch} placeholder="Un artisan, un métier, une ville…" accessibilityLabel="Rechercher" />
    <Field value={city} onChangeText={setCity} placeholder="Filtrer par ville" accessibilityLabel="Filtrer par ville" />
    <View style={styles.chips}><Pressable onPress={() => setCategory(null)} style={[styles.chip, category === null && styles.chipActive]}><Text style={[styles.chipText, category === null && styles.chipTextActive]}>Tous</Text></Pressable>{(categories.data ?? []).map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.chip, category === item.id && styles.chipActive]}><Text style={[styles.chipText, category === item.id && styles.chipTextActive]}>{item.name}</Text></Pressable>)}</View>
    <SectionTitle title="Artisans" />
    {directory.isPending ? <ActivityIndicator color={colors.blue} /> : directory.error
      ? <EmptyState icon="alert-circle-outline" title="Recherche indisponible" description="Impossible de charger les professionnels pour le moment." />
      : visible.length === 0
        ? <EmptyState icon="search-outline" title={search || city || category ? 'Aucun résultat' : 'Aucun artisan pour le moment'} description={search || city || category ? 'Essayez un autre métier, une autre ville ou un autre filtre.' : 'Les profils professionnels apparaîtront ici dès leur publication.'} />
        : visible.map((item) => <View key={item.user_id} style={styles.card}>
          <Avatar name={item.business_name} />
          <View style={styles.cardBody}><Text style={styles.cardTitle}>{item.business_name}</Text>{item.headline ? <Text style={styles.cardMeta}>{item.headline}</Text> : null}{item.city ? <Text style={styles.cardMeta}>{item.city}</Text> : null}</View>
          <View style={styles.cardActions}>
            <Pressable onPress={() => router.push(`/professional/${item.user_id}`)} accessibilityRole="button" style={styles.cardAction}><Text style={styles.cardActionText}>Voir le profil</Text></Pressable>
            {account.data === 'customer' && <Pressable onPress={() => contact(item.user_id)} disabled={Boolean(busyId)} accessibilityRole="button" style={styles.cardAction}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.blue} /><Text style={styles.cardActionText}>{busyId === item.user_id ? 'Ouverture…' : 'Contacter'}</Text></Pressable>}
          </View>
        </View>)}
    {directory.hasNextPage && <Pressable onPress={() => void directory.fetchNextPage()} disabled={directory.isFetchingNextPage} accessibilityRole="button" style={styles.loadMore}><Text style={styles.loadMoreText}>{directory.isFetchingNextPage ? 'Chargement…' : 'Afficher plus d’artisans'}</Text></Pressable>}
  </MainScreen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 9999 },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.blue, fontSize: 14 },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  cardBody: { flex: 1, gap: 3, minWidth: 160 },
  cardTitle: { color: colors.navy, fontSize: 17, fontWeight: '700' },
  cardMeta: { color: colors.muted, fontSize: 13 },
  cardActions: { width: '100%', flexDirection: 'row', gap: 10 },
  cardAction: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  cardActionText: { color: colors.blue, fontWeight: '600' },
  loadMore: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  loadMoreText: { color: colors.blue, fontWeight: '600' },
});
