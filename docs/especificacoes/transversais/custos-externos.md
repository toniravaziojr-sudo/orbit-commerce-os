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
  - **OpenAI** — endpoint de billing descontinuado.
  - **Google Cloud** — exige Service Account + BigQuery export.
  - **Cloudflare / Lovable / Firecrawl / Focus NFe** — assinatura mensal fixa.
  - **Gemini** — pay-as-you-go, sem saldo.
- O botão "Sincronizar saldos" só aparece quando há ≥1 serviço em modo `auto`.

## Alerta
Banner fixo no topo de `/platform/*` quando há serviço com renovação ≤7 dias (warning) ou ≤3 dias (crítico).

## Serviços ativos
SendGrid (auto), Cloudflare, Lovable, Firecrawl, **Focus NFe**, Fal.AI, OpenAI, Google Cloud, Gemini.

## Removidos
- **Z-API** (WhatsApp), **Late** (social), **ElevenLabs**: removidos na Onda 1.
- **Nuvem Fiscal**: removida — substituída integralmente por **Focus NFe** (token único da plataforma).
