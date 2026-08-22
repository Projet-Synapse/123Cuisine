//////////////////////////////////////////////////////////////////////////
//                            💾 Donnees.tsx                             //
//////////////////////////////////////////////////////////////////////////

/*
 * Mes données : export et import de tout le contenu au format JSON, aperçu de
 * ce qui est stocké, et remise à zéro des préférences alimentaires.
 *
 * L'export/import était auparavant enfoui dans l'onglet Compte.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useKitchen } from '@/hooks/useKitchen';
import { useAuth, useAlert } from '@/template';
import * as kitchenService from '@/services/kitchenService';
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type Recipe,
  type ShoppingList,
  type RecipePlaylist,
} from '@/services/kitchenService';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import {
  SettingsPage,
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsDivider,
} from '@/components/settings/SettingsKit';

type Tokens = ThemeContextType;

export default function DonneesScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { recipes, shoppingLists, playlists, preferences, updatePreferences, refreshAll } = useKitchen();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        email: user?.email ?? null,
        recipes,
        shoppingLists,
        playlists,
        preferences,
      };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `123cuisine-export-${new Date().toISOString().slice(0, 10)}.json`;

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

  const handleImport = async () => {
    setImporting(true);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) {
        setImporting(false);
        return;
      }
      const asset = result.assets[0];

      let text: string;
      if (Platform.OS === 'web') {
        text = await (await fetch(asset.uri)).text();
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
        await kitchenService.addRecipe(r, user?.id);
        count++;
      }
      for (const l of payload.shoppingLists ?? []) {
        await kitchenService.addShoppingList(l, user?.id);
        count++;
      }
      for (const p of payload.playlists ?? []) {
        await kitchenService.addPlaylist(p, user?.id);
        count++;
      }
      if (payload.preferences) {
        await kitchenService.savePreferences(payload.preferences, user?.id);
      }
      await refreshAll();
      showAlert('Import réussi', `${count} élément(s) importé(s).`);
    } catch {
      showAlert('Erreur', "Impossible d'importer ce fichier. Vérifie qu'il s'agit bien d'un export 123Cuisine.");
    } finally {
      setImporting(false);
    }
  };

  const handleResetPreferences = () => {
    showAlert(
      'Réinitialiser mes goûts ?',
      'Régimes, allergies et ingrédients reviendront aux valeurs de départ. Tes recettes ne sont pas touchées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => void updatePreferences({ ...DEFAULT_PREFERENCES }),
        },
      ],
    );
  };

  const stats = [
    { icon: 'menu-book' as const, label: 'Recettes', value: recipes.length, color: Colors.primary },
    {
      icon: 'shopping-cart' as const,
      label: 'Listes de courses',
      value: shoppingLists.length,
      color: Colors.secondary,
    },
    { icon: 'playlist-play' as const, label: 'Catégories', value: playlists.length, color: Colors.accent },
  ];

  return (
    <SettingsPage title="Mes données" subtitle={user ? 'Synchronisées avec ton compte' : 'Stockées sur cet appareil'}>
      <SettingsSection label="CE QUE TU AS CRÉÉ">
        <SettingsCard>
          <View style={styles.statRow}>
            {stats.map(s => (
              <View key={s.label} style={styles.stat}>
                <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                  <MaterialIcons name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        label="SAUVEGARDE"
        hint="Un fichier JSON qui contient tout : recettes, listes, catégories et préférences."
      >
        <SettingsCard>
          <SettingsRow
            icon="file-download"
            iconColor={Colors.secondary}
            label="Exporter mes données"
            description="Télécharge une copie complète"
            onPress={() => void handleExport()}
            busy={exporting}
          />
          <SettingsDivider />
          <SettingsRow
            icon="file-upload"
            iconColor={Colors.accent}
            label="Importer un fichier"
            description="Ajoute le contenu d'un export à ce compte"
            onPress={() => void handleImport()}
            busy={importing}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection label="REMISE À ZÉRO">
        <SettingsCard>
          <SettingsRow
            icon="restart-alt"
            label="Réinitialiser mes goûts"
            description="Régimes, allergies et ingrédients"
            onPress={handleResetPreferences}
            danger
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Radius, Spacing, typo } = t;
  return StyleSheet.create({
    statRow: { flexDirection: 'row', gap: Spacing.sm },
    stat: { flex: 1, alignItems: 'center', gap: 4 },
    statIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    statValue: { ...typo('xl', 'bold'), color: Colors.text },
    statLabel: { ...typo('xs'), color: Colors.textMuted, textAlign: 'center' },
  });
}
