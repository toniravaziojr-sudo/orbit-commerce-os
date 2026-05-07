## Objetivo

Fechar o vazamento de custo nas duas únicas edges de mídia ainda fora do motor v2 (`creative-process` e `media-generate-video`), seguindo estritamente o padrão já estabelecido pelo doc e pelo piloto Fase 3B (shadow primeiro, live depois). Sem inventar arquitetura, sem inventar service_keys, sem pular shadow.

## Por que o plano anterior precisou ser refeito

A investigação dos docs revelou 5 violações graves no plano anterior:

| # | Violação | Correção |
|---|---|---|
| 1 | Inventei `service_key` no formato `creative.kling-i2v-pro` | Usar **só** chaves canônicas já em `service_pricing`: `fal.kling-video.per_second.pro`, `fal.veo-3.1.per_second.*`, `fal.gpt-image-1.5.per_image.*` |
| 2 | Propus `chargeAfter` direto para vídeo (risco crítico no registry) | Vídeo é `reserve+capture` obrigatório com 110% da estimativa (doc §8). `chargeAfter` postpaid não atende. |
| 3 | Pulei shadow mode | Fase 3B exige shadow primeiro. `creative-image-generate` ainda está em shadow. Live só após validação |
| 4 | Ignorei o helper `live-v2.ts`/`shadow-reservation.ts` que `creative-image-generate` já usa | Replicar exatamente o mesmo padrão das edges novas — sem helper alternativo |
| 5 | Não tinha mapeamento `model_id interno → service_key canônica` | Esse mapper é o trabalho real. Pequeno, isolado, testável |

## Diagnóstico final do escopo

| Edge | Estado real | Ação |
|---|---|---|
| `creative-image-generate` | Shadow ativo + live-v2 condicional. **Já é o padrão** | Nada |
| `ads-autopilot-creative-generate` | **Delega** via fetch interno para `creative-image-generate` (linha 329). Cobrança herdada | Verificar só se `tenant_id` propaga |
| `meta-ads-creatives` | Apenas CRUD/sync da Meta API. **Não gera mídia** | Fora de escopo |
| `creative-generate` | Cria job + estimativa de display em centavos (hardcode). Não chama provider | Manter como está; cobrança vai no worker |
| `creative-process` (worker) | Já busca `costUsd` real via Fal Usage API. **Não toca motor** | Plugar shadow + reserve/capture |
| `media-generate-video` | Gera vídeo direto. **Não toca motor** | Plugar shadow + reserve/capture |

## O que será feito

### Etapa 1 — Mapper canônico (helper compartilhado)

Criar `supabase/functions/_shared/credits/media-service-key-resolver.ts`:

- Função `resolveVideoServiceKey(modelId, opts)` → `{ serviceKey, units }` para vídeo.
  - `kling-i2v-pro` → `fal.kling-video.per_second.pro` + `units = { seconds }`
  - `kling-avatar*` → `fal.kling-video.per_second.pro`
  - `veo31-text-video` → `fal.veo-3.1.per_second.fast.audio` (ou variant via opts)
- Função `resolveImageServiceKey(modelId, opts)` → para imagens (`gpt-image-bg` etc.)
- Função `resolveAudioServiceKey(modelId, opts)` → para `f5-tts`, `sync-lipsync`, `chatterbox-voice`. Se não houver entrada em `service_pricing`, retornar `null` e a edge faz **skip controlado** com `skip_reason='pricing_not_seeded'` (mesmo padrão da Fase 3B).
- Tabela única e testável. Próximas edges reusam.

### Etapa 2 — Plug em `creative-process` (worker)

Após cada step concluído com sucesso e `fetchRealCostFromFalai` resolvido:

1. `serviceKey, units = resolveVideoServiceKey(step.model_id, { seconds: actualDuration })` (ou Image, conforme tipo).
2. Se `serviceKey === null`: log `[creative-process.shadow] skip pricing_not_seeded` e segue. **Nunca quebra entrega.**
3. Caso contrário: chamar **mesma função usada por `creative-image-generate`** (`live-v2.ts` se aplicável, ou shadow via `shadow-reservation.ts`).
4. Idempotência: `${job.id}:${step.step_id}:${variation_index}`.
5. Tenant ativa shadow incluindo as novas chaves em `tenant_credit_motor_config.shadow_service_keys` (sem entrar em `live_service_keys` ainda).

### Etapa 3 — Plug em `media-generate-video`

Mesmo padrão. Vídeo = sempre shadow primeiro. Idempotência: `media-generate-video:${tenant_id}:${request_id}`.

### Etapa 4 — Seed de `service_pricing` faltantes (migration)

Auditar gaps. Hoje confirmado:

- ✅ `fal.kling-video.per_second.pro` (existe)
- ✅ `fal.veo-3.1.per_second.*` (várias variantes)
- ✅ `fal.gpt-image-1.5.per_image.*` (várias resoluções)
- ❌ `fal.pixverse.*` — **faltam**, seedar com `metadata.placeholder=true`
- ❌ `fal.f5-tts.*`, `fal.sync-lipsync.*` — **faltam**, seedar como placeholder
- ❌ `fal.kling-video.per_second.standard` (modo std do mascot avatar) — verificar

Seed só com `placeholder=true` para chaves não confirmadas; mapper retorna `null` para placeholders → edge faz skip controlado. Sem cobrança shadow errada. Cura quando preço real for confirmado.

### Etapa 5 — Atualizar `tenant_credit_motor_config` do Respeite o Homem

Adicionar em `shadow_service_keys` as novas chaves de vídeo confirmadas (Kling pro, Veo). Pixverse/F5-TTS ficam fora até preço real.

### Etapa 6 — Validação técnica obrigatória

Disparar 1 job de cada tipo no piloto e validar via:

```sql
SELECT service_key, status, metadata->>'v2_credits_estimated', metadata->>'shadow_error'
FROM service_usage_events
WHERE tenant_id='d1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status='shadow'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Critérios de sucesso:
- 0 erros shadow
- Cada step gerou exatamente 1 evento shadow
- Idempotência: re-disparo do mesmo job não duplica evento
- `credit_ledger` permanece intacto (shadow não toca financeiro)

### Etapa 7 — Janela de avaliação shadow (7 dias)

Antes de promover qualquer chave de vídeo para `live_service_keys`, esperar 7 dias com ≥10 eventos shadow por chave e 0 erros. Mesma régua da Fase 3.

## Documentação a atualizar (no fechamento)

- `docs/especificacoes/plataforma/motor-creditos.md` — nova **Fase 3C — Piloto shadow IA Vídeo + áudio creative** logo abaixo da Fase 3B.
- `docs/especificacoes/plataforma/motor-creditos-fase-3c-shadow-video.md` — doc dedicado (espelha estrutura do 3b).
- `mem://features/platform/motor-universal-creditos-rollout` — marcar lote de mídia como "shadow ativo, aguardando janela de 7 dias".
- `mem://features/ai/creative-pipeline-charging-standard` — nova memória com contrato do `media-service-key-resolver`.
- `docs/especificacoes/plataforma/funcoes-pagas.md` — atualizar status de `creative-process`, `media-generate-video`, `ads-autopilot-creative-generate` (tudo plugado em shadow).

## Fora deste plano

- **Promoção live de vídeo** — só após janela shadow validada. Mensagem separada.
- **Auditoria `tenant_ai_usage` zerado** — diagnóstico independente, mensagem separada.
- **Hardcode em `creative-generate`** — é só estimativa de display, não impacta cobrança real. Limpeza opcional futura.

## Diagrama do fluxo final

```text
creative-generate (cria job, estima display)
        ↓
creative-process (worker)
   ├─ executa step na Fal
   ├─ fetchRealCostFromFalai() → costUsd real
   ├─ salva output
   ├─ resolveVideoServiceKey(model_id, { seconds }) → { serviceKey, units } | null
   └─ se serviceKey != null → shadow event via shadow-reservation
                              (live-v2 só após promoção em config)

media-generate-video
   ├─ executa geração na Fal
   ├─ fetchRealCostFromFalai()
   ├─ resolveVideoServiceKey(...)
   └─ shadow event (igual acima)
```

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Mapper retorna chave errada → cobrança shadow errada | Testes unitários do resolver + janela 7 dias antes de live |
| Edge quebra se shadow falhar | `shadow-reservation` já tem try/catch silencioso. Falha vira `WARN`, geração entrega normalmente |
| Pixverse/F5-TTS sem preço seedado vazam custo silencioso | Aceito por enquanto. Pricing real entra em iteração futura, sem bloquear este lote |
| Chaves canônicas Kling/Veo divergem do `model_id` interno | Mapper centralizado é o único ponto de tradução. Testado |
