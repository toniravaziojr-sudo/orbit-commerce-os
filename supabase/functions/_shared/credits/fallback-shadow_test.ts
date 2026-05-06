/**
 * Testes unitários do Fallback Shadow (Fase A2.1).
 * Funções puras — não tocam DB, RPCs, wallet, ledger ou provider.
 * recordFallbackShadowEvent é testado com supabase mockado.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isFallbackShadowEnabled,
  normalizeProviderForFallback,
  resolveFallbackServiceKey,
  slugifyModelForFallback,
  buildFallbackShadowMetadata,
  recordFallbackShadowEvent,
  FALLBACK_SHADOW_VERSION,
} from "./fallback-shadow.ts";

Deno.test("gate isFallbackShadowEnabled: ambos campos exigidos", () => {
  assertEquals(isFallbackShadowEnabled(null), false);
  assertEquals(isFallbackShadowEnabled(undefined), false);
  assertEquals(isFallbackShadowEnabled({}), false);
  assertEquals(isFallbackShadowEnabled({ fallback_shadow_enabled: true }), false);
  assertEquals(isFallbackShadowEnabled({ fallback_shadow_enabled: true, fallback_shadow_version: "0.0.9" }), false);
  assertEquals(isFallbackShadowEnabled({ fallback_shadow_enabled: false, fallback_shadow_version: "0.1.0" }), false);
  assert(isFallbackShadowEnabled({ fallback_shadow_enabled: true, fallback_shadow_version: "0.1.0" }));
});

Deno.test("normalizeProviderForFallback cobre Gemini/OpenAI/Lovable/Fal/unknown", () => {
  assertEquals(normalizeProviderForFallback("gemini"), "gemini");
  assertEquals(normalizeProviderForFallback("Google"), "gemini");
  assertEquals(normalizeProviderForFallback("nano-banana"), "gemini");
  assertEquals(normalizeProviderForFallback("openai"), "openai");
  assertEquals(normalizeProviderForFallback("gpt-image-1"), "openai");
  assertEquals(normalizeProviderForFallback("DALL-E"), "openai");
  assertEquals(normalizeProviderForFallback("Lovable Gateway"), "lovable");
  assertEquals(normalizeProviderForFallback("fal-ai"), "fal");
  assertEquals(normalizeProviderForFallback("fal"), "fal");
  assertEquals(normalizeProviderForFallback(""), "unknown");
  assertEquals(normalizeProviderForFallback(null), "unknown");
});

Deno.test("slugifyModelForFallback gera slug seguro", () => {
  assertEquals(slugifyModelForFallback("gemini-2.5-flash-image"), "gemini-2.5-flash-image");
  assertEquals(slugifyModelForFallback("GPT Image 1"), "gpt-image-1");
  assertEquals(slugifyModelForFallback("foo/bar baz!!"), "foo-bar-baz");
  assertEquals(slugifyModelForFallback(null), "unknown-model");
  assertEquals(slugifyModelForFallback(""), "unknown-model");
});

Deno.test("resolveFallbackServiceKey usa prefixo fallback. e sufixo .unpriced", () => {
  const k1 = resolveFallbackServiceKey("gemini", "gemini-2.5-flash-image");
  assertEquals(k1, "fallback.gemini.gemini-2.5-flash-image.unpriced");
  assert(k1.startsWith("fallback."));
  assert(k1.endsWith(".unpriced"));

  assertEquals(
    resolveFallbackServiceKey("openai", "gpt-image-1"),
    "fallback.openai.gpt-image-1.unpriced",
  );
  assertEquals(
    resolveFallbackServiceKey("lovable", "gemini-2.5-flash-image"),
    "fallback.lovable.gemini-2.5-flash-image.unpriced",
  );
  assertEquals(
    resolveFallbackServiceKey("Google", "Nano Banana 2"),
    "fallback.gemini.nano-banana-2.unpriced",
  );
});

Deno.test("buildFallbackShadowMetadata invariantes obrigatórios", () => {
  const meta = buildFallbackShadowMetadata({
    creative_job_id: "job-123",
    variation_index: 1,
    predicted_provider: "fal",
    predicted_model: "fal-ai/gpt-image-1/edit-image",
    predicted_service_key: "fal.gpt-image-1.5.per_image.medium_1024",
    actual_provider: "gemini",
    actual_model: "gemini-2.5-flash-image",
    winner_provider: "gemini",
    winner_model: "gemini-2.5-flash-image",
    fallback_reason: "fal_unavailable",
    providers_requested: ["openai", "gemini"],
    enable_fallback: true,
  });

  assertEquals(meta.motor_version, "v2");
  assertEquals(meta.mode, "shadow");
  assertEquals(meta.is_fallback_event, true);
  assertEquals(meta.fallback_shadow_version, FALLBACK_SHADOW_VERSION);
  assertEquals(meta.pricing_status, "missing");
  assertEquals(meta.unpriced, true);
  assertEquals(meta.no_billing, true);
  assertEquals(meta.no_wallet_mutation, true);
  assertEquals(meta.no_ledger_mutation, true);
  assertEquals(meta.absorbed_by_platform, true);
  assertEquals(meta.actual_service_key, null);
  assertEquals(meta.live_behavior, "block_without_pricing");
  assertEquals(meta.pricing_missing_reason, "no_service_pricing_row_for_model");
  assertEquals(meta.admin_visibility, true);

  // Não deve haver cost/sell/credits
  const asAny = meta as Record<string, unknown>;
  assertEquals(asAny.cost_usd_snap, undefined);
  assertEquals(asAny.sell_usd_snap, undefined);
  assertEquals(asAny.credits, undefined);
  assertEquals(asAny.shadow_reserve, undefined);
  assertEquals(asAny.shadow_capture, undefined);
  assertEquals(asAny.shadow_release, undefined);
});

Deno.test("buildFallbackShadowMetadata trata valores ausentes", () => {
  const meta = buildFallbackShadowMetadata({
    creative_job_id: "job-x",
    variation_index: 2,
    actual_provider: null,
    actual_model: null,
  });
  assertEquals(meta.predicted_provider, null);
  assertEquals(meta.predicted_service_key, null);
  assertEquals(meta.providers_requested, []);
  assertEquals(meta.enable_fallback, false);
  assertEquals(meta.fallback_reason, null);
});

// ====== Mock supabase para testar recordFallbackShadowEvent ======

function makeMockSupabase(opts: { fail?: boolean } = {}) {
  const calls: Array<{ table: string; row: any }> = [];
  return {
    calls,
    from(table: string) {
      return {
        insert: async (row: any) => {
          calls.push({ table, row });
          if (opts.fail) return { error: { message: "mock_insert_failure" } };
          return { error: null };
        },
      };
    },
  };
}

Deno.test("recordFallbackShadowEvent insere com schema correto", async () => {
  const sb = makeMockSupabase();
  const r = await recordFallbackShadowEvent(sb as any, {
    tenantId: "tenant-1",
    creative_job_id: "job-1",
    variation_index: 1,
    actual_provider: "gemini",
    actual_model: "gemini-2.5-flash-image",
    predicted_provider: "fal",
    predicted_service_key: "fal.gpt-image-1.5.per_image.medium_1024",
    providers_requested: ["openai", "gemini"],
    enable_fallback: true,
    fallback_reason: "winner_not_fal",
  });
  assertEquals(r.recorded, true);
  assertEquals(sb.calls.length, 1);
  const row = sb.calls[0].row;
  assertEquals(sb.calls[0].table, "service_usage_events");
  assertEquals(row.tenant_id, "tenant-1");
  assertEquals(row.cost_owner, "platform");
  assertEquals(row.status, "shadow");
  assertEquals(row.category, "ai_image");
  assertEquals(row.provider, "gemini");
  assertEquals(row.origin_function, "creative-image-generate");
  assertEquals(row.units_json, { images: 1 });
  assert(typeof row.service_key === "string");
  assert(row.service_key.startsWith("fallback."));
  assert(row.service_key.endsWith(".unpriced"));
  assertEquals(row.metadata.is_fallback_event, true);
  assertEquals(row.metadata.pricing_status, "missing");
  // Garantia: nenhum campo de ledger preenchido
  assertEquals(row.credit_ledger_id, undefined);
  assertEquals(row.reservation_ledger_id, undefined);
  assertEquals(row.platform_cost_ledger_id, undefined);
});

Deno.test("recordFallbackShadowEvent não lança em falha de insert", async () => {
  const sb = makeMockSupabase({ fail: true });
  const r = await recordFallbackShadowEvent(sb as any, {
    tenantId: "tenant-1",
    creative_job_id: "job-2",
    variation_index: 1,
    actual_provider: "openai",
    actual_model: "gpt-image-1",
  });
  assertEquals(r.recorded, false);
  assertEquals(r.error, "mock_insert_failure");
});
