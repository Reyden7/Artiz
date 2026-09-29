import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { colors } from '@/constants/artiz';
import type { Database } from '@/services/supabase/database.types';

export type AppLog = Database['public']['Tables']['app_logs']['Row'];

export function LogEntry({ item }: { item: AppLog }) {
  const [expanded, setExpanded] = useState(false);
  const context = item.context && typeof item.context === 'object' && !Array.isArray(item.context)
    ? Object.entries(item.context).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') : '';
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Détails du journal ${item.message}`} onPress={() => setExpanded((value) => !value)} style={styles.heading}>
      <Text style={[styles.level, item.level === 'error' && styles.error]}>{item.level.toUpperCase()}</Text>
      <View style={styles.headingText}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('fr-FR')}</Text>
      </View>
      <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {expanded && <View style={styles.detail}>
      <Text style={styles.meta}>Utilisateur : {item.user_id ?? 'Système'}</Text>
      <Text style={styles.meta}>Écran : {item.route ?? 'Non indiqué'}</Text>
      <Text style={styles.meta}>Plateforme : {item.platform ?? 'Inconnue'} · App : {item.app_version ?? 'Inconnue'} · Build : {item.build_version ?? '—'}</Text>
      {item.correlation_id && <Text style={styles.meta}>Corrélation : {item.correlation_id}</Text>}
      {context && <Text style={styles.meta}>Contexte : {context}</Text>}
      {item.error_name && <Text style={styles.meta}>Erreur : {item.error_name}</Text>}
      {item.error_message && <Text style={styles.meta}>{item.error_message}</Text>}
      {item.stack_trace && <Text selectable style={styles.stack}>{item.stack_trace}</Text>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 62 },
  headingText: { flex: 1, gap: 3 },
  level: { color: colors.orangeDark, fontSize: 11, fontWeight: '700' },
  error: { color: colors.red },
  message: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chevron: { color: colors.blue, fontSize: 19 },
  detail: { borderTopWidth: 1, borderTopColor: colors.divider, padding: 14, gap: 6 },
  stack: { color: colors.navy, fontSize: 11, lineHeight: 16, fontFamily: 'monospace' },
});
