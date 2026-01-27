// =============================================
// B2B SEARCH - Edge Function para busca CNPJ/CNAE
// Integra com BrasilAPI e outras fontes públicas
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface SearchCnpjRequest {
  action: 'search_cnpj';
  cnpj: string;
  tenant_id: string;
}

interface SearchNichoRequest {
  action: 'search_nicho';
  uf: string;
  cidade?: string;
  cnae?: string;
  nicho?: string;
  tenant_id: string;
}

interface SearchCnaeRequest {
  action: 'search_cnae';
  uf: string;
  cidade?: string;
  cnae?: string;
  nicho?: string;
  tenant_id: string;
}

type RequestBody = SearchCnpjRequest | SearchNichoRequest | SearchCnaeRequest;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RequestBody = await req.json();

    if (body.action === 'search_cnpj') {
      return await handleCnpjSearch(body, supabase);
    } else if (body.action === 'search_nicho') {
      return await handleNichoSearch(body, supabase);
    } else if (body.action === 'search_cnae') {
      return await handleCnaeSearch(body, supabase);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Ação inválida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('B2B Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCnpjSearch(body: SearchCnpjRequest, supabase: any) {
  const { cnpj, tenant_id } = body;

  // Limpar CNPJ (apenas dígitos)
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (cleanCnpj.length !== 14) {
    return new Response(
      JSON.stringify({ success: false, error: 'CNPJ inválido' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verificar quota
  const quotaCheck = await checkAndIncrementQuota(supabase, tenant_id, 'brasilapi');
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Quota diária esgotada', code: 'QUOTA_EXCEEDED' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Consultar BrasilAPI
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: 'CNPJ não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`BrasilAPI error: ${response.status}`);
    }

    const data = await response.json();

    // Mapear dados para nosso formato
    const entity = {
      cnpj: cleanCnpj,
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || data.razao_social || '',
      cnae_principal: data.cnae_fiscal?.toString() || '',
      cnae_descricao: data.cnae_fiscal_descricao || '',
      situacao_cadastral: data.descricao_situacao_cadastral || '',
      porte: mapPorte(data.porte),
      natureza_juridica: data.natureza_juridica || '',
      data_abertura: data.data_inicio_atividade || null,
      capital_social: data.capital_social || 0,
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep?.replace(/\D/g, '') || '',
      telefone: formatPhone(data.ddd_telefone_1),
      telefone_secundario: formatPhone(data.ddd_telefone_2),
      email: (data.email || '').toLowerCase().trim(),
    };

    console.log(`[b2b-search] CNPJ ${cleanCnpj} found: ${entity.nome_fantasia}`);

    return new Response(
      JSON.stringify({ success: true, entity }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (apiError) {
    console.error('BrasilAPI error:', apiError);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao consultar CNPJ' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleNichoSearch(body: SearchNichoRequest, supabase: any) {
  const { uf, cidade, cnae, nicho, tenant_id } = body;
  
  // Verificar quota
  const quotaCheck = await checkAndIncrementQuota(supabase, tenant_id, 'nicho_search');
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Quota diária esgotada', code: 'QUOTA_EXCEEDED' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Por enquanto, retornar aviso de que busca em lote requer implementação adicional
  // A busca em massa por nicho geralmente requer acesso a bases de dados comerciais
  // Como alternativa futura: integração com DataSeek, Econodata, ou base offline de CNPJs
  
  console.log(`[b2b-search] Nicho search: ${nicho} in ${cidade || 'all'}/${uf}, CNAE: ${cnae || 'any'}`);
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Busca por nicho/região requer integração com provedor de dados empresariais (DataSeek, Econodata, etc). Use a busca por CNPJ específico por enquanto.',
      code: 'NICHO_NOT_IMPLEMENTED',
      searched: { uf, cidade, cnae, nicho }
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCnaeSearch(body: SearchCnaeRequest, supabase: any) {
  // Por enquanto, retornar aviso de que busca por CNAE requer implementação adicional
  // A busca em massa por CNAE geralmente requer acesso a bases de dados pagas
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Busca por CNAE/região requer configuração de provedor adicional. Use a busca por CNPJ específico.',
      code: 'CNAE_NOT_IMPLEMENTED' 
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function checkAndIncrementQuota(supabase: any, tenantId: string, provider: string): Promise<{ allowed: boolean }> {
  try {
    // Buscar ou criar source
    const { data: source, error } = await supabase
      .from('b2b_sources')
      .select('id, quota_daily, quota_used_today, last_quota_reset')
      .eq('tenant_id', tenantId)
      .eq('provider_name', provider)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Quota check error:', error);
      // Em caso de erro, permitir a consulta
      return { allowed: true };
    }

    if (!source) {
      // Source não existe, criar automaticamente
      await supabase.from('b2b_sources').insert({
        tenant_id: tenantId,
        source_type: 'cnpj_api',
        provider_name: provider,
        display_name: 'BrasilAPI',
        is_enabled: true,
        quota_daily: 100,
        quota_used_today: 1,
      });
      return { allowed: true };
    }

    // Verificar se precisa resetar quota (novo dia)
    const lastReset = new Date(source.last_quota_reset);
    const today = new Date();
    const needsReset = lastReset.toDateString() !== today.toDateString();

    if (needsReset) {
      await supabase
        .from('b2b_sources')
        .update({ quota_used_today: 1, last_quota_reset: today.toISOString() })
        .eq('id', source.id);
      return { allowed: true };
    }

    // Verificar quota
    if (source.quota_used_today >= source.quota_daily) {
      return { allowed: false };
    }

    // Incrementar quota
    await supabase
      .from('b2b_sources')
      .update({ quota_used_today: source.quota_used_today + 1 })
      .eq('id', source.id);

    return { allowed: true };
  } catch (err) {
    console.error('Quota error:', err);
    return { allowed: true };
  }
}

function mapPorte(porte: string | null): string {
  if (!porte) return '';
  const porteMap: Record<string, string> = {
    '00': 'Não informado',
    '01': 'MEI',
    '03': 'ME',
    '05': 'EPP',
    '07': 'Demais',
  };
  return porteMap[porte] || porte;
}

function formatPhone(dddPhone: string | null): string {
  if (!dddPhone) return '';
  const clean = dddPhone.replace(/\D/g, '');
  if (clean.length < 10) return '';
  return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
}
