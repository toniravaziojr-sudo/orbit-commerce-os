// Tests for tenant vocabulary resolver and universal family detector
// Onda 2 — Reg #2.18

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectFamilyMentionedUniversal,
  getCatalogFamilyAliasesUniversal,
  detectFamilyMentioned,
} from "../transitions.ts";
import {
  buildFamilyTokenSet,
  type TenantVocabulary,
} from "../tenant-vocabulary-resolver.ts";

function vocab(families: Array<{ key: string; label: string; synonyms?: string[] }>): TenantVocabulary {
  return {
    tenantId: "t",
    segment: null,
    audience: null,
    families: families.map((f) => ({
      key: f.key,
      label: f.label,
      synonyms: f.synonyms ?? [],
      productCount: 1,
      source: "categories",
    })),
    painPoints: [],
    forbiddenTerms: [],
    preferredPhrases: {},
    productAliases: {},
    loadedAt: Date.now(),
  };
}

Deno.test("universal family detector: pet shop tenant detects 'ração' even without legacy regex", () => {
  const v = vocab([
    { key: "racao", label: "Ração", synonyms: ["racao seca"] },
    { key: "petisco", label: "Petisco" },
  ]);
  const tokens = buildFamilyTokenSet(v);
  assertEquals(detectFamilyMentionedUniversal("tem ração para filhote?", tokens), "racao");
  assertEquals(detectFamilyMentionedUniversal("quero um petisco", tokens), "petisco");
});

Deno.test("universal family detector: fashion tenant detects 'calça' (não está no FAMILY_TOKENS legado)", () => {
  const v = vocab([{ key: "calca", label: "Calça" }, { key: "camiseta", label: "Camiseta" }]);
  const tokens = buildFamilyTokenSet(v);
  assertEquals(detectFamilyMentionedUniversal("procuro uma calça jeans", tokens), "calca");
});

Deno.test("universal family detector: fallback para legado quando vocabulário ausente", () => {
  // Sem vocab → cai para detectFamilyMentioned legacy (cobre cosméticos)
  assertEquals(detectFamilyMentionedUniversal("preciso de shampoo", null), "shampoo");
  assertEquals(detectFamilyMentioned("preciso de shampoo"), "shampoo");
});

Deno.test("universal family detector: longest match wins", () => {
  const v = vocab([
    { key: "kit", label: "Kit" },
    { key: "kit_barba", label: "Kit Barba Completo" },
  ]);
  const tokens = buildFamilyTokenSet(v);
  assertEquals(
    detectFamilyMentionedUniversal("quero o kit barba completo", tokens),
    "kit_barba",
  );
});

Deno.test("getCatalogFamilyAliasesUniversal: respeita aliases legacy + tenant", () => {
  // legacy: locao <-> balm
  assertEquals(getCatalogFamilyAliasesUniversal("locao", null).sort(), ["balm", "locao"].sort());
  // tenant adiciona "creme" como alias de "locao"
  const merged = getCatalogFamilyAliasesUniversal("locao", { locao: ["creme"] }).sort();
  assertEquals(merged, ["balm", "creme", "locao"].sort());
});

Deno.test("getCatalogFamilyAliasesUniversal: tenant sem fungibilidade legada", () => {
  assertEquals(
    getCatalogFamilyAliasesUniversal("racao", { racao: ["alimento_seco"] }).sort(),
    ["alimento_seco", "racao"].sort(),
  );
});
