---
name: Ads Readiness — Meta Auto-Derive
description: Motor de prontidão de criativos lê ativos Meta da integração ativa e deriva evento de conversão/janela de atribuição do objetivo da campanha. PROIBIDO reintroduzir campos manuais.
type: constraint
---

A partir de 2026-06-16, o motor de prontidão H.4.1 (`creativeReadinessGate.ts` + `readinessLoader.ts`) **não exige mais** os seguintes itens como campo manual:

- **Página do Facebook**, **Instagram**, **Pixel**, **Conta de anúncios**, **API de Conversões**: lidos exclusivamente de `tenant_meta_integrations` (linhas `status='active'`, `integration_id` em `anuncios`/`pixel_facebook`/`conversions_api`).
- **Evento de conversão**: derivado do objetivo da campanha. Mapa fixo: `sales/conversions/purchase → PURCHASE`, `leads/lead_generation → LEAD`, `traffic/engagement/awareness → VIEW_CONTENT`. Helper canônico: `deriveConversionEventFromObjective` em `accountDefaults.ts`.
- **Janela de atribuição**: padrão Meta por objetivo. Sales → `7d_click_1d_view`; Leads → `7d_click`; outros → `1d_click`. Helper: `deriveAttributionWindowFromObjective`.

**A tabela `ads_meta_production_config` permanece apenas como override avançado opcional.** Loader não depende dela para nada. UI não expõe esses campos como formulário obrigatório.

## Regras de marca e produto (H.4.1 v2)

- **Bloqueadores reais que sobram:** promessa principal aprovada (sempre); claims permitidas (apenas se categoria do produto for sensível: `cosmetic_hair` ou `supplement`); categoria regulatória do produto; logo, paleta e imagem principal do produto.
- **Viraram avisos (não bloqueiam):** tom de voz, diferenciais/benefícios do produto, claims proibidas/restrições da marca.

## Anti-regressão

- PROIBIDO reintroduzir formulário manual de Página/Pixel/Instagram/Conta/Evento/Janela por conta de anúncios. `MetaProductionConfigCard.tsx` ficou órfão — qualquer reuso futuro precisa autorização explícita.
- PROIBIDO bloquear geração de criativos por ausência de evento de conversão ou janela de atribuição. São sempre derivados.
- PROIBIDO transformar tom de voz, diferenciais ou restrições genéricas em bloqueador sem categoria sensível.
- Testes em `creativeReadinessGate_test.ts` cobrem: derivação automática (testes 05/06), aviso de diferenciais (15), bloqueador condicional de claims (19), aviso de restrições (20).
