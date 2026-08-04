// Powered by OnSpace.AI
import { Platform } from 'react-native';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sur web, Print.printAsync({ html }) de expo-print ignore le HTML fourni et
// appelle juste window.print() sur la page actuelle — on ouvre donc une fenêtre
// dédiée avec le HTML généré et on l'imprime, elle.
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return;
  }

  const Print = await import('expo-print');
  await Print.printAsync({ html });
}
