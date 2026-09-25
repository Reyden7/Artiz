import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { AuthScreen, Brand, PrimaryButton } from '@/components/artiz-ui';
import { colors } from '@/constants/artiz';
import { readConfirmationParameters } from '@/features/auth/callback-parameters';
import { confirmationErrorMessage, confirmEmailFromParameters } from '@/features/auth/confirmation-link';
import { completePendingProfessionalRegistration } from '@/features/auth/professional-registration';

type ScreenState = 'loading' | 'confirmed' | 'error' | 'professional-error';

export default function AuthCallbackScreen() {
  const linkedUrl = Linking.useLinkingURL();
  const routeParams = useLocalSearchParams();
  const [initialUrl, setInitialUrl] = useState<string | null | undefined>();
  const [state, setState] = useState<ScreenState>('loading');
  const [message, setMessage] = useState('Confirmation de votre adresse e-mail…');
  const attempt = readConfirmationParameters([linkedUrl, initialUrl], routeParams).toString();
  const ready = initialUrl !== undefined || Boolean(linkedUrl) || Object.keys(routeParams).length > 0;

  useEffect(() => {
    let active = true;
    const fallback = setTimeout(() => {
      if (active) setInitialUrl((current) => current === undefined ? null : current);
    }, 3000);
    void Linking.getInitialURL().then((url) => {
      if (active) setInitialUrl(url);
    }).catch(() => {
      if (active) setInitialUrl(null);
    });
    return () => { active = false; clearTimeout(fallback); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function finish() {
      setState('loading');
      try {
        const result = await confirmEmailFromParameters(new URLSearchParams(attempt));
        if (!active) return;
        if (result.status === 'confirmed-without-session') {
          setMessage('Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter.');
          setState('confirmed');
          return;
        }
        try {
          const professional = await completePendingProfessionalRegistration(result.email);
          if (active) router.replace(professional ? '/profile' : '/home');
        } catch (error) {
          if (!active) return;
          setMessage(error instanceof Error ? error.message : 'Terminez votre inscription professionnelle depuis votre profil.');
          setState('professional-error');
        }
      } catch (error) {
        if (!active) return;
        setMessage(confirmationErrorMessage(error));
        setState('error');
      }
    }
    void finish();
    return () => { active = false; };
  }, [ready, attempt]);

  return <AuthScreen>
    <View style={styles.content}>
      <Brand />
      {state === 'loading' && <ActivityIndicator color={colors.blue} />}
      <Text style={styles.message}>{message}</Text>
      {state === 'confirmed' && <PrimaryButton title="Se connecter" onPress={() => router.replace('/login')} />}
      {state === 'error' && <PrimaryButton title="Se connecter" onPress={() => router.replace('/login')} />}
      {state === 'professional-error' && <PrimaryButton title="Voir mon profil" onPress={() => router.replace('/profile')} />}
    </View>
  </AuthScreen>;
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 20, paddingVertical: 50 },
  message: { color: colors.navy, lineHeight: 23, textAlign: 'center' },
});
