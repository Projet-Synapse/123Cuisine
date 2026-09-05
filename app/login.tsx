//////////////////////////////////////////////////////////////////////////
//                             🔐 Login.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran de connexion / inscription : pseudo + mot de passe, Google, ou accès
 * invité sans compte.
 *
 * On se connecte avec son PSEUDO. Supabase, lui, n'authentifie que par e-mail :
 * la traduction se fait dans la fonction Edge `username-auth`
 * (cf. services/auth/usernameAuth.ts). Le champ accepte aussi une adresse
 * e-mail — les comptes créés avant les pseudos n'en ont pas encore, et
 * personne ne doit se retrouver enfermé dehors.
 *
 * SOMMAIRE
 * Chap 1. État et retour de Google
 * Chap 2. Connexion
 * Chap 3. Inscription
 * Chap 4. Rendu
 * Chap 5. Styles
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { isValidUsername, looksLikeEmail, USERNAME_RULE_TEXT } from '@/utils/username';
import { isUsernameAvailable, signInWithUsername } from '@/services/auth/usernameAuth';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useAppTheme();
  const { Colors, Radius, FontSize } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user, signInWithPassword, signUpWithPassword, signInWithGoogle, operationLoading } =
    useAuth();
  const { showAlert } = useAlert();

/////////////////////////////// Chap 1. État et retour de Google ///////////////////////////////

  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const working = operationLoading || busy;

  /*
   * Une connexion réussie ne navigue pas toute seule : AuthRouter, qui s'en
   * charge d'habitude, est monté sur la route « / » et pas ici. Sans cet effet,
   * le mot de passe était bien accepté par Supabase et l'écran ne bougeait pas.
   * Couvre aussi le retour de Google, qui arrive par onAuthStateChange.
   */
  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user, router]);

  /*
   * Quand l'échange du code échoue côté Supabase (secret Google périmé, adresse
   * de retour non autorisée…), on est renvoyé ici avec l'erreur dans l'URL —
   * et, sans ce qui suit, aucun message : l'écran de connexion réapparaissait
   * simplement, comme si rien ne s'était passé.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search.replace(/^\?/, ''));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = query.get('error_description') ?? hash.get('error_description');
    const code = query.get('error') ?? hash.get('error');
    if (!description && !code) return;
    setOauthError(description || code);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

/////////////////////////////// Chap 2. Connexion ///////////////////////////////

  const handleLogin = async () => {
    const login = identifier.trim();
    if (!login || !password.trim()) {
      showAlert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }

    // Une adresse e-mail passe par le chemin habituel de Supabase ; un pseudo
    // fait le détour par la fonction Edge qui retrouve le compte.
    if (looksLikeEmail(login)) {
      const { error } = await signInWithPassword(login, password);
      if (error) showAlert('Connexion échouée', error);
      return;
    }

    if (!isValidUsername(login)) {
      showAlert('Pseudo invalide', USERNAME_RULE_TEXT);
      return;
    }

    setBusy(true);
    try {
      const { error } = await signInWithUsername(login, password);
      if (error) showAlert('Connexion échouée', error);
    } finally {
      setBusy(false);
    }
  };

/////////////////////////////// Chap 3. Inscription ///////////////////////////////

  const handleRegister = async () => {
    const pseudo = username.trim();
    if (!pseudo || !email.trim() || !password.trim()) {
      showAlert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    if (!isValidUsername(pseudo)) {
      showAlert('Pseudo invalide', USERNAME_RULE_TEXT);
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      showAlert('Mot de passe trop court', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setBusy(true);
    try {
      // `null` = la question n'a pas pu être posée : on n'empêche pas
      // l'inscription pour autant, l'index unique en base tranchera.
      const available = await isUsernameAvailable(pseudo);
      if (available === false) {
        showAlert('Pseudo déjà pris', 'Choisissez-en un autre, celui-ci est occupé.');
        return;
      }

      const result = await signUpWithPassword(email.trim(), password, { username: pseudo });
      if (result.error) {
        showAlert('Erreur', result.error);
        return;
      }
      if (result.needsEmailConfirmation) {
        showAlert(
          'Vérifiez votre email',
          'Un lien de confirmation vous a été envoyé. Cliquez dessus, puis revenez vous connecter ici avec votre pseudo.',
        );
        setIdentifier(pseudo);
        setMode('login');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setOauthError(null);
    const { error } = await signInWithGoogle();
    if (error) showAlert('Erreur Google', error);
  };

/////////////////////////////// Chap 4. Rendu ///////////////////////////////

  const Shadow = {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  };
  const ShadowSm = {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  };
  const inputStyle = {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={[styles.heroArea, { maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
          <Image
            source={require('@/assets/images/hero-kitchen.jpg')}
            style={StyleSheet.absoluteFillObject as any}
            contentFit="cover"
            transition={300}
          />
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
                <Pressable
                  key={m}
                  style={[styles.tab, mode === m && { backgroundColor: Colors.surface, ...ShadowSm }]}
                  onPress={() => setMode(m)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: mode === m ? Colors.primary : Colors.textMuted,
                        fontWeight: mode === m ? FontWeight.bold : FontWeight.medium,
                      },
                    ]}
                  >
                    {m === 'login' ? 'Connexion' : 'Inscription'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {oauthError ? (
              <View style={[styles.oauthError, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.error }]}>
                <MaterialIcons name="error-outline" size={18} color={Colors.error} />
                <Text style={[styles.oauthErrorText, { color: Colors.text }]}>
                  {oauthError.includes('redirect') || oauthError.includes('not allowed') || oauthError.includes('URL')
                    ? 'Connexion Google refusée : adresse de retour non autorisée. Ajoutez https://projet-synapse.github.io/123Cuisine/login dans Supabase → Authentication → URL Configuration → Redirect URLs.'
                    : `Connexion Google refusée : ${oauthError}`}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.googleBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
              onPress={() => void handleGoogle()}
              disabled={working}
            >
              <MaterialIcons name="account-circle" size={20} color={Colors.text} />
              <Text style={[styles.googleBtnText, { color: Colors.text }]}>Continuer avec Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: Colors.border }]} />
              <Text style={[styles.dividerText, { color: Colors.textMuted }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: Colors.border }]} />
            </View>

            {mode === 'login' ? (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Pseudo</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="votre pseudo"
                  placeholderTextColor={Colors.textMuted}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.fieldHint, { color: Colors.textMuted }]}>
                  {'Votre adresse e-mail fonctionne aussi.'}
                </Text>
              </View>
            ) : (
              <>
                <View style={{ marginBottom: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Pseudo</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="votre pseudo"
                    placeholderTextColor={Colors.textMuted}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.fieldHint, { color: Colors.textMuted }]}>
                    {USERNAME_RULE_TEXT}
                  </Text>
                </View>

                <View style={{ marginBottom: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Adresse email</Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="vous@exemple.fr"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={[styles.fieldHint, { color: Colors.textMuted }]}>
                    {'Sert à confirmer le compte et à récupérer un mot de passe oublié.'}
                  </Text>
                </View>
              </>
            )}

            <View style={{ marginBottom: Spacing.md }}>
              <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Mot de passe</Text>
              <View style={[styles.passwordRow, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
                <TextInput
                  style={[inputStyle, { flex: 1, borderRadius: Radius.md, borderWidth: 0 }]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)} hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {mode === 'register' ? (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.fieldLabel, { color: Colors.textSubtle }]}>Confirmer le mot de passe</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
              onPress={() => void (mode === 'login' ? handleLogin() : handleRegister())}
              disabled={working}
            >
              {working ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>
              )}
            </Pressable>
          </View>

          <Text style={[styles.guestNote, { color: Colors.textMuted }]}>
            {"Utilisez l'app sans compte — vos données restent sur l'appareil."}
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)')}>
            <Text style={[styles.guestLink, { color: Colors.primary }]}>{'Continuer sans compte →'}</Text>
          </Pressable>
        </ScreenContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/////////////////////////////// Chap 5. Styles ///////////////////////////////

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    heroArea: {
      height: 200,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      marginBottom: Spacing.lg,
      position: 'relative',
    },
    heroContent: { flex: 1, justifyContent: 'flex-end', padding: Spacing.lg },
    appName: { color: '#fff', fontSize: 32, fontWeight: FontWeight.bold },
    tagline: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.md, marginTop: 4 },
    card: { borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
    formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginBottom: 4 },
    formSubtitle: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
    tabRow: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, marginBottom: Spacing.lg },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
    tabText: { fontSize: FontSize.sm },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 13,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      marginBottom: Spacing.md,
    },
    googleBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: FontSize.sm },
    fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 6 },
    fieldHint: { fontSize: FontSize.xs, marginTop: 5 },
    oauthError: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    oauthErrorText: { flex: 1, fontSize: FontSize.sm },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    eyeBtn: { paddingHorizontal: Spacing.md },
    primaryBtn: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
    primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
    linkBtn: { alignItems: 'center', marginTop: Spacing.md },
    linkText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    guestNote: { textAlign: 'center', fontSize: FontSize.xs, marginBottom: 4 },
    guestLink: { textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  });
};
