// ============================================================
// Pipeline Básica IA — F2
// Orquestrador (router): a partir de um estado, monta o prompt completo,
// o filtro de tools e os parâmetros do turno.
//
// PRECEDÊNCIA (oficial F2):
//   1. Linguagem-base PT-BR (BASE_LANGUAGE_PROMPT) — fixa
//   2. Prompt do estado atual — fixo
//   3. Camada do tenant (system_prompt + custom_instructions) — COMPLEMENTA
//   4. Guardrails de segurança (SECURITY_GUARDRAILS) — fixa, no FINAL,
//      para que nenhuma instrução do tenant consiga quebrar:
//        - máquina de estados
//        - filtro de tools
//        - política de imagem
//        - regras anti-loop
//        - prioridade da última mensagem
// ============================================================

import { BASE_LANGUAGE_PROMPT, SECURITY_GUARDRAILS } from "./prompts/base.ts";
import { GREETING_PROMPT } from "./prompts/greeting.ts";
import { DISCOVERY_PROMPT } from "./prompts/discovery.ts";
import { RECOMMENDATION_PROMPT } from "./prompts/recommendation.ts";
import { PRODUCT_DETAIL_PROMPT } from "./prompts/product-detail.ts";
import { DECISION_PROMPT } from "./prompts/decision.ts";
import { CHECKOUT_ASSIST_PROMPT } from "./prompts/checkout-assist.ts";
import { SUPPORT_PROMPT } from "./prompts/support.ts";
import { HANDOFF_PROMPT } from "./prompts/handoff.ts";
import type { PipelineState } from "./states.ts";
import { TOOLS_BY_STATE, filterToolsForState } from "./tool-filter.ts";

const STATE_PROMPTS: Record<PipelineState, string> = {
  greeting: GREETING_PROMPT,
  discovery: DISCOVERY_PROMPT,
  recommendation: RECOMMENDATION_PROMPT,
  product_detail: PRODUCT_DETAIL_PROMPT,
  decision: DECISION_PROMPT,
  checkout_assist: CHECKOUT_ASSIST_PROMPT,
  support: SUPPORT_PROMPT,
  handoff: HANDOFF_PROMPT,
};

const STATE_PARAMS: Record<PipelineState, { temperature: number; maxTokens: number }> = {
  greeting:        { temperature: 0.6, maxTokens: 250 },
  discovery:       { temperature: 0.5, maxTokens: 300 },
  recommendation:  { temperature: 0.5, maxTokens: 450 },
  product_detail:  { temperature: 0.4, maxTokens: 500 },
  decision:        { temperature: 0.3, maxTokens: 350 },
  checkout_assist: { temperature: 0.3, maxTokens: 400 },
  support:         { temperature: 0.4, maxTokens: 350 },
  handoff:         { temperature: 0.3, maxTokens: 200 },
};

export interface TenantOverlay {
  // Texto livre vindo de ai_support_config.system_prompt — agora COMPLEMENTA.
  systemPromptComplement?: string | null;
  // Instruções específicas por canal — também complementam.
  channelCustomInstructions?: string | null;
  // Persona/loja para humanizar (quando o tenant não personalizar nada).
  personalityName?: string | null;
  storeName?: string | null;
}

export interface RouterInput<T extends { type: string; function: { name: string } }> {
  state: PipelineState;
  allTools: T[];
  tenant: TenantOverlay;
  // Blocos contextuais já montados pelo caller (catálogo, cliente, memória, etc).
  // Vão para o final, depois do guardrail estrutural.
  contextualBlocks?: string[];
}

export interface RouterOutput<T> {
  systemPrompt: string;
  tools: T[];
  toolsExposed: string[];
  temperature: number;
  maxTokens: number;
  promptModule: string;
}

export function buildPromptForState<T extends { type: string; function: { name: string } }>(
  input: RouterInput<T>
): RouterOutput<T> {
  const { state, allTools, tenant, contextualBlocks } = input;

  const tenantHeader = (tenant.personalityName || tenant.storeName)
    ? `\n\n### IDENTIDADE\nVocê é ${tenant.personalityName || "a atendente"} da loja ${tenant.storeName || ""}.`
    : "";

  const tenantComplement = tenant.systemPromptComplement?.trim()
    ? `\n\n### PERSONALIZAÇÃO DA LOJA (complementa, não substitui as regras acima)\n${tenant.systemPromptComplement.trim()}`
    : "";

  const channelExtra = tenant.channelCustomInstructions?.trim()
    ? `\n\n### INSTRUÇÕES DO CANAL\n${tenant.channelCustomInstructions.trim()}`
    : "";

  const ctx = (contextualBlocks || []).filter(Boolean).join("\n\n");

  const systemPrompt = [
    BASE_LANGUAGE_PROMPT,
    tenantHeader,
    STATE_PROMPTS[state],
    tenantComplement,
    channelExtra,
    SECURITY_GUARDRAILS,
    ctx ? `\n\n### CONTEXTO\n${ctx}` : "",
  ].filter(Boolean).join("\n\n");

  const tools = filterToolsForState(allTools, state);
  const toolsExposed = TOOLS_BY_STATE[state] || [];
  const params = STATE_PARAMS[state];

  return {
    systemPrompt,
    tools,
    toolsExposed,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    promptModule: `${state}.ts`,
  };
}
