import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { derivePainCategoryPatternsUniversal } from "../pain-category-resolver.ts";
import type { TenantVocabulary } from "../tenant-vocabulary-resolver.ts";

const emptyVocab: TenantVocabulary = {
  tenantId: "t1",
  segment: null,
  audience: null,
  families: [],
  painPoints: [],
  forbiddenTerms: [],
  preferredPhrases: {},
  productAliases: {},
  loadedAt: Date.now(),
};

Deno.test("Onda 3 — sem vocabulário, deriva padrões só do texto do cliente", () => {
  const r = derivePainCategoryPatternsUniversal({
    painSource: "estou com calvície e queda forte",
    vocabulary: emptyVocab,
  });
  assert(r.patterns.includes("%calvicie%"));
  assert(r.patterns.includes("%queda%"));
  assert(!r.patterns.some((p) => p.includes("estou")));
});

Deno.test("Onda 3 — pet shop: 'meu cachorro coça muito' gera padrões pet, sem termo cosmético", () => {
  const r = derivePainCategoryPatternsUniversal({
    painSource: "meu cachorro coça muito a pele",
    vocabulary: emptyVocab,
  });
  assert(r.patterns.includes("%cachorro%"));
  assert(r.patterns.includes("%pele%"));
  assert(!r.patterns.some((p) => /calv|caspa|shampoo/.test(p)));
});

Deno.test("Onda 3 — moda: 'calça apertando na cintura' deriva padrões corretos", () => {
  const r = derivePainCategoryPatternsUniversal({
    painSource: "minha calça está apertando na cintura",
    vocabulary: emptyVocab,
  });
  assert(r.patterns.includes("%calca%"));
  assert(r.patterns.includes("%cintura%"));
});

Deno.test("Onda 3 — sinônimos do tenant ampliam padrões quando dor declarada bate", () => {
  const vocab: TenantVocabulary = {
    ...emptyVocab,
    painPoints: [
      { name: "queda capilar", synonyms: ["calvicie", "rarefacao"], source: "language_dictionary" },
    ],
  };
  const r = derivePainCategoryPatternsUniversal({
    painSource: "estou com calvicie",
    vocabulary: vocab,
  });
  assert(r.matchedPainPoints.includes("queda capilar"));
  // sinônimo "rarefacao" entra como token derivado
  assert(r.tokens.some((t) => t.startsWith("rarefac")));
});

Deno.test("Onda 3 — stopwords não viram padrão", () => {
  const r = derivePainCategoryPatternsUniversal({
    painSource: "preciso de uma ajuda com o produto que tenho",
    vocabulary: emptyVocab,
  });
  assertEquals(r.patterns.length, 0);
});
