import { supabase } from "@/integrations/supabase/client";

// ID fixo para usuário anônimo
const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Retorna o ID do usuário autenticado ou ID anônimo fixo
 */
export const getUserId = async (): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || ANONYMOUS_USER_ID;
};

/**
 * Retorna o ID do usuário de forma síncrona (não recomendado, use getUserId quando possível)
 */
export const getAnonymousUserId = (): string => {
  return ANONYMOUS_USER_ID;
};
