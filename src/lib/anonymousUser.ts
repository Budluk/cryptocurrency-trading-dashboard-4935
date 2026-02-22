import { supabase } from "@/integrations/supabase/client";

// Fixed anonymous user ID for unauthenticated operation
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Returns the authenticated user's ID, or a fixed anonymous ID as fallback.
 * This allows the app to operate without requiring login.
 */
export const getUserId = async (): Promise<string> => {
  try {
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
