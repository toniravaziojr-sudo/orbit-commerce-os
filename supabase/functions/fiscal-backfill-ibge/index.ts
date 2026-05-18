// =============================================
// FISCAL BACKFILL IBGE
// One-shot/manual: percorre fiscal_invoices com fiscal_stage='pedido_venda' e
// dest_endereco_municipio_codigo ausente/inválido, resolve via CEP e atualiza.
// Em seguida recalcula pendência removendo o motivo de "município não localizado"
// quando o IBGE for resolvido.
// Acesso restrito: somente service_role (header x-admin-key) ou usuário com platform_admin.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAddressByCep } from "../_shared/cep-lookup.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

const OLD_PENDENCY_MSG = 'Cidade do cliente não localizada na base oficial de municípios — confirme a grafia da cidade no endereço.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Auth: aceitamos chamadas internas com service_role key no header x-admin-key,
  // ou usuário autenticado (qualquer plataforma) — a operação só lê/atualiza
  // por CEP, sem mudar valor fiscal.
  const adminKey = req.headers.get('x-admin-key');
  const isService = adminKey && adminKey === serviceKey;
  if (!isService) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* default {} */ }
  const tenantSlug: string | null = body?.tenant_slug || null;
  const tenantId: string | null = body?.tenant_id || null;
  const limit: number = Math.min(Number(body?.limit) || 500, 2000);
  const dryRun: boolean = Boolean(body?.dry_run);

  let resolvedTenantId = tenantId;
  if (!resolvedTenantId && tenantSlug) {
    const { data: t } = await admin.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    resolvedTenantId = t?.id || null;
  }

  // Busca invoices candidatas
  let q = admin
    .from('fiscal_invoices')
    .select('id, tenant_id, dest_endereco_cep, dest_endereco_uf, dest_endereco_municipio_codigo, pendencia_motivos, fiscal_stage')
    .eq('fiscal_stage', 'pedido_venda')
    .not('dest_endereco_cep', 'is', null)
    .limit(limit);
  if (resolvedTenantId) q = q.eq('tenant_id', resolvedTenantId);

  const { data: rows, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let scanned = 0, resolved = 0, alreadyOk = 0, failed = 0, ufMismatch = 0;
  const samples: any[] = [];

  for (const row of rows || []) {
    scanned++;
    const currentIbge = String(row.dest_endereco_municipio_codigo || '').replace(/\D/g, '');
    if (currentIbge.length === 7) { alreadyOk++; continue; }

    const lookup = await resolveAddressByCep(admin, row.dest_endereco_cep);
    if (!lookup?.ibge) { failed++; samples.push({ id: row.id, cep: row.dest_endereco_cep, status: 'no_lookup' }); continue; }

    // Atualiza IBGE e limpa pendência específica
    const motivos: string[] = Array.isArray(row.pendencia_motivos) ? [...row.pendencia_motivos] : [];
    const filtered = motivos.filter(m => m !== OLD_PENDENCY_MSG && !/município do cliente a partir do CEP/i.test(m));

    // UF mismatch -> adiciona pendência
    if (lookup.uf && row.dest_endereco_uf && lookup.uf.toUpperCase() !== String(row.dest_endereco_uf).toUpperCase()) {
      ufMismatch++;
      const msg = `Endereço incompatível com o CEP: o CEP pertence a ${lookup.uf}, mas o pedido informa ${row.dest_endereco_uf}. Confirme cidade e estado com o cliente antes de despachar.`;
      if (!filtered.includes(msg)) filtered.push(msg);
    }

    if (!dryRun) {
      await admin
        .from('fiscal_invoices')
        .update({
          dest_endereco_municipio_codigo: lookup.ibge,
          pendencia_motivos: filtered.length > 0 ? filtered : null,
          fiscal_stage: filtered.length > 0 ? 'pendencia' : row.fiscal_stage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
    resolved++;
    if (samples.length < 20) samples.push({ id: row.id, cep: row.dest_endereco_cep, ibge: lookup.ibge, fonte: lookup.fonte });
  }

  return new Response(JSON.stringify({
    success: true,
    dry_run: dryRun,
    scanned, resolved, already_ok: alreadyOk, failed, uf_mismatch: ufMismatch,
    samples,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
