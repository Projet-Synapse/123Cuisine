//////////////////////////////////////////////////////////////////////////
//                               Types.ts                               //
//////////////////////////////////////////////////////////////////////////

/*
 * Types du système d'alerte (boutons, état).
 */

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}