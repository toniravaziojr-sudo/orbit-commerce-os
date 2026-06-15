import { describe, it, expect } from "vitest";
import {
  resolveCreativeFormat,
  normalizeCreativeFormat,
} from "../../supabase/functions/_shared/ads-autopilot/creativeFormatResolver";

const base = {
  isTesting: false,
  requiresCatalog: false,
  hasValidCatalog: false,
  platform: "meta",
  objectiveCanonical: "sales" as string | null,
};

describe("Onda H.2.5 — Resolver de creative_format", () => {
  it("[Teste] não preenche formato; mantém variável H.4", () => {
    const r = resolveCreativeFormat({ ...base, isTesting: true });
    expect(r.value).toBeNull();
    expect(r.source).toBe("testing_h4_variable");
    expect(r.resolution_phase).toBe("h4_future");
  });

  it("Catálogo obrigatório sem catálogo válido vira pendência de configuração; NÃO cai para imagem", () => {
    const r = resolveCreativeFormat({ ...base, requiresCatalog: true, hasValidCatalog: false });
    expect(r.value).toBeNull();
    expect(r.source).toBe("missing_catalog_config");
    expect(r.resolution_phase).toBe("account_config");
    expect(r.missing_reason).toBeTruthy();
  });

  it("Catálogo obrigatório com catálogo válido usa 'catalog'", () => {
    const r = resolveCreativeFormat({ ...base, requiresCatalog: true, hasValidCatalog: true });
    expect(r.value).toBe("catalog");
    expect(r.source).toBe("catalog_required");
  });

  it("Formato explícito da estratégia tem prioridade sobre default", () => {
    const r = resolveCreativeFormat({ ...base, explicit: "carousel", accountDefault: "single_image" });
    expect(r.value).toBe("carousel");
    expect(r.source).toBe("strategy_explicit_format");
  });

  it("Default da conta tem prioridade sobre default contratual", () => {
    const r = resolveCreativeFormat({ ...base, accountDefault: "single_video" });
    expect(r.value).toBe("single_video");
    expect(r.source).toBe("account_default_format");
  });

  it("Meta + Vendas, não-[Teste], sem explícito nem conta → 'Imagem única' contratual", () => {
    const r = resolveCreativeFormat(base);
    expect(r.value).toBe("single_image");
    expect(r.label).toBe("Imagem única");
    expect(r.source).toBe("meta_sales_manual_contract_default");
    expect(r.resolution_phase).toBe("h2_structural");
  });

  it("Plataforma diferente de Meta NÃO recebe default contratual", () => {
    const r = resolveCreativeFormat({ ...base, platform: "google" });
    expect(r.value).toBeNull();
    expect(r.source).toBe("unsupported_format");
  });

  it("Objetivo diferente de Vendas NÃO recebe default contratual", () => {
    const r = resolveCreativeFormat({ ...base, objectiveCanonical: "traffic" });
    expect(r.value).toBeNull();
    expect(r.source).toBe("unsupported_format");
  });

  it("Aliases PT-BR e ingleses são normalizados", () => {
    expect(normalizeCreativeFormat("Imagem única")).toBe("single_image");
    expect(normalizeCreativeFormat("IMAGE")).toBe("single_image");
    expect(normalizeCreativeFormat("Carrossel")).toBe("carousel");
    expect(normalizeCreativeFormat("video")).toBe("single_video");
    expect(normalizeCreativeFormat("foo")).toBeNull();
  });
});
