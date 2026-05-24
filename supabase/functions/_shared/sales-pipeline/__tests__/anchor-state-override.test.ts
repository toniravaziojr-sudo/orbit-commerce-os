import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { anchorStateOverride } from "../anchor-state-override.ts";

Deno.test("anchor: dor declarada força recommendation a partir de discovery", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "open_discovery",
    declaredPain: "queda",
    familyFocus: null,
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "tô com queda",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, "recommendation");
  assertEquals(r.reason, "declared_pain");
});

Deno.test("anchor: catalog_question força recommendation (B3.1, B4.1)", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "catalog_question",
    declaredPain: null,
    familyFocus: null,
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "vocês têm shampoo?",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, "recommendation");
  assertEquals(r.reason, "catalog_question");
});

Deno.test("anchor: menção a kit destrava B4.1 mesmo sem família", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "open_discovery",
    declaredPain: null,
    familyFocus: null,
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "qual o kit mais completo?",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, "recommendation");
});

Deno.test("anchor: family_focus persistida em discovery força recommendation", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "product_question",
    declaredPain: null,
    familyFocus: "shampoo",
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "e aí?",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, "recommendation");
});

Deno.test("anchor: bucket post_sale bloqueia override", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "post_sale",
    declaredPain: "queda",
    familyFocus: null,
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "cadê meu pedido?",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, null);
});

Deno.test("anchor: reflexo já alterou estado, não interfere", () => {
  const r = anchorStateOverride({
    currentState: "support",
    bucket: "post_sale",
    declaredPain: null,
    familyFocus: null,
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "obrigado",
    reflexAlreadyOverrodeState: true,
  });
  assertEquals(r.forcedState, null);
  assertEquals(r.reason, "reflex_already_overrode");
});

Deno.test("anchor: estado avançado não é elegível", () => {
  const r = anchorStateOverride({
    currentState: "recommendation",
    bucket: "catalog_question",
    declaredPain: "queda",
    familyFocus: "shampoo",
    mentionedFamily: true,
    mentionedProduct: false,
    consolidatedText: "tem shampoo?",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, null);
});

Deno.test("anchor: hesitation bloqueia override (não atropela hesitação)", () => {
  const r = anchorStateOverride({
    currentState: "discovery",
    bucket: "hesitation",
    declaredPain: "queda",
    familyFocus: "shampoo",
    mentionedFamily: false,
    mentionedProduct: false,
    consolidatedText: "depois eu vejo",
    reflexAlreadyOverrodeState: false,
  });
  assertEquals(r.forcedState, null);
});
