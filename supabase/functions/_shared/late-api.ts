/**
 * Late API - Constantes e utilitários
 * 
 * Centraliza URLs, contratos e funções para a API do Late.
 * Base URL única para todas as chamadas.
 */

// Base URL único - NUNCA mudar em outras funções
export const LATE_BASE_URL = "https://getlate.dev/api/v1";

/**
 * Interface para profile do Late (usa _id, não id)
 */
export interface LateProfile {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
  description?: string;
  isOverLimit?: boolean;
}

/**
 * Interface para account do Late
 */
export interface LateAccount {
  _id: string;
  platform: string;
  profileId: { _id: string; name: string; slug?: string };
  username: string;
  displayName: string;
  profileUrl?: string;
  isActive: boolean;
}

/**
 * Interface para resposta de listagem de profiles
 */
export interface LateProfilesResponse {
  profiles: LateProfile[];
}

/**
 * Interface para resposta de listagem de accounts
 */
export interface LateAccountsResponse {
  accounts: LateAccount[];
  hasAnalyticsAccess?: boolean;
}

/**
 * Interface para resposta de connect
 */
export interface LateConnectResponse {
  authUrl: string;
  state: string;
}

/**
 * Faz uma requisição GET para a API do Late
 */
export async function lateGet<T>(
  path: string,
  apiKey: string,
  queryParams?: Record<string, string>
): Promise<{ data: T | null; error: string | null; status: number }> {
  let url = `${LATE_BASE_URL}${path}`;
  
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url = `${url}?${params.toString()}`;
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[late-api] GET ${path} failed:`, res.status, errorText);
      return { data: null, error: errorText || `HTTP ${res.status}`, status: res.status };
    }

    const data = await res.json();
    return { data: data as T, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error(`[late-api] GET ${path} exception:`, message);
    return { data: null, error: message, status: 0 };
  }
}

/**
 * Faz uma requisição POST para a API do Late
 */
export async function latePost<T>(
  path: string,
  apiKey: string,
  body: Record<string, any>
): Promise<{ data: T | null; error: string | null; status: number }> {
  const url = `${LATE_BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[late-api] POST ${path} failed:`, res.status, errorText);
      return { data: null, error: errorText || `HTTP ${res.status}`, status: res.status };
    }

    const data = await res.json();
    return { data: data as T, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error(`[late-api] POST ${path} exception:`, message);
    return { data: null, error: message, status: 0 };
  }
}

/**
 * Lista profiles do Late
 */
export async function listProfiles(apiKey: string): Promise<{ profiles: LateProfile[]; error: string | null }> {
  const { data, error } = await lateGet<LateProfilesResponse>("/profiles", apiKey);
  
  if (error) {
    return { profiles: [], error };
  }

  // A API retorna { profiles: [...] }
  const profiles = data?.profiles || [];
  return { profiles, error: null };
}

/**
 * Cria um novo profile no Late
 */
export async function createProfile(apiKey: string, name: string): Promise<{ profile: LateProfile | null; error: string | null }> {
  const { data, error, status } = await latePost<{ message: string; profile: LateProfile }>("/profiles", apiKey, { name });
  
  if (error) {
    // Verificar erros específicos
    if (error.toLowerCase().includes("limit") || status === 403) {
      return { profile: null, error: "PROFILE_LIMIT_REACHED" };
    }
    if (error.toLowerCase().includes("exist")) {
      return { profile: null, error: "PROFILE_EXISTS" };
    }
    return { profile: null, error };
  }

  return { profile: data?.profile || null, error: null };
}

/**
 * Lista accounts conectadas a um profile
 */
export async function listAccounts(apiKey: string, profileId?: string): Promise<{ accounts: LateAccount[]; error: string | null }> {
  const queryParams = profileId ? { profileId } : undefined;
  const { data, error } = await lateGet<LateAccountsResponse>("/accounts", apiKey, queryParams);
  
  if (error) {
    return { accounts: [], error };
  }

  // A API retorna { accounts: [...] }
  const accounts = data?.accounts || [];
  return { accounts, error: null };
}

/**
 * Obtém URL de conexão OAuth para uma plataforma
 */
export async function getConnectUrl(
  apiKey: string,
  platform: string,
  profileId: string,
  redirectUrl?: string
): Promise<{ authUrl: string | null; error: string | null }> {
  const queryParams: Record<string, string> = { profileId };
  if (redirectUrl) {
    queryParams.redirect_url = redirectUrl;
  }

  const { data, error } = await lateGet<LateConnectResponse>(`/connect/${platform}`, apiKey, queryParams);
  
  if (error) {
    return { authUrl: null, error };
  }

  return { authUrl: data?.authUrl || null, error: null };
}

/**
 * Encontra um profile existente que corresponde ao tenant
 */
export function findMatchingProfile(profiles: LateProfile[], tenantId: string, tenantSlug?: string): LateProfile | null {
  const shortId = tenantId.substring(0, 8);
  
  for (const profile of profiles) {
    // Match por ID parcial
    if (profile.name.includes(shortId)) {
      return profile;
    }
    // Match por slug do tenant
    if (tenantSlug && profile.name.toLowerCase().includes(tenantSlug.toLowerCase())) {
      return profile;
    }
  }

  return null;
}

/**
 * Gera nome de profile único para um tenant
 */
export function generateProfileName(tenantSlug: string | null, tenantId: string): string {
  const shortId = tenantId.substring(0, 8);
  if (tenantSlug) {
    return `${tenantSlug}-${shortId}`;
  }
  return `tenant-${shortId}`;
}
