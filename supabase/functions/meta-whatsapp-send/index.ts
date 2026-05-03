import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";
import {
  renderTemplate,
  assertNoPlaceholders,
  renderForInternalLog,
  TemplateRenderError,
} from "../_shared/template-renderer.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Reliability v2 — retry inline, timeout, idempotência, append atômico de tentativas
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-test-token",
};

// ===== Reliability v2 constants =====
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [0, 800, 2000]; // before attempt N (0-indexed)
const LOCK_TTL_SECONDS = 30;

interface SendMessageParams {
  tenant_id: string;
  phone: string;
  message: string;
  template_name?: string;
  template_language?: string;
  template_components?: any[];
  template_body?: string;
  template_payload?: Record<string, unknown>;
  image_url?: string;
  image_caption?: string;
  /** [Reliability v2] Optional messages.id used for idempotency lock + delivery_attempts append. */
  message_id?: string;
  /** [TEST ONLY] Force first N attempts to fail. Requires header x-internal-test-token. */
  _test_inject_failures?: number;
}

type AttemptOutcome = {
  attempt: number;
  ok: boolean;
  status: number | null;
  duration_ms: number;
  error_code?: string | number | null;
  error_message?: string | null;
  message_id?: string | null;
  timed_out?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function isRetryableHttpStatus(status: number): boolean {
  // Network/timeout handled separately. 5xx and 429 are retryable.
  return status === 429 || (status >= 500 && status <= 599);
}

function isRetryableMetaError(code: number | undefined): boolean {
  // Meta-side transient codes: 1 (unknown), 2 (service), 4 (rate), 17 (rate), 32 (rate), 613 (rate)
  if (!code) return false;
  return [1, 2, 4, 17, 32, 613].includes(code);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-send][${traceId}] Request received (v${VERSION})`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ===== TEST FLAG GUARD =====
  // _test_inject_failures only works if the request includes a valid internal test token header.
  // The token is stored in a runtime secret (INTERNAL_TEST_TOKEN). This blindagem garante que
  // produção normal não pode disparar falhas injetadas mesmo se um payload malicioso enviar a flag.
  const internalTestTokenHeader = req.headers.get("x-internal-test-token");
  const internalTestTokenSecret = Deno.env.get("META_WHATSAPP_TEST_INJECT_TOKEN") || "";
  const testModeAllowed = !!internalTestTokenSecret && internalTestTokenHeader === internalTestTokenSecret;

  try {
    const params: SendMessageParams & {
      recipient_override?: string;
      dry_send?: boolean;
      sandbox_force_send_failure?: boolean;
    } = await req.json();
    const {
      tenant_id, message, template_name, template_language, template_components,
      template_body, template_payload, image_url, image_caption, message_id,
    } = params;
    let phone = params.phone;

    // Sanitize test flag — only honored when header token matches
    const injectFailures = testModeAllowed ? Math.max(0, Math.min(MAX_ATTEMPTS, Number(params._test_inject_failures) || 0)) : 0;
    if (params._test_inject_failures && !testModeAllowed) {
      console.warn(`[meta-whatsapp-send][${traceId}] _test_inject_failures ignored (no valid x-internal-test-token)`);
    }
    if (injectFailures > 0) {
      console.log(`[meta-whatsapp-send][${traceId}] [TEST MODE] injectFailures=${injectFailures}`);
    }

    if (!tenant_id || !phone) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id e phone são obrigatórios" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message && !template_name && !image_url) {
      return new Response(JSON.stringify({ success: false, error: "message, template_name ou image_url é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // [SANDBOX GUARD RAIL — Reg #2.13 Fase C]
    // Bloqueia envio real se origem for sandbox/teste/dry_run.
    // Avalia ANTES de qualquer formatação de telefone.
    // ============================================================
    const allowRealSendHeader = (req.headers.get("x-allow-real-send") || "").toLowerCase() === "true";
    const recipientOverride = (params.recipient_override || "").trim();
    const allowlistRaw = Deno.env.get("TEST_WHATSAPP_RECIPIENT_ALLOWLIST") || "";
    const allowlist = allowlistRaw.split(",").map((s) => s.replace(/\D/g, "")).filter(Boolean);

    let convoMeta: Record<string, any> = {};
    let msgMeta: Record<string, any> = {};
    if (message_id) {
      const { data: msgRow0 } = await supabase
        .from("messages")
        .select("metadata, conversation_id")
        .eq("id", message_id)
        .maybeSingle();
      msgMeta = (msgRow0?.metadata as any) || {};
      if (msgRow0?.conversation_id) {
        const { data: convRow } = await supabase
          .from("conversations")
          .select("metadata")
          .eq("id", msgRow0.conversation_id)
          .maybeSingle();
        convoMeta = (convRow?.metadata as any) || {};
      }
    }

    const isSandboxConv = convoMeta.is_sandbox === true || msgMeta.is_sandbox === true;
    const dryFlag = params.dry_send === true || msgMeta.dry_send === true || convoMeta.dry_send === true;
    const realSendMeta = msgMeta.real_send === true || convoMeta.real_send === true;
    const sandboxPattern = /^(sandbox|test|fake|mock)|sandbox_burst|_test_|fake_/i;
    const phoneLooksFake = sandboxPattern.test(String(phone || ""));

    const isSandboxOrigin = isSandboxConv || dryFlag || phoneLooksFake;

    if (isSandboxOrigin) {
      // Tenta liberar somente se TODOS os requisitos forem satisfeitos
      const overrideDigits = recipientOverride.replace(/\D/g, "");
      const allowed =
        allowRealSendHeader &&
        recipientOverride.length > 0 &&
        allowlist.length > 0 &&
        allowlist.includes(overrideDigits) &&
        realSendMeta === true &&
        dryFlag === false;

      if (!allowed) {
        // DRY-RUN — não chama Meta
        const reason = !allowRealSendHeader
          ? "missing_x_allow_real_send"
          : !recipientOverride
          ? "missing_recipient_override"
          : allowlist.length === 0
          ? "empty_allowlist"
          : !allowlist.includes(overrideDigits)
          ? "recipient_not_in_allowlist"
          : !realSendMeta
          ? "missing_real_send_metadata"
          : dryFlag
          ? "dry_send_active"
          : "guard_rail";
        console.warn(`[meta-whatsapp-send][${traceId}] [GUARD-RAIL] sandbox real_send DENIED reason=${reason} phone=${phone}`);

        // Simular falha sem chamar Meta?
        const forceFailure = params.sandbox_force_send_failure === true || msgMeta.sandbox_force_send_failure === true;
        if (forceFailure) {
          if (message_id) {
            await supabase.from("messages").update({
              delivery_status: "failed",
              failure_reason: `sandbox_simulated_send_failure`,
              metadata: { ...msgMeta, delivery_adapter: "dry_run", real_send: false, dry_send: true, sandbox_force_send_failure: true },
            }).eq("id", message_id);
          }
          return new Response(JSON.stringify({
            success: false,
            managed_status: !!message_id,
            dry_run: true,
            real_send_allowed: false,
            simulated_failure: true,
            error: "sandbox_simulated_send_failure",
            guard_reason: reason,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // DRY-RUN sucesso técnico (NUNCA chamou Meta)
        if (message_id) {
          await supabase.from("messages").update({
            delivery_status: "dry_run",
            external_message_id: null,
            failure_reason: null,
            metadata: { ...msgMeta, delivery_adapter: "dry_run", real_send: false, dry_send: true, sandbox_dry_run_at: new Date().toISOString() },
          }).eq("id", message_id);
        }
        return new Response(JSON.stringify({
          success: true,
          managed_status: !!message_id,
          dry_run: true,
          real_send_allowed: false,
          wamid: null,
          message_id: null,
          guard_reason: reason,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Liberado — substituir phone pelo override autorizado e prosseguir
      console.warn(`[meta-whatsapp-send][${traceId}] [GUARD-RAIL] sandbox real_send_allowed=true override=${overrideDigits}`);
      phone = overrideDigits;
    }

    if (!tenant_id || !phone) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id e phone são obrigatórios (post-guard)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-send][${traceId}] Tenant: ${tenant_id}, Phone: ${phone}, message_id: ${message_id ?? "—"}, sandbox=${isSandboxOrigin}`);

    // ===== IDEMPOTENCY LOCK (Reliability v2) =====
    // If message_id is provided, we use a lock baseado no estado persistido em messages.metadata.delivery_lock.
    // Outra execução simultânea para a mesma message_id retorna 409 conflict_in_progress (NÃO é failure de entrega).
    let managedStatus = false;
    let acquiredLock = false;

    if (message_id) {
      managedStatus = true;
      const lockToken = `${traceId}-${Date.now()}`;
      const lockExpiresAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString();

      // Read current state
      const { data: msgRow, error: msgErr } = await supabase
        .from("messages")
        .select("id, metadata, delivery_status")
        .eq("id", message_id)
        .maybeSingle();

      if (msgErr || !msgRow) {
        console.error(`[meta-whatsapp-send][${traceId}] message_id ${message_id} não encontrado`);
        return new Response(JSON.stringify({ success: false, error: "message_id não encontrado", managed_status: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const meta = (msgRow.metadata as any) || {};
      const existingLock = meta.delivery_lock;
      const lockStillValid = existingLock?.expires_at && new Date(existingLock.expires_at) > new Date();

      // Already delivered? Idempotent return.
      if (msgRow.delivery_status === "sent" || msgRow.delivery_status === "delivered" || msgRow.delivery_status === "read") {
        console.log(`[meta-whatsapp-send][${traceId}] Already delivered (status=${msgRow.delivery_status}). Idempotent return.`);
        return new Response(JSON.stringify({
          success: true,
          managed_status: true,
          idempotent: true,
          message_id: meta.external_message_id ?? null,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Another execution holding the lock?
      if (lockStillValid && existingLock.token !== lockToken) {
        console.warn(`[meta-whatsapp-send][${traceId}] Lock already held (until ${existingLock.expires_at}). Conflict.`);
        return new Response(JSON.stringify({
          success: false,
          managed_status: true,
          conflict_in_progress: true,
          error: "Outra execução já está enviando esta mensagem",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Acquire lock
      const newMeta = { ...meta, delivery_lock: { token: lockToken, expires_at: lockExpiresAt, trace_id: traceId } };
      const { error: lockErr } = await supabase
        .from("messages")
        .update({ metadata: newMeta })
        .eq("id", message_id);

      if (lockErr) {
        console.error(`[meta-whatsapp-send][${traceId}] Failed to acquire lock:`, lockErr);
        return new Response(JSON.stringify({
          success: false,
          managed_status: true,
          error: "Falha ao adquirir lock de idempotência",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      acquiredLock = true;
    }

    // Get tenant's Meta WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .eq("connection_status", "connected")
      .single();

    if (configError || !config) {
      console.error(`[meta-whatsapp-send][${traceId}] No Meta config for tenant`);
      return new Response(JSON.stringify({ success: false, error: "WhatsApp Meta não configurado ou desconectado", managed_status: managedStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone_number_id, access_token, token_expires_at } = config;

    if (!phone_number_id || !access_token) {
      return new Response(JSON.stringify({ success: false, error: "Configuração incompleta do WhatsApp Meta", managed_status: managedStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (token_expires_at && new Date(token_expires_at) < new Date()) {
      console.error(`[meta-whatsapp-send][${traceId}] Token expired`);
      await supabase
        .from("whatsapp_configs")
        .update({ connection_status: "token_expired", last_error: "Token expirado" })
        .eq("id", config.id);

      return new Response(JSON.stringify({ success: false, error: "Token do WhatsApp expirado. Reconecte sua conta.", managed_status: managedStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= 24h WINDOW AUDIT =============
    if (!template_name && injectFailures === 0) {
      try {
        const { data: convo } = await supabase
          .from("conversations")
          .select("id, last_customer_message_at")
          .eq("tenant_id", tenant_id)
          .eq("channel_type", "whatsapp")
          .eq("customer_phone", phone)
          .order("last_customer_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const lastInbound = convo?.last_customer_message_at ? new Date(convo.last_customer_message_at) : null;
        const ageMs = lastInbound ? Date.now() - lastInbound.getTime() : Infinity;
        const WINDOW_MS = 24 * 60 * 60 * 1000;

        if (ageMs > WINDOW_MS) {
          console.warn(`[meta-whatsapp-send][${traceId}] Outside 24h window. Free text BLOCKED.`);
          await supabase.from("whatsapp_messages").insert({
            tenant_id,
            recipient_phone: phone,
            message_type: "text",
            message_content: (message ?? "").substring(0, 500),
            status: "failed",
            error_message: "Fora da janela de 24h: só é permitido enviar template aprovado.",
          });
          if (acquiredLock && message_id) {
            await supabase.from("messages").update({
              delivery_status: "failed",
              failure_reason: "OUTSIDE_24H_WINDOW",
            }).eq("id", message_id);
          }
          return new Response(JSON.stringify({
            success: false,
            error: "Fora da janela de 24h do WhatsApp. Use um template aprovado para reabrir a conversa.",
            code: "OUTSIDE_24H_WINDOW",
            last_customer_message_at: lastInbound?.toISOString() ?? null,
            managed_status: managedStatus,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (winErr) {
        console.warn(`[meta-whatsapp-send][${traceId}] 24h window check failed (non-fatal):`, winErr);
      }
    }

    // ============= Render visible content =============
    let visibleContent: string;
    try {
      if (template_name) {
        const source = template_body && template_body.length > 0 ? template_body : (message ?? "");
        if (source && source.length > 0) {
          const rendered = renderTemplate(source, template_payload ?? {}, { mode: "strict" });
          assertNoPlaceholders(rendered.text, { stage: "meta-whatsapp-send/template", templateName: template_name });
          visibleContent = rendered.text;
        } else {
          visibleContent = "Mensagem do sistema";
        }
      } else if (image_url) {
        visibleContent = (image_caption ?? "").substring(0, 1024) || "[imagem]";
      } else {
        const rendered = renderTemplate(message ?? "", template_payload ?? {}, { mode: "strict" });
        assertNoPlaceholders(rendered.text, { stage: "meta-whatsapp-send/text" });
        visibleContent = rendered.text;
      }
    } catch (err) {
      if (err instanceof TemplateRenderError) {
        console.error(`[meta-whatsapp-send][${traceId}] Template render blocked:`, err.message);
        const safeForLog = renderForInternalLog(template_body ?? message ?? "", template_payload ?? {});
        await supabase.from("whatsapp_messages").insert({
          tenant_id,
          recipient_phone: phone,
          message_type: template_name ? "template" : "text",
          message_content: safeForLog.text.substring(0, 500),
          status: "failed",
          error_message: `Template render blocked (missing: ${err.missing.join(", ") || "—"})`,
        });
        if (acquiredLock && message_id) {
          await supabase.from("messages").update({
            delivery_status: "failed",
            failure_reason: "TEMPLATE_RENDER_BLOCKED",
          }).eq("id", message_id);
        }
        return new Response(JSON.stringify({
          success: false,
          error: "Mensagem bloqueada: variáveis obrigatórias ausentes no template",
          missing: err.missing,
          managed_status: managedStatus,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }

    // Get graph API version
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();

    const graphApiVersion = versionCred?.credential_value || "v21.0";

    // Format phone
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "55" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    // Build payload
    const messageType: "template" | "image" | "text" = template_name ? "template" : (image_url ? "image" : "text");
    let messagePayload: any;

    if (messageType === "template") {
      const templateObj: any = {
        name: template_name,
        language: { code: template_language || "pt_BR" },
      };
      if (template_components && template_components.length > 0) {
        templateObj.components = template_components;
      }
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: templateObj,
      };
    } else if (messageType === "image") {
      const imageObj: any = { link: image_url };
      if (image_caption && image_caption.length > 0) {
        imageObj.caption = image_caption.substring(0, 1024);
      }
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "image",
        image: imageObj,
      };
    } else {
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: visibleContent },
      };
    }

    const sendUrl = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/messages`;
    console.log(`[meta-whatsapp-send][${traceId}] URL: ${sendUrl}, msg_type: ${messageType}, to: ${formattedPhone}`);

    // ============= RETRY LOOP (Reliability v2) =============
    let finalMessageId: string | null = null;
    let finalError: { code?: any; message: string } | null = null;
    let succeeded = false;
    const attempts: AttemptOutcome[] = [];

    for (let attemptNum = 1; attemptNum <= MAX_ATTEMPTS; attemptNum++) {
      // Backoff before retry (not before first)
      const backoff = RETRY_BACKOFF_MS[attemptNum - 1] ?? 0;
      if (backoff > 0) await new Promise((r) => setTimeout(r, backoff));

      const startedAt = Date.now();
      const attemptStartedIso = nowIso();
      let outcome: AttemptOutcome;

      // TEST: force first N attempts to fail with simulated 503
      if (injectFailures > 0 && attemptNum <= injectFailures) {
        const duration = Date.now() - startedAt;
        outcome = {
          attempt: attemptNum,
          ok: false,
          status: 503,
          duration_ms: duration,
          error_code: "TEST_INJECTED",
          error_message: "Simulated transient failure (test mode)",
          message_id: null,
          timed_out: false,
        };
        console.log(`[meta-whatsapp-send][${traceId}] [TEST] Attempt ${attemptNum} forced fail`);
      } else {
        try {
          const resp = await fetchWithTimeout(sendUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(messagePayload),
          }, ATTEMPT_TIMEOUT_MS);

          const duration = Date.now() - startedAt;
          const result = await resp.json().catch(() => ({}));

          if (resp.ok && !result.error) {
            outcome = {
              attempt: attemptNum,
              ok: true,
              status: resp.status,
              duration_ms: duration,
              message_id: result.messages?.[0]?.id ?? null,
            };
          } else {
            outcome = {
              attempt: attemptNum,
              ok: false,
              status: resp.status,
              duration_ms: duration,
              error_code: result.error?.code ?? resp.status,
              error_message: result.error?.message ?? `HTTP ${resp.status}`,
              message_id: null,
            };
          }
        } catch (err: any) {
          const duration = Date.now() - startedAt;
          const isAbort = err?.name === "AbortError";
          outcome = {
            attempt: attemptNum,
            ok: false,
            status: null,
            duration_ms: duration,
            error_code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
            error_message: isAbort ? `Timeout após ${ATTEMPT_TIMEOUT_MS}ms` : (err?.message ?? "Network error"),
            timed_out: isAbort,
          };
        }
      }

      // Append attempt to messages.metadata.delivery_attempts (atomic)
      if (message_id) {
        const attemptRecord = {
          attempt: outcome.attempt,
          started_at: attemptStartedIso,
          ended_at: nowIso(),
          duration_ms: outcome.duration_ms,
          ok: outcome.ok,
          http_status: outcome.status,
          error_code: outcome.error_code ?? null,
          error_message: outcome.error_message ?? null,
          timed_out: outcome.timed_out ?? false,
          provider_message_id: outcome.message_id ?? null,
          trace_id: traceId,
        };
        const { error: appendErr } = await supabase.rpc("append_delivery_attempt", {
          _message_id: message_id,
          _attempt: attemptRecord,
        });
        if (appendErr) {
          console.error(`[meta-whatsapp-send][${traceId}] Failed to append attempt ${attemptNum}:`, appendErr);
        }
      }

      attempts.push(outcome);
      console.log(`[meta-whatsapp-send][${traceId}] Attempt ${attemptNum}: ok=${outcome.ok} status=${outcome.status} dur=${outcome.duration_ms}ms err=${outcome.error_code ?? "—"}`);

      if (outcome.ok) {
        succeeded = true;
        finalMessageId = outcome.message_id ?? null;
        break;
      }

      finalError = { code: outcome.error_code, message: outcome.error_message ?? "Erro desconhecido" };

      // Decide whether to retry
      const isLastAttempt = attemptNum >= MAX_ATTEMPTS;
      if (isLastAttempt) break;

      const retryable =
        outcome.timed_out ||
        outcome.error_code === "NETWORK_ERROR" ||
        outcome.error_code === "TEST_INJECTED" ||
        (typeof outcome.status === "number" && isRetryableHttpStatus(outcome.status)) ||
        (typeof outcome.error_code === "number" && isRetryableMetaError(outcome.error_code));

      if (!retryable) {
        console.log(`[meta-whatsapp-send][${traceId}] Error not retryable. Stop.`);
        break;
      }
    }

    // ============= FINALIZE =============
    if (succeeded) {
      const usedRetry = attempts.length > 1;
      const finalStatus = usedRetry ? "delivered_after_retry" : "sent";

      // whatsapp_messages log
      await supabase.from("whatsapp_messages").insert({
        tenant_id,
        recipient_phone: formattedPhone,
        message_type: messageType,
        message_content: visibleContent.substring(0, 500),
        status: "sent",
        sent_at: nowIso(),
        provider_message_id: finalMessageId,
      });

      // Update messages row + release lock
      if (message_id) {
        const { data: row } = await supabase.from("messages").select("metadata").eq("id", message_id).maybeSingle();
        const meta = (row?.metadata as any) || {};
        const newMeta = { ...meta, external_message_id: finalMessageId, attempts_count: attempts.length };
        delete newMeta.delivery_lock;

        await supabase.from("messages").update({
          delivery_status: finalStatus,
          external_message_id: finalMessageId,
          failure_reason: null,
          metadata: newMeta,
        }).eq("id", message_id);
      }

      console.log(`[meta-whatsapp-send][${traceId}] SUCCESS in ${attempts.length} attempt(s). final_status=${finalStatus}`);

      return new Response(JSON.stringify({
        success: true,
        managed_status: managedStatus,
        message_id: finalMessageId,
        attempts: attempts.length,
        final_status: finalStatus,
        data: {
          message_id: finalMessageId,
          phone: formattedPhone,
          rendered_content: visibleContent,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FAILURE after all attempts
    const failureReason = finalError?.message ?? "Falha desconhecida";
    console.error(`[meta-whatsapp-send][${traceId}] FAILED after ${attempts.length} attempt(s). reason=${failureReason}`);

    await supabase.from("whatsapp_messages").insert({
      tenant_id,
      recipient_phone: formattedPhone,
      message_type: messageType,
      message_content: visibleContent.substring(0, 500),
      status: "failed",
      error_message: failureReason.substring(0, 500),
    });

    if (message_id) {
      const { data: row } = await supabase.from("messages").select("metadata").eq("id", message_id).maybeSingle();
      const meta = (row?.metadata as any) || {};
      const newMeta = { ...meta, attempts_count: attempts.length };
      delete newMeta.delivery_lock;

      await supabase.from("messages").update({
        delivery_status: "failed",
        failure_reason: failureReason.substring(0, 500),
        metadata: newMeta,
      }).eq("id", message_id);
    }

    return new Response(JSON.stringify({
      success: false,
      managed_status: managedStatus,
      error: failureReason,
      error_code: finalError?.code ?? null,
      attempts: attempts.length,
      final_status: "failed",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-whatsapp-send][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-send', action: 'send' });
  }
});
