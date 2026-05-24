import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectDeterministicReflex } from "../deterministic-reflexes.ts";
import { isHesitation } from "../continuity-gate.ts";

Deno.test("hesitation detector: 'depois eu vejo'", () => {
  assertEquals(isHesitation("depois eu vejo"), true);
});

Deno.test("hesitation detector: 'preciso pensar'", () => {
  assertEquals(isHesitation("preciso pensar"), true);
});

Deno.test("hesitation detector: 'vou ver'", () => {
  assertEquals(isHesitation("vou ver"), true);
});

Deno.test("hesitation detector: 'amanhã eu volto'", () => {
  assertEquals(isHesitation("amanhã eu volto"), true);
});

Deno.test("hesitation detector: ignora frase longa não-hesitação", () => {
  assertEquals(
    isHesitation("vocês têm shampoo pra queda de cabelo masculina forte?"),
    false,
  );
});

Deno.test("hesitation reflex: 'depois eu vejo' dispara reflexo", () => {
  const r = detectDeterministicReflex({
    consolidatedText: "depois eu vejo",
    state: "discovery",
    hasActiveCart: false,
    familyFocus: null,
    lastFocusedProductName: null,
    turnIntent: null,
    tprAskedShipping: null,
    tprIsSupportTopic: null,
    tprAskedPaymentLink: null,
    hasKnownCustomerCep: false,
  });
  assertEquals(r?.reflexId, "hesitation");
  assertEquals(r?.newState, null);
});

Deno.test("hesitation reflex: 'vou pensar' dispara reflexo", () => {
  const r = detectDeterministicReflex({
    consolidatedText: "vou pensar",
    state: "recommendation",
    hasActiveCart: false,
    familyFocus: "shampoo",
    lastFocusedProductName: null,
    turnIntent: null,
    tprAskedShipping: null,
    tprIsSupportTopic: null,
    tprAskedPaymentLink: null,
    hasKnownCustomerCep: false,
  });
  assertEquals(r?.reflexId, "hesitation");
});
