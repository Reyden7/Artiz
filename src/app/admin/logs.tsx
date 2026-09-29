import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen, EmptyState, Field } from '@/components/artiz-ui';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';
import { LogEntry } from '@/features/logging/log-entry';
import { AdminOnlySupport } from '@/features/support/admin-only';
import { supabase } from '@/services/supabase/client';
import { logger } from '@/services/logger';

type Period = '24h' | '7d' | '30d' | 'all';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LogList() {
  const { session } = useAuth();
  const [level, setLevel] = useState<'all' | 'warn' | 'error'>('all');
  const [period, setPeriod] = useState<Period>('7d');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');
  const normalizedUser = userId.trim();
  const validUser = !normalizedUser || uuid.test(normalizedUser);
  const term = search.replace(/[^a-zA-Z0-9 ._-]/g, '').trim().slice(0, 80);
  const logs = useQuery({
    queryKey: ['admin-app-logs', session?.user.id, level, period, normalizedUser, term],
    enabled: Boolean(supabase && session && validUser),
    queryFn: async () => {
      if (!supabase) return [];
      let query = supabase.from('app_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (level !== 'all') query = query.eq('level', level);
      if (normalizedUser) query = query.eq('user_id', normalizedUser);
      if (period !== 'all') {
        const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
        query = query.gte('created_at', new Date(Date.now() - days * 86400_000).toISOString());
      }
      if (term) query = query.or(`message.ilike.%${term}%,error_message.ilike.%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  async function createDiagnosticTest() {
    logger.error('test.deliberate_failure', {
      error: new Error('Erreur technique volontaire sans donnée personnelle'),
      context: { operation: 'admin_log_test' },
      correlationId: logger.newCorrelationId(),
    });
    await logger.flush();
    await logs.refetch();
  }

  return <AppScreen title="Journaux" subtitle="Événements techniques des bêta-testeurs. Conservation : 60 jours.">
    {__DEV__ && <Pressable accessibilityRole="button" onPress={() => { void createDiagnosticTest(); }} style={styles.testButton}>
      <Text style={styles.testText}>Générer une erreur de test</Text>
    </Pressable>}
    <View style={styles.filters}>
      <Text style={styles.label}>Niveau</Text>
      <View style={styles.choices}>{(['all', 'warn', 'error'] as const).map((value) =>
        <Pressable key={value} accessibilityRole="button" onPress={() => setLevel(value)} style={[styles.choice, level === value && styles.selected]}>
          <Text style={[styles.choiceText, level === value && styles.selectedText]}>{value === 'all' ? 'Tous' : value.toUpperCase()}</Text>
        </Pressable>)}</View>
      <Text style={styles.label}>Date</Text>
      <View style={styles.choices}>{(['24h', '7d', '30d', 'all'] as const).map((value) =>
        <Pressable key={value} accessibilityRole="button" onPress={() => setPeriod(value)} style={[styles.choice, period === value && styles.selected]}>
          <Text style={[styles.choiceText, period === value && styles.selectedText]}>{value === 'all' ? 'Toutes' : value}</Text>
        </Pressable>)}</View>
      <Field label="Utilisateur (identifiant)" value={userId} onChangeText={setUserId} autoCapitalize="none" placeholder="UUID du compte" />
      {!validUser && <Text style={styles.error}>Saisissez un identifiant utilisateur valide.</Text>}
      <Field label="Rechercher" value={search} onChangeText={setSearch} placeholder="Événement ou erreur" />
    </View>
    {!validUser ? null : logs.isPending ? <ActivityIndicator color={colors.blue} />
      : logs.error ? <EmptyState icon="alert-circle-outline" title="Journaux indisponibles" description="Réessayez plus tard." />
        : !logs.data?.length ? <EmptyState icon="document-text-outline" title="Aucun événement" description="Aucun journal ne correspond aux filtres." />
          : <>{logs.data.map((item) => <LogEntry key={item.id} item={item} />)}<Text style={styles.hint}>50 événements récents au maximum.</Text></>}
  </AppScreen>;
}

export default function AdminLogsScreen() { return <AdminOnlySupport><LogList /></AdminOnlySupport>; }

const styles = StyleSheet.create({
  filters: { gap: 10, backgroundColor: colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.divider },
  label: { color: colors.navy, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: colors.pale, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  selected: { backgroundColor: colors.blue },
  choiceText: { color: colors.navy, fontWeight: '600' },
  selectedText: { color: colors.white },
  error: { color: colors.red, fontSize: 12 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  testButton: { borderWidth: 1, borderColor: colors.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  testText: { color: colors.blue, fontWeight: '700' },
});
