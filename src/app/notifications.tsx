import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';

const items = [
  { icon: 'heart-outline' as const, title: 'Votre réseau s’anime', detail: 'Suivez les réalisations des artisans qui vous inspirent.', time: 'Aujourd’hui' },
  { icon: 'sparkles-outline' as const, title: 'Bienvenue sur Artiz', detail: 'Découvrez le savoir-faire près de chez vous.', time: 'Hier' },
];

export default function NotificationsScreen() {
  return <AppScreen title="Notifications" subtitle="Les nouvelles de votre réseau local.">{items.map((item) => <View key={item.title} style={styles.item}><View style={styles.icon}><Ionicons name={item.icon} size={23} color={colors.blue} /></View><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text><Text style={styles.time}>{item.time}</Text></View></View>)}</AppScreen>;
}

const styles = StyleSheet.create({ item: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: 'row', gap: 12 }, icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.navy, fontWeight: '800', fontSize: 15 }, detail: { color: colors.muted, marginTop: 3, lineHeight: 19 }, time: { color: colors.blue, fontSize: 12, marginTop: 7 } });
