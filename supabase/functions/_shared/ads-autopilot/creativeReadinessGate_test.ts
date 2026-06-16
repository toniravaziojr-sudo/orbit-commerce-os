// =============================================================================
// H.4.0 — Testes do motor puro creativeReadinessGate
// Nenhum teste cria creative_jobs, chama IA, chama Meta ou faz I/O.
// =============================================================================

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateCreativeReadiness,
  type CreativeReadinessInput,
  CREATIVE_READINESS_CONTRACT_VERSION,
} from "./creativeReadinessGate.ts";

function baseInput(): CreativeReadinessInput {
  return {
    proposal: {
      id: "p1",
      proposal_kind: "creation",
      campaign_objective: "CONVERSIONS",
      destination_url: "https://exemplo.com/produto",
      utm_template: "utm_source=meta&utm_medium=cpc&utm_campaign={{c}}",
      budget_amount_cents: 5000_00,
      audience_defined: true,
      placements_defined: true,
      catalog_required: false,
      catalog_linked: false,
      planned_creatives: [
        { index: 0, origin: "creation", format: "image_single", cta: "SHOP_NOW" },
        { index: 1, origin: "creation", format: "image_single", cta: "LEARN_MORE" },
      ],
    },
    meta: {
      oauth_active: true,
      ad_account_valid: true,
      facebook_page_linked: true,
      pixel_configured: true,
      conversion_event_set: true,
      attribution_window_set: true,
    },
    brand: {
      brand_summary: "Marca premium",
      tone_of_voice: "Direto, masculino",
      visual_style_guidelines: "Fundo limpo",
      logo_url: "https://cdn/logo.png",
      palette_defined: true,
      packshot_url: "https://cdn/pack.png",
      banned_claims: ["cura"],
      do_not_do: ["mostrar mãos"],
      allowed_claims: ["hidrata", "fortalece"],
      approved_main_promise: "Cabelos mais fortes em 30 dias",
      compliance_notes: null,
      no_additional_restrictions_confirmed: false,
    },
    product: {
      id: "prod1",
      name: "Shampoo X",
      description: "Shampoo fortalecedor para cabelos masculinos",
      benefits: ["fortalece raiz", "reduz queda"],
      is_physical: true,
      primary_image_url: "https://cdn/prod.png",
      regulatory_category: "cosmetic_hair",
      commercial_restrictions: "Não usar termos médicos",
      no_additional_restrictions_confirmed: false,
    },
    pricing: {
      format_to_service_key: {
        image_single: "fal.gpt-image-1.5.per_image.medium_1024",
        carousel: "fal.gpt-image-1.5.per_image.medium_1024",
        video: null,
      },
      table: {
        "fal.gpt-image-1.5.per_image.medium_1024": {
          service_key: "fal.gpt-image-1.5.per_image.medium_1024",
          credits_per_unit: 10,
        },
      },
      cost_table_version: "2026-06-16",
    },
  };
}

function expectBlocker(field: string, input: CreativeReadinessInput) {
  const r = evaluateCreativeReadiness(input);
  assertEquals(r.status, "blocked", `esperava blocked por ${field}`);
  assert(
    r.blockers.some((b) => b.field === field),
    `esperava blocker com field=${field}, recebi: ${r.blockers.map((b) => b.field).join(",")}`,
  );
}

Deno.test("01 ready quando tudo está completo e custo é calculável", () => {
  const r = evaluateCreativeReadiness(baseInput());
  assertEquals(r.contract_version, CREATIVE_READINESS_CONTRACT_VERSION);
  assertEquals(r.status, "ready");
  assertEquals(r.blockers.length, 0);
  assert(r.cost_estimate.calculable);
  assertEquals(r.cost_estimate.total_jobs, 2);
  assertEquals(r.cost_estimate.total_credits, 20);
});

Deno.test("02 blocked sem conexão Meta", () => {
  const i = baseInput(); i.meta.oauth_active = false;
  expectBlocker("meta.oauth_active", i);
});

Deno.test("03 blocked sem Página do Facebook", () => {
  const i = baseInput(); i.meta.facebook_page_linked = false;
  expectBlocker("meta.facebook_page", i);
});

Deno.test("04 blocked sem Pixel", () => {
  const i = baseInput(); i.meta.pixel_configured = false;
  expectBlocker("meta.pixel", i);
});

Deno.test("05 blocked sem evento de conversão", () => {
  const i = baseInput(); i.meta.conversion_event_set = false;
  expectBlocker("meta.conversion_event", i);
});

Deno.test("06 blocked sem janela de atribuição", () => {
  const i = baseInput(); i.meta.attribution_window_set = false;
  expectBlocker("meta.attribution_window", i);
});

Deno.test("07 blocked sem UTM", () => {
  const i = baseInput(); i.proposal.utm_template = null;
  expectBlocker("proposal.utm_template", i);
});

Deno.test("08 blocked sem URL de destino", () => {
  const i = baseInput(); i.proposal.destination_url = "";
  expectBlocker("proposal.destination_url", i);
});

Deno.test("09 blocked sem CTA em variação", () => {
  const i = baseInput(); i.proposal.planned_creatives[0].cta = null;
  expectBlocker("creative.0.cta", i);
});

Deno.test("10 blocked sem formato real em variação", () => {
  const i = baseInput(); i.proposal.planned_creatives[0].format = "test_pending";
  expectBlocker("creative.0.format", i);
});

Deno.test("11 [Teste] bloqueia quando variação não tem formato real", () => {
  const i = baseInput();
  i.proposal.proposal_kind = "test";
  i.proposal.planned_creatives = [
    { index: 0, origin: "test", format: "test_pending", cta: "SHOP_NOW" },
  ];
  expectBlocker("creative.0.format", i);
});

Deno.test("12 [Criação] passa com formato image_single mas bloqueia se briefing falta", () => {
  const i = baseInput();
  i.product.description = null;
  expectBlocker("product.description", i);
});

Deno.test("13 blocked sem descrição de produto", () => {
  const i = baseInput(); i.product.description = "";
  expectBlocker("product.description", i);
});

Deno.test("14 blocked sem promessa principal aprovada", () => {
  const i = baseInput(); i.brand.approved_main_promise = null;
  expectBlocker("brand.approved_main_promise", i);
});

Deno.test("15 blocked sem diferenciais/benefícios", () => {
  const i = baseInput(); i.product.benefits = [];
  expectBlocker("product.benefits", i);
});

Deno.test("16 blocked sem logo", () => {
  const i = baseInput(); i.brand.logo_url = null;
  expectBlocker("brand.logo_url", i);
});

Deno.test("17 blocked sem paleta", () => {
  const i = baseInput(); i.brand.palette_defined = false;
  expectBlocker("brand.palette", i);
});

Deno.test("18 blocked sem referência visual confiável", () => {
  const i = baseInput();
  i.product.primary_image_url = null;
  i.brand.packshot_url = null;
  expectBlocker("brand.visual_reference", i);
});

Deno.test("19 blocked sem claims permitidas", () => {
  const i = baseInput(); i.brand.allowed_claims = [];
  expectBlocker("brand.allowed_claims", i);
});

Deno.test("20 blocked sem claims proibidas E sem confirmação explícita", () => {
  const i = baseInput();
  i.brand.banned_claims = [];
  i.brand.do_not_do = [];
  i.brand.no_additional_restrictions_confirmed = false;
  expectBlocker("brand.restrictions", i);
});

Deno.test("20b passa quando claims proibidas vazias mas confirmação explícita marcada", () => {
  const i = baseInput();
  i.brand.banned_claims = [];
  i.brand.do_not_do = [];
  i.brand.no_additional_restrictions_confirmed = true;
  const r = evaluateCreativeReadiness(i);
  assertEquals(r.status, "ready");
});

Deno.test("21 categoria sensível sem restrições nem confirmação bloqueia", () => {
  const i = baseInput();
  i.product.regulatory_category = "supplement";
  i.product.commercial_restrictions = null;
  i.product.no_additional_restrictions_confirmed = false;
  expectBlocker("product.commercial_restrictions", i);
});

Deno.test("22 blocked sem categoria regulatória", () => {
  const i = baseInput(); i.product.regulatory_category = null;
  expectBlocker("product.regulatory_category", i);
});

Deno.test("23 blocked quando custo não é calculável (preço ausente)", () => {
  const i = baseInput();
  i.pricing.table = {};
  expectBlocker("pricing.cost_table", i);
});

Deno.test("24 cost_estimate retorna total_credits e total_jobs quando calculável", () => {
  const r = evaluateCreativeReadiness(baseInput());
  assert(r.cost_estimate.calculable);
  assertEquals(r.cost_estimate.total_jobs, 2);
  assertEquals(r.cost_estimate.total_credits, 20);
  assertEquals(r.cost_estimate.source, "service_pricing");
});

Deno.test("25 sem orçamento bloqueia", () => {
  const i = baseInput(); i.proposal.budget_amount_cents = 0;
  expectBlocker("proposal.budget", i);
});

Deno.test("26 sem público bloqueia", () => {
  const i = baseInput(); i.proposal.audience_defined = false;
  expectBlocker("proposal.audience", i);
});

Deno.test("27 catálogo exigido mas não vinculado bloqueia", () => {
  const i = baseInput();
  i.proposal.catalog_required = true;
  i.proposal.catalog_linked = false;
  expectBlocker("proposal.catalog", i);
});
