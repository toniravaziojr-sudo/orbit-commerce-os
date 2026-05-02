// ============================================================
// Onda 18 — Fase B — Policy Compiler
//
// Fonte central da política efetiva da IA de atendimento/vendas.
// Compila 3 camadas em um único objeto `EffectivePolicy`, com
// `source_trace` por campo, indicando a origem real da regra:
//
//   base    → invariantes da plataforma/pipeline (NÃO podem ser sobrescritos)
//   tenant  → ai_support_config (configuração geral do tenant)
//   channel → ai_channel_config (override permitido por canal)
//   default → fallback duro do compiler quando nenhuma camada definiu
//
// Precedência (do menos prioritário para o mais prioritário, dentro do
// que é sobrescrevível): default → tenant → channel.
// Invariantes (camada `base`) ficam SEMPRE no topo e ignoram tenant/channel.
//
// Função pura. NÃO consulta banco. Quem chama (ai-support-chat) carrega
// `ai_support_config` e `ai_channel_config` e passa os 2 brutos.
// ============================================================

export type PolicySource = "base" | "tenant" | "channel" | "default";

export interface PolicyField<T> {
  value: T;
  source: PolicySource;
}

/**
 * Configuração geral do tenant (ai_support_config). Usamos `any` no input
 * porque o handler já trabalha com a row crua do supabase; aqui só lemos
 * os campos que o compiler conhece.
 */
export type TenantConfigInput = {
  personality_name?: string | null;
  personality_tone?: string | null;
  greeting_style?: string | null;
  use_emojis?: boolean | null;
  system_prompt?: string | null;
  custom_knowledge?: string | null;
  max_response_length?: number | null;
  forbidden_topics?: string[] | null;
  handoff_keywords?: string[] | null;
  sales_mode_enabled?: boolean | null;
  ai_model?: string | null;
  rules?: unknown;
  metadata?: Record<string, unknown> | null;
} | null | undefined;

/**
 * Configuração por canal (ai_channel_config). Schema atual: 4 overrides
 * permitidos (system_prompt_override, forbidden_topics, max_response_length,
 * use_emojis) + custom_instructions livre.
 */
export type ChannelConfigInput = {
  channel_type?: string | null;
  is_enabled?: boolean | null;
  system_prompt_override?: string | null;
  forbidden_topics?: string[] | null;
  max_response_length?: number | null;
  use_emojis?: boolean | null;
  custom_instructions?: string | null;
} | null | undefined;

export interface CompilePolicyInput {
  tenantConfig: TenantConfigInput;
  channelConfig: ChannelConfigInput;
  /** Canal efetivo do turno (whatsapp, instagram, web, ...). */
  channelType: string;
}

/**
 * Invariantes da plataforma. Estas regras vêm de `base` e NÃO podem ser
 * sobrescritas por tenant nem por canal. Ficam aqui como contrato explícito
 * em vez de espalhadas em prompts/strings.
 */
export const PLATFORM_INVARIANTS = Object.freeze({
  // Isolamento e segurança
  tenant_isolation: true as const,
  cross_tenant_data_leak_forbidden: true as const,
  forbidden_pii_request_on_whatsapp: true as const, // CPF, cartão etc só por canal seguro

  // Honestidade da pipeline
  no_invented_actions: true as const,
  no_unverified_tool_assertions: true as const,
  no_real_world_side_effect_without_tool: true as const,

  // Integridade de dados
  no_catalog_override: true as const, // não inventar produto/preço/estoque
  no_shipping_override: true as const, // não fabricar frete grátis ou prazo
  no_checkout_override: true as const, // não confirmar pagamento sem tool
});

export type PlatformInvariants = typeof PLATFORM_INVARIANTS;

export interface EffectivePolicy {
  // Identidade & estilo (sobrescrevíveis por canal)
  personality_name: PolicyField<string>;
  personality_tone: PolicyField<string>;
  greeting_style: PolicyField<string>;
  use_emojis: PolicyField<boolean>;
  max_response_length: PolicyField<number>;

  // Prompt & instruções
  system_prompt: PolicyField<string | null>;
  custom_instructions: PolicyField<string | null>; // só channel pode setar
  custom_knowledge: PolicyField<string | null>;

  // Comportamento comercial
  sales_mode_enabled: PolicyField<boolean>;
  forbidden_topics: PolicyField<string[]>; // união tenant ∪ channel
  handoff_keywords: PolicyField<string[]>;

  // Modelo & regras estruturadas
  ai_model: PolicyField<string>;
  rules: PolicyField<unknown[]>;

  // Metadata útil para debugging (não sobrescrevível pelo cliente)
  channel_type: PolicyField<string>;

  // Camada base — sempre `source: "base"`, freezada
  invariants: PlatformInvariants;
}

const DEFAULTS = Object.freeze({
  personality_name: "Assistente",
  personality_tone: "amigável e profissional",
  greeting_style: "natural",
  use_emojis: true,
  max_response_length: 500,
  sales_mode_enabled: false,
  ai_model: "gpt-5.2",
});

function pick<T>(
  channelVal: T | null | undefined,
  tenantVal: T | null | undefined,
  fallback: T,
  channelHasField: boolean
): PolicyField<T> {
  // Channel só ganha se EFETIVAMENTE setou o campo (não null/undefined).
  // Para boolean, channelHasField=true diferencia "explicit false" de "ausente".
  if (channelHasField && channelVal !== null && channelVal !== undefined) {
    return { value: channelVal as T, source: "channel" };
  }
  if (tenantVal !== null && tenantVal !== undefined) {
    return { value: tenantVal as T, source: "tenant" };
  }
  return { value: fallback, source: "default" };
}

/**
 * Compila a política efetiva. Pura, determinística.
 */
export function compileEffectivePolicy(input: CompilePolicyInput): EffectivePolicy {
  const tenant = input.tenantConfig || {};
  const channel = input.channelConfig || {};

  // ----- Identidade & estilo -----
  const personality_name = pick<string>(
    null, // canal não tem coluna de nome — só tenant define
    tenant.personality_name,
    DEFAULTS.personality_name,
    false
  );
  const personality_tone = pick<string>(
    null, // canal não tem coluna de tom — só tenant define
    tenant.personality_tone,
    DEFAULTS.personality_tone,
    false
  );
  const greeting_style = pick<string>(
    null,
    tenant.greeting_style,
    DEFAULTS.greeting_style,
    false
  );
  const use_emojis = pick<boolean>(
    channel.use_emojis,
    tenant.use_emojis,
    DEFAULTS.use_emojis,
    Object.prototype.hasOwnProperty.call(channel, "use_emojis")
  );
  const max_response_length = pick<number>(
    typeof channel.max_response_length === "number" && channel.max_response_length > 0
      ? channel.max_response_length
      : null,
    typeof tenant.max_response_length === "number" && tenant.max_response_length > 0
      ? tenant.max_response_length
      : null,
    DEFAULTS.max_response_length,
    typeof channel.max_response_length === "number" && channel.max_response_length > 0
  );

  // ----- Prompt & instruções -----
  // Canal pode override total via system_prompt_override; senão tenant.
  const system_prompt: PolicyField<string | null> = (() => {
    if (channel.system_prompt_override && channel.system_prompt_override.trim().length > 0) {
      return { value: channel.system_prompt_override, source: "channel" };
    }
    if (tenant.system_prompt && tenant.system_prompt.trim().length > 0) {
      return { value: tenant.system_prompt, source: "tenant" };
    }
    return { value: null, source: "default" };
  })();

  const custom_instructions: PolicyField<string | null> = channel.custom_instructions
    ? { value: channel.custom_instructions, source: "channel" }
    : { value: null, source: "default" };

  const custom_knowledge: PolicyField<string | null> = tenant.custom_knowledge
    ? { value: tenant.custom_knowledge, source: "tenant" }
    : { value: null, source: "default" };

  // ----- Comportamento comercial -----
  const sales_mode_enabled = pick<boolean>(
    null, // canal não controla sales mode (decisão do tenant)
    tenant.sales_mode_enabled,
    DEFAULTS.sales_mode_enabled,
    false
  );

  // forbidden_topics: UNIÃO determinística (tenant ∪ channel), preservando ordem.
  const forbidden_topics: PolicyField<string[]> = (() => {
    const t = Array.isArray(tenant.forbidden_topics) ? tenant.forbidden_topics : [];
    const c = Array.isArray(channel.forbidden_topics) ? channel.forbidden_topics : [];
    if (t.length === 0 && c.length === 0) {
      return { value: [], source: "default" };
    }
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const x of [...t, ...c]) {
      if (typeof x !== "string") continue;
      const key = x.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(key);
    }
    // Source = "channel" se o canal contribuiu com pelo menos 1 tópico novo.
    const channelContributed = c.some(
      (x) => typeof x === "string" && x.trim() && !t.includes(x)
    );
    return { value: merged, source: channelContributed ? "channel" : "tenant" };
  })();

  const handoff_keywords: PolicyField<string[]> = Array.isArray(tenant.handoff_keywords) && tenant.handoff_keywords.length > 0
    ? { value: tenant.handoff_keywords, source: "tenant" }
    : { value: [], source: "default" };

  // ----- Modelo & regras -----
  const ai_model = pick<string>(
    null,
    tenant.ai_model,
    DEFAULTS.ai_model,
    false
  );

  const rules: PolicyField<unknown[]> = Array.isArray(tenant.rules)
    ? { value: tenant.rules as unknown[], source: "tenant" }
    : { value: [], source: "default" };

  return {
    personality_name,
    personality_tone,
    greeting_style,
    use_emojis,
    max_response_length,
    system_prompt,
    custom_instructions,
    custom_knowledge,
    sales_mode_enabled,
    forbidden_topics,
    handoff_keywords,
    ai_model,
    rules,
    channel_type: { value: input.channelType, source: "base" },
    invariants: PLATFORM_INVARIANTS,
  };
}

/**
 * Açúcar: extrai só os valores compilados, sem source_trace.
 * Útil quando o consumidor não precisa logar origem.
 */
export function flattenPolicy(p: EffectivePolicy) {
  return {
    personality_name: p.personality_name.value,
    personality_tone: p.personality_tone.value,
    greeting_style: p.greeting_style.value,
    use_emojis: p.use_emojis.value,
    max_response_length: p.max_response_length.value,
    system_prompt: p.system_prompt.value,
    custom_instructions: p.custom_instructions.value,
    custom_knowledge: p.custom_knowledge.value,
    sales_mode_enabled: p.sales_mode_enabled.value,
    forbidden_topics: p.forbidden_topics.value,
    handoff_keywords: p.handoff_keywords.value,
    ai_model: p.ai_model.value,
    rules: p.rules.value,
    channel_type: p.channel_type.value,
    invariants: p.invariants,
  };
}

/**
 * Extrai um source_trace compacto pra logging/observabilidade.
 */
export function policySourceTrace(p: EffectivePolicy): Record<string, PolicySource> {
  return {
    personality_name: p.personality_name.source,
    personality_tone: p.personality_tone.source,
    greeting_style: p.greeting_style.source,
    use_emojis: p.use_emojis.source,
    max_response_length: p.max_response_length.source,
    system_prompt: p.system_prompt.source,
    custom_instructions: p.custom_instructions.source,
    custom_knowledge: p.custom_knowledge.source,
    sales_mode_enabled: p.sales_mode_enabled.source,
    forbidden_topics: p.forbidden_topics.source,
    handoff_keywords: p.handoff_keywords.source,
    ai_model: p.ai_model.source,
    rules: p.rules.source,
    channel_type: p.channel_type.source,
  };
}
