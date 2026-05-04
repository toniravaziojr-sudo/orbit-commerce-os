# AI Provider Routing — Hierarquia, Fallback e Rate Limit

**Status:** Vigente — Fase 1 aplicada em 2026-05-03 (somente TPR).
**Owner técnico:** plataforma de IA de atendimento.
**Doc relacionado:** `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`,
`mem://constraints/sales-pipeline-tpr-and-output-gates`,
`mem://infrastructure/ai/provider-router-standard`.

---

## 1. Por que esse doc existe

O Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
é um intermediário conveniente — uma única chave (`LOVABLE_API_KEY`)
distribui chamadas para Gemini/OpenAI. Mas em produção ele tem dois
problemas estruturais:

1. **Rate limit por workspace Lovable, não por tenant.** Toda IA do
   sistema (atendimento real do WhatsApp, sandbox de testes, qualquer
   função utilitária) compartilha o **mesmo bucket** de RPM. Um teste
   manual ou pico de tráfego em qualquer tenant pode 429 o WhatsApp dos
   outros.
2. **É um único ponto de falha.** Se o gateway oscilar, o atendimento
   inteiro cai — mesmo que OpenAI e Gemini diretos estejam saudáveis.

A diretriz do projeto é: **fluxos críticos de atendimento devem usar
providers nativos (OpenAI / Gemini) com fallback, e tratar o Lovable
Gateway apenas como rede de segurança final** — não como dependência
primária.

---

## 2. Modelo lógico vs provider real

Usamos sempre **model ids no formato Lovable Gateway** (`google/...`,
`openai/...`) na origem da chamada. O `_shared/ai-router.ts` faz o
mapeamento para o modelo real do provider escolhido.

| Modelo lógico requisitado          | Gemini Native        | OpenAI Native | Lovable Gateway          |
|------------------------------------|----------------------|---------------|---------------------------|
| `google/gemini-2.5-flash-lite`     | `gemini-2.5-flash`   | `gpt-4o-mini` | `google/gemini-2.5-flash-lite` |
| `google/gemini-2.5-flash`          | `gemini-2.5-flash`   | `gpt-4o`      | `google/gemini-2.5-flash` |
| `google/gemini-2.5-pro`            | `gemini-2.5-pro`     | `gpt-4o`      | `google/gemini-2.5-pro`   |
| `openai/gpt-5-mini`                | `gemini-2.5-flash`   | `gpt-4o`      | `openai/gpt-5-mini`       |
| `openai/gpt-5`                     | `gemini-2.5-pro`     | `gpt-4o`      | `openai/gpt-5`            |

Quem requisita NUNCA deve hard-codear o nome real do provider —
o router decide.

---

## 3. Hierarquia padrão (preferProvider="auto")

Para modelos `google/...`:
1. **Gemini Native** (se `GEMINI_API_KEY` disponível).
2. **OpenAI Native** (se `OPENAI_API_KEY` disponível).
3. **Lovable Gateway** (se `LOVABLE_API_KEY` disponível).

Para modelos `openai/...`:
1. OpenAI Native → 2. Gemini Native → 3. Lovable Gateway.

A chave de cada provider é resolvida em ordem: `platform_credentials`
(banco) → variável de ambiente. Provider sem chave é pulado
silenciosamente.

---

## 4. Política de fallback

- Em **429** no provider atual → retry no MESMO provider com backoff
  exponencial (até `maxRetries`, default 3). Se persistir → o provider
  é marcado como rate-limited no lifecycle do request (TTL 60s) e o
  router pula para o próximo.
- Em **402** (payment required) → pula direto para o próximo provider.
- Em outros erros HTTP / exceção → pula direto para o próximo provider.
- Se **todos** falharem → retorna `Response` 502 com `error` JSON. O
  consumidor (ex.: TPR) deve cair em comportamento default seguro,
  nunca derrubar o turno.

---

## 5. Política de rate limit

- O Lovable Gateway tem rate limit **por workspace Lovable** (compartilhado).
- OpenAI Native tem rate limit por API key (tier OpenAI da plataforma).
- Gemini Native tem rate limit por API key (tier Google da plataforma).
- O `ai-router` mantém memória curta (60s) de providers já 429 dentro do
  mesmo lifecycle de request, evitando martelar provider exausto.

Recomendação para produção (próximas fases):
- **Fase 4** introduz contagem por tenant (`ai_provider_calls`) e alertas
  quando 1 tenant consome > X% do bucket.

---

## 6. Sandbox vs produção

Hoje o sandbox de testes da IA roda no MESMO `ai-support-chat` da
produção, então compartilha quotas. Risco aceito até a Fase 5, mas
mitigações já aplicadas:

- TPR (Fase 1) usa **Gemini Native** como rota primária real
  (validado em smoke test 2026-05-04 — provider=gemini,
  model=gemini-2.5-flash, latência ~2s). Isolado do bucket Lovable.
- Se `LOVABLE_API_KEY` for atingida por testes, atendimento real
  continua funcionando via Gemini/OpenAI nativos.

**Fase 5** prevê header `x-ai-context: sandbox|production` para forçar
sandbox a usar Lovable Gateway primeiro, blindando produção.

---

## 6.1. Hierarquia de credenciais (resolveAPIKeys)

A resolução de chaves no `_shared/ai-router.ts` segue ordem estrita:

1. **Fonte primária:** `platform_credentials` (banco) — via `getCredential`.
2. **Fallback condicional:** variável de ambiente do projeto Supabase
   (`Deno.env.get`) — usada SOMENTE se o banco não retornou chave válida.

⚠️ **Bug histórico (corrigido em 2026-05-04):** a v1.2.0 do router
consultava o banco e em seguida sobrescrevia incondicionalmente
`openaiKey`/`geminiKey` com `Deno.env.get(...) || null`. Como
`OPENAI_API_KEY`/`GEMINI_API_KEY` não existem como env var do projeto
(estão só no banco), o resultado era `null` para ambos e o router
caía sempre no Lovable Gateway — anulando o objetivo da Fase 1.

A correção tornou o fallback **condicional** (`if (!openaiKey) ...`),
adicionou `trim()` para evitar string vazia, e mantém o contrato do
router intacto.

**Validação obrigatória:** Fase 1 só pode ser considerada fechada
após smoke test confirmar `provider=gemini` ou `provider=openai`
nos logs do TPR — nunca `provider=lovable` como primário.

---

## 7. Plano faseado

| Fase | Escopo | Status |
|------|--------|--------|
| 1 | Migrar **TPR** (`turn-pre-router.ts`) para `ai-router`. | ✅ Fechada 2026-05-04 (Gemini Native validado) |
| 2 | Migrar composer principal (9 chamadas OpenAI direto) em `ai-support-chat/index.ts` para `ai-router` (consolidar fallback). | Planejada |
| 3 | Migrar 16 funções utilitárias que ainda chamam o Gateway direto. | Planejada |
| 4 | Tabela `ai_provider_calls` por tenant + alertas de consumo. | Planejada |
| 5 | Header `x-ai-context: sandbox|production` para isolar testes. | Planejada |

Cada fase exige nova entrega, doc/memória atualizadas e validação real.
**Onda 1C continua em `dry_run`** — esta migração não a promove.

---

## 8. Rollback de emergência

Cada função migrada deve preservar um caminho de rollback simples.

**TPR:** setar a variável de ambiente `TPR_USE_LEGACY_GATEWAY=1`
no projeto Supabase. O código volta a chamar o Lovable Gateway
diretamente (caminho antigo), sem deploy. Para reativar o router,
remover/zerar a variável.

---

## 9. Observabilidade mínima (Fase 1)

### 9.1 Logs stdout (fonte auxiliar)

O TPR loga em todas as chamadas:
```
[turn-pre-router] provider=<gemini|openai|lovable> model=<real-model> latency=<ms>ms source=llm fallback=<true|false>
```
Em falha total:
```
[turn-pre-router] all providers failed or timeout: <reason>
```

⚠️ Logs stdout são **voláteis** (rotacionam, sem retenção longa) e não permitem agregação histórica por turno/conversa. Servem só para debug em janela curta.

### 9.2 Auditoria persistente — `ai_support_turn_log.metadata.tpr`

**Lacuna histórica:** até 2026-05-04 a única evidência do provider real usado pelo TPR vinha do stdout. A validação observacional do dia constatou que `ai_support_turn_log.metadata.tpr` não existia, então não havia auditoria histórica do TPR — impossível responder, dias depois, "qual provider o TPR usou nesse turno?".

**Correção aplicada (2026-05-04):**

1. `TurnClassification` ganhou dois campos opcionais não-breaking: `provider: "gemini" | "openai" | "lovable" | null` e `model: string | null`. Preenchidos nos 3 caminhos do TPR (router-success, no_tool_call, legacy gateway).
2. O ponto único de persistência de `ai_support_turn_log` no `ai-support-chat` agora inclui `metadata.tpr` com o snapshot do TPR já calculado no turno. Persistência protegida por try/catch externo — falha de log nunca derruba o atendimento.

Forma do `metadata.tpr`:
```json
{
  "source": "llm" | "fallback",
  "provider": "gemini" | "openai" | "lovable" | null,
  "model": "gemini-2.5-flash" | "gpt-4o-mini" | "google/gemini-2.5-flash-lite" | null,
  "latency_ms": 2005,
  "fallback": false,
  "error": null,
  "timestamp": "2026-05-04T13:17:29.000Z"
}
```

**Hierarquia de fontes de auditoria do TPR:**
1. `ai_support_turn_log.metadata.tpr` — fonte de verdade persistente.
2. Stdout `[turn-pre-router] ...` — fonte auxiliar para janela curta.

**Garantias preservadas:** classificação, contrato `TurnClassification`, prompt, tool calling, conteúdo enviado ao modelo, resposta final, ranking, Catalog Probe, Orchestrator e Onda 1C continuam intactos. Esta entrega é puramente observacional.

### 9.3 Persistência defensiva em falha do composer (Fase 1.1 — 2026-05-04)

**Lacuna descoberta na validação observacional pós-9.2:** o insert canônico de `ai_support_turn_log` (linha ~7951 do `ai-support-chat/index.ts`) só executava no caminho de SUCESSO do composer. Se o composer falhasse (HTTP 429, `insufficient_quota`, exception de fetch, qualquer erro OpenAI), o handler retornava early com `{ success: false, code: "RATE_LIMIT" | "AI_ERROR" }` SEM gravar log algum. Resultado: cegueira total do turno — inclusive do TPR, mesmo quando ele rodou com sucesso antes do composer.

**Correção aplicada:** no caminho de erro do composer (`if (!response || !response.ok)`), antes dos returns 429/AI_ERROR, é executado um insert mínimo em `ai_support_turn_log` com:

- Campos canônicos básicos: `conversation_id`, `tenant_id`, `message_id`, `last_user_message`, `last_user_message_at`, `model_used`, `response_length=0`, `duration_ms=null`.
- `metadata.tpr` — mesmo snapshot do caminho de sucesso (provider/model/source/latency/fallback).
- `metadata.composer_error` — resumo seguro do erro:
  ```json
  {
    "stage": "composer",
    "code": "insufficient_quota" | "429" | "fetch_error",
    "message": "<até 240 chars, sem chars de controle>",
    "http_status": 429 | 500 | null,
    "provider": "openai",
    "model": "gpt-5",
    "timestamp": "2026-05-04T13:33:35.000Z"
  }
  ```

**Garantias:**
- Sanitização: nunca grava token/secret/payload bruto. Mensagem é parseada como JSON quando possível (extrai `error.code`/`error.message`); se não for JSON, usa texto truncado a 240 chars sem caracteres de controle.
- Não-bloqueante: insert dentro de `try/catch`; falha de gravação só vai para stdout (`[F1-FAIL]`).
- Idempotência por caminho: insert de falha só roda no `if (!response || !response.ok)`; insert de sucesso só roda no caminho ok. Mutuamente exclusivos → sem duplicação.
- Runtime inalterado: shape `{ success: false, error, code }` permanece igual; nenhum prompt/ranking/conteúdo tocado.

**Hierarquia de auditoria reafirmada:** `ai_support_turn_log.metadata.tpr` agora é fonte principal mesmo quando o composer falha. Stdout segue auxiliar.

---

## 10. O que NÃO foi feito nesta entrega

- Composer principal do `ai-support-chat` continua chamando OpenAI
  direto (sem router).
- Outras 16 funções utilitárias continuam no Lovable Gateway direto.
- Catalog Probe e `search_products` não foram alterados.
- Orchestrator continua desligado.
- Onda 1C continua em `dry_run`.
- Nenhuma alteração em prompt, ranking, shape de resposta ou UI.
