# Custos Externos da Plataforma

> **Camada:** Layer 3 — Especificação Transversal  
> **Última atualização:** 2026-05-04

## Visão geral
Painel `/platform/external-costs` (somente platform admin) consolida serviços de terceiros pagos pela plataforma: custo mensal, saldo/créditos atuais, data de renovação e modo de sync (auto/manual).

## Relação com o Motor Universal de Créditos

Este painel cobre apenas **custos fixos da plataforma** (assinaturas, prepaid, payg em nível agregado). A operação de **débito por uso** (cost por chamada, sell por crédito, margem por tenant) é responsabilidade do **Motor Universal de Créditos** — ver `docs/especificacoes/plataforma/motor-creditos.md`.

### Diferenças canônicas

| Conceito | Onde mora | Responsável |
|---|---|---|
| Custo externo agregado da plataforma (assinatura SendGrid, Cloudflare etc.) | `platform_external_costs` | Painel atual `/platform/external-costs` (aba "Custos da plataforma"). |
| Custo real por chamada por tenant (`cost_usd`) | `credit_ledger` | Motor de Créditos. |
| Valor vendido por chamada (`sell_usd`) | `credit_ledger` | Motor de Créditos. |
| Margem por tenant/categoria/provedor | View admin | Aba "Margens" (futura). |
| Custo absorvido pela plataforma por chamada (`cost_owner='platform'`) | Estrutura separada (decisão Fase 1) | Aba "Custos da plataforma" expandida + reconciliação. |

## Abas futuras do painel

Ver `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`. O painel será expandido com:

- Consumo por tenant
- Consumo por categoria
- Consumo por provedor
- Catálogo de preços (`service_pricing`)
- Reconciliação
- Margens

## Fonte de verdade
Tabela `public.platform_external_costs` (RLS: `is_platform_admin()`).

## Sincronização automática
- Edge function: `platform-costs-sync`
- Cron: a cada 6h (`platform-costs-sync-6h`)
- **Apenas serviços com API pública de saldo são sincronizados.** Hoje: **SendGrid** (créditos de e-mail).
- Demais serviços são manuais por limitação dos provedores:
  - **Fal.AI** — não expõe endpoint de saldo.
  - **OpenAI** — endpoint de billing descontinuado.
  - **Google Cloud** — exige Service Account + BigQuery export.
  - **Cloudflare / Lovable / Firecrawl / Focus NFe** — assinatura mensal fixa.
  - **Gemini** — pay-as-you-go, sem saldo.
- O botão "Sincronizar saldos" só aparece quando há ≥1 serviço em modo `auto`.

## Reconciliação financeira

Reconciliação exata entre ledger interno e fontes externas depende de **API/fatura integrada do provedor**. Quando essa fonte não existe (Fal.AI, OpenAI billing descontinuado, Google Cloud sem BigQuery), a reconciliação inicial será **estimada** com base em `cost_usd_per_unit × volume registrado no ledger`. Esta limitação deve ser deixada explícita na UI da aba "Reconciliação".

## Alerta
Banner fixo no topo de `/platform/*` quando há serviço com renovação ≤7 dias (warning) ou ≤3 dias (crítico).

## Serviços ativos
SendGrid (auto), Cloudflare, Lovable, Firecrawl, **Focus NFe**, Fal.AI, OpenAI, Google Cloud, Gemini.

## Removidos
- **Z-API** (WhatsApp), **Late** (social), **ElevenLabs**: removidos na Onda 1.
- **Nuvem Fiscal**: removida — substituída integralmente por **Focus NFe** (token único da plataforma).

## Documentos relacionados
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`
