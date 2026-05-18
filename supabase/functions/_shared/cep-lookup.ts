// =============================================
// CEP LOOKUP - Resolve endereço + código IBGE a partir do CEP
// Hierarquia: cache local (cep_cache) -> ViaCEP -> BrasilAPI
// CEP é dado público; tabela de cache compartilhada entre tenants.
// =============================================

export interface CepLookupResult {
  cep: string;        // 8 dígitos
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  ibge: string;       // 7 dígitos (código IBGE do município)
  fonte: 'cache' | 'viacep' | 'brasilapi';
}

function sanitizeCep(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 8);
}

async function fetchWithTimeout(url: string, timeoutMs = 3500): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchViaCep(cep: string): Promise<CepLookupResult | null> {
  const r = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
  if (!r || !r.ok) return null;
  try {
    const j: any = await r.json();
    if (!j || j.erro) return null;
    const ibge = String(j.ibge || '').replace(/\D/g, '');
    if (ibge.length !== 7) return null;
    return {
      cep,
      logradouro: String(j.logradouro || ''),
      bairro: String(j.bairro || ''),
      cidade: String(j.localidade || ''),
      uf: String(j.uf || '').toUpperCase(),
      ibge,
      fonte: 'viacep',
    };
  } catch {
    return null;
  }
}

async function fetchBrasilApi(cep: string): Promise<CepLookupResult | null> {
  const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!r || !r.ok) return null;
  try {
    const j: any = await r.json();
    // BrasilAPI v2 não devolve IBGE; usa v1 que tem .city_ibge nem sempre; tentamos v1 em paralelo
    // Fallback: chama v1
    const r2 = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    let ibge = '';
    if (r2 && r2.ok) {
      const j1: any = await r2.json().catch(() => null);
      ibge = String(j1?.city_ibge || '').replace(/\D/g, '');
    }
    if (ibge.length !== 7) return null;
    return {
      cep,
      logradouro: String(j.street || ''),
      bairro: String(j.neighborhood || ''),
      cidade: String(j.city || ''),
      uf: String(j.state || '').toUpperCase(),
      ibge,
      fonte: 'brasilapi',
    };
  } catch {
    return null;
  }
}

/**
 * Resolve endereço e código IBGE de 7 dígitos a partir do CEP.
 * Retorna null se o CEP for inválido ou nenhuma fonte responder.
 */
export async function resolveAddressByCep(
  supabase: any,
  rawCep: string | null | undefined,
): Promise<CepLookupResult | null> {
  const cep = sanitizeCep(rawCep);
  if (cep.length !== 8) return null;

  // 1. Cache
  try {
    const { data } = await supabase
      .from('cep_cache')
      .select('cep, logradouro, bairro, cidade, uf, ibge, fonte')
      .eq('cep', cep)
      .maybeSingle();
    if (data && String(data.ibge || '').length === 7) {
      return {
        cep: data.cep,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        uf: String(data.uf || '').toUpperCase(),
        ibge: data.ibge,
        fonte: 'cache',
      };
    }
  } catch (_e) {
    // segue para providers
  }

  // 2. ViaCEP
  let result = await fetchViaCep(cep);

  // 3. BrasilAPI fallback
  if (!result) {
    result = await fetchBrasilApi(cep);
  }

  if (!result) return null;

  // 4. Grava no cache (best-effort, não bloqueia)
  try {
    await supabase
      .from('cep_cache')
      .upsert({
        cep: result.cep,
        logradouro: result.logradouro,
        bairro: result.bairro,
        cidade: result.cidade,
        uf: result.uf,
        ibge: result.ibge,
        fonte: result.fonte,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'cep' });
  } catch (_e) {
    // ignorar erro de cache
  }

  return result;
}

/**
 * Normaliza nome de cidade/UF para comparação tolerante a acento/maiúsculas/espaços.
 */
export function normalizeCityName(s: string | null | undefined): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
