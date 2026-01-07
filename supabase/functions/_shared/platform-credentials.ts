import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Busca uma credencial da plataforma.
 * Prioridade: banco de dados > variável de ambiente
 * 
 * Isso permite que o admin edite credenciais via painel,
 * mas mantém fallback para env vars (não quebra nada existente).
 */
export async function getCredential(
  supabaseUrl: string,
  supabaseServiceKey: string,
  credentialKey: string
): Promise<string | null> {
  // Primeiro, tentar buscar do banco de dados
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('platform_credentials')
      .select('credential_value, is_active')
      .eq('credential_key', credentialKey)
      .single();
    
    // Se encontrou no banco e está ativo e tem valor, usar
    if (!error && data?.is_active && data?.credential_value) {
      console.log(`[platform-credentials] Using DB value for ${credentialKey}`);
      return data.credential_value;
    }
  } catch (err) {
    console.log(`[platform-credentials] DB lookup failed for ${credentialKey}, using env var fallback`);
  }
  
  // Fallback: usar variável de ambiente
  const envValue = Deno.env.get(credentialKey);
  if (envValue) {
    console.log(`[platform-credentials] Using env var for ${credentialKey}`);
  }
  return envValue || null;
}

/**
 * Atualiza uma credencial no banco de dados.
 * Retorna true se sucesso, false se falha.
 */
export async function updateCredential(
  supabaseUrl: string,
  supabaseServiceKey: string,
  credentialKey: string,
  credentialValue: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('platform_credentials')
      .upsert({
        credential_key: credentialKey,
        credential_value: credentialValue,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      }, {
        onConflict: 'credential_key'
      });
    
    if (error) {
      console.error(`[platform-credentials] Update failed for ${credentialKey}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`[platform-credentials] Updated ${credentialKey}`);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

/**
 * Verifica se uma credencial existe (no banco ou env var)
 */
export async function hasCredential(
  supabaseUrl: string,
  supabaseServiceKey: string,
  credentialKey: string
): Promise<boolean> {
  const value = await getCredential(supabaseUrl, supabaseServiceKey, credentialKey);
  return !!value;
}

/**
 * Retorna preview mascarado de uma credencial
 */
export function maskCredential(value: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.substring(0, 4)}••••${value.substring(value.length - 4)}`;
}
