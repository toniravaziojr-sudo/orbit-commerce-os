import { describe, it, expect } from "vitest";
import { applyUtm, hasRequiredUtm, slugifyForUtm } from "@/lib/ads/utm";

describe("ads/utm — Onda F", () => {
  it("aplica utm completas quando link não tem nenhuma", () => {
    const r = applyUtm("https://loja.com/produto/x", {
      campaignSlug: "Black Friday 2026", adSlug: "Vídeo 1", audienceSlug: "Frio 25-45",
    });
    expect(r.url).toContain("utm_source=meta");
    expect(r.url).toContain("utm_medium=paid_social");
    expect(r.url).toContain("utm_campaign=black_friday_2026");
    expect(r.url).toContain("utm_content=video_1");
    expect(r.url).toContain("utm_term=frio_25_45");
    expect(r.warnings).toEqual([]);
  });

  it("preserva query existente e não duplica utm já definida", () => {
    const r = applyUtm("https://loja.com/p?ref=abc&utm_source=manual&utm_campaign=ja_existia", {
      campaignSlug: "Nova", adSlug: "Ad", audienceSlug: "Pub",
    });
    const u = new URL(r.url);
    expect(u.searchParams.get("ref")).toBe("abc");
    expect(u.searchParams.get("utm_source")).toBe("manual");          // não sobrescreve
    expect(u.searchParams.get("utm_campaign")).toBe("ja_existia");    // não sobrescreve
    expect(u.searchParams.get("utm_medium")).toBe("paid_social");     // completa o que faltava
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        "utm_conflict:utm_source:kept_existing",
        "utm_conflict:utm_campaign:kept_existing",
      ]),
    );
  });

  it("hasRequiredUtm valida fonte/medium/campaign", () => {
    expect(hasRequiredUtm("https://x.com/?utm_source=a&utm_medium=b&utm_campaign=c")).toBe(true);
    expect(hasRequiredUtm("https://x.com/?utm_source=a&utm_medium=b")).toBe(false);
    expect(hasRequiredUtm("https://x.com/")).toBe(false);
    expect(hasRequiredUtm("nao_url")).toBe(false);
  });

  it("slugify normaliza acentos, espaços e caracteres especiais", () => {
    expect(slugifyForUtm("Promoção Brasil!")).toBe("promocao_brasil");
    expect(slugifyForUtm("  TOF / Frio  ")).toBe("tof_frio");
    expect(slugifyForUtm("")).toBe("");
  });

  it("retorna url original se url for inválida", () => {
    const r = applyUtm("not-a-url", { campaignSlug: "x", adSlug: "y", audienceSlug: "z" });
    expect(r.url).toBe("not-a-url");
    expect(r.warnings).toContain("invalid_url");
  });
});
