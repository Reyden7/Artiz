import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { supabase } from '@/services/supabase/client';

const pageSize = 20;
export default function ProfessionalReviewsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reviews = useInfiniteQuery({
    queryKey: ['professional-reviews', id], enabled: Boolean(supabase && id), initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!supabase || !id) return [];
      const { data, error } = await supabase.from('reviews').select('id,customer_id,rating,body,created_at')
        .eq('professional_id', id).order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      if (error) throw error;
      const ids = [...new Set(data.map((review) => review.customer_id))];
      const names = ids.length ? await supabase.from('profiles').select('id,display_name').in('id', ids) : { data: [], error: null };
      if (names.error) throw names.error;
      const lookup = new Map(names.data.map((person) => [person.id, person.display_name]));
      return data.map((review) => ({ ...review, customerName: lookup.get(review.customer_id) ?? 'Membre Artiz' }));
    },
    getNextPageParam: (lastPage, pages) => lastPage.length === pageSize ? pages.length : undefined,
  });
  return <AppScreen title="Avis des clients">
    {reviews.isPending ? <ActivityIndicator color={colors.blue} /> : reviews.error
      ? <EmptyState icon="alert-circle-outline" title="Avis indisponibles" description="Réessayez plus tard." />
      : !reviews.data?.pages.flat().length
        ? <EmptyState icon="star-outline" title="Aucun avis" description="Les avis apparaîtront ici." />
        : reviews.data.pages.flat().map((review) => <View key={review.id} style={styles.card}>
          <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: review.customer_id } })}><Text style={styles.name}>{review.customerName}</Text></Pressable>
          <Text style={styles.stars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
          <Text style={styles.date}>{new Date(review.created_at).toLocaleDateString('fr-FR')}</Text>
          {review.body ? <Text style={styles.body}>{review.body}</Text> : null}
        </View>)}
    {reviews.hasNextPage && <PrimaryButton title={reviews.isFetchingNextPage ? 'Chargement…' : 'Afficher plus d’avis'} onPress={() => void reviews.fetchNextPage()} disabled={reviews.isFetchingNextPage} outline />}
  </AppScreen>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, gap: 6 },
  name: { color: colors.blue, fontWeight: '700' }, stars: { color: colors.orange, fontSize: 18 },
  date: { color: colors.muted, fontSize: 13 }, body: { color: colors.navy, lineHeight: 22 },
});
