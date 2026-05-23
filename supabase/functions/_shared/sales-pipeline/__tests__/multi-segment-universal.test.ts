// ============================================================
// Onda 7 — Reg #2.18 — Bateria multi-segmento (universalização)
// Valida que detectores universais funcionam fora do segmento
// cosmético, usando vocabulário do tenant em vez de regex fixo.
// ============================================================

import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { classifyTurnCompleteness } from "../turn-completeness.ts";
import { derivePainCategoryPatternsUniversal } from "../pain-category-resolver.ts";
import type { TenantVocabulary } from "../tenant-vocabulary-resolver.ts";

function vocab(partial: Partial<TenantVocabulary>): TenantVocabulary {
  return {
    tenantId: "test",
    segment: null,
    audience: null,
    families: [],
    painPoints: [],
    forbiddenTerms: [],
    preferredPhrases: {},
    productAliases: {},
    loadedAt: Date.now(),
    ...partial,
  };
}

// ---------- Pet shop ----------
Deno.test("[multi-segmento] pet — recomendação com 'cachorro coçando' é actionable via tenant tokens", () => {
  const result = classifyTurnCompleteness(
    [{ id: "1", text: "qual você recomenda? meu cachorro está coçando muito", created_at: new Date().toISOString() }],
    { tenantPainTokens: ["coceira", "cachorro coçando", "pulgas", "carrapato"] },
  );
  assertEquals(result.completeness, "complete_actionable");
  assertEquals(result.reason, "recommend_with_symptom_or_focus");
});

Deno.test("[multi-segmento] pet — pain resolver gera padrões a partir do dicionário do tenant (sem cosmético)", () => {
  const v = vocab({
    segment: "pet",
    painPoints: [
      { name: "coceira", synonyms: ["coça", "alergia"], source: "business_context" },
      { name: "pulgas", synonyms: [], source: "business_context" },
    ],
  });
  const { patterns } = derivePainCategoryPatternsUniversal({
    painSource: "meu cachorro está com coceira",
    vocabulary: v,
  });
  assert(patterns.length > 0, "deve gerar pelo menos um padrão");
  assert(
    patterns.some((p: string) => p.toLowerCase().includes("coceira") || p.toLowerCase().includes("coç")),
    `padrões devem refletir a dor declarada — recebido: ${JSON.stringify(patterns)}`,
  );
  // Garante que nenhum padrão cosmético hardcoded vazou
  assert(
    !patterns.some((p: string) => /calv|caspa|shampoo|balm|coroa/i.test(p)),
    `nenhum padrão cosmético hardcoded permitido — recebido: ${JSON.stringify(patterns)}`,
  );
});

// ---------- Moda ----------
Deno.test("[multi-segmento] moda — 'calça apertando' como recomendação é actionable via tenant tokens", () => {
  const result = classifyTurnCompleteness(
    [{ id: "1", text: "qual você recomenda? a calça está apertando", created_at: new Date().toISOString() }],
    { tenantPainTokens: ["calça apertando", "tamanho errado", "manga curta"] },
  );
  assertEquals(result.completeness, "complete_actionable");
});

// ---------- Suplemento ----------
Deno.test("[multi-segmento] suplemento — 'baixa imunidade' actionable via tenant tokens", () => {
  const result = classifyTurnCompleteness(
    [{ id: "1", text: "qual você indica pra baixa imunidade?", created_at: new Date().toISOString() }],
    { tenantPainTokens: ["baixa imunidade", "cansaço", "falta de energia"] },
  );
  assertEquals(result.completeness, "complete_actionable");
});

// ---------- Paridade cosmético (não regrediu) ----------
Deno.test("[multi-segmento] cosmético legado (Respeite o Homem) continua actionable mesmo sem tenant tokens", () => {
  const result = classifyTurnCompleteness(
    [{ id: "1", text: "qual você recomenda pra calvície?", created_at: new Date().toISOString() }],
    {}, // sem tenantPainTokens — regex legado deve cobrir
  );
  assertEquals(result.completeness, "complete_actionable");
});
