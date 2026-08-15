//////////////////////////////////////////////////////////////////////////
//                             🔐 Login.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran de connexion/inscription (email + mot de passe, Google), avec accès invité sans compte.
 */

// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ScreenContainer } from '@/components/ScreenContainer';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { showAlert('Champs requis', 'Veuillez remplir tous les champs.'); return; }
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) showAlert('Connexion échouée', error);
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) { showAlert('Champs requis', 'Veuillez remplir tous les champs.'); return; }
    if (password !== confirmPassword) { showAlert('Erreur', 'Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 6) { showAlert('Mot de passe trop court', 'Le mot de passe doit faire au moins 6 caractères.'); return; }
    const result = await signUpWithPassword(email.trim(), password);
    if (result.error) { showAlert('Erreur', result.error); return; }
    if (result.needsEmailConfirmation) {
      showAlert('Vérifiez votre email', 'Un lien de confirmation vous a été envoyé. Cliquez dessus, puis revenez vous connecter ici.');
      setMode('login');
    }
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) showAlert('Erreur Google', error);
  };

  const Shadow = { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 };
  const ShadowSm = { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 };
  const inputStyle = { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={[styles.heroArea, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
          <Image source={require('@/assets/images/hero-kitchen.jpg')} style={StyleSheet.absoluteFillObject as any} contentFit="cover" transition={300} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(44,24,16,0.5)' }]} />
          <View style={styles.heroContent}>
            <Text style={styles.appName}>123Cuisine</Text>
            <Text style={styles.tagline}>Vos recettes, vos courses, votre cuisine.</Text>
          </View>
        </View>

        <ScreenContainer style={{ maxWidth: 480 }}>
        {/* Form card */}
        <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow }]}>
          <View style={[styles.tabRow, { backgroundColor: Colors.surfaceMuted }]}>
            {(['login', 'register'] as Mode[]).map(m => (
              <Pressable key={m} style={[styles.tab, mode === m && { backgroundColor: Colors.surface, ...ShadowSm }]} onPress={() => setMode(m)}>
                <Text style={[styles.tabText, { color: mode === m ? Colors.primary : Colors.textMuted, fontWeight: mode === m ? FontWeight.bold : FontWeight.medium }]}>{m === 'login' ? 'Connexion' : 'Inscription'}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.googleBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]} onPress={() => void handleGoogle()} disabled={operationLoading}>
            <MaterialIcons name="account-circle" size={20} color={Colors.text} />
            <Text style={[styles.googleBtnText, { color: Colors.text }]}>Continuer avec Google</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: Colors.border }]} />
            <Text style={[styles.dividerText, { color: Colors.textMuted }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: Colors.border }]} />
          </View>

          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Adresse email</Text>
            <TextInput style={inputStyle} placeholder="vous@exemple.fr" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Mot de passe</Text>
            <View style={[styles.passwordRow, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
              <TextInput style={[inputStyle, { flex: 1, borderRadius: Radius.md, borderWidth: 0 }]} placeholder="••••••••" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)} hitSlop={8}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {mode === 'register' ? (
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Confirmer le mot de passe</Text>
              <TextInput style={inputStyle} placeholder="••••••••" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
            </View>
          ) : null}

          <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.primary }]} onPress={() => void (mode === 'login' ? handleLogin() : handleRegister())} disabled={operationLoading}>
            {operationLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Se connecter' : "Créer mon compte"}</Text>}
          </Pressable>
        </View>

        <Text style={[styles.guestNote, { color: Colors.textMuted }]}>{"Utilisez l'app sans compte — vos données restent sur l'appareil."}</Text>
        <Pressable onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.guestLink, { color: Colors.primary }]}>{"Continuer sans compte →"}</Text>
        </Pressable>
        </ScreenContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroArea: { height: 200, borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.lg, position: 'relative' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: Spacing.lg },
  appName: { color: '#fff', fontSize: 32, fontWeight: FontWeight.bold },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.md, marginTop: 4 },
  card: { borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
  formSubtitle: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  tabRow: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
  tabText: { fontSize: FontSize.sm },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1.5, marginBottom: Spacing.md },
  googleBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: FontSize.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden' },
  eyeBtn: { paddingHorizontal: Spacing.md },
  primaryBtn: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  linkBtn: { alignItems: 'center', marginTop: Spacing.md },
  linkText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  guestNote: { textAlign: 'center', fontSize: FontSize.xs, marginBottom: 4 },
  guestLink: { textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
