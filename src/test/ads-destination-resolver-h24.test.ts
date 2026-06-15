// =============================================================================
// Testes do resolver de destino — Onda H.2.4 (Contrato Meta Vendas v1.1)
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  resolveDestination,
  sanitizePublicUrl,
  sanitizeVerifiedDomain,
} from "../../supabase/functions/_shared/ads-autopilot/destinationResolver";

describe("sanitizePublicUrl", () => {
  it("aceita https público comum", () => {
    expect(sanitizePublicUrl("https://www.respeiteohomem.com.br/produto/x"))
      .toBe("https://www.respeiteohomem.com.br/produto/x");
  });
  it("rejeita http e vazio", () => {
    expect(sanitizePublicUrl("http://x.com")).toBeNull();
    expect(sanitizePublicUrl("")).toBeNull();
    expect(sanitizePublicUrl(null)).toBeNull();
  });
  it("rejeita admin/preview/checkout admin/localhost/lovable/supabase", () => {
    expect(sanitizePublicUrl("https://x.com/admin/x")).toBeNull();
    expect(sanitizePublicUrl("https://x.com/preview/y")).toBeNull();
    expect(sanitizePublicUrl("https://x.com/checkout/admin")).toBeNull();
    expect(sanitizePublicUrl("https://localhost/x")).toBeNull();
    expect(sanitizePublicUrl("https://abc.lovable.app/produto/y")).toBeNull();
    expect(sanitizePublicUrl("https://xyz.supabase.co/storage")).toBeNull();
    expect(sanitizePublicUrl("https://x.com/?preview=1")).toBeNull();
  });
});

describe("sanitizeVerifiedDomain", () => {
  it("normaliza domínio com protocolo e path", () => {
    expect(sanitizeVerifiedDomain("https://www.respeiteohomem.com.br/x"))
      .toBe("www.respeiteohomem.com.br");
  });
  it("rejeita domínios não confiáveis", () => {
    expect(sanitizeVerifiedDomain("abc.lovable.app")).toBeNull();
    expect(sanitizeVerifiedDomain("localhost")).toBeNull();
    expect(sanitizeVerifiedDomain("")).toBeNull();
    expect(sanitizeVerifiedDomain(null)).toBeNull();
  });
});

describe("resolveDestination — prioridades", () => {
  const domain = "www.respeiteohomem.com.br";

  it("ad override tem prioridade máxima", () => {
    const out = resolveDestination({
      adExplicitUrl: "https://x.com/oferta",
      landingUrl: "https://x.com/lp",
      productPublicUrl: "https://x.com/produto/a",
      productSlug: "a",
      tenantPrimaryVerifiedDomain: domain,
    });
    expect(out.destination_source).toBe("ad_override");
    expect(out.destination_url).toBe("https://x.com/oferta");
  });

  it("landing pública vence produto", () => {
    const out = resolveDestination({
      landingUrl: "https://www.respeiteohomem.com.br/lp/kit-banho",
      productSlug: "kit-banho",
      tenantPrimaryVerifiedDomain: domain,
    });
    expect(out.destination_source).toBe("landing");
  });

  it("landing inválida/admin é descartada, cai para produto derivado", () => {
    const out = resolveDestination({
      landingUrl: "https://x.com/admin/preview",
      productSlug: "kit-banho",
      tenantPrimaryVerifiedDomain: domain,
    });
    expect(out.destination_source).toBe("domain_derived");
    expect(out.destination_url).toBe(`https://${domain}/produto/kit-banho`);
  });

  it("deriva URL com domínio verificado + slug", () => {
    const out = resolveDestination({
      productSlug: "fast-upgrade",
      tenantPrimaryVerifiedDomain: domain,
    });
    expect(out.destination_source).toBe("domain_derived");
    expect(out.destination_url).toBe(`https://${domain}/produto/fast-upgrade`);
    expect(out.destination_pending_reason).toBeNull();
  });

  it("sem domínio verificado, com slug, vira pendência de domínio", () => {
    const out = resolveDestination({
      productSlug: "fast-upgrade",
      tenantPrimaryVerifiedDomain: null,
    });
    expect(out.destination_url).toBeNull();
    expect(out.destination_pending_reason).toBe("store_public_domain_not_verified");
  });

  it("sem slug e sem produto/landing vira no_product_or_offer_linked", () => {
    const out = resolveDestination({ tenantPrimaryVerifiedDomain: domain });
    expect(out.destination_pending_reason).toBe("no_product_or_offer_linked");
  });

  it("nome de produto sem slug nem URL vira product_offer_url_missing", () => {
    const out = resolveDestination({
      productName: "Kit Banho",
      tenantPrimaryVerifiedDomain: domain,
    });
    expect(out.destination_pending_reason).toBe("product_offer_url_missing");
  });

  it("nunca usa URL fixa da conta Meta (não há entrada para isso)", () => {
    // O resolver não aceita parâmetro de URL da conta — garantia estrutural.
    // @ts-expect-error — campo proibido propositalmente
    const out = resolveDestination({ accountFixedUrl: "https://meta-account-url.com" });
    expect(out.destination_url).toBeNull();
  });
});
