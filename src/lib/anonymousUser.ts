import { supabase } from "@/integrations/supabase/client";

// ID usado apenas quando o projeto não permite login anônimo.
// Com RLS ativo, o app precisa de uma sessão anônima real para gravar configurações.
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000001';

// Só tenta login anônimo quando o provider foi ativado no Supabase e este flag
// foi ligado no .env. Evita 422 em /auth/v1/signup em projetos sem o provider.
const ANONYMOUS_SIGNIN_ENABLED = import.meta.env.VITE_SUPABASE_ANONYMOUS_SIGNIN === 'true';

let sessionPromise: Promise<void> | null = null;
let anonymousSignInUnavailable = false;

/**
 * Garante uma sessão anônima no Supabase quando não há usuário autenticado.
 * Tenta uma única vez: se o provider "Anonymous Sign-Ins" estiver desativado,
 * evita repetir 422 no /auth/v1/signup a cada consulta.
 */
const ensureSession = async (): Promise<void> => {
  if (!ANONYMOUS_SIGNIN_ENABLED || anonymousSignInUnavailable) return;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return;
        const { error } = await supabase.auth.signInAnonymously();
        if (error) anonymousSignInUnavailable = true;
      } catch {
        // Sem sessão: mantém o fallback abaixo e segue com a interface utilizável.
        anonymousSignInUnavailable = true;
      }
    })().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
};

/**
 * Returns the authenticated user's ID, or a fixed anonymous ID as fallback.
 * This allows the app to operate without requiring login.
 */
export const getUserId = async (): Promise<string> => {
  try {
    await ensureSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
  } catch (e) {
    // Auth check failed, use anonymous fallback
  }
  return ANONYMOUS_USER_ID;
};

/**
 * Returns the authenticated user's ID or null if not authenticated.
 */
export const getUserIdOrNull = async (): Promise<string | null> => {
  try {
    await ensureSession();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (e) {
    return null;
  }
};

/**
 * Returns the fixed anonymous user ID for operations that don't require auth.
 */
export const getAnonymousUserId = (): string => {
  return ANONYMOUS_USER_ID;
};
