import { describe, it, expect } from "vitest";
import { runUtmGate } from "@/lib/ads/gates/utm";

function s(ads: Array<{ destination_url?: string | null; name?: string }>) {
  return {
    is_structured_campaign: true,
    campaign: { name: "C", objective: "sales", daily_budget_cents: 5000 } as any,
    ad_sets: [] as any,
    ads: ads.map((a, i) => ({ name: a.name || `Ad ${i + 1}`, destination_url: a.destination_url ?? "" } as any)),
  } as any;
}

describe("ads/gates/utm — Onda F", () => {
  it("passa quando todos os anúncios têm UTM completas", () => {
    const r = runUtmGate(s([
      { destination_url: "https://x.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=c1" },
      { destination_url: "https://x.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=c2" },
    ]));
    expect(r.passed).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("bloqueia ad sem UTM apontando para o nó creative/ad", () => {
    const r = runUtmGate(s([
      { destination_url: "https://x.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=c1" },
      { destination_url: "https://x.com/" }, // sem UTM
    ]));
    expect(r.passed).toBe(false);
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0].node_type).toBe("creative");
    expect(r.blockers[0].severity).toBe("blocker");
    expect(r.blockers[0].field).toContain("destination_url");
  });

  it("ignora anúncios sem URL (outro gate cobre)", () => {
    const r = runUtmGate(s([{ destination_url: "" }]));
    expect(r.passed).toBe(true);
  });
});
