/**
 * Teste integrado A2.1 (Opção C — PLANNER aprovado).
 *
 * Validação técnica controlada do helper recordFallbackShadowEvent contra DB real,
 * usando service_role. Idempotente por validation_run_id. Mantém o evento sintético
 * como evidência permanente.
 *
 * NÃO chama provider. NÃO gera imagem. NÃO toca wallet/ledger/pricing/config.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  FALLBACK_SHADOW_VERSION,
  recordFallbackShadowEvent,
} from "./fallback-shadow.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const TENANT_ID = "d1a4d0ed-8842-495e-b741-540a9a345b25";
const VALIDATION_RUN_ID = "a2-1-controlled-validation-2026-05-05";
const SYNTHETIC_JOB_ID = "synthetic-a21-validation-2026-05-05";
const EXPECTED_SERVICE_KEY = "fallback.gemini.gemini-2.5-flash-image.unpriced";

Deno.test("A2.1 integration: insert + RLS + isolation", async () => {
  assert(SUPABASE_URL, "SUPABASE_URL ausente");
  assert(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY ausente");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ===== Baselines =====
  const walletBefore = await admin
    .from("credit_wallet")
    .select("balance_credits,reserved_credits")
    .eq("tenant_id", TENANT_ID)
    .single();
  assertEquals(walletBefore.error, null);

  const ledgerBefore = await admin
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID);
  assertEquals(ledgerBefore.error, null);
  const ledgerCountBefore = ledgerBefore.count ?? 0;

  const cfgBefore = await admin
    .from("tenant_credit_motor_config")
    .select("motor_v2_enabled,live_service_keys,shadow_service_keys,metadata")
    .eq("tenant_id", TENANT_ID)
    .single();
  assertEquals(cfgBefore.error, null);
  assertEquals(cfgBefore.data?.motor_v2_enabled, false);
  assertEquals(Array.isArray(cfgBefore.data?.live_service_keys) && cfgBefore.data.live_service_keys.length, 0);

  const pricingBefore = await admin
    .from("service_pricing")
    .select("service_key", { count: "exact", head: true });
  assertEquals(pricingBefore.error, null);
  const pricingCountBefore = pricingBefore.count ?? 0;

  // ===== Idempotência =====
  const existing = await admin
    .from("service_usage_events")
    .select("id, metadata, status, cost_owner, service_key, provider, units_json, tenant_id, category, origin_function, credit_ledger_id, reservation_ledger_id, platform_cost_ledger_id, created_at")
    .eq("tenant_id", TENANT_ID)
    .filter("metadata->>validation_run_id", "eq", VALIDATION_RUN_ID);
  assertEquals(existing.error, null);
  const existingRows = existing.data ?? [];
  if (existingRows.length > 1) {
    throw new Error(`Duplicidade: ${existingRows.length} eventos para validation_run_id=${VALIDATION_RUN_ID}`);
  }

  let evidence: any;
  let createdNow = false;

  if (existingRows.length === 1) {
    evidence = existingRows[0];
    console.log(JSON.stringify({ evt: "a21.evidence.reused", id: evidence.id }));
  } else {
    const r = await recordFallbackShadowEvent(admin as any, {
      tenantId: TENANT_ID,
      creative_job_id: SYNTHETIC_JOB_ID,
      variation_index: 1,
      predicted_provider: "fal",
      predicted_model: "fal-ai/gpt-image-1/edit-image",
      predicted_service_key: "fal.gpt-image-1.5.per_image.medium_1024",
      actual_provider: "gemini",
      actual_model: "gemini-2.5-flash-image",
      winner_provider: "gemini",
      winner_model: "gemini-2.5-flash-image",
      fallback_reason: "technical_validation",
      providers_requested: ["openai", "gemini"],
      enable_fallback: true,
      synthetic: true,
      technical_validation: true,
      validation_run_id: VALIDATION_RUN_ID,
      validation_type: "synthetic_db_integration",
    });
    assertEquals(r.recorded, true, `INSERT falhou: ${r.error ?? ""}`);
    assertEquals(r.service_key, EXPECTED_SERVICE_KEY);
    createdNow = true;

    const fetched = await admin
      .from("service_usage_events")
      .select("id, metadata, status, cost_owner, service_key, provider, units_json, tenant_id, category, origin_function, credit_ledger_id, reservation_ledger_id, platform_cost_ledger_id, created_at")
      .eq("tenant_id", TENANT_ID)
      .filter("metadata->>validation_run_id", "eq", VALIDATION_RUN_ID);
    assertEquals(fetched.error, null);
    assertEquals((fetched.data ?? []).length, 1, "Esperado exatamente 1 evento sintético após INSERT");
    evidence = fetched.data![0];
    console.log(JSON.stringify({ evt: "a21.evidence.created", id: evidence.id }));
  }

  // ===== Asserts do evento =====
  assertEquals(evidence.status, "shadow");
  assertEquals(evidence.cost_owner, "platform");
  assertEquals(evidence.tenant_id, TENANT_ID);
  assertEquals(evidence.category, "ai_image");
  assertEquals(evidence.origin_function, "creative-image-generate");
  assertEquals(evidence.service_key, EXPECTED_SERVICE_KEY);
  assert(/^fallback\..+\.unpriced$/.test(evidence.service_key));
  assertEquals(evidence.provider, "gemini");
  assertEquals(evidence.units_json?.images, 1);
  assertEquals(evidence.credit_ledger_id, null);
  assertEquals(evidence.reservation_ledger_id, null);
  assertEquals(evidence.platform_cost_ledger_id, null);

  const m = evidence.metadata as Record<string, unknown>;
  assertEquals(m.is_fallback_event, true);
  assertEquals(m.fallback_shadow_version, FALLBACK_SHADOW_VERSION);
  assertEquals(m.pricing_status, "missing");
  assertEquals(m.unpriced, true);
  assertEquals(m.no_billing, true);
  assertEquals(m.no_wallet_mutation, true);
  assertEquals(m.no_ledger_mutation, true);
  assertEquals(m.synthetic, true);
  assertEquals(m.technical_validation, true);
  assertEquals(m.validation_run_id, VALIDATION_RUN_ID);
  assertEquals(m.validation_type, "synthetic_db_integration");
  assertEquals(m.live_behavior, "block_without_pricing");
  assertEquals(m.admin_visibility, true);

  // Campos proibidos
  assertEquals(m.cost_usd_snap, undefined);
  assertEquals(m.sell_usd_snap, undefined);
  assertEquals(m.credits, undefined);
  assertEquals(m.shadow_reserve, undefined);
  assertEquals(m.shadow_capture, undefined);
  assertEquals(m.shadow_release, undefined);

  // ===== Isolamento — wallet/ledger/config/pricing =====
  const walletAfter = await admin
    .from("credit_wallet")
    .select("balance_credits,reserved_credits")
    .eq("tenant_id", TENANT_ID)
    .single();
  assertEquals(walletAfter.data?.balance_credits, walletBefore.data?.balance_credits);
  assertEquals(walletAfter.data?.reserved_credits, walletBefore.data?.reserved_credits);

  const ledgerAfter = await admin
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID);
  assertEquals(ledgerAfter.count ?? 0, ledgerCountBefore);

  const cfgAfter = await admin
    .from("tenant_credit_motor_config")
    .select("motor_v2_enabled,live_service_keys")
    .eq("tenant_id", TENANT_ID)
    .single();
  assertEquals(cfgAfter.data?.motor_v2_enabled, false);
  assertEquals(Array.isArray(cfgAfter.data?.live_service_keys) && cfgAfter.data.live_service_keys.length, 0);

  const pricingAfter = await admin
    .from("service_pricing")
    .select("service_key", { count: "exact", head: true });
  assertEquals(pricingAfter.count ?? 0, pricingCountBefore);

  // ===== RLS — anon não enxerga evento platform =====
  const anonView = await anon
    .from("service_usage_events")
    .select("id")
    .eq("id", evidence.id);
  // anon deve receber 0 linhas (RLS bloqueia) ou erro de permissão. Aceitamos ambos.
  if (!anonView.error) {
    assertEquals((anonView.data ?? []).length, 0, "Anon não deveria enxergar evento platform");
  }

  console.log(JSON.stringify({
    evt: "a21.integration.summary",
    evidence_id: evidence.id,
    created_now: createdNow,
    validation_run_id: VALIDATION_RUN_ID,
  }));
});
