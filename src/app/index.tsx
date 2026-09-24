import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/typography';
import { Logo } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { useAuth } from '@/features/auth/auth-context';

const village = require('../../assets/artiz/onboarding-village.png');

export default function WelcomeScreen() {
  const { session } = useAuth();
  const [imageHeight, setImageHeight] = useState(0);
  if (session) return <Redirect href="/home" />;

  const blurHeight = Math.min(42, imageHeight * 0.12);
  const imageOffset = Math.min(70, imageHeight * 0.18);
  const imageRenderHeight = imageHeight + imageOffset * 2;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page} bounces={false}>
      <View style={styles.intro}>
        <Logo width={260} />
        <Text style={styles.title}>Trouvez les bons artisans{'\n'}autour de vous</Text>
      </View>
      <View style={styles.illustration} onLayout={(event) => setImageHeight(event.nativeEvent.layout.height)}>
        <Image source={village} style={[styles.village, { height: imageHeight ? imageRenderHeight : '100%', top: -imageOffset }]} resizeMode="cover" accessibilityLabel="Village français entouré de collines" />
        {imageHeight > 0 && <>
          <View pointerEvents="none" style={[styles.blurBand, { top: 0, height: blurHeight }]}>
            <Image source={village} resizeMode="cover" blurRadius={5} style={{ width: '100%', height: imageRenderHeight, marginTop: -imageOffset }} />
          </View>
          <View pointerEvents="none" style={[styles.blurBand, { bottom: 0, height: blurHeight }]}>
            <Image source={village} resizeMode="cover" blurRadius={5} style={{ width: '100%', height: imageRenderHeight, marginTop: -(imageHeight - blurHeight + imageOffset) }} />
          </View>
        </>}
        <LinearGradient pointerEvents="none" colors={[colors.white, 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']} locations={[0, 0.45, 1]} style={styles.topFade} />
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', colors.white]} locations={[0, 0.55, 1]} style={styles.bottomFade} />
      </View>
      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.button, styles.createButton, pressed && styles.pressed]} onPress={() => router.push('/register')} accessibilityRole="button">
          <Text style={styles.createText}>Créer un compte</Text><Ionicons name="arrow-forward" size={23} color={colors.navy} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.button, styles.loginButton, pressed && styles.pressed]} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.loginText}>Se connecter</Text>
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { flexGrow: 1, minHeight: 680, backgroundColor: colors.white, paddingTop: 18, paddingBottom: 24 },
  intro: { alignItems: 'center', paddingHorizontal: 20, gap: 4 },
  title: { color: colors.navy, textAlign: 'center', fontSize: 27, lineHeight: 34, fontWeight: '500', letterSpacing: -0.5 },
  illustration: { flex: 1, minHeight: 260, marginTop: 12, overflow: 'hidden' },
  village: { position: 'absolute', width: '100%' },
  blurBand: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0, height: 80 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  actions: { backgroundColor: colors.white, paddingHorizontal: 26, paddingTop: 18, gap: 13, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -14 },
  button: { height: 62, borderRadius: 34, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  createButton: { backgroundColor: '#FFC42E', borderWidth: 1, borderColor: '#EAA500' },
  createText: { fontSize: 20, fontWeight: '700', color: colors.navy },
  loginButton: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.navy },
  loginText: { fontSize: 20, fontWeight: '600', color: colors.navy },
  pressed: { opacity: 0.8 },
});
