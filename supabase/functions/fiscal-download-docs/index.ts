// =============================================
// FISCAL DOWNLOAD DOCS — Download seguro de DANFE/XML
//
// Suporta:
//   - Individual: 1 NF → 1 arquivo (DANFE.pdf ou XML.xml) com nome padrão
//   - Massa XML: N NFs → 1 arquivo ZIP com todos os XMLs
//   - Massa DANFE: N NFs → 1 arquivo PDF unificado (multipágina)
//
// Por que via backend:
//   - URLs do provedor fiscal exigem Basic Auth com token do tenant
//   - Evita CORS no browser
//   - Permite forçar Content-Disposition: attachment (em vez de inline)
//   - Permite empacotar (ZIP) e mesclar (PDF) sem expor segredos
//
// Padrão de nomes (PT-BR):
//   - Individual: "NF {numero} - {cliente} - {dd-mm-aaaa}.{pdf|xml}"
//   - Massa:      "NFs {N} - {aaaa-mm-dd HH-MM}.{zip|pdf}"
//
// Limite: 100 NFs por chamada em massa.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import JSZip from "npm:jszip@3.10.1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BULK = 100;

type Format = "xml" | "danfe";

function jsonErr(message: string, status = 200) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Sanitiza nome de cliente para uso em filename (remove chars proibidos)
function sanitizeName(raw: string | null | undefined, fallback = "Cliente"): string {
  const s = (raw || "").trim();
  if (!s) return fallback;
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim() || fallback;
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "sem-data";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "sem-data";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function nowStampForBulk(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;
}

function buildIndividualFilename(numero: number | string, cliente: string, dataIso: string | null, ext: string): string {
  return `NF ${numero} - ${sanitizeName(cliente)} - ${formatDateBR(dataIso)}.${ext}`;
}

function buildBulkFilename(count: number, ext: string): string {
  return `NFs ${count} - ${nowStampForBulk()}.${ext}`;
}

// Baixa um arquivo da Focus usando Basic Auth com o token do tenant
async function fetchFromFocus(url: string, token: string): Promise<ArrayBuffer> {
  const basic = btoa(`${token}:`);
  const res = await fetch(url, { headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do provedor fiscal (HTTP ${res.status})`);
  }
  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonErr("Método não permitido", 405);

  try {
    await loadPlatformCredentials();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Sessão expirada. Faça login novamente.", 401);

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return jsonErr("Sessão expirada. Faça login novamente.", 401);

    const { data: profile } = await userClient
      .from("profiles")
      .select("current_tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.current_tenant_id;
    if (!tenantId) return jsonErr("Nenhuma loja selecionada.");

    const body = await req.json().catch(() => ({}));
    const invoiceIds: string[] = Array.isArray(body?.invoice_ids) ? body.invoice_ids : [];
    const format: Format = body?.format === "danfe" ? "danfe" : "xml";

    if (invoiceIds.length === 0) return jsonErr("Selecione ao menos uma nota fiscal.");
    if (invoiceIds.length > MAX_BULK) {
      return jsonErr(`Limite de ${MAX_BULK} notas por download. Selecione no máximo ${MAX_BULK} de uma vez.`);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invoices, error: invErr } = await admin
      .from("fiscal_invoices")
      .select("id, tenant_id, numero, serie, dest_nome, status, xml_url, danfe_url, authorized_at, created_at")
      .in("id", invoiceIds)
      .eq("tenant_id", tenantId);

    if (invErr) throw invErr;
    if (!invoices || invoices.length === 0) {
      return jsonErr("Nenhuma nota fiscal encontrada para esta loja.");
    }

    // Filtrar só autorizadas com URL disponível para o formato
    const eligible = invoices.filter((inv) => {
      if (inv.status !== "authorized") return false;
      return format === "xml" ? !!inv.xml_url : !!inv.danfe_url;
    });

    if (eligible.length === 0) {
      return jsonErr(
        format === "xml"
          ? "Nenhuma das notas selecionadas tem XML disponível para download."
          : "Nenhuma das notas selecionadas tem DANFE disponível para download.",
      );
    }

    // Resolver token do tenant para baixar do provedor
    const { data: settings } = await admin
      .from("fiscal_settings")
      .select("ambiente, focus_ambiente")
      .eq("tenant_id", tenantId)
      .single();

    const ambiente = (settings?.focus_ambiente || settings?.ambiente || "producao") as "homologacao" | "producao";
    const tenantTok = await loadFocusTenantToken(admin, tenantId, ambiente);
    const creds = resolveFocusCredentials({
      ambiente,
      operationKind: "nfe_op",
      tenantTokenForAmbiente: tenantTok.token,
    });
    if (!creds.ok || !creds.token) return jsonErr(creds.error || "Credenciais fiscais não configuradas.");
    const token = creds.token;

    const isSingle = eligible.length === 1;

    // -------------------- INDIVIDUAL --------------------
    if (isSingle) {
      const inv = eligible[0];
      const url = (format === "xml" ? inv.xml_url : inv.danfe_url) as string;
      const buf = await fetchFromFocus(url, token);

      const filename = buildIndividualFilename(
        inv.numero,
        inv.dest_nome,
        inv.authorized_at || inv.created_at,
        format === "xml" ? "xml" : "pdf",
      );

      const contentType = format === "xml" ? "application/xml" : "application/pdf";

      return new Response(buf, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // -------------------- MASSA --------------------
    // Baixar todos em paralelo (com tolerância a falha individual)
    const results = await Promise.allSettled(
      eligible.map(async (inv) => {
        const url = (format === "xml" ? inv.xml_url : inv.danfe_url) as string;
        const buf = await fetchFromFocus(url, token);
        return { inv, buf };
      }),
    );

    const okItems = results
      .filter((r): r is PromiseFulfilledResult<{ inv: any; buf: ArrayBuffer }> => r.status === "fulfilled")
      .map((r) => r.value);

    if (okItems.length === 0) {
      return jsonErr("Não foi possível baixar nenhum arquivo do provedor fiscal. Tente novamente em alguns instantes.");
    }

    if (format === "xml") {
      // ZIP com todos os XMLs
      const zip = new JSZip();
      for (const { inv, buf } of okItems) {
        const entry = buildIndividualFilename(
          inv.numero, inv.dest_nome, inv.authorized_at || inv.created_at, "xml",
        );
        zip.file(entry, buf);
      }
      const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      const filename = buildBulkFilename(okItems.length, "zip");

      return new Response(zipBuf, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // DANFE em massa → mesclar todos os PDFs em um único multipágina
    const merged = await PDFDocument.create();
    for (const { buf } of okItems) {
      try {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch (e) {
        console.error("[fiscal-download-docs] PDF merge skip:", e);
      }
    }
    const mergedBytes = await merged.save();
    const filename = buildBulkFilename(okItems.length, "pdf");

    return new Response(mergedBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: "fiscal", action: "download-docs" });
  }
});
