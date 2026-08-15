//////////////////////////////////////////////////////////////////////////
//                            Compte.tsx                                //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran de profil/compte : infos utilisateur, export/import des données en JSON, déconnexion, accès aux réglages.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import { DIETARY_TAGS, ALLERGIES } from '@/constants/config';
import { Preferences, Recipe, ShoppingList, RecipePlaylist } from '@/services/kitchenService';
import * as kitchenService from '@/services/kitchenService';
import { ScreenContainer } from '@/components/ScreenContainer';

export default function CompteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { recipes, shoppingLists, playlists, preferences, updatePreferences, refreshAll } = useKitchen();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [newLiked, setNewLiked] = useState('');
  const [newDisliked, setNewDisliked] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => { setPrefs(preferences); }, [preferences]);

  useEffect(() => {
    if (user) {
      const loadUsername = async () => {
        try {
          const sb = getSupabaseClient();
          const { data } = await sb.from('user_profiles').select('username').eq('id', user.id).single();
          if (data) setCurrentUsername(data.username ?? null);
        } catch {}
      };
      void loadUsername();
    }
  }, [user]);

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || !user) { setShowUsernameModal(false); return; }
    setSavingUsername(true);
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.from('user_profiles').update({ username: trimmed }).eq('id', user.id);
      if (!error) {
        setCurrentUsername(trimmed);
        showAlert('Pseudo mis à jour', `Votre pseudo est maintenant "${trimmed}".`);
      } else {
        showAlert('Erreur', 'Impossible de mettre à jour le pseudo.');
      }
    } catch {
      showAlert('Erreur', 'Impossible de mettre à jour le pseudo.');
    } finally {
      setSavingUsername(false);
      setShowUsernameModal(false);
    }
  };

  const Shadow = {
    sm: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 4,
      elevation: 2,
    },
  };

  const handleLogout = () => {
    showAlert('Se déconnecter ?', 'Vos données restent sauvegardées dans le cloud.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        email: user.email,
        recipes,
        shoppingLists,
        playlists,
        preferences,
      };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `macuisine-export-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const FileSystem = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Exporter mes données' });
        } else {
          showAlert('Export terminé', `Fichier enregistré : ${fileUri}`);
        }
      }
    } catch {
      showAlert('Erreur', "Impossible d'exporter les données.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) { setImporting(false); return; }
      const asset = result.assets[0];

      let text: string;
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        text = await res.text();
      } else {
        const FileSystem = await import('expo-file-system');
        text = await FileSystem.readAsStringAsync(asset.uri);
      }

      const payload = JSON.parse(text) as {
        recipes?: Recipe[];
        shoppingLists?: ShoppingList[];
        playlists?: RecipePlaylist[];
        preferences?: Preferences;
      };

      let count = 0;
      for (const r of payload.recipes ?? []) {
        await kitchenService.addRecipe(r, user.id);
        count++;
      }
      for (const l of payload.shoppingLists ?? []) {
        await kitchenService.addShoppingList(l, user.id);
        count++;
      }
      for (const p of payload.playlists ?? []) {
        await kitchenService.addPlaylist(p, user.id);
        count++;
      }
      if (payload.preferences) {
        await kitchenService.savePreferences(payload.preferences, user.id);
      }
      await refreshAll();
      showAlert('Import réussi', `${count} élément(s) importé(s).`);
    } catch {
      showAlert('Erreur', "Impossible d'importer ce fichier. Vérifiez qu'il s'agit bien d'un export 123Cuisine.");
    } finally {
      setImporting(false);
    }
  };

  const save = async (updated: Preferences) => {
    setPrefs(updated);
    await updatePreferences(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addLiked = () => {
    if (!newLiked.trim()) return;
    const updated = { ...prefs, likedIngredients: [...prefs.likedIngredients, newLiked.trim()] };
    setNewLiked('');
    void save(updated);
  };

  const removeLiked = (name: string) => {
    void save({ ...prefs, likedIngredients: prefs.likedIngredients.filter(i => i !== name) });
  };

  const addDisliked = () => {
    if (!newDisliked.trim()) return;
    const updated = { ...prefs, dislikedIngredients: [...prefs.dislikedIngredients, newDisliked.trim()] };
    setNewDisliked('');
    void save(updated);
  };

  const removeDisliked = (name: string) => {
    void save({ ...prefs, dislikedIngredients: prefs.dislikedIngredients.filter(i => i !== name) });
  };

  const toggleDiet = (id: string) => {
    const tags = prefs.dietaryTags.includes(id)
      ? prefs.dietaryTags.filter(t => t !== id)
      : [...prefs.dietaryTags, id];
    void save({ ...prefs, dietaryTags: tags });
  };

  const toggleAllergy = (name: string) => {
    const allergies = prefs.allergies.includes(name)
      ? prefs.allergies.filter(a => a !== name)
      : [...prefs.allergies, name];
    void save({ ...prefs, allergies });
  };

  const inputStyle = {
    flex: 1 as const,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenContainer style={{ paddingTop: insets.top + Spacing.sm }}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Mon Compte</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {saved ? (
              <View style={[styles.savedBadge, { backgroundColor: Colors.secondary + '22' }]}>
                <MaterialIcons name="check" size={14} color={Colors.secondary} />
                <Text style={[styles.savedText, { color: Colors.secondary }]}>Enregistré</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── PROFILE CARD ── */}
        <View style={styles.section}>
          {user ? (
            <View style={[styles.profileCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <View style={[styles.avatar, { backgroundColor: Colors.primary + '20' }]}>
                <MaterialIcons name="person" size={36} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileEmail, { color: Colors.text }]}>
                  {currentUsername || user.email}
                </Text>
                {currentUsername ? (
                  <Text style={[styles.profileSubSmall, { color: Colors.textMuted }]}>{user.email}</Text>
                ) : null}
                <Text style={[styles.profileSub, { color: Colors.textSubtle }]}>Synchronisé avec le cloud ☁️</Text>
                <Pressable
                  onPress={() => { setUsernameInput(currentUsername ?? ''); setShowUsernameModal(true); }}
                  style={[styles.editUsernameBtn, { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '30' }]}
                >
                  <MaterialIcons name="edit" size={12} color={Colors.primary} />
                  <Text style={[styles.editUsernameText, { color: Colors.primary }]}>
                    {currentUsername ? 'Modifier le pseudo' : 'Ajouter un pseudo'}
                  </Text>
                </Pressable>
                <View style={styles.profileStats}>
                  <View style={[styles.statPill, { backgroundColor: Colors.primary + '12' }]}>
                    <MaterialIcons name="menu-book" size={13} color={Colors.primary} />
                    <Text style={[styles.statPillText, { color: Colors.primary }]}>{recipes.length} recettes</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: Colors.secondary + '12' }]}>
                    <MaterialIcons name="shopping-cart" size={13} color={Colors.secondary} />
                    <Text style={[styles.statPillText, { color: Colors.secondary }]}>{shoppingLists.length} listes</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: Colors.accent + '12' }]}>
                    <MaterialIcons name="playlist-play" size={13} color={Colors.accent} />
                    <Text style={[styles.statPillText, { color: Colors.accent }]}>{playlists.length} playlists</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.profileCard, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <View style={[styles.avatar, { backgroundColor: Colors.surfaceMuted }]}>
                <MaterialIcons name="person-outline" size={36} color={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileEmail, { color: Colors.text }]}>Mode hors ligne</Text>
                <Text style={[styles.profileSub, { color: Colors.textSubtle }]}>Connectez-vous pour synchroniser vos données</Text>
                <Pressable
                  style={[styles.loginBtn, { backgroundColor: Colors.primary }]}
                  onPress={() => router.push('/login')}
                >
                  <MaterialIcons name="login" size={16} color="#fff" />
                  <Text style={styles.loginBtnText}>Se connecter / Créer un compte</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── ACTIONS ── */}
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <Pressable style={styles.menuRow} onPress={() => router.push('/settings')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.primary + '15' }]}>
                <MaterialIcons name="settings" size={20} color={Colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Paramètres</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
            {user ? (
              <>
                <View style={[styles.divider, { backgroundColor: Colors.borderLight }]} />
                <Pressable style={styles.menuRow} onPress={() => router.push('/notifications')}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.accent + '15' }]}>
                    <MaterialIcons name="notifications" size={20} color={Colors.accent} />
                  </View>
                  <Text style={[styles.menuLabel, { color: Colors.text }]}>Notifications</Text>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                </Pressable>
              </>
            ) : null}
            <View style={[styles.divider, { backgroundColor: Colors.borderLight }]} />
            <Pressable style={styles.menuRow} onPress={() => router.push('/create-recipe')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.secondary + '15' }]}>
                <MaterialIcons name="add-circle-outline" size={20} color={Colors.secondary} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Nouvelle recette</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: Colors.borderLight }]} />
            <Pressable style={styles.menuRow} onPress={() => router.push('/create-list')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.accent + '15' }]}>
                <MaterialIcons name="playlist-add" size={20} color={Colors.accent} />
              </View>
              <Text style={[styles.menuLabel, { color: Colors.text }]}>Nouvelle liste de courses</Text>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
            {user ? (
              <>
                <View style={[styles.divider, { backgroundColor: Colors.borderLight }]} />
                <Pressable style={styles.menuRow} onPress={handleLogout}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.error + '15' }]}>
                    <MaterialIcons name="logout" size={20} color={Colors.error} />
                  </View>
                  <Text style={[styles.menuLabel, { color: Colors.error }]}>Se déconnecter</Text>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.error} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* ── SAUVEGARDE ── */}
        {user ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Sauvegarde</Text>
            <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Exportez vos données ou restaurez-les sur un autre backend</Text>
            <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
              <Pressable style={styles.menuRow} onPress={() => void handleExportData()} disabled={exporting}>
                <View style={[styles.menuIcon, { backgroundColor: Colors.secondary + '15' }]}>
                  {exporting ? <ActivityIndicator size="small" color={Colors.secondary} /> : <MaterialIcons name="file-download" size={20} color={Colors.secondary} />}
                </View>
                <Text style={[styles.menuLabel, { color: Colors.text }]}>Exporter mes données</Text>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: Colors.borderLight }]} />
              <Pressable style={styles.menuRow} onPress={() => void handleImportData()} disabled={importing}>
                <View style={[styles.menuIcon, { backgroundColor: Colors.accent + '15' }]}>
                  {importing ? <ActivityIndicator size="small" color={Colors.accent} /> : <MaterialIcons name="file-upload" size={20} color={Colors.accent} />}
                </View>
                <Text style={[styles.menuLabel, { color: Colors.text }]}>Importer mes données</Text>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── DIETARY TAGS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Régimes alimentaires</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.tagGrid}>
              {DIETARY_TAGS.map(tag => {
                const isActive = prefs.dietaryTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.dietTag, { backgroundColor: isActive ? Colors.primary + '15' : Colors.surfaceMuted, borderColor: isActive ? Colors.primary : Colors.border }]}
                    onPress={() => toggleDiet(tag.id)}
                  >
                    <Text>{tag.emoji}</Text>
                    <Text style={[styles.dietTagText, { color: isActive ? Colors.primary : Colors.textSubtle, fontWeight: isActive ? FontWeight.semibold : FontWeight.medium }]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── ALLERGIES ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Allergies & intolérances</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            {ALLERGIES.map((allergy, idx) => {
              const isActive = prefs.allergies.includes(allergy);
              return (
                <Pressable key={allergy} style={[styles.allergyRow, { borderBottomColor: Colors.borderLight, borderBottomWidth: idx < ALLERGIES.length - 1 ? 1 : 0 }]} onPress={() => toggleAllergy(allergy)}>
                  <Text style={[styles.allergyLabel, { color: Colors.text }]}>{allergy}</Text>
                  <Switch value={isActive} onValueChange={() => toggleAllergy(allergy)} trackColor={{ false: Colors.border, true: Colors.primary + '80' }} thumbColor={isActive ? Colors.primary : '#f4f3f4'} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── LIKED INGREDIENTS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Ingrédients favoris ❤️</Text>
          <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Influence les recommandations IA</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.inputRow}>
              <TextInput style={inputStyle} placeholder="Ajouter un ingrédient..." placeholderTextColor={Colors.textMuted} value={newLiked} onChangeText={setNewLiked} onSubmitEditing={addLiked} returnKeyType="done" />
              <Pressable style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={addLiked}><MaterialIcons name="add" size={20} color="#fff" /></Pressable>
            </View>
            <View style={styles.chipList}>
              {prefs.likedIngredients.map(name => (
                <View key={name} style={[styles.chip, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: Colors.primary }]}>{name}</Text>
                  <Pressable onPress={() => removeLiked(name)} hitSlop={8}><MaterialIcons name="close" size={14} color={Colors.primary} /></Pressable>
                </View>
              ))}
              {prefs.likedIngredients.length === 0 ? <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' }}>Aucun ingrédient favori</Text> : null}
            </View>
          </View>
        </View>

        {/* ── DISLIKED INGREDIENTS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>À éviter 🚫</Text>
          <Text style={[styles.sectionHint, { color: Colors.textMuted }]}>Ces ingrédients seront exclus des recommandations</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.inputRow}>
              <TextInput style={inputStyle} placeholder="Ingrédient à éviter..." placeholderTextColor={Colors.textMuted} value={newDisliked} onChangeText={setNewDisliked} onSubmitEditing={addDisliked} returnKeyType="done" />
              <Pressable style={[styles.addBtn, { backgroundColor: Colors.textMuted }]} onPress={addDisliked}><MaterialIcons name="add" size={20} color="#fff" /></Pressable>
            </View>
            <View style={styles.chipList}>
              {prefs.dislikedIngredients.map(name => (
                <View key={name} style={[styles.chip, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
                  <Text style={[styles.chipText, { color: Colors.textSubtle }]}>{name}</Text>
                  <Pressable onPress={() => removeDisliked(name)} hitSlop={8}><MaterialIcons name="close" size={14} color={Colors.textMuted} /></Pressable>
                </View>
              ))}
              {prefs.dislikedIngredients.length === 0 ? <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' }}>Aucun ingrédient à éviter</Text> : null}
            </View>
          </View>
        </View>

        {/* ── SERVINGS ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Portions par défaut</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.servingsRow}>
              <Text style={[styles.servingsLabel, { color: Colors.text }]}>Nombre de personnes</Text>
              <View style={styles.servingsControl}>
                <Pressable style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]} onPress={() => void save({ ...prefs, defaultServings: Math.max(1, prefs.defaultServings - 1) })}>
                  <MaterialIcons name="remove" size={18} color={Colors.primary} />
                </Pressable>
                <Text style={[styles.servingsValue, { color: Colors.text }]}>{prefs.defaultServings}</Text>
                <Pressable style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]} onPress={() => void save({ ...prefs, defaultServings: Math.min(20, prefs.defaultServings + 1) })}>
                  <MaterialIcons name="add" size={18} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

      </ScreenContainer>

      {/* ── USERNAME MODAL ── */}
      <Modal visible={showUsernameModal} transparent animationType="fade" onRequestClose={() => setShowUsernameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowUsernameModal(false)}>
            <Pressable style={[styles.usernameModal, { backgroundColor: Colors.surface }]} onPress={() => {}}>
              <Text style={[styles.usernameModalTitle, { color: Colors.text }]}>Modifier le pseudo</Text>
              <Text style={[styles.usernameModalSub, { color: Colors.textSubtle }]}>
                Votre pseudo est visible par les autres utilisateurs de la communauté
              </Text>
              <TextInput
                style={[styles.usernameInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]}
                placeholder="Votre pseudo..."
                placeholderTextColor={Colors.textMuted}
                value={usernameInput}
                onChangeText={setUsernameInput}
                autoFocus
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.usernameModalBtns}>
                <Pressable style={[styles.usernameBtn, { borderColor: Colors.border }]} onPress={() => setShowUsernameModal(false)}>
                  <Text style={[styles.usernameBtnText, { color: Colors.textSubtle }]}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.usernameBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                  onPress={() => void handleSaveUsername()} disabled={savingUsername}
                >
                  {savingUsername
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[styles.usernameBtnText, { color: '#fff' }]}>Enregistrer</Text>}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
  savedText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  section: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: 2 },
  sectionHint: { fontSize: FontSize.xs, marginBottom: Spacing.sm },
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  divider: { height: 1, marginVertical: 4 },
  profileCard: { borderRadius: Radius.xl, padding: Spacing.md, flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  profileEmail: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  profileSubSmall: { fontSize: 11, marginTop: 1 },
  profileSub: { fontSize: FontSize.xs, marginTop: 2, marginBottom: Spacing.sm },
  editUsernameBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.round, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 6 },
  editUsernameText: { fontSize: 11, fontWeight: FontWeight.semibold },
  profileStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.round },
  statPillText: { fontSize: 11, fontWeight: FontWeight.semibold },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, marginTop: 8 },
  loginBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  menuIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dietTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.round, borderWidth: 1 },
  dietTagText: { fontSize: FontSize.sm },
  allergyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  allergyLabel: { fontSize: FontSize.md },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  addBtn: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  chipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  servingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servingsLabel: { fontSize: FontSize.md },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  servingsBtn: { width: 36, height: 36, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  servingsValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, minWidth: 30, textAlign: 'center' },
  // Username modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  usernameModal: { width: '100%', borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  usernameModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  usernameModalSub: { fontSize: FontSize.xs, lineHeight: 18 },
  usernameInput: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, borderWidth: 1, marginTop: 4 },
  usernameModalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  usernameBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  usernameBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
