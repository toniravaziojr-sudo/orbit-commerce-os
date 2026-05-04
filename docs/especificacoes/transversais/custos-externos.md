# Custos Externos da Plataforma

## Visão geral
Painel `/platform/external-costs` (somente platform admin) consolida serviços de terceiros pagos pela plataforma: custo mensal, saldo/créditos atuais, data de renovação e modo de sync (auto/manual).

## Fonte de verdade
Tabela `public.platform_external_costs` (RLS: `is_platform_admin()`).

## Sincronização automática
- Edge function: `platform-costs-sync`
- Cron: a cada 6h (`platform-costs-sync-6h`)
- **Apenas serviços com API pública de saldo são sincronizados.** Hoje: **SendGrid** (créditos de e-mail).
- Demais serviços são manuais por limitação dos provedores:
  - **Fal.AI** — não expõe endpoint de saldo.
  - **OpenAI** — endpoint de billing descontinuado; novos endpoints exigem Admin Key e retornam custo, não saldo.
  - **Google Cloud** — Cloud Billing API exige Service Account + BigQuery export; sem conceito de saldo.
  - **Cloudflare / Lovable / Firecrawl / Nuvem Fiscal** — assinatura mensal fixa.
  - **Gemini** — pay-as-you-go, sem saldo.
- O botão "Sincronizar saldos" só aparece quando há ≥1 serviço em modo `auto`.

## Alerta
Banner fixo no topo de `/platform/*` quando há serviço com renovação ≤7 dias (warning) ou ≤3 dias (crítico).

## Serviços ativos
SendGrid (auto), Cloudflare, Lovable, Firecrawl, Nuvem Fiscal, Fal.AI, OpenAI, Google Cloud, Gemini.

## Removidos
- **Z-API** (WhatsApp), **Late** (social), **ElevenLabs**: removidos na Onda 1.
- **Focus NFe**: removido — substituído integralmente por Nuvem Fiscal.

## Pendente (Onda 2)
Implementar adapter completo Nuvem Fiscal (emissão/cancelamento/CCe/inutilização) com branch em `fiscal-submit` por `fiscal_settings.provider`, migrar 3 tenants (`focusnfe → nuvem_fiscal`), validar emissão real e só então remover Focus NFe do código + secret.
