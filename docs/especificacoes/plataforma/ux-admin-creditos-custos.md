# UX Admin — Créditos, Custos Externos e Margens

> **Camada:** Layer 3 — Especificação Funcional  
> **Status:** Especificação futura (UI ainda não implementada nesta fase 0)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** experiência do platform_admin em torno de custos externos, consumo por tenant, margem, catálogo de preços e reconciliação.

---

## 1. Hub principal

**Rota oficial:** `/platform/external-costs`

Hub admin para custos externos da plataforma e tudo relacionado ao Motor Universal de Créditos. Aba atual ("Custos da plataforma") é mantida e expandida com novas abas.

## 2. Estrutura de abas (futuro)

| Aba | Caminho | Conteúdo |
|---|---|---|
| **Custos da plataforma** | `/platform/external-costs` (default) | Atual: serviços de terceiros, sync 6h, banner de alerta. |
| **Consumo por tenant** | `?tab=tenants` | Tabela com cost/sell/margem por tenant. |
| **Consumo por categoria** | `?tab=categories` | Agregado por categoria (IA, fiscal, e-mail, WhatsApp, scrape). |
| **Consumo por provedor** | `?tab=providers` | Agregado por provedor (OpenAI, Fal, Focus NFe, SendGrid, Meta, Firecrawl). |
| **Catálogo de preços** | `?tab=pricing` | CRUD do `service_pricing` (apenas platform_admin). |
| **Reconciliação** | `?tab=reconciliation` | Diferença entre ledger e fontes externas. |
| **Margens** | `?tab=margins` | Visão consolidada de margem por tenant/categoria/período. |

## 3. Aba "Consumo por tenant"

### 3.1 Colunas obrigatórias

| Coluna | Conteúdo |
|---|---|
| Tenant | Nome + slug. |
| Plano | Plano SaaS atual. |
| Créditos comprados | Período. |
| Créditos consumidos | Período. |
| Saldo atual | `balance_credits - reserved_credits`. |
| `cost_usd` | Custo real total no período. |
| `cost_brl` | Snapshot BRL (soma dos snapshots do ledger). |
| `sell_usd` | Valor vendido em USD. |
| `sell_brl` | Valor vendido em BRL. |
| `margem_usd` | `sell_usd - cost_usd`. |
| `margem_brl` | `sell_brl - cost_brl`. |
| `margem_pct` | `(sell - cost) / sell × 100`. |
| Período | Período aplicado pelo filtro. |

### 3.2 Filtros admin

- Tenant (autocomplete).
- Período (preset + custom).
- Categoria.
- Provedor.
- Feature/módulo.
- `cost_owner` (`tenant` \| `platform`).
- Status (concluído, estornado, falha).

### 3.3 Drill-down

Click no tenant → abre painel lateral com:
- Top 10 features mais caras do período.
- Linha do tempo de débitos.
- Link "Ver extrato completo" (somente leitura, com `cost_usd`/`sell_usd`/margem).

## 4. Análises obrigatórias do admin

O painel admin deve permitir responder:

- Qual o custo real total da plataforma no período?
- Qual o custo real por tenant?
- Qual o custo real por categoria?
- Qual o custo real por provedor?
- Qual o valor total vendido em créditos (sell)?
- Qual a margem por tenant?
- Qual a margem por categoria?
- Quais divergências de reconciliação existem entre ledger e painéis externos?
- Quais tenants estão com consumo anômalo (spike vs baseline)?

## 5. Aba "Catálogo de preços"

- CRUD completo de `service_pricing`.
- **Apenas platform_admin** (`is_platform_admin()`).
- Campos editáveis: `cost_usd_per_unit`, `markup_pct`, `min_credits_charge`, `effective_from/until`, `is_active`, `metadata`.
- Atualização cria nova linha (versionamento por vigência) e fecha vigência da anterior. Não permite edição destrutiva.
- Histórico de versões visível por `service_key`.
- Alerta se markup informado diverge do default da categoria.
- Validações: `cost_usd_per_unit > 0`, `markup_pct >= 0`, `effective_from < effective_until` quando ambos preenchidos.

## 6. Aba "Reconciliação"

- Diferença entre soma do ledger por provedor (período) e dados de painel externo (`platform_external_costs.current_balance` delta, ou faturas importadas).
- Coluna "Divergência %" com semáforo:
  - <2%: verde.
  - 2–5%: amarelo.
  - >5%: vermelho com alerta.
- Detalhamento por dia/serviço para investigação.
- **Importante:** reconciliação financeira exata depende de fonte real do provedor. Se o provedor não expõe API de faturamento (caso de Fal.AI, OpenAI billing descontinuado, Google Cloud sem BigQuery export), a reconciliação inicial é **estimada** com base em `cost_usd_per_unit × volume registrado no ledger`. Limitação documentada na UI.

## 7. Aba "Margens"

- Margem consolidada por tenant, categoria, provedor e período.
- Gráfico de margem ao longo do tempo.
- Identificação de tenants com margem negativa (sinal de pricing mal configurado).
- Identificação de categorias com margem fora do esperado (ex.: e-mail com markup 100% mas margem real 30% por algum motivo).

## 8. Exportação

- Cada aba tem botão "Exportar CSV".
- Exportação inclui todos os campos visíveis + IDs internos para auditoria.
- Limite: 12 meses por export.

## 9. Fonte de dados

A UI admin **não** calcula valores no frontend. Toda agregação vem de:

- Views SQL (`v_tenant_consumption_period`, `v_category_consumption_period`, etc.) — preferencialmente views normais.
- RPCs seguras (`get_tenant_margins`, `get_reconciliation_diff`).
- Materialized views **apenas se houver problema de performance comprovado**. Não usar como padrão na fase inicial.

## 10. Regras de acesso

- Todas as abas exigem `is_platform_admin()`.
- Frontend protege com `PlatformAdminGate`.
- RLS protege no banco (defense in depth).
- `cost_usd`, `markup_pct`, margem **nunca** são acessíveis a usuários tenant.

## 11. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`
- `docs/especificacoes/transversais/custos-externos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`
