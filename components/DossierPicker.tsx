//////////////////////////////////////////////////////////////////////////
//                         📁 DossierPicker.tsx                          //
//////////////////////////////////////////////////////////////////////////

/*
 * Choix des dossiers d'une catégorie, partagé par la création et la
 * modification.
 *
 * Pourquoi ce composant existe : jusqu'ici, créer une catégorie écrivait
 * `dossierIds: []` en dur. Même en partant de l'intérieur d'un dossier, la
 * catégorie atterrissait donc systématiquement à la racine, et le seul moyen
 * de la ranger était de la retrouver puis de passer par le menu d'affectation.
 *
 * Une catégorie peut appartenir à plusieurs dossiers — ce sont des étiquettes,
 * pas des tiroirs exclusifs (cf. Categorie.dossierIds). D'où des cases à
 * cocher plutôt qu'un choix unique.
 *
 * Le composant charge lui-même la liste des dossiers : les écrans qui
 * l'utilisent n'ont rien à préparer.
 *
 * SOMMAIRE
 * Chap 1. Mise à plat de l'arborescence
 * Chap 2. Composant
 * Chap 3. Styles
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, FontWeight } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { useAuth } from '@/template';
import { getDossiers, type Dossier } from '@/services/kitchenService';

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/////////////////////////////// Chap 1. Arborescence ///////////////////////////////

interface Row {
  dossier: Dossier;
  depth: number;
}

/*
 * Les dossiers sont imbriqués par `parentId`. On les met à plat en respectant
 * l'ordre d'affichage (un dossier suivi de ses enfants) et en retenant la
 * profondeur, qui sert à l'indentation.
 */
function flatten(all: Dossier[], parentId: string | null = null, depth = 0): Row[] {
  return all
    .filter(d => d.parentId === parentId)
    .flatMap(d => [{ dossier: d, depth }, ...flatten(all, d.id, depth + 1)]);
}

/////////////////////////////// Chap 2. Composant ///////////////////////////////

export function DossierPicker({ selectedIds, onChange }: Props) {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user } = useAuth();

  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await getDossiers(user?.id);
      if (!cancelled) {
        setDossiers(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const rows = useMemo(() => flatten(dossiers), [dossiers]);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={[styles.placeholder, { backgroundColor: Colors.surfaceMuted, borderColor: Colors.border }]}>
        <Text style={[styles.placeholderText, { color: Colors.textMuted }]}>
          {"Aucun dossier pour l'instant. Vous pourrez en créer depuis l'onglet Catégories."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map(({ dossier, depth }) => {
        const checked = selectedIds.includes(dossier.id);
        return (
          <Pressable
            key={dossier.id}
            onPress={() => toggle(dossier.id)}
            style={[
              styles.row,
              {
                marginLeft: depth * Spacing.md,
                backgroundColor: checked ? dossier.color + '1A' : Colors.surfaceMuted,
                borderColor: checked ? dossier.color : Colors.border,
              },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <MaterialIcons
              name={checked ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={checked ? dossier.color : Colors.textMuted}
            />
            <MaterialIcons name="folder" size={18} color={dossier.color} />
            <Text style={[styles.rowLabel, { color: Colors.text }]} numberOfLines={1}>
              {dossier.name}
            </Text>
          </Pressable>
        );
      })}

      <Text style={[styles.hint, { color: Colors.textMuted }]}>
        {selectedIds.length === 0
          ? "Sans dossier, la catégorie apparaîtra à la racine de l'onglet Catégories."
          : `Rangée dans ${selectedIds.length} dossier${selectedIds.length > 1 ? 's' : ''}.`}
      </Text>
    </View>
  );
}

/////////////////////////////// Chap 3. Styles ///////////////////////////////

const makeStyles = (t: ThemeContextType) => {
  const { Radius, FontSize } = t;
  return StyleSheet.create({
    list: { gap: Spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    rowLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    placeholder: {
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    placeholderText: { fontSize: FontSize.sm, textAlign: 'center' },
    hint: { fontSize: FontSize.xs, marginTop: 4 },
  });
};
