// Reconciliador automático: detecta NF cujo evento `authorized` foi gravado em
// fiscal_invoice_events mas cujo registro em fiscal_invoices NÃO está como
// `authorized` (estado órfão SEFAZ↔banco).
//
// Reaplica persistAuthorizedState() usando o focus_response já salvo no evento
// e dispara os side-effects canônicos (link de remessa, e-mail, WMS).
//
// Gatilho:
//  - cron a cada 5 min (pg_cron + pg_net) faz varredura global.
//  - chamadas pontuais com { invoice_id } para self-heal sob demanda.

import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { persistAuthorizedState } from "../_shared/fiscal-persist-authorized.ts";
import { fireAuthorizedSideEffects } from "../_shared/fiscal-authorized-side-effects.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let scopeInvoiceId: string | null = null;
    let scopeTenantId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        scopeInvoiceId = body?.invoice_id || null;
        scopeTenantId = body?.tenant_id || null;
      } catch {
        // body opcional
      }
    }

    // Busca eventos `authorized` recentes (últimos 7 dias) cujo invoice não está authorized.
    let q = supabase
      .from("fiscal_invoice_events")
      .select("id, invoice_id, tenant_id, event_data, created_at")
      .eq("event_type", "authorized")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (scopeInvoiceId) q = q.eq("invoice_id", scopeInvoiceId);
    if (scopeTenantId) q = q.eq("tenant_id", scopeTenantId);

    const { data: events, error: eventsErr } = await q;
    if (eventsErr) throw eventsErr;

    if (!events?.length) {
      return new Response(
        JSON.stringify({ success: true, checked: 0, healed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplica por invoice (pegar o evento mais recente de cada).
    const byInvoice = new Map<string, typeof events[number]>();
    for (const ev of events) {
      if (!byInvoice.has(ev.invoice_id)) byInvoice.set(ev.invoice_id, ev);
    }

    let healed = 0;
    let skipped = 0;
    let failed = 0;

    for (const [invoiceId, ev] of byInvoice) {
      const { data: inv } = await supabase
        .from("fiscal_invoices")
        .select("id, tenant_id, status, order_id, focus_ref")
        .eq("id", invoiceId)
        .maybeSingle();

      if (!inv) { skipped++; continue; }
      if (inv.status === "authorized") { skipped++; continue; }

      const eventData = (ev.event_data as any) || {};
      const focusResponse = eventData.focus_response || eventData;
      if (!focusResponse?.chave_nfe) { skipped++; continue; }

      const { data: settings } = await supabase
        .from("fiscal_settings")
        .select("focus_ambiente, ambiente")
        .eq("tenant_id", inv.tenant_id)
        .maybeSingle();
      const ambiente = ((settings?.focus_ambiente || settings?.ambiente || "producao") as "homologacao" | "producao");

      const result = await persistAuthorizedState({
        supabaseClient: supabase,
        invoiceId,
        tenantId: inv.tenant_id,
        ambiente,
        callerModule: "fiscal-reconcile-authorized",
        focusStatusData: {
          status: "autorizado",
          chave_nfe: focusResponse.chave_nfe,
          numero: focusResponse.numero,
          serie: focusResponse.serie,
          caminho_xml_nota_fiscal: focusResponse.caminho_xml_nota_fiscal,
          caminho_danfe: focusResponse.caminho_danfe,
          mensagem_sefaz: focusResponse.mensagem_sefaz,
          status_sefaz: focusResponse.status_sefaz,
          protocolo: focusResponse.protocolo,
        },
        focusRef: inv.focus_ref || eventData.ref,
      });

      if (result.persisted && result.invoice) {
        healed++;
        await fireAuthorizedSideEffects({
          supabaseClient: supabase,
          invoice: { id: invoiceId, tenant_id: inv.tenant_id, order_id: inv.order_id },
          chaveAcesso: focusResponse.chave_nfe,
          supabaseUrl,
          supabaseServiceKey,
          callerModule: "fiscal-reconcile-authorized",
        });
        await supabase.from("fiscal_invoice_events").insert({
          invoice_id: invoiceId,
          tenant_id: inv.tenant_id,
          event_type: "reconciled_authorized",
          event_data: { healed_from_event_id: ev.id, chave: focusResponse.chave_nfe },
        });
      } else if (result.error) {
        failed++;
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: byInvoice.size, healed, skipped, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: "fiscal", action: "reconcile-authorized" });
  }
});
