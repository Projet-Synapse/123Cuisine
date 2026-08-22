//////////////////////////////////////////////////////////////////////////
//                            🔤 Themed.tsx                              //
//////////////////////////////////////////////////////////////////////////

/*
 * <Text> et <TextInput> qui appliquent la police choisie par l'utilisateur.
 *
 * Pourquoi passer par des composants plutôt que par les feuilles de style ?
 * La police n'est pas une valeur numérique qu'on peut mettre à l'échelle comme
 * la taille ou l'arrondi : il faut la poser sur chaque élément de texte de
 * l'app. Les injecter ici évite d'avoir à toucher les centaines de règles de
 * style existantes, et gère un cas que `fontWeight` seul ne couvre pas : avec
 * Inter, chaque graisse est une police distincte (Inter_700Bold…), poser
 * fontWeight: '700' ne suffirait pas sur Android.
 *
 * La famille est placée EN PREMIER dans le tableau de styles : n'importe quel
 * style explicite passé en prop peut donc encore la remplacer (par exemple le
 * bloc de débogage à chasse fixe dans À propos).
 *
 * Usage : remplacer `import { Text } from 'react-native'` par
 * `import { Text } from '@/components/Themed'`.
 */

import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

export function Text({ style, ...props }: TextProps) {
  const { fontFor } = useAppTheme();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const family = fontFor(flat?.fontWeight);
  return <RNText {...props} style={family ? [{ fontFamily: family }, style] : style} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  const { fontFor } = useAppTheme();
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const family = fontFor(flat?.fontWeight);
  return <RNTextInput {...props} style={family ? [{ fontFamily: family }, style] : style} />;
}
