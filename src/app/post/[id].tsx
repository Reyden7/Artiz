import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, Avatar, EmptyState, Field, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { avatarUrl } from '@/features/profiles/avatars';
import { supabase } from '@/services/supabase/client';

type Mention = { user_id: string; start_cp: number; length_cp: number };
type RenderMention = Mention & { label: string; account_type: string };
const cp = (value: string) => Array.from(value);

function CommentBody({ body, mentions }: { body: string; mentions: RenderMention[] }) {
  const chars = cp(body);
  let cursor = 0;
  const pieces: React.ReactNode[] = [];
  for (const mention of mentions.sort((a, b) => a.start_cp - b.start_cp)) {
    if (mention.start_cp < cursor || mention.start_cp + mention.length_cp > chars.length) continue;
    pieces.push(chars.slice(cursor, mention.start_cp).join(''));
    pieces.push(<Text key={`${mention.user_id}-${mention.start_cp}`} style={styles.mention} onPress={() => router.push(mention.account_type === 'professional'
      ? { pathname: '/professional/[id]', params: { id: mention.user_id } }
      : { pathname: '/user/[id]', params: { id: mention.user_id } })}>{chars.slice(mention.start_cp, mention.start_cp + mention.length_cp).join('')}</Text>);
    cursor = mention.start_cp + mention.length_cp;
  }
  pieces.push(chars.slice(cursor).join(''));
  return <Text style={styles.commentBody}>{pieces}</Text>;
}

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState('');
  const post = useQuery({
    queryKey: ['post', id], enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null;
      const [item, photos, comments, like] = await Promise.all([
        supabase.from('posts').select('id,author_id,title,body,city,created_at,like_count,comment_count').eq('id', id).eq('status', 'published').maybeSingle(),
        supabase.from('post_images').select('storage_path').eq('post_id', id).order('position'),
        supabase.from('post_comments').select('id,author_id,body,created_at').eq('post_id', id).order('created_at', { ascending: true }).limit(100),
        userId ? supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (item.error) throw item.error;
      if (photos.error) throw photos.error;
      if (comments.error) throw comments.error;
      if (like.error) throw like.error;
      if (!item.data) return null;
      const ids = [...new Set([item.data.author_id, ...comments.data.map((comment) => comment.author_id)])];
      const [people, relations] = await Promise.all([
        supabase.from('profiles').select('id,display_name,account_type,avatar_path').in('id', ids),
        comments.data.length ? supabase.from('comment_mentions').select('comment_id,mentioned_user_id,start_cp,length_cp,label').in('comment_id', comments.data.map((comment) => comment.id)) : Promise.resolve({ data: [], error: null }),
      ]);
      if (people.error) throw people.error;
      if (relations.error) throw relations.error;
      const mentionedIds = [...new Set(relations.data.map((relation) => relation.mentioned_user_id))];
      const mentionedProfiles = mentionedIds.length ? await supabase.from('profiles').select('id,account_type').in('id', mentionedIds) : { data: [], error: null };
      if (mentionedProfiles.error) throw mentionedProfiles.error;
      const types = new Map(mentionedProfiles.data.map((person) => [person.id, person.account_type]));
      const names = new Map(people.data.map((person) => [person.id, person.display_name]));
      const avatars = new Map<string, string | null>();
      await Promise.all(people.data.map(async (person) => avatars.set(person.id, await avatarUrl(person.avatar_path))));
      const urls = await Promise.all(photos.data.map(async (photo) => {
        const { data } = await supabase!.storage.from('post-images').createSignedUrl(photo.storage_path, 600);
        return data?.signedUrl ?? null;
      }));
      return { ...item.data, authorName: names.get(item.data.author_id) ?? 'Artisan Artiz', authorAvatar: avatars.get(item.data.author_id),
        images: urls.filter((url): url is string => Boolean(url)), liked: Boolean(like.data),
        comments: comments.data.map((comment) => ({ ...comment, name: names.get(comment.author_id) ?? 'Membre Artiz', avatar: avatars.get(comment.author_id),
          mentions: relations.data.filter((relation) => relation.comment_id === comment.id).map((relation) => ({ ...relation, user_id: relation.mentioned_user_id, account_type: types.get(relation.mentioned_user_id) ?? 'customer' })) })) };
    },
  });
  const suggestions = useQuery({
    queryKey: ['mention-targets', id, term], enabled: Boolean(supabase && id && term.length >= 2),
    queryFn: async () => {
      if (!supabase || !id) return [];
      const { data, error } = await supabase.rpc('search_mention_targets', { search_term: term, target_post: id });
      if (error) throw error;
      return data;
    },
  });

  function edit(value: string) {
    setBody(value);
    setMentions((current) => current.filter((mention) =>
      cp(value).slice(0, mention.start_cp + mention.length_cp).join('') === cp(body).slice(0, mention.start_cp + mention.length_cp).join('')));
    const match = value.match(/(?:^|\s)@([\p{L}\p{N} ._-]{2,40})$/u);
    setTerm(match?.[1].trim() ?? '');
  }

  function choose(person: { user_id: string; display_name: string }) {
    if (mentions.length >= 5) { Alert.alert('Limite atteinte', 'Un commentaire peut contenir au maximum cinq mentions.'); return; }
    const match = body.match(/(?:^|\s)@([\p{L}\p{N} ._-]{2,40})$/u);
    if (!match) return;
    const start = body.length - match[0].length + match[0].lastIndexOf('@');
    const before = body.slice(0, start);
    const text = `@${person.display_name}`;
    setBody(`${before}${text} `);
    setMentions((current) => [...current, { user_id: person.user_id, start_cp: cp(before).length, length_cp: cp(text).length }]);
    setTerm('');
  }

  async function submit() {
    if (!supabase || !id || !body.trim() || busy) return;
    setBusy(true);
    const value = body.trim();
    const leading = cp(body).length - cp(body.trimStart()).length;
    const validMentions = mentions.filter((mention) => mention.start_cp >= leading && mention.start_cp + mention.length_cp <= leading + cp(value).length)
      .map((mention) => ({ ...mention, start_cp: mention.start_cp - leading })).sort((a, b) => a.start_cp - b.start_cp);
    const { error } = await supabase.rpc('create_post_comment', { target_post: id, comment_body: value, mentions: validMentions });
    setBusy(false);
    if (error) Alert.alert('Commentaire refusé', error.message);
    else { setBody(''); setMentions([]); setTerm(''); await queryClient.invalidateQueries({ queryKey: ['post', id] }); await queryClient.invalidateQueries({ queryKey: ['posts-feed'] }); }
  }

  async function toggleLike() {
    if (!supabase || !userId || !post.data || busy) return;
    setBusy(true);
    const current = post.data;
    const result = current.liked ? await supabase.from('post_likes').delete().eq('post_id', current.id).eq('user_id', userId)
      : await supabase.from('post_likes').insert({ post_id: current.id, user_id: userId });
    setBusy(false);
    if (result.error) Alert.alert('Action impossible', result.error.message);
    else { await queryClient.invalidateQueries({ queryKey: ['post', id] }); await queryClient.invalidateQueries({ queryKey: ['posts-feed'] }); }
  }

  async function removeComment(commentId: string) {
    if (!supabase || !id) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
    if (error) Alert.alert('Suppression impossible', error.message);
    else { await queryClient.invalidateQueries({ queryKey: ['post', id] }); await queryClient.invalidateQueries({ queryKey: ['posts-feed'] }); }
  }

  return <AppScreen title="Publication" keyboardExtraSpace={150}>
    {post.isPending ? <ActivityIndicator color={colors.blue} /> : post.error || !post.data
      ? <EmptyState icon="images-outline" title="Publication indisponible" description="Elle a peut-être été retirée ou n’est pas visible pour vous." />
      : <>
        <View style={styles.card}>
          <Pressable style={styles.author} onPress={() => router.push({ pathname: '/professional/[id]', params: { id: post.data!.author_id } })}><Avatar name={post.data.authorName} uri={post.data.authorAvatar} /><Text style={styles.name}>{post.data.authorName}</Text></Pressable>
          <Text style={styles.title}>{post.data.title}</Text><Text style={styles.body}>{post.data.body}</Text>
          {post.data.images.map((url, index) => <Image key={url} source={{ uri: url }} contentFit="cover" style={styles.image} accessibilityLabel={`Photo ${index + 1}`} />)}
          <View style={styles.actions}><Pressable onPress={() => void toggleLike()} disabled={busy}><Text style={styles.link}>{post.data.liked ? '♥' : '♡'} {post.data.like_count} j’aime</Text></Pressable><Text style={styles.meta}>{post.data.comment_count} commentaires</Text><Pressable onPress={() => router.push({ pathname: '/post/report', params: { id } })}><Text style={styles.meta}>Signaler</Text></Pressable></View>
        </View>
        <Text style={styles.title}>Commentaires</Text>
        {post.data.comments.map((comment) => <View key={comment.id} style={styles.comment}>
          <Pressable style={styles.author} onPress={() => router.push({ pathname: '/user/[id]', params: { id: comment.author_id } })}><Avatar name={comment.name} uri={comment.avatar} size={34} /><Text style={styles.name}>{comment.name}</Text></Pressable>
          <CommentBody body={comment.body} mentions={comment.mentions} />
          <View style={styles.actions}><Text style={styles.meta}>{new Date(comment.created_at).toLocaleString('fr-FR')}</Text>{comment.author_id === userId && <Pressable onPress={() => Alert.alert('Supprimer ce commentaire ?', undefined, [{ text: 'Annuler' }, { text: 'Supprimer', style: 'destructive', onPress: () => void removeComment(comment.id) }])}><Text style={styles.link}>Supprimer</Text></Pressable>}</View>
        </View>)}
        <View style={styles.card}>
          <Field label="Ajouter un commentaire" value={body} onChangeText={edit} multiline maxLength={1000} placeholder="Écrivez un commentaire. Tapez @nom pour mentionner un membre." />
          {term.length >= 2 && suggestions.data?.length ? <View style={styles.suggestions}>{suggestions.data.map((person) => <Pressable key={person.user_id} onPress={() => choose(person)} style={styles.suggestion}><Text style={styles.link}>@{person.display_name}</Text><Text style={styles.meta}>{person.account_type === 'professional' ? 'Professionnel' : 'Particulier'}</Text></Pressable>)}</View> : null}
          <PrimaryButton title={busy ? 'Envoi…' : 'Commenter'} onPress={() => void submit()} disabled={busy || !body.trim()} />
        </View>
      </>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, padding: 16, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, gap: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 9 }, name: { color: colors.navy, fontWeight: '700' },
  title: { color: colors.navy, fontWeight: '700', fontSize: 19 }, body: { color: colors.navy, lineHeight: 22 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'center' },
  link: { color: colors.blue, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 13 },
  comment: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, gap: 9 },
  commentBody: { color: colors.navy, lineHeight: 22 }, mention: { color: colors.blue, fontWeight: '700' },
  suggestions: { borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, suggestion: { padding: 10, flexDirection: 'row', justifyContent: 'space-between' },
});
