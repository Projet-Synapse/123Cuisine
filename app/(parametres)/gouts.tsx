//////////////////////////////////////////////////////////////////////////
//                             🥗 Gouts.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Préférences alimentaires : régimes, allergies, ingrédients aimés et évités,
 * portions par défaut. Elles alimentent les recommandations.
 *
 * Fusionne les deux écrans qui faisaient doublon jusqu'ici (l'onglet
 * Préférences et la moitié basse de l'onglet Compte).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Switch } from 'react-native';
import { Text, TextInput } from '@/components/Themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { DIETARY_TAGS, ALLERGIES } from '@/constants/config';
import type { Preferences } from '@/services/kitchenService';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { SettingsPage, SettingsSection, SettingsCard } from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

export default function GoutsScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { preferences, updatePreferences } = useKitchen();

  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [newLiked, setNewLiked] = useState('');
  const [newDisliked, setNewDisliked] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  const save = async (updated: Preferences) => {
    setPrefs(updated);
    await updatePreferences(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTo = (field: 'likedIngredients' | 'dislikedIngredients', raw: string) => {
    const name = raw.trim();
    if (!name || prefs[field].includes(name)) return;
    void save({ ...prefs, [field]: [...prefs[field], name] });
  };

  const removeFrom = (field: 'likedIngredients' | 'dislikedIngredients', name: string) =>
    void save({ ...prefs, [field]: prefs[field].filter(i => i !== name) });

  const toggleInList = (field: 'dietaryTags' | 'allergies', value: string) =>
    void save({
      ...prefs,
      [field]: prefs[field].includes(value) ? prefs[field].filter(v => v !== value) : [...prefs[field], value],
    });

  return (
    <SettingsPage
      title="Mes goûts"
      subtitle="Ce qui guide tes recommandations"
      headerRight={
        saved ? (
          <View style={[styles.savedBadge, { backgroundColor: Colors.secondary + '22' }]}>
            <MaterialIcons name="check" size={13} color={Colors.secondary} />
            <Text style={[styles.savedText, { color: Colors.secondary }]}>Enregistré</Text>
          </View>
        ) : undefined
      }
    >
      {/* ── Régimes ── */}
      <SettingsSection label="RÉGIMES ALIMENTAIRES">
        <SettingsCard>
          <View style={styles.tagGrid}>
            {DIETARY_TAGS.map(tag => {
              const active = prefs.dietaryTags.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleInList('dietaryTags', tag.id)}
                  style={[
                    styles.dietTag,
                    {
                      backgroundColor: active ? Colors.primary + '15' : Colors.surfaceMuted,
                      borderColor: active ? Colors.primary : Colors.border,
                    },
                  ]}
                >
                  <Text>{tag.emoji}</Text>
                  <Text style={[styles.dietTagText, { color: active ? Colors.primary : Colors.textSubtle }]}>
                    {tag.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── Allergies ── */}
      <SettingsSection label="ALLERGIES & INTOLÉRANCES">
        <SettingsCard>
          {ALLERGIES.map((allergy, idx) => {
            const active = prefs.allergies.includes(allergy);
            return (
              <Pressable
                key={allergy}
                onPress={() => toggleInList('allergies', allergy)}
                style={[
                  styles.allergyRow,
                  { borderBottomColor: Colors.borderLight, borderBottomWidth: idx < ALLERGIES.length - 1 ? 1 : 0 },
                ]}
              >
                <Text style={styles.allergyLabel}>{allergy}</Text>
                <Switch
                  value={active}
                  onValueChange={() => toggleInList('allergies', allergy)}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={active ? Colors.primary : Colors.surface}
                />
              </Pressable>
            );
          })}
        </SettingsCard>
      </SettingsSection>

      {/* ── Ingrédients favoris ── */}
      <SettingsSection label="INGRÉDIENTS FAVORIS ❤️" hint="Ils remontent dans les recommandations.">
        <SettingsCard>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ajouter un ingrédient…"
              placeholderTextColor={Colors.textMuted}
              value={newLiked}
              onChangeText={setNewLiked}
              onSubmitEditing={() => {
                addTo('likedIngredients', newLiked);
                setNewLiked('');
              }}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: Colors.primary }]}
              onPress={() => {
                addTo('likedIngredients', newLiked);
                setNewLiked('');
              }}
            >
              <MaterialIcons name="add" size={20} color={Colors.textOnPrimary} />
            </Pressable>
          </View>
          <View style={styles.chipList}>
            {prefs.likedIngredients.map(name => (
              <View
                key={name}
                style={[styles.chip, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
              >
                <Text style={[styles.chipText, { color: Colors.primary }]}>{name}</Text>
                <Pressable onPress={() => removeFrom('likedIngredients', name)} hitSlop={8}>
                  <MaterialIcons name="close" size={14} color={Colors.primary} />
                </Pressable>
              </View>
            ))}
            {prefs.likedIngredients.length === 0 ? <Text style={styles.emptyText}>Aucun ingrédient favori</Text> : null}
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── À éviter ── */}
      <SettingsSection label="À ÉVITER 🚫" hint="Ces ingrédients sont exclus des recommandations.">
        <SettingsCard>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ingrédient à éviter…"
              placeholderTextColor={Colors.textMuted}
              value={newDisliked}
              onChangeText={setNewDisliked}
              onSubmitEditing={() => {
                addTo('dislikedIngredients', newDisliked);
                setNewDisliked('');
              }}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: Colors.textMuted }]}
              onPress={() => {
                addTo('dislikedIngredients', newDisliked);
                setNewDisliked('');
              }}
            >
              <MaterialIcons name="add" size={20} color={Colors.surface} />
            </Pressable>
          </View>
          <View style={styles.chipList}>
            {prefs.dislikedIngredients.map(name => (
              <View
                key={name}
                style={[styles.chip, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}
              >
                <Text style={[styles.chipText, { color: Colors.textSubtle }]}>{name}</Text>
                <Pressable onPress={() => removeFrom('dislikedIngredients', name)} hitSlop={8}>
                  <MaterialIcons name="close" size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
            {prefs.dislikedIngredients.length === 0 ? (
              <Text style={styles.emptyText}>Aucun ingrédient à éviter</Text>
            ) : null}
          </View>
        </SettingsCard>
      </SettingsSection>

      {/* ── Portions ── */}
      <SettingsSection label="PORTIONS PAR DÉFAUT">
        <SettingsCard>
          <View style={styles.servingsRow}>
            <Text style={styles.servingsLabel}>Nombre de personnes</Text>
            <View style={styles.servingsControl}>
              <Pressable
                style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]}
                onPress={() => void save({ ...prefs, defaultServings: Math.max(1, prefs.defaultServings - 1) })}
              >
                <MaterialIcons name="remove" size={18} color={Colors.primary} />
              </Pressable>
              <Text style={styles.servingsValue}>{prefs.defaultServings}</Text>
              <Pressable
                style={[styles.servingsBtn, { backgroundColor: Colors.primary + '15' }]}
                onPress={() => void save({ ...prefs, defaultServings: Math.min(20, prefs.defaultServings + 1) })}
              >
                <MaterialIcons name="add" size={18} color={Colors.primary} />
              </Pressable>
            </View>
          </View>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Spacing, Radius, typo } = t;
  return StyleSheet.create({
    savedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: Radius.round,
    },
    savedText: { ...typo('xs', 'semibold') },

    tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    dietTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.round,
      borderWidth: 1,
    },
    dietTagText: { ...typo('sm', 'medium') },

    allergyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    allergyLabel: { ...typo('md'), color: Colors.text },

    inputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    input: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      color: Colors.text,
      ...typo('md'),
    },
    addBtn: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },

    chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.round,
      borderWidth: 1,
    },
    chipText: { ...typo('sm', 'medium') },
    emptyText: { ...typo('sm'), color: Colors.textMuted, fontStyle: 'italic' },

    servingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    servingsLabel: { ...typo('md'), color: Colors.text },
    servingsControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    servingsBtn: { width: 36, height: 36, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
    servingsValue: { ...typo('xl', 'bold'), color: Colors.text, minWidth: 30, textAlign: 'center' },
  });
}
