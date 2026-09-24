import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Avatar, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

export type Post = {
  id: string;
  professionalId: string;
  author: string;
  job: string;
  city: string;
  time: string;
  description: string;
  image: ImageSourcePropType;
  likes: number;
  comments: number;
};

export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const source = Image.resolveAssetSource(post.image);
  const photoWidth = Math.max(0, cardWidth - 32);
  const sourceRatio = source?.width && source?.height ? source.height / source.width : 3 / 4;
  const photoHeight = photoWidth * Math.min(1, Math.max(2 / 3, sourceRatio));
  return <View style={styles.card} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
    <Pressable style={styles.authorRow} onPress={() => router.push({ pathname: '/professional/[id]', params: { id: post.professionalId } })}>
      <Avatar name={post.author} />
      <View style={{ flex: 1 }}><Text style={styles.author}>{post.author}</Text><Text style={styles.meta}>{post.job} · {post.city}</Text></View>
      <Text style={styles.time}>{post.time}</Text>
    </Pressable>
    <Text style={styles.description}>{post.description}</Text>
    <Image source={post.image} style={[styles.photo, { width: photoWidth, height: photoHeight }]} resizeMode="cover" accessibilityLabel={`Réalisation de ${post.author}`} />
    <View style={styles.actions}>
      <Pressable style={styles.action} onPress={() => setLiked(!liked)} accessibilityLabel={liked ? 'Retirer le j’aime' : 'J’aime'}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? colors.red : colors.muted} /><Text style={styles.actionText}>{post.likes + Number(liked)}</Text></Pressable>
      <Pressable style={styles.action} onPress={() => Alert.alert('Commentaires', 'Les commentaires seront disponibles avec le backend social.')} accessibilityLabel="Commentaires"><Ionicons name="chatbubble-outline" size={21} color={colors.muted} /><Text style={styles.actionText}>{post.comments}</Text></Pressable>
      <Pressable style={styles.action} onPress={() => setSaved(!saved)} accessibilityLabel={saved ? 'Retirer des favoris' : 'Enregistrer'}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.blue : colors.muted} /><Text style={styles.actionText}>Enregistrer</Text></Pressable>
    </View>
    <PrimaryButton title="Demander un devis" icon="document-text-outline" onPress={() => router.push({ pathname: '/quote', params: { id: post.professionalId } })} />
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.divider, gap: 12, shadowColor: colors.navy, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1, overflow: 'hidden' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { color: colors.navy, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  time: { color: colors.muted, fontSize: 12 },
  description: { color: colors.navy, lineHeight: 21, fontSize: 15 },
  photo: { borderRadius: 12, backgroundColor: colors.pale },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  actionText: { color: colors.muted, fontSize: 13 },
});
