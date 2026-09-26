import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { router } from 'expo-router';
import { Avatar, EmptyState } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { useAccountType } from '@/features/auth/use-account-type';
import { openConversation } from '@/features/messaging/conversations';
import { supabase } from '@/services/supabase/client';

type FeedTab = 'feed' | 'nearby' | 'contacts';
type FeedPost = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  city: string | null;
  created_at: string;
  authorName: string;
  imageUrl: string | null;
  avatarUrl: string | null;
  like_count: number;
  comment_count: number;
  liked: boolean;
};
const pageSize = 20;

export default function HomeScreen() {
  const [tab, setTab] = useState<FeedTab>('feed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { session } = useAuth();
  const account = useAccountType();
  const queryClient = useQueryClient();
  const filters = useQuery({
    queryKey: ['feed-filters', session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: async () => {
      if (!supabase || !session) return { city: null as string | null, following: [] as string[] };
      const [profile, follows] = await Promise.all([
        supabase.from('profiles').select('city').eq('id', session.user.id).single(),
        supabase.from('professional_follows').select('professional_id').eq('follower_id', session.user.id),
      ]);
      if (profile.error) throw profile.error;
      if (follows.error) throw follows.error;
      return { city: profile.data.city, following: follows.data.map((row) => row.professional_id) };
    },
  });
  const feed = useInfiniteQuery({
    queryKey: ['posts-feed', session?.user.id, tab, filters.data?.city, filters.data?.following],
    enabled: Boolean(supabase && session && filters.data),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<FeedPost[]> => {
      if (!supabase || !session || !filters.data) return [];
      const client = supabase;
      if (tab === 'nearby' && !filters.data.city) return [];
      if (tab === 'contacts' && filters.data.following.length === 0) return [];
      let query = client.from('posts').select('id,author_id,title,body,city,created_at,like_count,comment_count')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      if (tab === 'nearby') query = query.eq('city', filters.data.city!);
      if (tab === 'contacts') query = query.in('author_id', filters.data.following);
      const { data: posts, error } = await query;
      if (error) throw error;
      if (!posts.length) return [];
      const [authors, images, likes] = await Promise.all([
        client.from('profiles').select('id,display_name,avatar_path').in('id', [...new Set(posts.map((post) => post.author_id))]),
        client.from('post_images').select('post_id,storage_path,position').in('post_id', posts.map((post) => post.id)).order('position'),
        client.from('post_likes').select('post_id').eq('user_id', session.user.id).in('post_id', posts.map((post) => post.id)),
      ]);
      if (authors.error) throw authors.error;
      if (images.error) throw images.error;
      if (likes.error) throw likes.error;
      const names = new Map(authors.data.map((author) => [author.id, author.display_name]));
      const avatarPaths = new Map(authors.data.map((author) => [author.id, author.avatar_path]));
      const liked = new Set(likes.data.map((like) => like.post_id));
      const firstImages = new Map<string, string>();
      images.data.forEach((item) => { if (!firstImages.has(item.post_id)) firstImages.set(item.post_id, item.storage_path); });
      const urls = new Map<string, string>();
      await Promise.all([...firstImages.values()].map(async (path) => {
        const { data } = await client.storage.from('post-images').createSignedUrl(path, 600);
        if (data?.signedUrl) urls.set(path, data.signedUrl);
      }));
      const avatarUrls = new Map<string, string>();
      await Promise.all([...avatarPaths.values()].filter((path): path is string => Boolean(path)).map(async (path) => {
        const { data } = await client.storage.from('avatars').createSignedUrl(path, 600);
        if (data) avatarUrls.set(path, data.signedUrl);
      }));
      return posts.map((post) => ({
        ...post,
        authorName: names.get(post.author_id) || 'Artisan Artiz',
        imageUrl: urls.get(firstImages.get(post.id) ?? '') ?? null,
        avatarUrl: avatarUrls.get(avatarPaths.get(post.author_id) ?? '') ?? null,
        liked: liked.has(post.id),
      }));
    },
    getNextPageParam: (lastPage, allPages) => lastPage.length === pageSize ? allPages.length : undefined,
  });
  const seen = new Set<string>();
  const posts = (feed.data?.pages.flat() ?? []).filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });

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

  async function toggleLike(post: FeedPost) {
    if (!supabase || !session || busyId) return;
    setBusyId(post.id);
    const result = post.liked
      ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', session.user.id)
      : await supabase.from('post_likes').insert({ post_id: post.id, user_id: session.user.id });
    setBusyId(null);
    if (result.error) Alert.alert('Action impossible', 'Réessayez plus tard.');
    else await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
  }

  const empty = filters.error || feed.error
    ? <EmptyState icon="alert-circle-outline" title="Fil indisponible" description="Impossible de charger les publications pour le moment." />
    : tab === 'feed'
      ? <EmptyState icon="images-outline" title="Aucune publication pour le moment" description="Les réalisations partagées sur Artiz apparaîtront ici." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />
      : tab === 'nearby'
        ? <EmptyState icon="location-outline" title="Rien à proximité pour le moment" description="Les publications de votre ville apparaîtront ici." action="Explorer les métiers" onPress={() => router.replace('/explore')} />
        : <EmptyState icon="people-outline" title="Aucune publication de vos contacts" description="Suivez des professionnels pour retrouver leurs réalisations dans cet onglet." action="Découvrir les artisans" onPress={() => router.replace('/explore')} />;

  return <FlatList
    style={styles.list}
    contentContainerStyle={styles.content}
    data={posts}
    keyExtractor={(post) => post.id}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.welcome}><Text style={styles.eyebrow}>LE SAVOIR-FAIRE PRÈS DE VOUS</Text><Text style={styles.title}>Bonjour 👋</Text><Text style={styles.text}>Découvrez les talents qui font vivre votre région.</Text></View>
      <View style={styles.tabs}>{([['feed', 'Fil d’actualité'], ['nearby', 'Autour de moi'], ['contacts', 'Mes contacts']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}><Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
    </View>}
    ListEmptyComponent={filters.isPending || feed.isPending ? <ActivityIndicator color={colors.blue} /> : empty}
    ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.blue} style={styles.footer} /> : null}
    refreshing={feed.isRefetching && !feed.isFetchingNextPage}
    onRefresh={() => { void filters.refetch(); void feed.refetch(); }}
    onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
    onEndReachedThreshold={0.4}
    renderItem={({ item: post }) => <View style={styles.card}>
      <Pressable onPress={() => router.push(`/professional/${post.author_id}`)} style={styles.author} accessibilityRole="button"><Avatar name={post.authorName} uri={post.avatarUrl} /><View><Text style={styles.authorName}>{post.authorName}</Text>{post.city ? <Text style={styles.location}>{post.city}</Text> : null}</View></Pressable>
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postBody}>{post.body}</Text>
      {post.imageUrl ? <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}><Image source={{ uri: post.imageUrl }} contentFit="cover" style={styles.postImage} /></Pressable> : null}
      <View style={styles.social}>
        <Pressable onPress={() => void toggleLike(post)} disabled={Boolean(busyId)} style={styles.socialAction} accessibilityRole="button" accessibilityLabel={post.liked ? 'Retirer mon j’aime' : 'J’aime'}><Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={22} color={post.liked ? colors.orange : colors.blue} /><Text style={styles.socialText}>{post.like_count}</Text></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} style={styles.socialAction} accessibilityRole="button"><Ionicons name="chatbubble-outline" size={21} color={colors.blue} /><Text style={styles.socialText}>{post.comment_count} commentaires</Text></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/post/report', params: { id: post.id } })} style={styles.socialAction} accessibilityRole="button"><Text style={styles.report}>Signaler</Text></Pressable>
      </View>
      {account.data === 'customer' && <View style={styles.actions}>
        <Pressable onPress={() => contact(post.author_id)} disabled={Boolean(busyId)} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>{busyId === post.author_id ? 'Ouverture…' : 'Contacter'}</Text></Pressable>
        <Pressable onPress={() => router.push(`/quote?id=${post.author_id}`)} style={styles.action} accessibilityRole="button"><Text style={styles.actionText}>Demander un devis</Text></Pressable>
      </View>}
    </View>}
  />;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { maxWidth: 680, width: '100%', alignSelf: 'center', padding: 20, gap: 20, paddingBottom: 40 },
  header: { gap: 20 },
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
  postTitle: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  postBody: { color: colors.navy, lineHeight: 21 },
  postImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.pale },
  actions: { flexDirection: 'row', gap: 10 },
  social: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' },
  socialAction: { flexDirection: 'row', gap: 5, alignItems: 'center', minHeight: 38 },
  socialText: { color: colors.blue, fontSize: 13 },
  report: { color: colors.muted, fontSize: 13 },
  action: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.blue, fontWeight: '600', textAlign: 'center' },
  footer: { padding: 20 },
});
