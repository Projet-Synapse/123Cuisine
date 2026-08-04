// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { AuthUser } from '../types';
import { authService } from './service';

interface AuthContextState {
  user: AuthUser | null;
  loading: boolean;
  operationLoading: boolean;
  initialized: boolean;
}

interface AuthContextActions {
  setOperationLoading: (loading: boolean) => void;
}

type AuthContextType = AuthContextState & AuthContextActions;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthContextState>({
    user: null,
    loading: true,
    operationLoading: false,
    initialized: false,
  });

  const updateState = (updates: Partial<AuthContextState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      return newState;
    });
  };

  const setOperationLoading = (loading: boolean) => {
    updateState({ operationLoading: loading });
  };

  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;
    let authSubscription: any = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const markInitialized = (authUser: any) => {
      if (!isMounted) return;
      hasInitialized = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      updateState({ user: authUser, loading: false, initialized: true });
    };

    try {
      // Supabase envoie toujours un premier événement (INITIAL_SESSION) dès
      // l'abonnement, avec la session déjà persistée s'il y en a une. On s'en
      // sert directement comme initialisation, au lieu de faire un premier
      // getSession() séparé puis de s'abonner ensuite : ces deux appels
      // concurrents au même verrou interne du client Supabase (côté web)
      // pouvaient parfois entrer en contention, causant une initialisation
      // qui traîne — et un login lancé pendant ce délai pouvait alors
      // échouer par timeout alors que les identifiants étaient bons.
      authSubscription = authService.onAuthStateChange((authUser) => {
        if (!isMounted) return;
        if (!hasInitialized) {
          markInitialized(authUser);
        } else {
          updateState({ user: authUser });
        }
      });

      // Filet de sécurité : si pour une raison quelconque aucun événement
      // n'arrive (édge case navigateur), on ne bloque pas l'app indéfiniment.
      fallbackTimer = setTimeout(() => {
        if (!hasInitialized) {
          console.warn('[Template:AuthProvider] Pas de réponse de Supabase après 10s, initialisation forcée.');
          markInitialized(null);
        }
      }, 10000);
    } catch (error) {
      console.warn('[Template:AuthProvider] Auth initialization failed:', error);
      markInitialized(null);
    }

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures single execution
  const contextValue: AuthContextType = {
    ...state,
    setOperationLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuthContext Hook - internal use
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}