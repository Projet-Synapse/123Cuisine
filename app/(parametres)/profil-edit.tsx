//////////////////////////////////////////////////////////////////////////
//                          ✏️ ProfilEdit.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Modification du profil : photo, couleur d'avatar de repli, pseudo, nom
 * affiché et bio. Le pseudo et la photo sont visibles par la communauté.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuth, useAlert } from '@/template';
import { ACCENT_SWATCHES } from '@/constants/theme';
import { getAvatarColor, getInitials } from '@/utils/avatar';
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatarImage,
  type UserProfileRecord,
} from '@/services/parametres/profileService';
import { isValidUsername, USERNAME_RULE_TEXT } from '@/utils/username';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { SettingsPage, SettingsSection, SettingsCard } from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

const MAX_BIO = 160;

export default function ProfilEditScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = await getMyProfile(user.id);
      if (cancelled) return;
      if (p) {
        setProfile(p);
        setUsername(p.username ?? '');
        setDisplayName(p.displayName ?? '');
        setBio(p.bio ?? '');
        setAvatarUrl(p.avatarUrl);
        setAvatarColor(p.avatarColor);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const pickAvatar = async (fromCamera: boolean) => {
    if (!user) return;
    const ImagePicker = await import('expo-image-picker');
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission refusée', "L'accès à la caméra est requis.");
        return;
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    const url = await uploadAvatarImage(result.assets[0].uri, user.id);
    setUploading(false);
    if (!url) {
      showAlert('Envoi impossible', "La photo n'a pas pu être envoyée. Vérifie ta connexion.");
      return;
    }
    setAvatarUrl(url);
  };

  const showPhotoOptions = () => {
    showAlert('Photo de profil', 'Choisis une source', [
      { text: 'Galerie', onPress: () => void pickAvatar(false) },
      { text: 'Appareil photo', onPress: () => void pickAvatar(true) },
      ...(avatarUrl
        ? [{ text: 'Retirer la photo', style: 'destructive' as const, onPress: () => setAvatarUrl(null) }]
        : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const handleSave = async () => {
    if (!user) return;

    // Le pseudo sert aussi d'identifiant de connexion depuis la 1.2.6 : un
    // pseudo mal formé ne se retaperait pas à l'identique sur l'écran de
    // connexion. On refuse ici plutôt que d'enfermer quelqu'un dehors.
    const pseudo = username.trim();
    if (pseudo && !isValidUsername(pseudo)) {
      showAlert('Pseudo invalide', USERNAME_RULE_TEXT);
      return;
    }

    setSaving(true);
    const error = await updateMyProfile(user.id, {
      username: pseudo || null,
      displayName: displayName.trim() || null,
      bio: bio.trim() || null,
      avatarUrl,
      avatarColor,
    });
    setSaving(false);
    if (error) {
      showAlert('Enregistrement impossible', error);
      return;
    }
    showAlert('Profil mis à jour', 'Tes modifications sont enregistrées.');
    router.back();
  };

  if (!user) {
    return (
      <SettingsPage title="Modifier le profil">
        <SettingsSection>
          <SettingsCard>
            <Text style={styles.emptyText}>Connecte-toi pour créer ton profil.</Text>
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>
    );
  }

  const fallbackColor = getAvatarColor(user.id, avatarColor);
  const initials = getInitials({ displayName, username, email: user.email });

  return (
    <SettingsPage title="Modifier le profil" busy={loading || saving}>
      {/* ── Photo ── */}
      <SettingsSection label="PHOTO">
        <SettingsCard>
          <View style={styles.avatarRow}>
            <Pressable
              onPress={showPhotoOptions}
              style={styles.avatarPress}
              accessibilityLabel="Changer la photo de profil"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: fallbackColor, justifyContent: 'center', alignItems: 'center' },
                  ]}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: Colors.primary, borderColor: Colors.surface }]}>
                {uploading ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <MaterialIcons name="photo-camera" size={14} color={Colors.textOnPrimary} />
                )}
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>
                {avatarUrl
                  ? 'Ta photo est visible par la communauté.'
                  : "Sans photo, tes initiales s'affichent sur la couleur choisie ci-dessous."}
              </Text>
            </View>
          </View>

          <Text style={styles.subLabel}>Couleur de la pastille</Text>
          <View style={styles.colorRow}>
            {ACCENT_SWATCHES.map(c => (
              <Pressable
                key={c}
                onPress={() => setAvatarColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: avatarColor === c }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  avatarColor === c && { borderColor: Colors.text, borderWidth: 3 },
                ]}
              />
            ))}
            <Pressable
              onPress={() => setAvatarColor(null)}
              style={[
                styles.colorDot,
                styles.autoDot,
                { borderColor: Colors.border },
                avatarColor === null && { borderColor: Colors.text, borderWidth: 3 },
              ]}
            >
              <MaterialIcons name="auto-awesome" size={14} color={Colors.textSubtle} />
            </Pressable>
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── Identité ── */}
      <SettingsSection label="IDENTITÉ">
        <SettingsCard>
          <Text style={styles.subLabel}>Pseudo</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="catelina"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
          />
          <Text style={styles.fieldHint}>
            {`Ton identifiant public, visible sur tes recettes partagées — et celui avec lequel tu te connectes. ${USERNAME_RULE_TEXT}`}
          </Text>

          <View style={styles.spacer} />

          <Text style={styles.subLabel}>Nom affiché</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Catelina"
            placeholderTextColor={Colors.textMuted}
            maxLength={40}
          />

          <View style={styles.spacer} />

          <Text style={styles.subLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={text => setBio(text.slice(0, MAX_BIO))}
            placeholder="Deux mots sur ta cuisine…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{`${bio.length}/${MAX_BIO}`}</Text>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection label="COMPTE">
        <SettingsCard>
          <Text style={styles.subLabel}>Adresse e-mail</Text>
          <Text style={styles.readonly}>{profile?.email || user.email}</Text>
          <Text style={styles.fieldHint}>{"L'e-mail se change depuis Compte & sécurité."}</Text>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: Colors.primary }, saving && { opacity: 0.6 }]}
          onPress={() => void handleSave()}
          disabled={saving || loading}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <MaterialIcons name="check" size={18} color={Colors.textOnPrimary} />
          )}
          <Text style={styles.saveText}>Enregistrer</Text>
        </Pressable>
      </SettingsSection>
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    avatarPress: { width: 76, height: 76 },
    avatar: { width: 76, height: 76, borderRadius: Radius.round },
    avatarInitials: { ...typo('xxl', 'bold'), color: '#FFFFFF' },
    avatarBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 28,
      height: 28,
      borderRadius: Radius.round,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },

    subLabel: { ...typo('xs', 'semibold'), color: Colors.textSubtle, marginBottom: 6 },
    hint: { ...typo('xs'), color: Colors.textMuted, lineHeight: 18 },
    fieldHint: { ...typo(11), color: Colors.textMuted, marginTop: 4, lineHeight: 16 },
    spacer: { height: Spacing.md },

    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    colorDot: { width: 34, height: 34, borderRadius: Radius.round, borderWidth: 0 },
    autoDot: { backgroundColor: 'transparent', borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

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
    bioInput: { minHeight: 84, paddingTop: 11 },
    counter: { ...typo(10), color: Colors.textMuted, textAlign: 'right', marginTop: 4 },
    readonly: { ...typo('md'), color: Colors.textSubtle },

    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radius.md,
    },
    saveText: { ...typo('md', 'bold'), color: Colors.textOnPrimary },
    emptyText: { ...typo('sm'), color: Colors.textMuted },
  });
}
