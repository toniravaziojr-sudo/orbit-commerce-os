// Onda 18 — Fase A: testes da função pura enforceFamilyBaseFirst.
// Cobre golden set mínimo de cenários família-base.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  enforceFamilyBaseFirst,
  detectFamilyInText,
  classifyKit,
} from "../catalog-probe.ts";

const lotion1 = { id: "p1", name: "Loção Pós-Banho Calvície Zero", is_kit: false, match_reason: "pain_match" as const };
const lotion2 = { id: "p2", name: "Loção Crescimento Power", is_kit: false, match_reason: "pain_match" as const };
const lotionKitQty = { id: "p3", name: "Loção Calvície Zero (3x)", is_kit: true, match_reason: "name_match" as const };
const lotionKitQty6 = { id: "p4", name: "Loção Calvície Zero (6x)", is_kit: true, match_reason: "name_match" as const };
const kitMixed = { id: "p5", name: "Kit Banho Calvície Zero", is_kit: true, match_reason: "pain_match" as const };
const shampoo = { id: "p6", name: "Shampoo Calvície Zero", is_kit: false, match_reason: "pain_match" as const };

Deno.test("detectFamilyInText — 'tem alguma loção pra crescer cabelo?' → locao", () => {
  assertEquals(detectFamilyInText("tem alguma loção pra crescer cabelo?"), "locao");
});

Deno.test("detectFamilyInText — só 'kit' não conta como família-base", () => {
  assertEquals(detectFamilyInText("quero o kit"), null);
});

Deno.test("classifyKit — 1 component = quantity, 2+ = complementary", () => {
  const map = new Map<string, string[]>([
    ["p3", ["pBase", "pBase", "pBase"]],
    ["p5", ["pBase1", "pBase2", "pBase3"]],
  ]);
  assertEquals(classifyKit("p3", true, map), "quantity");
  assertEquals(classifyKit("p5", true, map), "complementary");
  assertEquals(classifyKit("pX", false, map), "not_a_kit");
});

Deno.test("Cenário 1 — 'loção pra crescer cabelo' com 2 bases + kit_qty + kit_misto", () => {
  const kitMap = new Map<string, string[]>([
    ["p3", ["p1", "p1", "p1"]],         // kit qty (1 component)
    ["p4", ["p1", "p1", "p1", "p1", "p1", "p1"]], // kit qty
    ["p5", ["p1", "p2", "p6"]],         // kit complementar (3 components distintos)
  ]);
  const out = enforceFamilyBaseFirst({
    enriched: [lotionKitQty, lotion1, kitMixed, lotionKitQty6, lotion2],
    familyDetected: "locao",
    kitComponentMap: kitMap,
    limit: 5,
  });
  assertEquals(out.forced_base, true);
  assertEquals(out.bases_pain_count, 2);
  assertEquals(out.kits_quantity_excluded_count, 2);
  // Bases primeiro, kit complementar depois, kits qty fora.
  assertEquals(out.filtered.map(p => p.id), ["p1", "p2", "p5"]);
});

Deno.test("Cenário 2 — só kits de quantidade, sem base → fail-safe devolve original", () => {
  const kitMap = new Map<string, string[]>([
    ["p3", ["pX", "pX", "pX"]],
    ["p4", ["pX", "pX"]],
  ]);
  const out = enforceFamilyBaseFirst({
    enriched: [lotionKitQty, lotionKitQty6],
    familyDetected: "locao",
    kitComponentMap: kitMap,
    limit: 5,
  });
  assertEquals(out.forced_base, false);
  assertEquals(out.reason.startsWith("no_base_for_family_locao"), true);
  // Fail-safe: devolve algo, não vazio
  assertEquals(out.filtered.length > 0, true);
});

Deno.test("Cenário 3 — família shampoo: bases shampoo no topo, ignora loções", () => {
  const kitMap = new Map<string, string[]>();
  const out = enforceFamilyBaseFirst({
    enriched: [lotion1, shampoo, lotion2],
    familyDetected: "shampoo",
    kitComponentMap: kitMap,
    limit: 5,
  });
  assertEquals(out.forced_base, true);
  assertEquals(out.filtered.map(p => p.id), ["p6"]);
});

Deno.test("Cenário 4 — sem família detectada + bases existem → infere por maioria", () => {
  const out = enforceFamilyBaseFirst({
    enriched: [lotion1, lotion2, shampoo],
    familyDetected: null,
    kitComponentMap: new Map(),
    limit: 5,
  });
  assertEquals(out.forced_base, true);
  // Maioria é loção (2x); shampoo fica fora.
  assertEquals(out.filtered.map(p => p.id).sort(), ["p1", "p2"]);
});

Deno.test("Cenário 5 — pool vazio", () => {
  const out = enforceFamilyBaseFirst({
    enriched: [],
    familyDetected: "locao",
    kitComponentMap: new Map(),
    limit: 5,
  });
  assertEquals(out.forced_base, false);
  assertEquals(out.reason, "empty_pool");
  assertEquals(out.filtered.length, 0);
});

Deno.test("Cenário 6 — limit comercial respeitado", () => {
  const out = enforceFamilyBaseFirst({
    enriched: [lotion1, lotion2],
    familyDetected: "locao",
    kitComponentMap: new Map(),
    limit: 1,
  });
  assertEquals(out.forced_base, true);
  assertEquals(out.filtered.length, 1);
  // pain_match primeiro
  assertEquals(out.filtered[0].id, "p1");
});
