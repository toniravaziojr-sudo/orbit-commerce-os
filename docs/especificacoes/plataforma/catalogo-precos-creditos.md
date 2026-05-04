# Catálogo de Preços de Créditos — Comando Central

> **Camada:** Layer 2/3 — Especificação de Plataforma  
> **Status:** Ativo (Fase 0 — fundação documental)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** estrutura do catálogo, evolução de `ai_pricing`, regras de markup por categoria, regras de câmbio, controle de acesso a campos sensíveis.

---

## 1. Objetivo

Definir o catálogo administrável e versionado que serve como fonte única de verdade para:

- custo real (`cost_usd`) de cada serviço pago consumido pela plataforma;
- markup aplicado por categoria;
- créditos mínimos por operação;
- câmbio para snapshot em BRL.

O catálogo alimenta o Motor Universal de Créditos (ver `motor-creditos.md`). Toda transação de débito lê preço **vigente** no momento, e grava snapshot na linha do ledger.

## 2. Estado atual

| Tabela | Status | Linhas | Observação |
|---|---|---|---|
| `ai_pricing` | Ativa, versionada | 30 | Possui `pricing_type`, `effective_from/until`, RLS. Apenas IA. |
| `ai_model_pricing` | Legada | 4 | Subconjunto antigo. Será deprecada. |
| `platform_external_costs` | Ativa | 9 serviços | Custos fixos da plataforma (assinaturas, payg). Não cobre catálogo de débito. |

## 3. Estratégia de evolução (a decidir na Fase 1)

`ai_pricing` cobre apenas IA. Precisa virar **catálogo universal** cobrindo todas as categorias pagas (`ai_text`, `ai_image`, `ai_video`, `ai_audio`, `ai_embedding`, `fiscal`, `email`, `whatsapp`, `scrape`, e categorias futuras).

Três estratégias possíveis (decisão fica para abertura da Fase 1):

### Opção A — Rename + ALTER `ai_pricing` → `service_pricing`

**Prós:** preserva 30 linhas, preserva RLS, evita duplicação.  
**Contras:** rename quebra dependências (hooks, edge functions, types gerados). Exige varredura completa.

### Opção B — Tabela nova + view de compatibilidade

Criar `service_pricing` nova com schema universal. Manter `ai_pricing` como **view** sobre `service_pricing` filtrada por categorias `ai_*`.

**Prós:** zero quebra para código existente. Migração faseada.  
**Contras:** duas estruturas convivendo até cutover. Risco de divergência se ALTER acontecer só em uma.

### Opção C — Tabela nova + janela de migração

`service_pricing` nova, `ai_pricing` mantida congelada, código novo lê `service_pricing`, código antigo migrado por etapa, deprecar `ai_pricing` após 100% migrado.

**Prós:** isolamento. **Contras:** trabalho de migração dobrado.

**Recomendação técnica (sujeita a aprovação na Fase 1):** **Opção B** — tabela nova + view de compatibilidade. Minimiza risco de regressão e permite migração orgânica.

**`ai_model_pricing` (legada, 4 linhas):** deprecar com janela de migração — remover dependências, redirecionar leituras para `service_pricing`/`ai_pricing`, então DROP. Não é fonte de verdade hoje.

## 4. Schema esperado de `service_pricing`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | — |
| `category` | text NOT NULL | `ai_text` \| `ai_image` \| `ai_video` \| `ai_audio` \| `ai_embedding` \| `fiscal` \| `email` \| `whatsapp` \| `scrape` \| ... |
| `provider` | text NOT NULL | `openai` \| `gemini` \| `fal` \| `lovable` \| `sendgrid` \| `focus_nfe` \| `meta_whatsapp` \| `firecrawl` \| ... |
| `service_key` | text NOT NULL | Identificador estável do serviço, ex.: `gpt-5.2-chat`, `kling-v3-video`, `nfe-emit`, `nfe-cancel`, `cce`, `inutilizar`, `email-send`, `whatsapp-template-marketing`, `whatsapp-window-24h-marketing`, `firecrawl-scrape-page`. |
| `model` | text NULL | Modelo específico quando aplicável (ex.: `gpt-5.2`, `gemini-2.5-flash`). |
| `variant` | text NULL | Resolução, qualidade, tamanho, template_type. |
| `unit` | text NOT NULL | `token_in` \| `token_out` \| `image` \| `second` \| `minute` \| `document` \| `email` \| `conversation_24h` \| `template` \| `page`. |
| `cost_usd_per_unit` | numeric(12,8) NOT NULL | Custo real por unidade. |
| `markup_pct` | numeric(5,2) NULL | Override do markup por entrada. Se NULL, usa default da categoria (ver §5). |
| `min_credits_charge` | int NOT NULL DEFAULT 1 | Créditos mínimos por operação (evita débito de 0). |
| `effective_from` | timestamptz NOT NULL | Vigência inicial. |
| `effective_until` | timestamptz NULL | Vigência final. NULL = vigente. |
| `is_active` | bool NOT NULL DEFAULT true | — |
| `metadata` | jsonb DEFAULT '{}' | Extras (notas, link doc do provedor). |
| `created_at` / `updated_at` | timestamptz | — |

**UNIQUE:** `(category, provider, service_key, model, variant, effective_from)`.

## 5. Markup por categoria

| Categoria | Markup default |
|---|---|
| ai_text | 50% |
| ai_image | 50% |
| ai_video | **80%** |
| ai_audio | 50% |
| ai_embedding | 50% |
| fiscal | **30%** |
| email | **100%** |
| whatsapp | 50% (Fase 1 — revisar na Fase 2 com janela 24h) |
| scrape | 50% |
| outras | 50% |

**Regras:**

1. Markup **não é hardcoded** em código. Vem do catálogo.
2. `markup_pct` no registro do catálogo é override — quando NULL, aplica default da categoria (configurável em `platform_settings` ou tabela `category_defaults`).
3. Cancelamento fiscal, CCe e inutilização **não** têm regra hardcoded "metade". Cada um é uma linha do catálogo com seu próprio `cost_usd_per_unit` e (opcionalmente) `markup_pct`. Decisão de cobrar ou isentar é feita no catálogo, não no código.

## 6. Câmbio

1. **Fase 1:** câmbio fixo configurável por platform_admin (valor inicial aprovado: **R$ 5,50 / US$ 1,00**).
   - Armazenamento sugerido (decisão estrutural na Fase 1): `platform_settings.fx_usd_brl` ou tabela `fx_rates` simples.
2. **Fase 2:** cron diário Bacen PTAX populando `fx_rates(date, rate, source)`.
3. **Snapshot obrigatório:** toda linha de `credit_ledger` grava `fx_rate_usd_brl` no momento da transação. Mudanças futuras **não alteram** linhas antigas.
4. Relatórios admin podem reprojetar valores históricos com câmbio atual, mas a fonte de verdade do extrato/relatório financeiro é o snapshot.

## 7. Versionamento por vigência

1. Atualizar preço = inserir nova linha com `effective_from = now()` e atualizar `effective_until` da anterior.
2. Sem `UPDATE` no preço de uma linha já vigente. Histórico imutável.
3. Lookup do preço vigente: `WHERE category=? AND service_key=? AND model=? AND variant=? AND now() BETWEEN effective_from AND COALESCE(effective_until, 'infinity')`.

## 8. Controle de acesso (RLS)

| Quem | Pode ver | Pode editar |
|---|---|---|
| Platform admin (`is_platform_admin()`) | Tudo (`cost_usd`, `markup_pct`, todos campos) | Sim (CRUD completo) |
| Tenant autenticado | **Apenas estimativas sanitizadas** via RPC `estimate_credits()`. Nunca acesso direto à tabela. | Não |
| Anônimo | Nada | Não |

**Crítico:** **NÃO permitir** policy `Public read ai_pricing USING (true)` no novo `service_pricing`. O catálogo atual de `ai_pricing` tem leitura pública — isso precisa ser corrigido antes ou durante a migração. Custo real, markup e margem são informação interna de plataforma.

Tenant deve receber, via RPC, apenas:
- créditos estimados para a operação;
- valor aproximado em BRL (calculado com `sell × fx`);
- categoria e descrição amigável.

## 9. Cuidados antes da migração

1. **Mapear dependências de `ai_pricing`:** hooks (`useAIPricing`), edge functions, components (`AIPricingTable.tsx`), types gerados em `src/integrations/supabase/types.ts`.
2. **Não fazer rename direto** sem mapeamento. Pode quebrar build e runtime.
3. **`ai_model_pricing` legada:** mapear leitores antes de DROP. Hoje há referências em código? Auditar antes de Fase 1.
4. **`credit_packages` em BRL:** o pricing dos pacotes em BRL precisa ser reanalisado em relação a:
   - valor do crédito em USD (1 crédito = US$ 0,01);
   - câmbio assumido (R$ 5,50);
   - bônus oferecidos;
   - margem desejada.
   Auditoria pendente antes da Fase 8 (UI lojista).

## 10. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`

---

## 11. Estado pós-Fase 2A

- `service_pricing` foi criada e populada via backfill de `ai_pricing` (30) + `ai_model_pricing` (4) — total 34 linhas, todas categoria IA.
- Catálogo **não-IA** ainda não foi seedado. Categorias `email`, `fiscal`, `whatsapp`, `scrape` ficam para **Fase 2B**.
- UI admin de `service_pricing` (CRUD vigência, markup override) também é **Fase 2B**.
- Antes de seedar `fiscal`: auditar provider fiscal real em uso. **Não assumir Nuvem Fiscal** se o sistema atual usa Focus NFe — confirmar antes de criar entradas de catálogo.

## 12. Padrão `metadata.source`

- A chave oficial em `metadata` para registrar a origem de uma linha (backfill, sistema gerador, fluxo emissor) é **`source`**.
- Forma `metadata.origin_table` está obsoleta e não deve ser introduzida em código novo. Onde aparecer, refatorar para `source` antes de plug em produção.

---

## 13. Fase 2B — Catálogo não-IA seedado (2026-05-04)

- 19 registros não-IA inseridos: email (4), fiscal Focus NFe (7), whatsapp (6, janelas 24h `is_active=false`), scrape (2).
- Todos com `metadata.placeholder=true`, `approved_for_live=false`, `price_source='manual_placeholder'`, `requires_review=true`, `created_by_phase='2B'`.
- Provider fiscal real: **Focus NFe** (`provider='focus_nfe'`). Nuvem Fiscal não é usada.
- Gate `PRICE_NOT_APPROVED`: `reserve_credits_v2` e `charge_credits_v2` recusam tenant-paid live quando `placeholder=true` e `approved_for_live=false`. `record_platform_cost` e `estimate_*` não são afetados.
- Aprovação live é bloqueada quando `placeholder=true` e `price_source='manual_placeholder'` (exige preço real validado primeiro).
- Versionamento: `admin_pricing_version` fecha vigência atual e cria nova; nunca recalcula ledger histórico.
- Tabela `service_pricing_audit` registra todas as ações com `reason` obrigatório, restrita a platform_admin.

---

## Fase 3 — Primeiro plug em shadow mode (youtube-upload)

**Status:** Ativo desde 2026-05-04. Piloto: Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

### Decisões aprovadas

- `youtube-upload` continua usando RPCs v1 (`check_credit_balance`, `reserve_credits`, `consume_credits`) como **única** fonte de cobrança real.
- Motor v2 roda em **modo paralelo** (shadow), apenas calculando créditos via `estimate_credits_internal` e gravando em `service_usage_events` com `status='shadow'`.
- v2 **não** altera `credit_wallet` e **não** insere linhas financeiras em `credit_ledger`.
- Falha do v2 nunca propaga para o usuário (try/catch silencioso, log `WARN`).

### Service pricing

- `service_key`: `platform.youtube_upload`
- `category`: `platform_internal` (nova categoria, monetização interna sem custo externo direto)
- `provider`: `youtube`, `unit`: `upload`, `display_name`: `YouTube Upload`
- `metadata.pricing_model`: `fixed_credits` — base 16, +1 thumbnail, +2 captions (espelha v1)
- `metadata.placeholder=true`, `metadata.approved_for_live=false`, `metadata.shadow_only=true`
- `cost_usd=0.005` é apenas placeholder técnico; não representa venda em créditos para este caso (cálculo usa `fixed_credits`).

### Ativação por tenant

`tenant_credit_motor_config` ganhou as colunas `shadow_service_keys` e `live_service_keys` (text[]).
A ativação shadow é **por service_key**, não por categoria, sempre que tecnicamente possível.

```text
motor_v2_enabled       = false
shadow_categories      = []
live_categories        = []
shadow_service_keys    = ['platform.youtube_upload']
live_service_keys      = []
```

### Critérios de divergência

- `delta_abs = |v2_credits − v1_credits|`
- `delta_pct = delta_abs / v1_credits × 100`
- `≤ 1%` ideal; `> 5%` marca `metadata.divergence_alert=true`. Erro v2 marca `metadata.shadow_error=true`.
- Divergência **não bloqueia** o usuário.

### Idempotência shadow

Chave determinística: `youtube-upload-shadow-v2:{tenant_id}:{video_id ou job_id}`. Retry não duplica evento (verificação prévia em `service_usage_events`).

### Rollback

Remover `platform.youtube_upload` de `shadow_service_keys` no tenant. v1 continua intacto. Eventos shadow são preservados para auditoria.

### Janela de avaliação

7 dias antes de avaliar GO/NO-GO para live. Critério provisório de live: 0 erros v2 + |delta_pct médio| ≤ 1% em ≥50 eventos.
