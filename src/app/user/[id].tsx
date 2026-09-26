import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppScreen, Avatar, EmptyState, PrimaryButton } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { avatarUrl } from '@/features/profiles/avatars';
import { supabase } from '@/services/supabase/client';

export default function PublicUserScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profile = useQuery({
    queryKey: ['public-profile', id], enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null;
      const { data, error } = await supabase.from('profiles')
        .select('display_name,bio,city,avatar_path,account_type').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, avatar: await avatarUrl(data.avatar_path) } : null;
    },
  });
  return <AppScreen title="Profil">
    {profile.isPending ? <ActivityIndicator color={colors.blue} /> : profile.error || !profile.data
      ? <EmptyState icon="person-outline" title="Profil indisponible" description="Ce membre est introuvable." />
      : <View style={styles.card}>
        <Avatar name={profile.data.display_name} uri={profile.data.avatar} size={80} />
        <Text style={styles.name}>{profile.data.display_name}</Text>
        <Text style={styles.meta}>{profile.data.account_type === 'professional' ? 'Professionnel' : 'Particulier'}{profile.data.city ? ` · ${profile.data.city}` : ''}</Text>
        {profile.data.bio ? <Text style={styles.bio}>{profile.data.bio}</Text> : null}
        {profile.data.account_type === 'professional' && <PrimaryButton title="Voir le profil professionnel" onPress={() => router.push(`/professional/${id}`)} />}
      </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, gap: 12, alignItems: 'center' },
  name: { color: colors.navy, fontWeight: '700', fontSize: 22 },
  meta: { color: colors.muted },
  bio: { color: colors.navy, lineHeight: 22, alignSelf: 'stretch' },
});
