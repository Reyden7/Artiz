import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text } from '@/components/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/constants/artiz';
import { useUnreadMessages } from '@/features/messaging/use-unread-messages';
import { useUnreadNotifications } from '@/features/notifications/use-notifications';

type IconName = keyof typeof Ionicons.glyphMap;
const AuthFieldFocusContext = createContext<((input: TextInput) => void) | null>(null);
const logo = require('../../assets/artiz/logo-2026.png');

export function Logo({ width = 220 }: { width?: number }) {
  return <View style={{ width, height: width * 0.68, overflow: 'hidden', backgroundColor: colors.white }} accessibilityLabel="Artiz">
    <Image source={logo} resizeMode="contain" style={{ position: 'absolute', width: width * 1.25, height: width * 1.25, left: -width * 0.12, top: -width * 0.29 }} />
  </View>;
}

export function Brand({ small = false }: { small?: boolean }) {
  return <Pressable onPress={() => router.replace(small ? '/home' : '/')} accessibilityRole="button" accessibilityLabel="Artiz, accueil" style={[styles.brandWrap, small && styles.brandWrapSmall]}>
    <Logo width={small ? 82 : 220} />
  </Pressable>;
}

export function IconButton({ icon, onPress, badgeCount, label }: { icon: IconName; onPress: () => void; badgeCount?: number; label: string }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
    <Ionicons name={icon} size={23} color={colors.navy} />
    {Boolean(badgeCount) && <View style={styles.badge}><Text style={styles.badgeText}>{badgeCount! > 99 ? '99+' : badgeCount}</Text></View>}
  </Pressable>;
}

const navigation: { label: string; icon: IconName; path: '/home' | '/explore' | '/create' | '/messages' | '/profile' }[] = [
  { label: 'Accueil', icon: 'home-outline', path: '/home' },
  { label: 'Découvrir', icon: 'compass-outline', path: '/explore' },
  { label: 'Publier', icon: 'add-outline', path: '/create' },
  { label: 'Messages', icon: 'chatbubble-ellipses-outline', path: '/messages' },
  { label: 'Profil', icon: 'person-outline', path: '/profile' },
];

export function TopNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useUnreadMessages();
  const notifications = useUnreadNotifications();
  const unreadCount = (unread.data ?? []).reduce((total, item) => total + item.unread_count, 0);
  return <View style={styles.header}>
    <View style={styles.headerTop}>
      <View style={styles.brandActions}>
        <Brand small />
        <IconButton icon="ellipsis-horizontal" label="Plus d’options" onPress={() => setMenuOpen((open) => !open)} />
      </View>
      <View style={styles.headerActions}>
        <IconButton icon="search-outline" label="Rechercher" onPress={() => router.replace('/explore')} />
        <IconButton icon="chatbubble-ellipses-outline" label={unreadCount ? `Messages, ${unreadCount} non lus` : 'Messages'} badgeCount={unreadCount} onPress={() => router.replace('/messages')} />
        <IconButton icon="notifications-outline" label={notifications.data ? `Notifications, ${notifications.data} non lues` : 'Notifications'} badgeCount={notifications.data ?? 0} onPress={() => router.push('/notifications')} />
      </View>
    </View>
    {menuOpen && <Pressable style={styles.moreMenu} accessibilityRole="button" onPress={() => {
      setMenuOpen(false);
      router.push({ pathname: '/settings/support/new', params: { screen: pathname } });
    }}><Ionicons name="alert-circle-outline" size={19} color={colors.blue} /><Text style={styles.moreMenuText}>Signaler un problème</Text></Pressable>}
    <MainNavigation />
  </View>;
}

function MainNavigation() {
  const pathname = usePathname();
  return <View style={styles.navRow}>
    {navigation.map((item) => {
      const active = pathname === item.path;
      const publish = item.path === '/create';
      return <Pressable key={item.path} onPress={() => { if (!active) router.replace(item.path); }} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.navItem}>
        <View style={publish ? styles.publishIcon : styles.navIcon}>
          <Ionicons name={item.icon} size={publish ? 25 : 21} color={publish ? colors.white : active ? colors.orange : colors.blue} />
        </View>
        <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

type ScreenProps = { children: ReactNode; title?: string; subtitle?: string; scroll?: boolean; keyboardExtraSpace?: number };

function ScreenBody({ children, title, subtitle, scroll = true, keyboardExtraSpace = 28 }: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const revealFocusedInput = useCallback(() => {
    const top = keyboardTop.current;
    if (!focusedInput.current || top === null) return;
    focusedInput.current.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height - (top - keyboardExtraSpace);
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, [keyboardExtraSpace]);

  useEffect(() => {
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      revealTimer = setTimeout(revealFocusedInput, 250);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      focusedInput.current = null;
      setKeyboardHeight(0);
    });
    return () => { if (revealTimer) clearTimeout(revealTimer); show.remove(); hide.remove(); };
  }, [revealFocusedInput]);

  const onFieldFocus = useCallback((input: TextInput) => {
    focusedInput.current = input;
    if (keyboardTop.current !== null) setTimeout(revealFocusedInput, 100);
  }, [revealFocusedInput]);

  const content = <View style={styles.content}>{title && <Text style={styles.screenTitle}>{title}</Text>}{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}{children}</View>;
  return scroll ? <AuthFieldFocusContext.Provider value={onFieldFocus}><ScrollView
    ref={scrollRef}
    style={{ flex: 1 }}
    contentContainerStyle={[styles.scrollContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight + keyboardExtraSpace }]}
    keyboardShouldPersistTaps="handled"
    onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }}
    scrollEventThrottle={16}
  >{content}</ScrollView></AuthFieldFocusContext.Provider> : content;
}

export function MainScreen(props: ScreenProps) {
  return <View style={styles.safe}><ScreenBody {...props} /></View>;
}

export function AppScreen(props: ScreenProps) {
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><TopNavigation /><ScreenBody {...props} /></SafeAreaView>;
}

export function AuthScreen({ children }: { children: ReactNode }) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const revealFocusedInput = useCallback(() => {
    if (!focusedInput.current || keyboardTop.current === null) return;
    const visibleBottom = keyboardTop.current - 28;
    focusedInput.current.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height - visibleBottom;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, []);

  useEffect(() => {
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      revealTimer = setTimeout(revealFocusedInput, 250);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => { if (revealTimer) clearTimeout(revealTimer); show.remove(); hide.remove(); };
  }, [revealFocusedInput]);

  const onFieldFocus = useCallback((input: TextInput) => {
    focusedInput.current = input;
    if (keyboardTop.current !== null) setTimeout(revealFocusedInput, 100);
  }, [revealFocusedInput]);

  return (
    <AuthFieldFocusContext.Provider value={onFieldFocus}>
      <SafeAreaView style={styles.authSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.authScroll,
              Platform.OS === 'android' && keyboardHeight > 0 && {
                paddingBottom: keyboardHeight + 20,
                justifyContent: 'flex-start',
              },
            ]}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <View style={styles.authContent}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthFieldFocusContext.Provider>
  );
}

export function PrimaryButton({ title, onPress, icon, disabled = false, outline = false, accent = false }: { title: string; onPress: () => void; icon?: IconName; disabled?: boolean; outline?: boolean; accent?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, accent && styles.accentButton, outline && styles.outlineButton, pressed && !disabled && { opacity: 0.88 }, disabled && { opacity: 0.45 }]} accessibilityRole="button" accessibilityState={{ disabled }}>
    {icon && <Ionicons name={icon} size={20} color={outline ? colors.blue : colors.white} />}
    <Text style={[styles.primaryButtonText, outline && { color: colors.blue }]}>{title}</Text>
  </Pressable>;
}

export function Field({ label, multiline, onFocus, onBlur, ...props }: TextInputProps & { label?: string }) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const onAuthFieldFocus = useContext(AuthFieldFocusContext);
  return <View style={styles.fieldWrap}>{label && <Text style={styles.fieldLabel}>{label}</Text>}<TextInput {...props} ref={inputRef} onFocus={(event) => { setFocused(true); onFocus?.(event); if (inputRef.current) onAuthFieldFocus?.(inputRef.current); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }} multiline={multiline} placeholderTextColor={colors.mutedLight} style={[styles.field, focused && styles.fieldFocused, multiline && { minHeight: 110, textAlignVertical: 'top' }]} /></View>;
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}  ›</Text></Pressable>}</View>;
}

export function EmptyState({ icon, title, description, action, onPress }: { icon: IconName; title: string; description: string; action?: string; onPress?: () => void }) {
  return <View style={styles.emptyState}>
    <View style={styles.emptyIcon}><Ionicons name={icon} size={26} color={colors.blue} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyDescription}>{description}</Text>
    {action && onPress && <View style={styles.emptyAction}><PrimaryButton title={action} onPress={onPress} outline /></View>}
  </View>;
}

export function Avatar({ name, size = 44, uri }: { name: string; size?: number; uri?: string | null }) {
  const initials = name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>{uri
    ? <ExpoImage source={{ uri }} contentFit="cover" style={{ width: size, height: size }} />
    : <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  authSafe: { flex: 1, backgroundColor: colors.white },
  header: { backgroundColor: colors.white, borderBottomColor: colors.border, borderBottomWidth: 1, zIndex: 1 },
  headerTop: { height: 60, maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreMenu: { position: 'absolute', zIndex: 5, top: 55, left: 14, backgroundColor: colors.white, borderColor: colors.divider, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, elevation: 5 },
  moreMenuText: { color: colors.navy, fontWeight: '600' },
  brandWrap: { alignSelf: 'center' },
  brandWrapSmall: { alignSelf: 'flex-start' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, right: 1, top: 1, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.white },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  navRow: { height: 64, maxWidth: 820, width: '100%', alignSelf: 'center', flexDirection: 'row', paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  navItem: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  publishIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  navText: { color: colors.blue, fontSize: 14 },
  navTextActive: { color: colors.orange, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  content: { maxWidth: 680, width: '100%', alignSelf: 'center', padding: spacing.lg, gap: spacing.xxl },
  screenTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.navy, marginTop: 4 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22, marginTop: -12 },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.white },
  authContent: { maxWidth: 470, width: '100%', alignSelf: 'center', gap: 16, paddingVertical: 24 },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.md },
  accentButton: { backgroundColor: colors.orange },
  outlineButton: { backgroundColor: colors.white, borderColor: colors.blue, borderWidth: 1 },
  primaryButtonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  field: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, minHeight: 48, fontSize: 15, color: colors.navy, fontFamily: 'Inter_400Regular' },
  fieldFocused: { borderColor: colors.blue },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.navy },
  sectionAction: { color: colors.blue, fontWeight: '700' },
  emptyState: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.navy, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyAction: { marginTop: spacing.sm, width: '100%' },
  avatar: { backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blue, fontWeight: '800' },
});
