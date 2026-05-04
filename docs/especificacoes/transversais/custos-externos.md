# Custos Externos da Plataforma

## Visão geral
Painel `/platform/external-costs` (somente platform admin) consolida serviços de terceiros pagos pela plataforma: custo mensal, saldo/créditos atuais, data de renovação e modo de sync (auto/manual).

## Fonte de verdade
Tabela `public.platform_external_costs` (RLS: `is_platform_admin()`).

## Sincronização
- Edge function: `platform-costs-sync`
- Cron: a cada 6h (`platform-costs-sync-6h`)
- Botão "Sincronizar agora" no painel
- Adapters por serviço (best-effort). Provedores sem API pública de saldo ficam em modo manual.

## Alerta
Banner fixo no topo de `/platform/*` quando há serviço com renovação ≤7 dias (warning) ou ≤3 dias (crítico).

## Serviços ativos (Onda 1)
SendGrid (e-mail), Cloudflare (infra), Fal.AI (IA), OpenAI, Gemini, Nuvem Fiscal (fiscal — adapter pendente Onda 2), Focus NFe (fiscal atual — substituir), Google Cloud, Lovable, Firecrawl (avaliar mover para integração externa).

## Removidos (Onda 1)
- **Z-API** (WhatsApp): edges `whatsapp-connect`, `whatsapp-enable`, `whatsapp-test-connection` + componente `WhatsAppSettings.tsx` órfão.
- **Late** (agendamento social): removido de `platform-secrets-check` e allowlist.
- **ElevenLabs**: removidas referências em comentários/badges (não havia chamada real à API).

## Pendente (Onda 2)
Implementar adapter completo Nuvem Fiscal (emissão/cancelamento/CCe/inutilização) com branch em `fiscal-submit` por `fiscal_settings.provider`, migrar 3 tenants (`focusnfe → nuvem_fiscal`), validar emissão real e só então remover Focus NFe do código + secret.
