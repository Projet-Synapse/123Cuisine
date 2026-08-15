//////////////////////////////////////////////////////////////////////////
//                              Service.ts                              //
//////////////////////////////////////////////////////////////////////////

/*
 * Toutes les opérations d'authentification Supabase (connexion, inscription, Google, déconnexion, rafraîchissement de session), avec timeouts et messages d'erreur traduits en français.
 */

import { AuthUser, SendOTPOptions, SendOTPResult, SignUpResult, AuthResult, LogoutResult, GoogleSignInResult } from '../types';
import { safeSupabaseOperation, getSharedSupabaseClient } from '../../core/client';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Ensure Web platform correctly handles auth callbacks
WebBrowser.maybeCompleteAuthSession();

// Visibility change listener related variables
let lastVisibilityChange = 0;
let visibilityListener: (() => void) | null = null;

// Operation state tracking to prevent deadlock
let isUpdatingUserInOTPFlow = false;

const TIMEOUT_CONFIG = {
  AUTH_OPERATIONS: 10000,
  DATA_QUERIES: 8000,  
  SESSION_REFRESH: 5000,
  USER_UPDATE: 15000,
};

// Utility function to add timeout to any Promise with proper cleanup
const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string = 'Operation'
): Promise<T> => {
  // ReturnType<typeof setTimeout> plutôt que NodeJS.Timeout : ce code tourne
  // aussi bien dans le navigateur/Electron (web) où setTimeout renvoie un
  // number, que sous Node — NodeJS.Timeout ne correspond qu'au second cas.
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs/1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const isAuthError = (error: any): boolean => {
  if (error.message?.includes('timeout')) return false;
  return error.status === 401 ||
         error.status === 403 ||
         error.message?.includes('invalid_token');
};

// Traduit les messages d'erreur GoTrue (Supabase) les plus courants en
// français compréhensible. Sans ça, l'utilisateur voit passer le message
// anglais brut de Supabase ("Invalid login credentials", "Email not
// confirmed"...) tel quel dans l'alerte de connexion échouée.
const translateAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Votre adresse email n'est pas encore confirmée. Vérifiez votre boîte mail (et vos spams) pour le lien de confirmation.";
  if (m.includes('user already registered')) return 'Un compte existe déjà avec cet email.';
  if (m.includes('password should be at least')) return 'Le mot de passe est trop court.';
  if (m.includes('rate limit')) return 'Trop de tentatives, merci de réessayer dans quelques minutes.';
  if (m.includes('network') || m.includes('fetch')) return 'Connexion au serveur impossible, vérifiez votre réseau.';
  return message;
};

// Visibility monitoring logic - used to optimize auth event handling
const setupVisibilityMonitoring = () => {
  if (visibilityListener || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  visibilityListener = () => {
    lastVisibilityChange = Date.now();
  };

  document.addEventListener('visibilitychange', visibilityListener);
};

export const isVisibilityTriggeredAuthEvent = (event: string): boolean => {
  if (event !== 'SIGNED_IN') return false;

  const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
  return timeSinceVisibilityChange < 1000;
};

export const getLastVisibilityChange = (): number => lastVisibilityChange;

// Enhanced event filtering to prevent deadlock
export const shouldIgnoreAuthEvent = (event: string): boolean => {
  // Ignore USER_UPDATED events during updateUser operation to prevent deadlock
  if (event === 'USER_UPDATED' && isUpdatingUserInOTPFlow) {
    return true;
  }
  
  // Ignore visibility-triggered events
  if (isVisibilityTriggeredAuthEvent(event)) {
    return true;
  }
  
  return false;
};

export class AuthService {
  constructor() {
    // Initialize visibility monitoring
    setupVisibilityMonitoring();
  }

  private get supabase() {
    return getSharedSupabaseClient();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const session = await safeSupabaseOperation(async (client) => {
        const { data: { session }, error } = await withTimeout(
          client.auth.getSession(),
          TIMEOUT_CONFIG.DATA_QUERIES,
          'GetSession'
        );
        
        if (error) throw error;
        return session;
      });
      
      if (!session?.user) return null;

      // Map session.user to AuthUser (unified for all auth methods)
      return this.mapSessionToAuthUser(session.user);

    } catch (error) {
      if (isAuthError(error)) {
        return null;
      }
      
      return null;
    }
  }

  // Unified session.user mapping - used by all auth flows
  private mapSessionToAuthUser(sessionUser: any): AuthUser {
    return {
      id: sessionUser.id,
      email: sessionUser.email || '',
      username: sessionUser.user_metadata?.username || 
               sessionUser.user_metadata?.full_name || 
               sessionUser.user_metadata?.name || 
               sessionUser.email?.split('@')[0] || 
               `user_${sessionUser.id.slice(0, 8)}`,
      created_at: sessionUser.created_at,
      updated_at: sessionUser.updated_at || sessionUser.created_at,
    };
  }

  async sendOTP(email: string, options: SendOTPOptions = {}): Promise<SendOTPResult> {
    try {
      const { shouldCreateUser = true, emailRedirectTo } = options;
      
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser,
              emailRedirectTo,
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SendOTP'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Network is slow, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sendOTP error';
      console.warn('[Template:AuthService] SendOTP system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Network connection timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: 'Failed to send verification code', errorType: 'network' };
    }
  }

  async verifyOTPAndLogin(email: string, otp: string, options?: { password?: string }): Promise<AuthResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        // Step 1: Verify OTP first
        const { data, error } = await withTimeout(
          client.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'VerifyOTP'
        );

        if (error) {
          if (error.message.includes('Database error saving new user')) {
            console.warn('[Template:AuthService] Database trigger missing, auth function available but user profile creation failed');
            console.warn('[Template:AuthService] Please refer to SDK documentation to set up user_profiles table and triggers');
          }
          
          if (error.message.includes('timeout')) {
            return { error: 'Verification timeout, please retry', user: null, errorType: 'timeout' };
          }
          
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
  
          // Step 2: Update user with password if provided (with deadlock prevention)
          if (options?.password) {
            
            try {
              // Set flag to prevent deadlock
              isUpdatingUserInOTPFlow = true;
              
              const { error: updateError } = await withTimeout(
                client.auth.updateUser({ password: options.password }),
                TIMEOUT_CONFIG.USER_UPDATE,
                'UpdateUser'
              );
              
              
              if (updateError) {
                console.warn('[Template:AuthService] User update failed after OTP verification:', updateError.message);
                // Note: We don't fail the entire operation if user update fails
                // The user is still successfully authenticated via OTP
              }
              
              // Clear flag after a delay to ensure all events are processed
              setTimeout(() => {
                isUpdatingUserInOTPFlow = false;
              }, 2000);
              
            } catch {
              // Clear flag on error
              isUpdatingUserInOTPFlow = false;
              // Continue with the authentication flow
            }
          }

          // Standard flow: Check session status (wait a bit if we just updated user)
          if (options?.password) {
            // Wait a moment for the update to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              // Final fallback: Use original verification data
              const fallbackUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || '',
                username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
                created_at: data.user.created_at,
                updated_at: data.user.updated_at || data.user.created_at,
              };
              return { user: fallbackUser };
            }
          } catch {
            // Use fallback data
            const fallbackUser: AuthUser = {
              id: data.user.id,
              email: data.user.email || '',
              username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
              created_at: data.user.created_at,
              updated_at: data.user.updated_at || data.user.created_at,
            };
            return { user: fallbackUser };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verifyOTP error';
      console.warn('[Template:AuthService] VerifyOTPAndLogin system exception:', errorMessage);
      
      // Clear flag on any error
      isUpdatingUserInOTPFlow = false;
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Login timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Login failed', user: null, errorType: 'network' };
    }
  }

  async signUpWithPassword(email: string, password: string, metadata: Record<string, any> = {}): Promise<SignUpResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signUp({
            email,
            password,
            options: {
              data: metadata
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignUp'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: "L'inscription a expiré, merci de réessayer.", errorType: 'timeout' };
          }
          return { error: translateAuthError(error.message), errorType: 'business' };
        }

        if (data.user && !data.session) {
          return {
            user: null,
            needsEmailConfirmation: true
          };
        }

        // Comme pour signInWithPassword : on mappe directement le user déjà
        // renvoyé par signUp plutôt que de refaire un getSession() séparé.
        if (data.user && data.session) {
          return { user: this.mapSessionToAuthUser(data.user) };
        }

        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signUp error';
      console.warn('[Template:AuthService] SignUpWithPassword system exception:', errorMessage);

      if (errorMessage.includes('timeout')) {
        return { error: "L'inscription a expiré, merci de réessayer.", errorType: 'timeout' };
      }

      return { error: "L'inscription a échoué, merci de réessayer.", errorType: 'network' };
    }
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signInWithPassword({
            email,
            password
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignIn'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'La connexion a expiré, merci de réessayer.', user: null, errorType: 'timeout' };
          }
          return { error: translateAuthError(error.message), user: null, errorType: 'business' };
        }

        // On mappe directement l'utilisateur renvoyé par signInWithPassword
        // plutôt que de refaire un getSession() séparé juste après : ce
        // second appel concurrent au verrou interne du client Supabase (web)
        // pouvait parfois expirer ou échouer juste après une connexion
        // pourtant réussie, ce qui donnait l'impression que la connexion
        // avait échoué alors que les identifiants étaient corrects.
        if (data.user) {
          return { user: this.mapSessionToAuthUser(data.user) };
        }

        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signIn error';
      console.warn('[Template:AuthService] SignInWithPassword system exception:', errorMessage);

      if (errorMessage.includes('timeout')) {
        return { error: 'La connexion a expiré, merci de réessayer.', user: null, errorType: 'timeout' };
      }

      return { error: 'La connexion a échoué, merci de réessayer.', user: null, errorType: 'network' };
    }
  }

  async logout(): Promise<LogoutResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signOut(),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'Logout'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Logout timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown logout error';
      console.warn('[Template:AuthService] Logout system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Logout timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: errorMessage, errorType: 'network' };
    }
  }

  async refreshSession() {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.refreshSession(),
          TIMEOUT_CONFIG.SESSION_REFRESH,
          'RefreshSession'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            console.warn('[Template:AuthService] Session refresh timeout');
          } else {
            console.warn('[Template:AuthService] Refresh session error:', error);
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error';
      console.warn('[Template:AuthService] RefreshSession system exception:', errorMessage);
    }
  }

  async signInWithGoogle(): Promise<GoogleSignInResult> {
    try {
      // Generate cross-platform redirect URL. Sur web/Electron,
      // makeRedirectUri({ path: 'auth' }) construit l'URL à partir de
      // window.location, ex. http://127.0.0.1:47821/auth — mais aucune
      // route "/auth" n'existe dans l'app (voir app/), donc Google renvoie
      // sur un 404 (écran +not-found.tsx) juste après avoir accordé les
      // autorisations. On redirige vers la racine "/" à la place :
      // app/index.tsx est le point d'entrée qui décide déjà, via
      // AuthRouter, d'afficher les onglets ou /login selon l'état de
      // connexion — exactement ce qu'on veut une fois la session Google
      // détectée dans l'URL (detectSessionInUrl, cf. core/client.ts).
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'onspaceapp',
        path: ''
      });

      // Step 1: Get OAuth URL from Supabase
      const { data, error } = await withTimeout(
        this.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: { 
              access_type: 'offline', 
              prompt: 'consent' 
            },
            skipBrowserRedirect: Platform.OS !== 'web'
          }
        }),
        TIMEOUT_CONFIG.AUTH_OPERATIONS,
        'GoogleOAuth'
      );

      if (error) {
        return { error: `OAuth init failed: ${error.message}` };
      }

      if (!data?.url) {
        return { error: 'Failed to generate OAuth URL' };
      }

      // Web platform: Supabase handles redirect automatically
      if (Platform.OS === 'web') {
        return { error: null };
      }

      // Mobile platform: Manual OAuth flow
      // Step 2: Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      // Step 3: Handle callback
      if (result.type === 'success') {
        const url = result.url;
        
        try {
          const params = new URL(url).searchParams;
          const code = params.get('code');
          
          if (!code) {
            const error = params.get('error');
            const errorDescription = params.get('error_description');
            return { 
              error: errorDescription || error || 'No authorization code received'
            };
          }

          // Exchange code for session - this triggers SIGNED_IN event
          const { error: exchangeError } = await withTimeout(
            this.supabase.auth.exchangeCodeForSession(code),
            TIMEOUT_CONFIG.AUTH_OPERATIONS,
            'ExchangeCode'
          );

          if (exchangeError) {
            return { 
              error: `Session exchange failed: ${exchangeError.message}`
            };
          }

          // CRITICAL: Don't poll and wait here!
          // exchangeCodeForSession will trigger onAuthStateChange(SIGNED_IN)
          // Just verify session exists and return immediately
          const { data: sessionData } = await this.supabase.auth.getSession();
          if (sessionData.session) {
            // Session created successfully, AuthContext will update via onAuthStateChange
            return { error: null };
          }

          // If no session yet, wait briefly for it to settle
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: retrySessionData } = await this.supabase.auth.getSession();
          if (retrySessionData.session) {
            return { error: null };
          }

          // Last resort: refresh to trigger state change
          await this.supabase.auth.refreshSession();
          return { error: null };
        } catch (urlError) {
          const errorMsg = urlError instanceof Error ? urlError.message : 'Unknown error';
          return { 
            error: `Failed to parse callback: ${errorMsg}`
          };
        }
      } else if (result.type === 'cancel') {
        return { error: 'User cancelled login' };
      } else if (result.type === 'dismiss') {
        return { error: 'Browser dismissed' };
      } else if (result.type === 'locked') {
        return { error: 'Browser is locked' };
      }

      return { 
        error: `Unknown result: ${result.type}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Google login error';
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Google login timeout, please retry' };
      }
      
      return { 
        error: `Google login failed: ${errorMessage}`
      };
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    try {
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Use enhanced event filtering to prevent deadlock
          if (shouldIgnoreAuthEvent(event)) {
            return;
          }
          
          if (session?.user) {
            try {
              const authUser = this.mapSessionToAuthUser(session.user);
              callback(authUser);
            } catch (error) {
              console.warn('[Template:AuthService] Error in auth state change callback:', error);
              callback(null);
            }
          } else {
            callback(null);
          }
        }
      );

      return subscription;
    } catch (error) {
      console.error('[Template:AuthService] Failed to set up auth state listener:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
