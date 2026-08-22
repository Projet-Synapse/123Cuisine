//////////////////////////////////////////////////////////////////////////
//                           🔐 Securite.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Compte & sécurité : méthode de connexion, changement d'e-mail et de mot de
 * passe, déconnexion, suppression définitive du compte.
 *
 * La suppression passe par la fonction Edge `delete-account` : l'API client de
 * Supabase ne peut pas supprimer un utilisateur (il faut la clé service role).
 * Si la fonction n'est pas déployée, on le dit clairement plutôt que d'échouer
 * en silence.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import {
  SettingsPage,
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsDivider,
} from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

const PROVIDER_LABELS: Record<string, { label: string; icon: 'mail' | 'account-circle' }> = {
  email: { label: 'Adresse e-mail et mot de passe', icon: 'mail' },
  google: { label: 'Compte Google', icon: 'account-circle' },
};

export default function SecuriteScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();

  const [providers, setProviders] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'password' | 'delete'>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const sb = getSupabaseClient();
        const { data } = await sb.auth.getUser();
        if (cancelled) return;
        const meta = data.user?.app_metadata as { provider?: string; providers?: string[] } | undefined;
        const list = meta?.providers ?? (meta?.provider ? [meta.provider] : []);
        setProviders(list);
      } catch {
        /* méthode de connexion inconnue : la section reste générique */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasPasswordLogin = providers.length === 0 || providers.includes('email');

  const handleChangeEmail = async () => {
    const email = newEmail.trim();
    if (!email.includes('@')) {
      showAlert('Adresse invalide', 'Saisis une adresse e-mail valide.');
      return;
    }
    setBusy('email');
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.auth.updateUser({ email });
      if (error) showAlert('Changement impossible', error.message);
      else {
        setNewEmail('');
        showAlert(
          'Vérifie ta boîte mail',
          `Un lien de confirmation a été envoyé à ${email}. L'adresse changera une fois le lien ouvert.`,
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const handleChangePassword = async () => {
    if (password.length < 6) {
      showAlert('Mot de passe trop court', 'Il doit faire au moins 6 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      showAlert('Les mots de passe diffèrent', 'Les deux champs doivent être identiques.');
      return;
    }
    setBusy('password');
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.auth.updateUser({ password });
      if (error) showAlert('Changement impossible', error.message);
      else {
        setPassword('');
        setPasswordConfirm('');
        showAlert('Mot de passe mis à jour', 'Utilise-le à ta prochaine connexion.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = () => {
    showAlert('Se déconnecter ?', 'Tes données restent sauvegardées dans le cloud.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await logout();
            router.replace('/login');
          })();
        },
      },
    ]);
  };

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.functions.invoke('delete-account', { body: {} });
      if (error) {
        showAlert(
          'Suppression indisponible',
          "La fonction serveur `delete-account` n'a pas répondu. Elle doit être déployée sur le projet Supabase avant que cette option fonctionne.",
        );
        return;
      }
      await logout();
      router.replace('/login');
    } catch {
      showAlert('Suppression indisponible', 'Impossible de contacter le serveur. Réessaie plus tard.');
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Supprimer définitivement le compte ?',
      'Toutes tes recettes, listes, catégories et préférences seront effacées. Cette action est irréversible — pense à exporter tes données avant.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Exporter mes données', onPress: () => router.push('/donnees') },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  };

  if (!user) {
    return (
      <SettingsPage title="Compte & sécurité">
        <SettingsSection>
          <SettingsCard>
            <Text style={styles.emptyText}>Tu navigues en mode hors ligne, sans compte.</Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push('/login')}
            >
              <MaterialIcons name="login" size={16} color={Colors.textOnPrimary} />
              <Text style={styles.primaryBtnText}>Se connecter / Créer un compte</Text>
            </Pressable>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Compte & sécurité" subtitle={user.email}>
      {/* ── Méthode de connexion ── */}
      <SettingsSection label="CONNEXION">
        <SettingsCard>
          {(providers.length ? providers : ['email']).map((p, idx) => {
            const info = PROVIDER_LABELS[p] ?? { label: p, icon: 'account-circle' as const };
            return (
              <View key={p}>
                {idx > 0 ? <SettingsDivider /> : null}
                <SettingsRow icon={info.icon} label={info.label} value="Actif" />
              </View>
            );
          })}
        </SettingsCard>
      </SettingsSection>

      {/* ── E-mail ── */}
      <SettingsSection
        label="ADRESSE E-MAIL"
        hint="Un lien de confirmation est envoyé à la nouvelle adresse avant tout changement."
      >
        <SettingsCard>
          <Text style={styles.subLabel}>Nouvelle adresse</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder={user.email}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Pressable
            style={[
              styles.secondaryBtn,
              { borderColor: Colors.primary + '50', backgroundColor: Colors.primary + '10' },
            ]}
            onPress={() => void handleChangeEmail()}
            disabled={busy !== null}
          >
            {busy === 'email' ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="alternate-email" size={16} color={Colors.primary} />
            )}
            <Text style={[styles.secondaryBtnText, { color: Colors.primary }]}>{"Changer d'adresse"}</Text>
          </Pressable>
        </SettingsCard>
      </SettingsSection>

      {/* ── Mot de passe ── */}
      <SettingsSection
        label="MOT DE PASSE"
        hint={
          hasPasswordLogin
            ? 'Au moins 6 caractères.'
            : 'Ton compte se connecte via un fournisseur externe. Définir un mot de passe ajoute une seconde façon de te connecter.'
        }
      >
        <SettingsCard>
          <Text style={styles.subLabel}>Nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={styles.spacer} />
          <Text style={styles.subLabel}>Confirmation</Text>
          <TextInput
            style={styles.input}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
          <Pressable
            style={[
              styles.secondaryBtn,
              { borderColor: Colors.primary + '50', backgroundColor: Colors.primary + '10' },
            ]}
            onPress={() => void handleChangePassword()}
            disabled={busy !== null}
          >
            {busy === 'password' ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="lock-reset" size={16} color={Colors.primary} />
            )}
            <Text style={[styles.secondaryBtnText, { color: Colors.primary }]}>Mettre à jour le mot de passe</Text>
          </Pressable>
        </SettingsCard>
      </SettingsSection>

      {/* ── Zone sensible ── */}
      <SettingsSection label="ZONE SENSIBLE">
        <SettingsCard>
          <SettingsRow
            icon="logout"
            label="Se déconnecter"
            description="Tes données restent dans le cloud"
            onPress={handleLogout}
            danger
          />
          <SettingsDivider />
          <SettingsRow
            icon="delete-forever"
            label="Supprimer mon compte"
            description="Effacement définitif de toutes tes données"
            onPress={handleDeleteAccount}
            busy={busy === 'delete'}
            danger
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    subLabel: { ...typo('xs', 'semibold'), color: Colors.textSubtle, marginBottom: 6 },
    spacer: { height: Spacing.sm },
    input: {
      backgroundColor: Colors.surfaceMuted,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      color: Colors.text,
      ...typo('md'),
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: Radius.md,
      borderWidth: 1,
      marginTop: Spacing.md,
    },
    secondaryBtnText: { ...typo('sm', 'semibold') },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.md,
      marginTop: Spacing.md,
    },
    primaryBtnText: { ...typo('sm', 'bold'), color: Colors.textOnPrimary },
    emptyText: { ...typo('sm'), color: Colors.textMuted, lineHeight: 20 },
  });
}
