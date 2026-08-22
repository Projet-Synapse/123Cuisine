//////////////////////////////////////////////////////////////////////////
//                            NotFound.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Écran affiché quand une route ne correspond à rien (404).
 */

import React, { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Themed';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const t = useAppTheme();
  const { Colors } = t;
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="ramen-dining" size={54} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Cette page a brûlé</Text>
        <Text style={styles.message}>
          {"La recette que vous cherchez n'est pas au menu. Elle a peut-être été déplacée, ou supprimée."}
        </Text>

        <Pressable style={styles.homeButton} onPress={() => router.replace('/')}>
          <MaterialIcons name="home" size={18} color={Colors.textOnPrimary} />
          <Text style={styles.homeButtonText}>Retour à l&apos;accueil</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeContextType) => {
  const { Colors, Radius, typo } = t;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm },
    iconCircle: {
      width: 108,
      height: 108,
      borderRadius: Radius.round,
      backgroundColor: Colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    title: { ...typo('xxl', 'bold'), color: Colors.text, textAlign: 'center' },
    message: {
      ...typo('md'),
      color: Colors.textSubtle,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.lg,
      maxWidth: 380,
    },
    homeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      borderRadius: Radius.round,
    },
    homeButtonText: { ...typo('md', 'bold'), color: Colors.textOnPrimary },
  });
};
