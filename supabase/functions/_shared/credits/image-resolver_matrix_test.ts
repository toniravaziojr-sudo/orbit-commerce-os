/**
 * Matriz de validação format/size/quality → service_key Fal GPT Image 1.5.
 *
 * Cobre o contrato pós-A3.3 (UI alinhada ao catálogo):
 *   square    → 1024x1024
 *   portrait  → 1024x1536
 *   landscape → 1536x1024
 *
 * Garante:
 *  - Retrato + medium → fal.gpt-image-1.5.per_image.medium_1024x1536
 *  - nenhuma combinação resolve para service_key inexistente
 *  - sizes legados 1024x1792 / 1792x1024 NÃO produzem chave válida
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveImageServiceKey } from "./image-resolver.ts";

const VALID_KEYS = new Set([
  "fal.gpt-image-1.5.per_image.low_1024",
  "fal.gpt-image-1.5.per_image.low_other",
  "fal.gpt-image-1.5.per_image.medium_1024",
  "fal.gpt-image-1.5.per_image.medium_1024x1536",
  "fal.gpt-image-1.5.per_image.medium_1536x1024",
  "fal.gpt-image-1.5.per_image.high_1024",
  "fal.gpt-image-1.5.per_image.high_1024x1536",
  "fal.gpt-image-1.5.per_image.high_1536x1024",
]);

const matrix: Array<{ size: string; quality: "low" | "medium" | "high"; expected: string }> = [
  // medium (catálogo principal)
  { size: "1024x1024", quality: "medium", expected: "fal.gpt-image-1.5.per_image.medium_1024" },
  { size: "1024x1536", quality: "medium", expected: "fal.gpt-image-1.5.per_image.medium_1024x1536" },
  { size: "1536x1024", quality: "medium", expected: "fal.gpt-image-1.5.per_image.medium_1536x1024" },
  // high
  { size: "1024x1024", quality: "high",   expected: "fal.gpt-image-1.5.per_image.high_1024" },
  { size: "1024x1536", quality: "high",   expected: "fal.gpt-image-1.5.per_image.high_1024x1536" },
  { size: "1536x1024", quality: "high",   expected: "fal.gpt-image-1.5.per_image.high_1536x1024" },
  // low (retangular cai em low_other por design)
  { size: "1024x1024", quality: "low",    expected: "fal.gpt-image-1.5.per_image.low_1024" },
  { size: "1024x1536", quality: "low",    expected: "fal.gpt-image-1.5.per_image.low_other" },
  { size: "1536x1024", quality: "low",    expected: "fal.gpt-image-1.5.per_image.low_other" },
];

for (const { size, quality, expected } of matrix) {
  Deno.test(`matrix: ${size} + ${quality} → ${expected}`, () => {
    const r = resolveImageServiceKey({
      provider: "fal",
      actualProvider: "fal",
      model: "gpt-image-1.5",
      size,
      quality,
    });
    if (!r.resolved) {
      throw new Error(`expected resolved key, got skip ${r.skip_reason}: ${r.detail}`);
    }
    assertEquals(r.service_key, expected);
    assertEquals(VALID_KEYS.has(r.service_key), true, `key ${r.service_key} fora do catálogo`);
  });
}

Deno.test("Retrato + medium resolve para medium_1024x1536 (validação crítica A3.3)", () => {
  const r = resolveImageServiceKey({
    provider: "fal",
    actualProvider: "fal",
    model: "gpt-image-1.5",
    size: "1024x1536",
    quality: "medium",
  });
  if (!r.resolved) throw new Error(`expected resolved, got ${r.skip_reason}`);
  assertEquals(r.service_key, "fal.gpt-image-1.5.per_image.medium_1024x1536");
});

Deno.test("Sizes legados 1024x1792 / 1792x1024 NÃO resolvem para chave válida em medium/high", () => {
  for (const size of ["1024x1792", "1792x1024"]) {
    for (const quality of ["medium", "high"] as const) {
      const r = resolveImageServiceKey({
        provider: "fal",
        actualProvider: "fal",
        model: "gpt-image-1.5",
        size,
        quality,
      });
      assertEquals(r.resolved, false, `size ${size} + ${quality} não deveria resolver`);
    }
  }
});
