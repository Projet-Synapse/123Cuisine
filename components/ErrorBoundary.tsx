//////////////////////////////////////////////////////////////////////////
//                         🛡️ ErrorBoundary.tsx                         //
//////////////////////////////////////////////////////////////////////////

/*
 * Filet de sécurité React global : capture les erreurs de rendu pour afficher un écran de repli au lieu d'une page blanche ou d'un plantage, sur toutes les plateformes.
 */

// Powered by OnSpace.AI
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Filet de sécurité global : une erreur de rendu dans n'importe quel écran
// affichait auparavant une page blanche (web/desktop) ou plantait l'app
// (natif), sans aucun moyen de s'en sortir. On capte l'erreur ici, on
// l'affiche proprement, et on laisse l'utilisateur relancer l'app plutôt
// que de rester bloqué. Volontairement sans dépendance à un contexte
// (thème, auth…) puisqu'il doit survivre même si ceux-ci sont en cause.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erreur non interceptée :', error, info.componentStack);
  }

  handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    // Sur mobile natif, on retente simplement de remonter l'arbre : la plupart
    // des erreurs viennent d'un état incohérent ponctuel plutôt que d'un bug
    // systématique au chargement.
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.emoji}>😕</Text>
            <Text style={styles.title}>Un problème est survenu</Text>
            <Text style={styles.subtitle}>
              {"L'application a rencontré une erreur inattendue. Vos données locales sont conservées."}
            </Text>
            <Pressable style={styles.button} onPress={this.handleReload}>
              <Text style={styles.buttonText}>{Platform.OS === 'web' ? 'Recharger la page' : "Réessayer"}</Text>
            </Pressable>
            {__DEV__ ? (
              <Text style={styles.debug} numberOfLines={6}>{String(this.state.error?.message || this.state.error)}</Text>
            ) : null}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emoji: { fontSize: 48, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSubtle, textAlign: 'center', marginBottom: Spacing.lg, maxWidth: 360 },
  button: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: Radius.md },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  debug: { marginTop: Spacing.lg, fontSize: FontSize.xs, color: Colors.textMuted, maxWidth: 400, textAlign: 'center' },
});
