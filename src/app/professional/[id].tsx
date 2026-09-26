import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/typography';
import { AppScreen, Avatar, EmptyState, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';
import { avatarUrl } from '@/features/profiles/avatars';

export default function ProfessionalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = useAccountType();
  const [busy, setBusy] = useState(false);
  const professional = useQuery({
    queryKey: ['professional', id],
    enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null;
      const { data: business, error } = await supabase.from('professional_profiles')
        .select('user_id,business_name,headline,description,city,service_radius_km')
        .eq('user_id', id).eq('verification_status', 'verified').maybeSingle();
      if (error) throw error;
      if (!business) return null;
      const { data: owner, error: ownerError } = await supabase.from('profiles')
        .select('display_name,bio,avatar_path').eq('id', id).single();
      if (ownerError) throw ownerError;
      const [summary, reviews, posts] = await Promise.all([
        supabase.rpc('professional_review_summary', { target_professional: id }),
        supabase.from('reviews').select('id,customer_id,rating,body,created_at').eq('professional_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('posts').select('id,title,body').eq('author_id', id).eq('status', 'published').eq('in_portfolio', true).order('created_at', { ascending: false }).limit(12),
      ]);
      if (summary.error) throw summary.error;
      if (reviews.error) throw reviews.error;
      if (posts.error) throw posts.error;
      const customerIds = [...new Set(reviews.data.map((review) => review.customer_id))];
      const [customers, images] = await Promise.all([
        customerIds.length ? supabase.from('profiles').select('id,display_name').in('id', customerIds) : Promise.resolve({ data: [] as { id: string; display_name: string }[], error: null }),
        posts.data.length ? supabase.from('post_images').select('post_id,storage_path,position').in('post_id', posts.data.map((post) => post.id)).order('position') : Promise.resolve({ data: [] as { post_id: string; storage_path: string; position: number }[], error: null }),
      ]);
      if (customers.error) throw customers.error;
      if (images.error) throw images.error;
      const names = new Map(customers.data.map((person) => [person.id, person.display_name]));
      const firstImages = new Map<string, string>();
      images.data.forEach((image) => { if (!firstImages.has(image.post_id)) firstImages.set(image.post_id, image.storage_path); });
      const urls = new Map<string, string>();
      await Promise.all([...firstImages.values()].map(async (path) => {
        const { data } = await supabase!.storage.from('post-images').createSignedUrl(path, 600);
        if (data) urls.set(path, data.signedUrl);
      }));
      return { ...business, displayName: owner.display_name, bio: owner.bio, avatar: await avatarUrl(owner.avatar_path),
        reviewSummary: summary.data?.[0], reviews: reviews.data.map((review) => ({ ...review, customerName: names.get(review.customer_id) ?? 'Membre Artiz' })),
        portfolio: posts.data.map((post) => ({ ...post, image: urls.get(firstImages.get(post.id) ?? '') ?? null })) };
    },
  });

  async function contact() {
    if (!id || busy) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(id, 'profile');
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Contact impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusy(false);
    }
  }

  return <AppScreen title="Profil professionnel">
    {professional.isPending ? <ActivityIndicator color={colors.blue} /> : professional.error || !professional.data
      ? <EmptyState icon="person-outline" title="Profil indisponible" description="Ce profil professionnel n’est pas disponible pour le moment." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
      : <View style={styles.card}>
        <Avatar name={professional.data.displayName || professional.data.business_name} uri={professional.data.avatar} size={72} />
        <Text style={styles.title}>{professional.data.business_name}</Text>
        {professional.data.headline ? <Text style={styles.headline}>{professional.data.headline}</Text> : null}
        <Text style={styles.meta}>{professional.data.displayName}{professional.data.city ? ` · ${professional.data.city}` : ''}</Text>
        <Text style={styles.rating}>{professional.data.reviewSummary?.review_count ? `★ ${professional.data.reviewSummary.average_rating} / 5 · ${professional.data.reviewSummary.review_count} avis` : 'Aucun avis pour le moment'}</Text>
        {professional.data.bio ? <Text style={styles.description}>{professional.data.bio}</Text> : null}
        {professional.data.description ? <Text style={styles.description}>{professional.data.description}</Text> : null}
        {account.data === 'customer' && <View style={styles.actions}>
          <PrimaryButton title={busy ? 'Ouverture…' : 'Contacter'} icon="chatbubble-ellipses-outline" onPress={contact} disabled={busy} />
          <PrimaryButton title="Demander un devis" icon="document-text-outline" outline onPress={() => router.push(`/quote?id=${id}`)} />
        </View>}
        <Text style={styles.section}>Réalisations</Text>
        {professional.data.portfolio.length ? professional.data.portfolio.map((post) => <Pressable key={post.id} style={styles.portfolio} onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} accessibilityRole="button">
          {post.image ? <Image source={{ uri: post.image }} contentFit="cover" style={styles.portfolioImage} /> : null}
          <Text style={styles.portfolioTitle}>{post.title}</Text>
        </Pressable>) : <Text style={styles.meta}>Aucune réalisation publiée.</Text>}
        <Text style={styles.section}>Avis ({professional.data.reviewSummary?.review_count ?? 0})</Text>
        {professional.data.reviews.length ? professional.data.reviews.map((review) => <View key={review.id} style={styles.review}>
          <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: review.customer_id } })}><Text style={styles.reviewName}>{review.customerName}</Text></Pressable>
          <Text style={styles.rating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)} · {new Date(review.created_at).toLocaleDateString('fr-FR')}</Text>
          {review.body ? <Text style={styles.description}>{review.body}</Text> : null}
        </View>) : <Text style={styles.meta}>Aucun avis pour le moment.</Text>}
        {(professional.data.reviewSummary?.review_count ?? 0) > 5 && <PrimaryButton title="Voir tous les avis" outline onPress={() => router.push(`/professional/${id}/reviews` as Href)} />}
      </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  title: { fontSize: 22, color: colors.navy, fontWeight: '700', textAlign: 'center' },
  headline: { color: colors.blue, textAlign: 'center' },
  meta: { color: colors.muted, textAlign: 'center' },
  description: { color: colors.navy, lineHeight: 22, alignSelf: 'stretch' },
  actions: { width: '100%', gap: 10, marginTop: 10 },
  rating: { color: colors.orange, fontWeight: '700' },
  section: { alignSelf: 'stretch', color: colors.navy, fontSize: 19, fontWeight: '700', marginTop: 14 },
  review: { alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 5 },
  reviewName: { color: colors.blue, fontWeight: '700' },
  portfolio: { alignSelf: 'stretch', borderWidth: 1, borderColor: colors.divider, borderRadius: 12, overflow: 'hidden' },
  portfolioImage: { width: '100%', aspectRatio: 4 / 3 },
  portfolioTitle: { color: colors.navy, fontWeight: '700', padding: 10 },
});
