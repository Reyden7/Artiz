import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { DemoPost } from '@/features/demo/data';

export function PostCard({ post }: { post: DemoPost }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  return <View style={styles.card}>
    <Pressable style={styles.authorRow} onPress={() => router.push({ pathname: '/professional/[id]', params: { id: post.author === 'Sophie Martin' ? 'sophie-martin' : 'thomas-moreau' } })}>
      <Avatar name={post.author} />
      <View style={{ flex: 1 }}><Text style={styles.author}>{post.author}</Text><Text style={styles.meta}>{post.job} · {post.city}</Text></View>
      <Text style={styles.time}>{post.time}</Text>
    </Pressable>
    <Text style={styles.description}>{post.description}</Text>
    <Image source={post.image} style={styles.photo} resizeMode="cover" accessibilityLabel={`Réalisation de ${post.author}`} />
    <View style={styles.actions}>
      <Pressable style={styles.action} onPress={() => setLiked(!liked)} accessibilityLabel={liked ? 'Retirer le j’aime' : 'J’aime'}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? '#E8474D' : colors.muted} /><Text style={styles.actionText}>{post.likes + Number(liked)}</Text></Pressable>
      <Pressable style={styles.action} onPress={() => Alert.alert('Commentaires', 'Les commentaires seront disponibles avec le backend social.')} accessibilityLabel="Commentaires"><Ionicons name="chatbubble-outline" size={21} color={colors.muted} /><Text style={styles.actionText}>{post.comments}</Text></Pressable>
      <Pressable style={styles.action} onPress={() => setSaved(!saved)} accessibilityLabel={saved ? 'Retirer des favoris' : 'Enregistrer'}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.blue : colors.muted} /><Text style={styles.actionText}>Enregistrer</Text></Pressable>
    </View>
    <PrimaryButton title="Demander un devis" icon="document-text-outline" onPress={() => router.push('/quote')} />
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 13, shadowColor: colors.navy, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  time: { color: colors.muted, fontSize: 12 },
  description: { color: colors.navy, lineHeight: 21, fontSize: 15 },
  photo: { width: '100%', height: 245, borderRadius: 13, backgroundColor: colors.pale },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36 },
  actionText: { color: colors.muted, fontSize: 13 },
});
