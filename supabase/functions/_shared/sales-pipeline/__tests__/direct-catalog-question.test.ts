import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectDirectCatalogQuestion } from "../direct-catalog-question.ts";

Deno.test("kit bare 'kit?'", () => {
  const r = detectDirectCatalogQuestion({ consolidatedText: "kit?", intentBucket: "catalog_question", declaredPain: null });
  assertEquals(r.directKitQuestion, true);
});

Deno.test("kit pergunta direta 'qual o kit mais completo?'", () => {
  const r = detectDirectCatalogQuestion({ consolidatedText: "qual o kit mais completo?", intentBucket: "catalog_question", declaredPain: null });
  assertEquals(r.directKitQuestion, true);
});

Deno.test("família curta 'tem shampoo?'", () => {
  const r = detectDirectCatalogQuestion({ consolidatedText: "tem shampoo?", intentBucket: "catalog_question", declaredPain: null });
  assertEquals(r.directFamilyQuestion, true);
});

Deno.test("dor declarada bloqueia direct", () => {
  const r = detectDirectCatalogQuestion({ consolidatedText: "tem shampoo pra calvicie?", intentBucket: "catalog_question", declaredPain: "calvicie" });
  assertEquals(r.directKitQuestion, false);
  assertEquals(r.directFamilyQuestion, false);
});

Deno.test("turno longo narrativo não é direct family", () => {
  const r = detectDirectCatalogQuestion({
    consolidatedText: "to com queda de cabelo faz uns 6 meses e queria saber qual shampoo voces tem que ajuda nisso",
    intentBucket: "catalog_question",
    declaredPain: null,
  });
  assertEquals(r.directFamilyQuestion, false);
});
