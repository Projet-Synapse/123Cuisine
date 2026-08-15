//////////////////////////////////////////////////////////////////////////
//                           Preferences.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Préférences alimentaires (ingrédients aimés/évités, régimes, allergies) utilisées pour personnaliser les recommandations.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { DIETARY_TAGS, ALLERGIES } from '@/constants/config';
import { Preferences } from '@/services/kitchenService';

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { Colors } = useAppTheme();
  const { preferences, updatePreferences } = useKitchen();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [newLiked, setNewLiked] = useState('');
  const [newDisliked, setNewDisliked] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPrefs(preferences); }, [preferences]);

  const Shadow = { sm: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 } };

  const handleLogout = () => {
    showAlert('Se déconnecter ?', 'Vos données restent sauvegardées dans le cloud.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const save = async (updated: Preferences) => {
    await updatePreferences(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addLiked = () => {
    if (!newLiked.trim()) return;
    const updated = { ...prefs, likedIngredients: [...prefs.likedIngredients, newLiked.trim()] };
    setPrefs(updated); setNewLiked(''); void save(updated);
  };
  const removeLiked = (name: string) => { const updated = { ...prefs, likedIngredients: prefs.likedIngredients.filter(i => i !== name) }; setPrefs(updated); void save(updated); };
  const addDisliked = () => {
    if (!newDisliked.trim()) return;
    const updated = { ...prefs, dislikedIngredients: [...prefs.dislikedIngredients, newDisliked.trim()] };
    setPrefs(updated); setNewDisliked(''); void save(updated);
  };
  const removeDisliked = (name: string) => { const updated = { ...prefs, dislikedIngredients: prefs.dislikedIngredients.filter(i => i !== name) }; setPrefs(updated); void save(updated); };
  const toggleDiet = (id: string) => {
    const tags = prefs.dietaryTags.includes(id) ? prefs.dietaryTags.filter(t => t !== id) : [...prefs.dietaryTags, id];
    const updated = { ...prefs, dietaryTags: tags }; setPrefs(updated); void save(updated);
  };
  const toggleAllergy = (name: string) => {
    const allergies = prefs.allergies.includes(name) ? prefs.allergies.filter(a => a !== name) : [...prefs.allergies, name];
    const updated = { ...prefs, allergies }; setPrefs(updated); void save(updated);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: insets.top + Spacing.sm }}>

        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors.text }]}>Préférences</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            {saved ? (
              <View style={[styles.savedBadge, { backgroundColor: Colors.secondary + '20' }]}>
                <MaterialIcons name="check" size={14} color={Colors.secondary} />
                <Text style={[styles.savedText, { color: Colors.secondary }]}>Enregistré</Text>
              </View>
            ) : null}
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.settingsBtn}>
              <MaterialIcons name="settings" size={22} color={Colors.textSubtle} />
            </Pressable>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Compte</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            {user ? (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: Colors.primary + '15' }]}>
                    <MaterialIcons name="person" size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accountEmail, { color: Colors.text }]}>{user.email}</Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 }}>{"Connecté – données synchronisées ☁️"}</Text>
                  </View>
                </View>
                <Pressable style={[styles.logoutBtn, { borderColor: Colors.error + '40', backgroundColor: Colors.error + '08' }]} onPress={handleLogout}>
                  <MaterialIcons name="logout" size={16} color={Colors.error} />
                  <Text style={{ fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.semibold }}>Se déconnecter</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: Colors.surfaceMuted }]}>
                    <MaterialIcons name="person-outline" size={24} color={Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accountEmail, { color: Colors.text }]}>Mode hors ligne</Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textSubtle, marginTop: 2 }}>{"Données stockées sur l'appareil"}</Text>
                  </View>
                </View>
                <Pressable style={[styles.loginBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push('/login')}>
                  <MaterialIcons name="login" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm }}>{"Créer un compte / Se connecter"}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Régimes */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Régimes alimentaires</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.tagGrid}>
              {DIETARY_TAGS.map(tag => {
                const isActive = prefs.dietaryTags.includes(tag.id);
                return (
                  <Pressable key={tag.id} style={[styles.dietTag, { backgroundColor: isActive ? Colors.primary + '15' : Colors.surfaceMuted, borderColor: isActive ? Colors.primary : Colors.border }]} onPress={() => toggleDiet(tag.id)}>
                    <Text>{tag.emoji}</Text>
                    <Text style={[styles.dietTagText, { color: isActive ? Colors.primary : Colors.textSubtle, fontWeight: isActive ? FontWeight.semibold : FontWeight.medium }]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Allergies */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>{"Allergies & intolérances"}</Text>
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

        {/* Liked */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>{"Ingrédients favoris ❤️"}</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.tagInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder={"Ajouter un ingrédient..."} placeholderTextColor={Colors.textMuted} value={newLiked} onChangeText={setNewLiked} onSubmitEditing={addLiked} returnKeyType="done" />
              <Pressable style={[styles.addTagBtn, { backgroundColor: Colors.primary }]} onPress={addLiked}><MaterialIcons name="add" size={20} color="#fff" /></Pressable>
            </View>
            <View style={styles.tagList}>
              {prefs.likedIngredients.map(name => (
                <View key={name} style={[styles.likedTag, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}>
                  <Text style={[styles.likedTagText, { color: Colors.primary }]}>{name}</Text>
                  <Pressable onPress={() => removeLiked(name)} hitSlop={8}><MaterialIcons name="close" size={14} color={Colors.primary} /></Pressable>
                </View>
              ))}
              {prefs.likedIngredients.length === 0 ? <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' }}>Aucun ingrédient favori</Text> : null}
            </View>
          </View>
        </View>

        {/* Disliked */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>{"À éviter 🚫"}</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.tagInput, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border, color: Colors.text }]} placeholder={"Ingrédient à éviter..."} placeholderTextColor={Colors.textMuted} value={newDisliked} onChangeText={setNewDisliked} onSubmitEditing={addDisliked} returnKeyType="done" />
              <Pressable style={[styles.addTagBtn, { backgroundColor: Colors.textMuted }]} onPress={addDisliked}><MaterialIcons name="add" size={20} color="#fff" /></Pressable>
            </View>
            <View style={styles.tagList}>
              {prefs.dislikedIngredients.map(name => (
                <View key={name} style={[styles.likedTag, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
                  <Text style={[styles.likedTagText, { color: Colors.textSubtle }]}>{name}</Text>
                  <Pressable onPress={() => removeDisliked(name)} hitSlop={8}><MaterialIcons name="close" size={14} color={Colors.textMuted} /></Pressable>
                </View>
              ))}
              {prefs.dislikedIngredients.length === 0 ? <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' }}>Aucun ingrédient à éviter</Text> : null}
            </View>
          </View>
        </View>

        {/* Servings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Portions par défaut</Text>
          <View style={[styles.card, { backgroundColor: Colors.surface, ...Shadow.sm }]}>
            <View style={styles.servingsRow}>
              <Text style={[styles.servingsLabel, { color: Colors.text }]}>Nombre de personnes</Text>
              <View style={styles.servingsControl}>
                <Pressable style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]} onPress={() => { const u = { ...prefs, defaultServings: Math.max(1, prefs.defaultServings - 1) }; setPrefs(u); void save(u); }}>
                  <MaterialIcons name="remove" size={18} color={Colors.primary} />
                </Pressable>
                <Text style={[styles.servingsValue, { color: Colors.text }]}>{prefs.defaultServings}</Text>
                <Pressable style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]} onPress={() => { const u = { ...prefs, defaultServings: Math.min(20, prefs.defaultServings + 1) }; setPrefs(u); void save(u); }}>
                  <MaterialIcons name="add" size={18} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  settingsBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
  savedText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  section: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dietTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.round, borderWidth: 1 },
  dietTagText: { fontSize: FontSize.sm },
  allergyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  allergyLabel: { fontSize: FontSize.md },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  tagInput: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.md, borderWidth: 1 },
  addTagBtn: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  likedTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1 },
  likedTagText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  servingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servingsLabel: { fontSize: FontSize.md },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  servingsBtn: { width: 36, height: 36, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  servingsValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, minWidth: 30, textAlign: 'center' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatarCircle: { width: 48, height: 48, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
  accountEmail: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, alignSelf: 'flex-start' },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.md },
});
