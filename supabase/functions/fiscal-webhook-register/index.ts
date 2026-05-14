// fiscal-webhook-register
// Lote 1.E — Cadastro automático do webhook Focus NFe por tenant.
// Owner/Admin only. Usa token por tenant na URL (sem expor o secret global).
// Sem transmissão de NF / sem alteração de certificado.

import { errorResponse } from "../_shared/error-response.ts";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ success: true, ...body }), {
    status: 200,
    headers: corsHeaders,
  });

const fail = (error: string, code: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: false, error, code, ...extra }), {
    status: 200, // standard: 200 + success:false for business errors
    headers: corsHeaders,
  });

function focusBaseUrl(ambiente: "homologacao" | "producao"): string {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function basicAuth(token: string): string {
  return "Basic " + btoa(`${token}:`);
}

function generateTenantToken(): string {
  // 32 random bytes -> 64 hex chars
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildSanitizedUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/functions/v1/fiscal-webhook`;
}

function buildRegisterUrl(token: string): string {
  return `${buildSanitizedUrl()}?t=${token}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireFiscalRole(req, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient } = auth;

    const body = await req.json().catch(() => ({}));
    const rotateToken = body?.rotate_token === true;
    const dryRun = body?.dry_run === true;

    // Read fiscal_settings
    const { data: settings, error: settingsErr } = await serviceClient
      .from("fiscal_settings")
      .select(
        "id, tenant_id, focus_empresa_id, focus_ambiente, ambiente, cnpj, certificado_valido_ate, webhook_status, webhook_environment, webhook_focus_hook_id, webhook_tenant_token, webhook_url_sanitized",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (settingsErr) {
      console.error("[webhook-register] settings error", settingsErr);
      return fail("Erro ao ler configuração fiscal", "settings_read_error");
    }
    if (!settings) {
      return fail("Configuração fiscal não encontrada", "settings_missing");
    }
    if (!settings.cnpj) {
      return fail("CNPJ do emitente não configurado", "missing_cnpj");
    }
    if (!settings.focus_empresa_id) {
      return fail(
        "Empresa ainda não sincronizada com a Focus NFe. Sincronize antes de cadastrar o webhook.",
        "focus_company_missing",
      );
    }
    if (!settings.certificado_valido_ate) {
      return fail("Certificado A1 ausente ou inválido", "certificate_missing");
    }
    if (new Date(settings.certificado_valido_ate).getTime() < Date.now()) {
      return fail("Certificado A1 vencido", "certificate_expired");
    }

    const ambiente = (settings.focus_ambiente || settings.ambiente || "homologacao") as
      | "homologacao"
      | "producao";

    // Choose Focus token: per-tenant provider_token > global env
    // Read provider_token in a separate query (it's masked from default selects)
    const { data: tokenRow } = await serviceClient
      .from("fiscal_settings")
      .select("provider_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const focusToken = tokenRow?.provider_token || Deno.env.get("FOCUS_NFE_TOKEN");
    if (!focusToken) {
      return fail("Token da Focus NFe não configurado", "focus_token_missing");
    }

    // Generate or reuse per-tenant token
    let tenantToken = settings.webhook_tenant_token as string | null;
    let tokenWasGenerated = false;
    if (!tenantToken || rotateToken) {
      tenantToken = generateTenantToken();
      tokenWasGenerated = true;
    }

    const sanitizedUrl = buildSanitizedUrl();
    const registerUrl = buildRegisterUrl(tenantToken!);

    if (dryRun) {
      return ok({
        dry_run: true,
        ambiente,
        webhook_url_sanitized: sanitizedUrl,
        token_rotated: tokenWasGenerated,
        focus_empresa_id: settings.focus_empresa_id,
      });
    }

    const baseUrl = focusBaseUrl(ambiente);

    // 1) List existing hooks for this CNPJ to avoid duplicates
    let existingHookId: string | null = null;
    try {
      const listRes = await fetch(`${baseUrl}/v2/hooks?cnpj=${encodeURIComponent(settings.cnpj!)}`, {
        method: "GET",
        headers: { Authorization: basicAuth(focusToken) },
      });
      if (listRes.ok) {
        const arr = await listRes.json();
        if (Array.isArray(arr)) {
          // Match by URL path (ignoring query) so token rotation still finds the same hook
          const matched = arr.find((h: any) => {
            try {
              const u = new URL(h.url || "");
              return u.origin + u.pathname === sanitizedUrl;
            } catch { return false; }
          });
          if (matched?.id) existingHookId = String(matched.id);
        }
      } else {
        const text = await listRes.text();
        console.warn(`[webhook-register] list hooks status=${listRes.status} body=${text.slice(0, 300)}`);
      }
    } catch (e) {
      console.warn("[webhook-register] list hooks failed (continuing):", e);
    }

    // 2) Delete existing hook if found (to update URL with potentially rotated token)
    if (existingHookId) {
      try {
        const delRes = await fetch(`${baseUrl}/v2/hooks/${existingHookId}`, {
          method: "DELETE",
          headers: { Authorization: basicAuth(focusToken) },
        });
        if (!delRes.ok && delRes.status !== 404) {
          const text = await delRes.text();
          console.warn(`[webhook-register] delete hook status=${delRes.status} body=${text.slice(0, 300)}`);
        }
      } catch (e) {
        console.warn("[webhook-register] delete hook failed (continuing):", e);
      }
    }

    // 3) Register new hook
    const createBody = {
      cnpj: settings.cnpj,
      url: registerUrl,
      event: "nfe",
    };

    let newHookId: string | null = null;
    let registerError: string | null = null;
    try {
      const createRes = await fetch(`${baseUrl}/v2/hooks`, {
        method: "POST",
        headers: {
          Authorization: basicAuth(focusToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createBody),
      });
      const respText = await createRes.text();
      if (createRes.ok) {
        try {
          const json = JSON.parse(respText);
          newHookId = json?.id ? String(json.id) : null;
        } catch { /* noop */ }
      } else {
        // Sanitize: never log token / URL with token
        const sanitized = respText.replace(tenantToken!, "***").slice(0, 500);
        registerError = `Focus respondeu ${createRes.status}: ${sanitized}`;
        console.error("[webhook-register]", registerError);
      }
    } catch (e: any) {
      registerError = `Falha de rede ao chamar Focus: ${e?.message || "desconhecido"}`;
      console.error("[webhook-register]", registerError);
    }

    const now = new Date().toISOString();
    const updatePatch: Record<string, unknown> = {
      webhook_url_sanitized: sanitizedUrl,
      webhook_environment: ambiente,
      webhook_tenant_token: tenantToken,
      ...(tokenWasGenerated ? { webhook_token_rotated_at: now } : {}),
    };

    if (registerError) {
      updatePatch.webhook_status = "error";
      updatePatch.webhook_last_error = registerError;
      updatePatch.webhook_last_error_at = now;
    } else {
      updatePatch.webhook_status = "pending";
      updatePatch.webhook_focus_hook_id = newHookId;
      updatePatch.webhook_registered_at = now;
      updatePatch.webhook_last_error = null;
      updatePatch.webhook_last_error_at = null;
    }

    const { error: updateErr } = await serviceClient
      .from("fiscal_settings")
      .update(updatePatch)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      console.error("[webhook-register] update error", updateErr);
      return fail("Não foi possível salvar o status do webhook", "settings_update_error");
    }

    if (registerError) {
      // Fall-through: cadastro automático falhou, retornamos fallback manual
      // (URL com token por tenant — NUNCA o secret global)
      return ok({
        auto_register_succeeded: false,
        fallback: true,
        ambiente,
        webhook_url_sanitized: sanitizedUrl,
        manual_register_url: registerUrl, // contém apenas o token por tenant
        manual_register_event: "nfe",
        manual_register_cnpj: settings.cnpj,
        error: registerError,
      });
    }

    return ok({
      auto_register_succeeded: true,
      ambiente,
      webhook_url_sanitized: sanitizedUrl,
      focus_hook_id: newHookId,
      status: "pending",
    });
  } catch (e: unknown) {
    return errorResponse(e, corsHeaders, { module: "fiscal", action: "webhook-register" });
  }
});
