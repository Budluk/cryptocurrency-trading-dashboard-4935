import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the authenticated user's ID.
 * Throws an error if the user is not authenticated.
 * 
 * SECURITY: Anonymous fallback has been removed to prevent
 * multiple unauthenticated users from sharing the same user_id.
 */
export const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required. Please log in to access this feature.');
  }
  return user.id;
};

/**
 * Returns the authenticated user's ID or null if not authenticated.
 * Use this when you need to check authentication status without throwing.
 */
export const getUserIdOrNull = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

/**
 * @deprecated This function is deprecated for security reasons.
 * Use getUserId() which requires authentication.
 * 
 * Previously returned a hardcoded anonymous UUID which caused
 * all anonymous users to share the same user_id - a security risk.
 */
export const getAnonymousUserId = (): never => {
  throw new Error('Anonymous user access has been disabled for security. Please authenticate.');
};
