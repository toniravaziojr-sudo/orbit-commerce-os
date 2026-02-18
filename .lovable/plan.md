

# Correcao v5.11.1 — Destravar Pipeline de Criativos (2 Bugs + 2 Ajustes do ChatGPT)

## Diagnostico Confirmado

O pipeline de geracao de criativos esta **100% parado** por 2 bugs que trabalham juntos:

### Bug 1: Coluna errada (`ads-autopilot-creative`, linha 66)
- Codigo atual: `.order("position", { ascending: true })`
- A tabela `product_images` nao tem coluna `position`. O nome correto e `sort_order`.
- Resultado: query retorna vazio, funcao responde `{ success: false, error: "Imagem do produto nao encontrada" }` com HTTP 200.

### Bug 2: Sucesso fantasma (`ads-autopilot-analyze`, linhas 2397-2408)
- O bloco `generate_creative_image` (Ponto B, linha 2397) so checa `creativeErr` (erro HTTP de transporte).
- Quando `ads-autopilot-creative` retorna HTTP 200 com `{ success: false }`, o analyze ignora e marca `executed`.
- Mesmo problema no Ponto A (linha 2122-2127): auto-generation trigger so checa `creativeErr`.

### Resultado combinado
- `creative_job_id` = null em todas as acoes
- `ads_creative_assets` = 0 registros
- Sistema "acredita" que gerou criativos, mas nao gerou nenhum

---

## Correcoes a Implementar

### Correcao 1: `ads-autopilot-creative/index.ts`
**Linha 66**: trocar `"position"` por `"sort_order"`
- Version bump: v1.2.0 -> v1.2.1

### Correcao 2: `ads-autopilot-analyze/index.ts` — Ponto B (linhas 2397-2408)
Bloco `generate_creative_image` tool. Adicionar check de `success === false` apos linha 2397:

```text
if (creativeErr) throw creativeErr;

// v5.11.1: Check logical success (HTTP 200 but success=false)
if (creativeResult?.success === false) {
  throw new Error(creativeResult?.error || "Creative generation failed (success=false)");
}

// v5.11.1: Enrich action_data with traceability
actionRecord.status = "executed";
actionRecord.executed_at = new Date().toISOString();
actionRecord.action_data = {
  ...actionRecord.action_data,
  creative_job_id: creativeResult?.data?.job_id,
  creative_success: true,
  creative_error: null,
  product_id: topProduct.id,
  product_name: topProduct.name,
  funnel_stage: args.funnel_stage || null,
  strategy_run_id: strategyRunId,
};
```

O `throw` garante que o `catch` existente (linhas 2410-2413) trata o caso corretamente: marca `failed` com `error_message`.

### Correcao 3: `ads-autopilot-analyze/index.ts` — Ponto A (linhas 2122-2127)
Bloco auto-generation trigger dentro de `create_campaign`. Adicionar check de `success === false`:

```text
if (creativeErr) {
  console.error(...);
} else if (creativeResult?.success === false) {
  console.error(`[ads-autopilot-analyze][${VERSION}] Creative logical failure: ${creativeResult?.error}`);
  creativeJobId = null;
} else {
  creativeJobId = creativeResult?.data?.job_id || null;
  console.log(...);
}
```

Aqui o status ja e controlado pelas pos-condicoes estritas (linhas 2211-2232), entao `creativeJobId = null` garante que a acao NAO sera `executed` (caira em `pending_creatives`).

### Version bump
- `ads-autopilot-creative`: v1.2.0 -> v1.2.1
- `ads-autopilot-analyze`: v5.11.0 -> v5.11.1

---

## Ajustes exigidos pelo ChatGPT (incorporados)

### Ajuste 1: "success=false NUNCA pode terminar em executed"
- **Ponto B**: o `throw` garante que cai no `catch` -> `status = "failed"`. Coberto.
- **Ponto A**: `creativeJobId = null` faz a pos-condicao (linha 2215) definir `pending_creatives`. Coberto.

### Ajuste 2: "Garantir que generate_creative cria registro em ads_creative_assets"
- Este registro e criado pela funcao `creative-image-generate` (chamada por `ads-autopilot-creative`).
- O bug da coluna `position` impedia que `ads-autopilot-creative` chegasse ate essa chamada.
- Com o fix de `sort_order`, a chamada a `creative-image-generate` vai acontecer, e ESSA funcao e responsavel por inserir em `ads_creative_assets`.
- Aceite B valida isso: se `ads_creative_assets` continuar vazio apos o fix, o problema esta em `creative-image-generate` (proximo passo).

---

## Secao Tecnica

### Arquivos Afetados

| Arquivo | Mudanca | Versao |
|---------|---------|--------|
| `supabase/functions/ads-autopilot-creative/index.ts` | Linha 66: `position` -> `sort_order` | v1.2.1 |
| `supabase/functions/ads-autopilot-analyze/index.ts` | Ponto A (L2122-2127): check `success===false`; Ponto B (L2397-2408): check `success===false` + rastreabilidade | v5.11.1 |

### Sequencia de Implementacao
1. Fix `sort_order` em `ads-autopilot-creative`
2. Fix Ponto B (generate_creative tool) em `ads-autopilot-analyze`
3. Fix Ponto A (auto-generation trigger) em `ads-autopilot-analyze`
4. Deploy ambas as funcoes
5. Rodar queries de aceite

### Queries de Aceite (rodar apos proximo ciclo)

**Aceite A** — `creative_job_id` preenchido:
```text
SELECT created_at, status,
       action_data->>'creative_job_id' as job_id,
       action_data->>'creative_success' as creative_success,
       action_data->>'creative_error' as creative_error,
       error_message
FROM ads_autopilot_actions
WHERE action_type = 'generate_creative'
ORDER BY created_at DESC LIMIT 10;
```

**Aceite B** — Assets aparecendo:
```text
SELECT id, product_name, funnel_stage, status, session_id, created_at
FROM ads_creative_assets
ORDER BY created_at DESC LIMIT 10;
```

**Aceite C** — Fim do sucesso fantasma:
```text
SELECT status, count(*)
FROM ads_autopilot_actions
WHERE action_type = 'generate_creative'
  AND action_data->>'creative_job_id' IS NULL
  AND status = 'executed'
  AND created_at > now() - interval '1 hour'
GROUP BY status;
-- Resultado esperado: 0 linhas (nenhum executed sem job_id)
```

