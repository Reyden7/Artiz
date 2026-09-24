import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { router } from 'expo-router';
import { Avatar, EmptyState, MainScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

export default function HomeScreen() {
  const [tab, setTab] = useState<'feed' | 'nearby' | 'contacts'>('feed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { session } = useAuth();
  const account = useAccountType();
  const feed = useQuery({
    queryKey: ['posts-feed', session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase || !session) return { posts: [], city: null, following: [] as string[] };
      const client = supabase;
      const [postsResult, profileResult, followsResult] = await Promise.all([
        supabase.from('posts').select('id,author_id,body,city,created_at')
          .eq('status', 'published').order('created_at', { ascending: false }).limit(30),
        supabase.from('profiles').select('city').eq('id', session.user.id).single(),
        supabase.from('professional_follows').select('professional_id').eq('follower_id', session.user.id),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (profileResult.error) throw profileResult.error;
      if (followsResult.error) throw followsResult.error;
      const posts = postsResult.data;
      if (!posts.length) return { posts: [], city: profileResult.data.city, following: followsResult.data.map((row) => row.professional_id) };
      const [authorsResult, imagesResult] = await Promise.all([
        supabase.from('profiles').select('id,display_name').in('id', [...new Set(posts.map((post) => post.author_id))]),
        supabase.from('post_images').select('post_id,storage_path,position').in('post_id', posts.map((post) => post.id)).order('position'),
      ]);
      if (authorsResult.error) throw authorsResult.error;
      if (imagesResult.error) throw imagesResult.error;
      const names = new Map(authorsResult.data.map((author) => [author.id, author.display_name]));
      const firstImages = new Map<string, string>();
      imagesResult.data.forEach((item) => { if (!firstImages.has(item.post_id)) firstImages.set(item.post_id, item.storage_path); });
      const urls = new Map<string, string>();
      await Promise.all([...firstImages.values()].map(async (path) => {
        const { data } = await client.storage.from('post-images').createSignedUrl(path, 600);
        if (data?.signedUrl) urls.set(path, data.signedUrl);
      }));
      return {
        posts: posts.map((post) => ({ ...post, authorName: names.get(post.author_id) || 'Artisan Artiz', imageUrl: urls.get(firstImages.get(post.id) ?? '') ?? null })),
        city: profileResult.data.city,
        following: followsResult.data.map((row) => row.professional_id),
      };
    },
  });
  const visible = (feed.data?.posts ?? []).filter((post) => tab === 'feed'
    || (tab === 'nearby' && Boolean(feed.data?.city && post.city?.toLocaleLowerCase('fr') === feed.data.city.toLocaleLowerCase('fr')))
    || (tab === 'contacts' && feed.data?.following.includes(post.author_id)));

  async function contact(authorId: string) {
    if (busyId) return;
    setBusyId(authorId);
    try {
      const conversationId = await openConversation(authorId, 'post');
      router.push(`/conversation/${conversationId}`);
    } catch (error) {
      Alert.alert('Contact impossible', error instanceof Error ? error.message : 'Réessayez plus tard.');
    } finally {
      setBusyId(null);
    }
  }

  return <MainScreen>
    <View style={styles.welcome}><Text style={styles.eyebrow}>LE SAVOIR-FAIRE PRÈS DE VOUS</Text><Text style={styles.title}>Bonjour 👋</Text><Text style={styles.text}>Découvrez les talents qui font vivre votre région.</Text></View>
    <View style={styles.tabs}>{([['feed', 'Fil d’actualité'], ['nearby', 'Autour de moi'], ['contacts', 'Mes contacts']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
    {feed.isPending ? <ActivityIndicator color={colors.blue} /> : feed.error
      ? <EmptyState icon="alert-circle-outline" title="Fil indisponible" description="Impossible de charger les publications pour le moment." />
      : visible.length === 0
        ? tab === 'feed' ? <EmptyState icon="images-outline" title="Aucune publication pour le moment" description="Les réalisations partagées sur Artiz apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} /> : tab === 'nearby' ? <EmptyState icon="location-outline" title="Rien à proximité pour le moment" description="Les publications proches de vous apparaîtront ici." action="Explorer les métiers" onPress={() => router.replace('/explore')} /> : <EmptyState icon="people-outline" title="Aucune publication de vos contacts" description="Suivez des professionnels pour retrouver leurs réalisations dans cet onglet." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
        : visible.map((post) => <View key={post.id} style={styles.card}>
          <Pressable onPress={() => router.push(`/professional/${post.author_id}`)} style={styles.author} accessibilityRole="button"><Avatar name={post.authorName} /><View><Text style={styles.authorName}>{post.authorName}</Text>{post.city ? <Text style={styles.location}>{post.city}</Text> : null}</View></Pressable>
          <Text style={styles.postBody}>{post.body}</Text>
          {post.imageUrl ? <Image source={{ uri: post.imageUrl }} contentFit="cover" style={styles.postImage} /> : null}
          {account.data === 'customer' && <View style={styles.actions}>
            <Pressable onPress={() => contact(post.author_id)} disabled={Boolean(busyId)} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>{busyId === post.author_id ? 'Ouverture…' : 'Contacter'}</Text></Pressable>
            <Pressable onPress={() => router.push(`/quote?id=${post.author_id}`)} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Demander un devis</Text></Pressable>
          </View>}
        </View>)}
  </MainScreen>;
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: colors.backgroundWarm, padding: 20, borderRadius: 20, gap: 4 },
  eyebrow: { fontSize: 12, letterSpacing: 1, color: colors.blue, fontWeight: '700' },
  title: { fontSize: 26, color: colors.navy, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', alignItems: 'center' },
  tabActive: { borderBottomColor: colors.orange },
  tabText: { color: colors.muted, fontSize: 14 },
  tabTextActive: { color: colors.orange, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 14, gap: 12, overflow: 'hidden' },
  author: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  authorName: { color: colors.navy, fontWeight: '700' },
  location: { color: colors.muted, fontSize: 13 },
  postBody: { color: colors.navy, lineHeight: 21 },
  postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.pale },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.blue, fontWeight: '600', textAlign: 'center' },
});
