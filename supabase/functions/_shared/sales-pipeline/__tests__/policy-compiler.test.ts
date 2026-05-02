// Deno tests para Onda 18 — Fase B — Policy Compiler.
// Foco: precedência (default < tenant < channel), invariantes intocáveis,
// fallback sem channel, source_trace correto.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  compileEffectivePolicy,
  PLATFORM_INVARIANTS,
  policySourceTrace,
} from "../policy-compiler.ts";

Deno.test("Policy Compiler — sem tenant config nem channel: tudo default + invariantes presentes", () => {
  const p = compileEffectivePolicy({
    tenantConfig: null,
    channelConfig: null,
    channelType: "whatsapp",
  });

  assertEquals(p.personality_name.source, "default");
  assertEquals(p.personality_name.value, "Assistente");
  assertEquals(p.use_emojis.source, "default");
  assertEquals(p.max_response_length.value, 500);
  assertEquals(p.forbidden_topics.value, []);
  assertEquals(p.channel_type.value, "whatsapp");
  assertEquals(p.invariants, PLATFORM_INVARIANTS);
  // Invariantes congelados
  assert(Object.isFrozen(p.invariants));
});

Deno.test("Policy Compiler — tenant define persona/tom: source=tenant", () => {
  const p = compileEffectivePolicy({
    tenantConfig: {
      personality_name: "Carla",
      personality_tone: "consultivo e direto",
      max_response_length: 350,
      use_emojis: false,
      sales_mode_enabled: true,
      forbidden_topics: ["política", "religião"],
    },
    channelConfig: null,
    channelType: "whatsapp",
  });

  assertEquals(p.personality_name.value, "Carla");
  assertEquals(p.personality_name.source, "tenant");
  assertEquals(p.use_emojis.value, false);
  assertEquals(p.use_emojis.source, "tenant");
  assertEquals(p.max_response_length.value, 350);
  assertEquals(p.max_response_length.source, "tenant");
  assertEquals(p.sales_mode_enabled.value, true);
  assertEquals(p.forbidden_topics.value, ["política", "religião"]);
  assertEquals(p.forbidden_topics.source, "tenant");
});

Deno.test("Policy Compiler — channel sobrescreve tenant em campos permitidos", () => {
  const p = compileEffectivePolicy({
    tenantConfig: {
      max_response_length: 500,
      use_emojis: true,
      forbidden_topics: ["política"],
      system_prompt: "Você é a Carla, atende a loja...",
    },
    channelConfig: {
      channel_type: "whatsapp",
      max_response_length: 220, // override
      use_emojis: false,         // override explícito
      forbidden_topics: ["concorrentes"], // união
      system_prompt_override: "Você é a Carla no WhatsApp, ainda mais curta.",
      custom_instructions: "Use no máximo 2 linhas.",
    },
    channelType: "whatsapp",
  });

  assertEquals(p.max_response_length.value, 220);
  assertEquals(p.max_response_length.source, "channel");
  assertEquals(p.use_emojis.value, false);
  assertEquals(p.use_emojis.source, "channel");
  // União determinística
  assertEquals(p.forbidden_topics.value, ["política", "concorrentes"]);
  assertEquals(p.forbidden_topics.source, "channel");
  // System prompt sobrescrito
  assert(p.system_prompt.value?.includes("ainda mais curta"));
  assertEquals(p.system_prompt.source, "channel");
  // Custom instructions só vem do canal
  assertEquals(p.custom_instructions.value, "Use no máximo 2 linhas.");
  assertEquals(p.custom_instructions.source, "channel");
});

Deno.test("Policy Compiler — channel SEM use_emojis explicitado mantém valor do tenant", () => {
  const p = compileEffectivePolicy({
    tenantConfig: { use_emojis: false },
    channelConfig: { channel_type: "whatsapp" }, // não setou use_emojis
    channelType: "whatsapp",
  });
  assertEquals(p.use_emojis.value, false);
  assertEquals(p.use_emojis.source, "tenant");
});

Deno.test("Policy Compiler — channel max_response_length=0 é ignorado (fail-safe)", () => {
  const p = compileEffectivePolicy({
    tenantConfig: { max_response_length: 400 },
    channelConfig: { channel_type: "whatsapp", max_response_length: 0 },
    channelType: "whatsapp",
  });
  assertEquals(p.max_response_length.value, 400);
  assertEquals(p.max_response_length.source, "tenant");
});

Deno.test("Policy Compiler — invariantes não podem ser mutados (frozen)", () => {
  const p = compileEffectivePolicy({
    tenantConfig: null,
    channelConfig: null,
    channelType: "whatsapp",
  });
  let threw = false;
  try {
    // @ts-expect-error — tentativa intencional de mutação
    p.invariants.tenant_isolation = false;
  } catch {
    threw = true;
  }
  // Em modo strict do Deno, mutação em frozen lança; em modo loose, é silencioso.
  // O importante é que o valor NÃO mude.
  assertEquals(p.invariants.tenant_isolation, true);
  assert(threw || p.invariants.tenant_isolation === true);
});

Deno.test("Policy Compiler — source_trace cobre todos os campos", () => {
  const p = compileEffectivePolicy({
    tenantConfig: { personality_name: "X" },
    channelConfig: { channel_type: "whatsapp", use_emojis: false },
    channelType: "whatsapp",
  });
  const trace = policySourceTrace(p);
  assertEquals(trace.personality_name, "tenant");
  assertEquals(trace.use_emojis, "channel");
  assertEquals(trace.max_response_length, "default");
  assertEquals(trace.channel_type, "base");
});

Deno.test("Policy Compiler — forbidden_topics: union sem duplicatas", () => {
  const p = compileEffectivePolicy({
    tenantConfig: { forbidden_topics: ["a", "b"] },
    channelConfig: { channel_type: "whatsapp", forbidden_topics: ["b", "c"] },
    channelType: "whatsapp",
  });
  assertEquals(p.forbidden_topics.value, ["a", "b", "c"]);
  assertEquals(p.forbidden_topics.source, "channel"); // canal trouxe "c"
});

Deno.test("Policy Compiler — channel forbidden subset do tenant: source permanece tenant", () => {
  const p = compileEffectivePolicy({
    tenantConfig: { forbidden_topics: ["a", "b"] },
    channelConfig: { channel_type: "whatsapp", forbidden_topics: ["b"] },
    channelType: "whatsapp",
  });
  assertEquals(p.forbidden_topics.value, ["a", "b"]);
  assertEquals(p.forbidden_topics.source, "tenant");
});
