import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
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
  const [category, setCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const account = useAccountType();
  const directory = useQuery({
    queryKey: ['professional-directory'],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) return { professionals: [], categories: [], links: [] };
      const [professionals, categories] = await Promise.all([
        supabase.from('professional_profiles').select('user_id,business_name,headline,city')
          .eq('verification_status', 'verified').order('business_name').limit(100),
        supabase.from('professional_categories').select('id,name').order('name'),
      ]);
      if (professionals.error) throw professionals.error;
      if (categories.error) throw categories.error;
      const ids = professionals.data.map((item) => item.user_id);
      const links = ids.length
        ? await supabase.from('professional_category_links').select('professional_id,category_id').in('professional_id', ids)
        : { data: [], error: null };
      if (links.error) throw links.error;
      return { professionals: professionals.data, categories: categories.data, links: links.data ?? [] };
    },
  });
  const query = search.trim().toLocaleLowerCase('fr');
  const visible = (directory.data?.professionals ?? []).filter((item) => {
    const matchesText = !query || `${item.business_name} ${item.headline ?? ''} ${item.city ?? ''}`.toLocaleLowerCase('fr').includes(query);
    const matchesCategory = !category || directory.data?.links.some((link) => link.professional_id === item.user_id && link.category_id === category);
    return matchesText && matchesCategory;
  });

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
    <View style={styles.chips}><Pressable onPress={() => setCategory(null)} style={[styles.chip, category === null && styles.chipActive]}><Text style={[styles.chipText, category === null && styles.chipTextActive]}>Tous</Text></Pressable>{(directory.data?.categories ?? []).map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.chip, category === item.id && styles.chipActive]}><Text style={[styles.chipText, category === item.id && styles.chipTextActive]}>{item.name}</Text></Pressable>)}</View>
    <SectionTitle title="Artisans" />
    {directory.isPending ? <ActivityIndicator color={colors.blue} /> : directory.error
      ? <EmptyState icon="alert-circle-outline" title="Recherche indisponible" description="Impossible de charger les professionnels pour le moment." />
      : visible.length === 0
        ? <EmptyState icon="search-outline" title={search || category ? 'Aucun résultat' : 'Aucun artisan pour le moment'} description={search || category ? 'Essayez un autre métier, une autre ville ou un autre filtre.' : 'Les profils professionnels apparaîtront ici dès leur publication.'} />
        : visible.map((item) => <View key={item.user_id} style={styles.card}>
          <Avatar name={item.business_name} />
          <View style={styles.cardBody}><Text style={styles.cardTitle}>{item.business_name}</Text>{item.headline ? <Text style={styles.cardMeta}>{item.headline}</Text> : null}{item.city ? <Text style={styles.cardMeta}>{item.city}</Text> : null}</View>
          <View style={styles.cardActions}>
            <Pressable onPress={() => router.push(`/professional/${item.user_id}`)} accessibilityRole="button" style={styles.cardAction}><Text style={styles.cardActionText}>Voir le profil</Text></Pressable>
            {account.data === 'customer' && <Pressable onPress={() => contact(item.user_id)} disabled={Boolean(busyId)} accessibilityRole="button" style={styles.cardAction}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.blue} /><Text style={styles.cardActionText}>{busyId === item.user_id ? 'Ouverture…' : 'Contacter'}</Text></Pressable>}
          </View>
        </View>)}
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
});
