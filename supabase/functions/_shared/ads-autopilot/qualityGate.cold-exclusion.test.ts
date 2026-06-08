// =====================================================================
// Frente 1 — Tests for the cold/customer-exclusion rule in the Quality Gate.
// Run: deno test --allow-net --allow-env supabase/functions/_shared/ads-autopilot/qualityGate.cold-exclusion.test.ts
// =====================================================================

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runCreateCampaignQualityGate,
  QUALITY_GATE_VERSION,
} from "./qualityGate.ts";
import {
  buildCustomerExclusionMetadata,
  isColdFunnelStage,
} from "./customerAudience.ts";

const baseProduct = { id: "p1", name: "Shampoo Calvície Zero", price: 99 };

function buildArgs(overrides: Record<string, unknown> = {}) {
  return {
    campaign_name: "[AI] Frio | Shampoo Calvície Zero | PV 14D",
    product_id: "p1",
    product_name: "Shampoo Calvície Zero",
    funnel_stage: "cold",
    headlines: ["Shampoo Calvície Zero — homens 30+"],
    primary_texts: ["Descubra o segredo do Shampoo Calvície Zero para reduzir a queda."],
    cta: "SHOP_NOW",
    objective: "OUTCOME_SALES",
    daily_budget_cents: 5000,
    destination_url: "https://example.com/shampoo-calvicie-zero",
    creative_url: "https://cdn.test/c.png",
    ad_format: "SINGLE_IMAGE",
    excluded_audience_ids: [] as Array<unknown>,
    ...overrides,
  };
}

Deno.test("v1.3.0 is the current Quality Gate version", () => {
  assertEquals(QUALITY_GATE_VERSION, "1.3.0");
});

Deno.test("cold campaign WITHOUT customer audience info → no block (back-compat)", () => {
  const res = runCreateCampaignQualityGate({
    args: buildArgs(),
    matchedProduct: baseProduct,
    catalog: [baseProduct],
    // customerAudience omitted on purpose (legacy callers)
  });
  assert(res.ok, `expected ok, got ${JSON.stringify(res.reason_codes)}`);
  assertEquals(res.details.customer_audience_check, "skipped_no_resolver_input");
});

Deno.test("cold campaign + customer audience MISSING → blocks with cold_audience_requires_customer_exclusion", () => {
  const res = runCreateCampaignQualityGate({
    args: buildArgs(),
    matchedProduct: baseProduct,
    catalog: [baseProduct],
    customerAudience: { found: false, meta_audience_id: null, audience_name: null },
  });
  assertEquals(res.ok, false);
  assert(res.reason_codes.includes("cold_audience_requires_customer_exclusion"));
  assertEquals(res.details.customer_audience_status, "missing_in_account");
});

Deno.test("cold campaign + customer audience EXISTS but exclusion NOT applied → blocks", () => {
  const res = runCreateCampaignQualityGate({
    args: buildArgs({ excluded_audience_ids: [] }),
    matchedProduct: baseProduct,
    catalog: [baseProduct],
    customerAudience: { found: true, meta_audience_id: "120244679266150057", audience_name: "Clientes" },
  });
  assertEquals(res.ok, false);
  assert(res.reason_codes.includes("cold_audience_requires_customer_exclusion"));
  assertEquals(res.details.customer_audience_status, "exclusion_not_applied");
});

Deno.test("cold campaign + customer audience EXISTS + exclusion APPLIED → passes", () => {
  const res = runCreateCampaignQualityGate({
    args: buildArgs({
      excluded_audience_ids: [{ id: "120244679266150057", name: "Clientes" }],
    }),
    matchedProduct: baseProduct,
    catalog: [baseProduct],
    customerAudience: { found: true, meta_audience_id: "120244679266150057", audience_name: "Clientes" },
  });
  assert(res.ok, `expected ok, got ${JSON.stringify(res.reason_codes)}`);
  assertEquals(res.details.customer_audience_status, "exclusion_applied");
});

Deno.test("WARM/remarketing campaigns DO NOT require customer exclusion", () => {
  const res = runCreateCampaignQualityGate({
    args: buildArgs({ funnel_stage: "warm" }),
    matchedProduct: baseProduct,
    catalog: [baseProduct],
    customerAudience: { found: false, meta_audience_id: null, audience_name: null },
  });
  assert(res.ok, `warm should pass, got ${JSON.stringify(res.reason_codes)}`);
});

Deno.test("isColdFunnelStage recognizes cold/tof/prospecting", () => {
  assertEquals(isColdFunnelStage("cold"), true);
  assertEquals(isColdFunnelStage("tof"), true);
  assertEquals(isColdFunnelStage("prospecting"), true);
  assertEquals(isColdFunnelStage("frio"), true);
  assertEquals(isColdFunnelStage("warm"), false);
  assertEquals(isColdFunnelStage("hot"), false);
  assertEquals(isColdFunnelStage(""), false);
  assertEquals(isColdFunnelStage(null), false);
});

Deno.test("buildCustomerExclusionMetadata signals applied vs missing", () => {
  const meta = buildCustomerExclusionMetadata(
    {
      found: true,
      meta_audience_id: "120244679266150057",
      audience_name: "Clientes",
      list_id: "46154bee-53d5-4472-bd8f-5da2a8c1d02c",
      ad_account_id: "act_251893833881780",
      source: "audience_sync_mapping",
    },
    true,
  );
  assertEquals(meta.customer_audience_exclusion_enabled, true);
  assertEquals(meta.exclusion_reason, "cold_audience_must_exclude_existing_customers");
  assertEquals(meta.customer_audience_missing, false);

  const missing = buildCustomerExclusionMetadata(
    {
      found: false,
      meta_audience_id: null,
      audience_name: null,
      list_id: null,
      ad_account_id: "act_x",
      source: null,
    },
    true,
  );
  assertEquals(missing.customer_audience_exclusion_enabled, false);
  assertEquals(missing.customer_audience_missing, true);
});
