import { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/artiz';

type IconName = keyof typeof Ionicons.glyphMap;

export function Brand({ small = false }: { small?: boolean }) {
  return <Pressable onPress={() => router.push('/')} accessibilityRole="button" accessibilityLabel="Artiz, accueil" style={styles.brandWrap}>
    <Text style={[styles.brand, small && styles.brandSmall]}><Text style={{ color: colors.blue }}>A</Text>rtiz</Text>
    {!small && <Text style={styles.tagline}>Des talents bien réels</Text>}
    <View style={[styles.brandDot, small && { left: 34, top: 2 }]} />
  </Pressable>;
}

export function IconButton({ icon, onPress, badge, label }: { icon: IconName; onPress: () => void; badge?: boolean; label: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
    <Ionicons name={icon} size={23} color={colors.navy} />
    {badge && <View style={styles.badge} />}
  </Pressable>;
}

const navigation: { label: string; icon: IconName; activeIcon: IconName; path: '/' | '/explore' | '/create' | '/network' | '/profile' }[] = [
  { label: 'Accueil', icon: 'home-outline', activeIcon: 'home', path: '/' },
  { label: 'Explorer', icon: 'compass-outline', activeIcon: 'compass', path: '/explore' },
  { label: 'Publier', icon: 'add-circle-outline', activeIcon: 'add-circle', path: '/create' },
  { label: 'Réseau', icon: 'people-outline', activeIcon: 'people', path: '/network' },
  { label: 'Profil', icon: 'person-outline', activeIcon: 'person', path: '/profile' },
];

export function TopNavigation() {
  const pathname = usePathname();
  return <View style={styles.header}>
    <View style={styles.headerTop}>
      <Brand small />
      <View style={styles.headerActions}>
        <IconButton icon="search-outline" label="Rechercher" onPress={() => router.push('/explore')} />
        <IconButton icon="chatbubble-ellipses-outline" label="Messages" badge onPress={() => router.push('/messages')} />
        <IconButton icon="notifications-outline" label="Notifications" badge onPress={() => router.push('/notifications')} />
      </View>
    </View>
    <View style={styles.navRow}>
      {navigation.map((item) => {
        const active = pathname === item.path;
        return <Pressable key={item.path} onPress={() => router.push(item.path)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.navItem, active && styles.navItemActive]}>
          <Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? colors.blue : colors.muted} />
          <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export function AppScreen({ children, title, subtitle, scroll = true }: { children: ReactNode; title?: string; subtitle?: string; scroll?: boolean }) {
  const content = <View style={styles.content}>{title && <Text style={styles.screenTitle}>{title}</Text>}{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}{children}</View>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><TopNavigation />{scroll ? <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}</SafeAreaView>;
}

export function AuthScreen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled"><View style={styles.authContent}>{children}</View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export function PrimaryButton({ title, onPress, icon, disabled = false, outline = false }: { title: string; onPress: () => void; icon?: IconName; disabled?: boolean; outline?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, outline && styles.outlineButton, disabled && { opacity: 0.5 }]} accessibilityRole="button">
    {icon && <Ionicons name={icon} size={20} color={outline ? colors.blue : colors.white} />}
    <Text style={[styles.primaryButtonText, outline && { color: colors.blue }]}>{title}</Text>
  </Pressable>;
}

export function Field({ label, multiline, ...props }: TextInputProps & { label?: string }) {
  return <View style={styles.fieldWrap}>{label && <Text style={styles.fieldLabel}>{label}</Text>}<TextInput {...props} multiline={multiline} placeholderTextColor="#8091A2" style={[styles.field, multiline && { minHeight: 110, textAlignVertical: 'top' }]} /></View>;
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable>}</View>;
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, borderBottomColor: colors.border, borderBottomWidth: 1, zIndex: 1 },
  headerTop: { height: 64, maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  brandWrap: { position: 'relative', alignSelf: 'flex-start' },
  brand: { color: colors.navy, fontSize: 44, fontWeight: '800', letterSpacing: -3, lineHeight: 48 },
  brandSmall: { fontSize: 34, lineHeight: 38 },
  brandDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, top: 3, left: 44 },
  tagline: { fontSize: 11, color: colors.navy, letterSpacing: 1.1, marginTop: -4 },
  iconButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, right: 8, top: 7, borderWidth: 1, borderColor: colors.white },
  navRow: { height: 59, maxWidth: 820, width: '100%', alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  navItemActive: { borderBottomColor: colors.blue },
  navText: { color: colors.muted, fontSize: 11 },
  navTextActive: { color: colors.blue, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  content: { maxWidth: 680, width: '100%', alignSelf: 'center', padding: 16, gap: 16 },
  screenTitle: { fontSize: 29, fontWeight: '800', color: colors.navy, marginTop: 4 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22, marginTop: -12 },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  authContent: { maxWidth: 470, width: '100%', alignSelf: 'center', gap: 18, paddingVertical: 22 },
  primaryButton: { height: 52, borderRadius: 12, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlineButton: { backgroundColor: colors.white, borderColor: colors.blue, borderWidth: 1 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  field: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13, minHeight: 50, fontSize: 15, color: colors.navy },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: colors.navy },
  sectionAction: { color: colors.blue, fontWeight: '700' },
  avatar: { backgroundColor: '#DDEDF1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blue, fontWeight: '800' },
});
