/**
 * Sistema de usuário anônimo para permitir trading sem autenticação
 */

// ID fixo para usuário anônimo
export const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Retorna o ID do usuário atual ou o ID anônimo se não houver usuário
 */
export const getCurrentUserId = async (supabase: any): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || ANONYMOUS_USER_ID;
  } catch (error) {
    console.warn('Erro ao buscar usuário, usando anônimo:', error);
    return ANONYMOUS_USER_ID;
  }
};

/**
 * Verifica se o usuário atual é anônimo
 */
export const isAnonymousUser = (userId: string | null | undefined): boolean => {
  return !userId || userId === ANONYMOUS_USER_ID;
};
