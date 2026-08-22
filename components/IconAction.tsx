//////////////////////////////////////////////////////////////////////////
//                          💬 IconAction.tsx                            //
//////////////////////////////////////////////////////////////////////////

/*
 * Bouton-icône avec bulle d'aide.
 *
 * Les barres d'action de l'app alignent des icônes sans libellé (modifier,
 * verrouiller, imprimer, supprimer…) : rien n'indique ce qu'elles font. Ce
 * composant leur ajoute une explication :
 *   - à la souris (desktop, web), la bulle apparaît après un temps de survol ;
 *   - au doigt (mobile), il n'y a pas de survol : l'appui long l'affiche.
 *
 * Le délai de survol est délégué à `delayHoverIn` de Pressable — React Native
 * le gère nativement, inutile de tenir un minuteur à la main.
 *
 * ⚠️ La bulle est positionnée en absolu par rapport au bouton : le conteneur
 * parent ne doit pas avoir `overflow: 'hidden'`, sinon elle sera rognée.
 */

import React, { useMemo, useState, ReactNode } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeContextType } from '@/contexts/ThemeContext';

type Tokens = ThemeContextType;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Délai de survol avant l'apparition de la bulle, en millisecondes.
 * 700 ms est le réglage habituel des logiciels : assez long pour ne pas
 * surgir quand on ne fait que traverser la barre d'icônes, assez court pour
 * qu'on la découvre en hésitant sur un bouton.
 */
export const TOOLTIP_DELAY_MS = 700;

/** Durée d'affichage après un appui long, sur mobile (pas de survol possible). */
const TOUCH_TOOLTIP_MS = 2200;

export interface IconActionProps {
  icon: IconName;
  /** Texte de la bulle. Sert aussi d'étiquette d'accessibilité. */
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
  /** Style du bouton lui-même (pas du conteneur qui porte la bulle). */
  style?: StyleProp<ViewStyle>;
  placement?: 'top' | 'bottom';
  disabled?: boolean;
  /** Contenu personnalisé à la place de l'icône (indicateur de chargement…). */
  children?: ReactNode;
}

export function IconAction({
  icon,
  label,
  onPress,
  color,
  size = 22,
  style,
  placement = 'bottom',
  disabled,
  children,
}: IconActionProps) {
  const t = useAppTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [visible, setVisible] = useState(false);

  const showForTouch = () => {
    setVisible(true);
    setTimeout(() => setVisible(false), TOUCH_TOOLTIP_MS);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={8}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={label}
        delayHoverIn={TOOLTIP_DELAY_MS}
        onHoverIn={() => setVisible(true)}
        onHoverOut={() => setVisible(false)}
        onLongPress={showForTouch}
        onPressOut={() => setVisible(false)}
      >
        {children ?? <MaterialIcons name={icon} size={size} color={color ?? t.Colors.text} />}
      </Pressable>

      {visible ? (
        <View
          style={[styles.bubble, placement === 'top' ? styles.bubbleTop : styles.bubbleBottom]}
          pointerEvents="none"
        >
          <Text style={styles.bubbleText} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: Tokens) {
  const { Colors, Radius, typo, Shadow } = t;
  return StyleSheet.create({
    wrapper: { position: 'relative' },
    bubble: {
      position: 'absolute',
      // Centrée sur le bouton : left/right négatifs laissent la bulle
      // déborder des deux côtés, et alignItems la recentre.
      left: -80,
      right: -80,
      alignItems: 'center',
      zIndex: 1000,
      elevation: 12,
    },
    bubbleTop: { bottom: '100%', marginBottom: 6 },
    bubbleBottom: { top: '100%', marginTop: 6 },
    bubbleText: {
      ...typo('xs', 'medium'),
      color: Colors.surface,
      backgroundColor: Colors.text,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: Radius.sm,
      overflow: 'hidden',
      textAlign: 'center',
      ...Shadow.sm,
    },
  });
}
