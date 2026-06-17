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

## Regras de marca e produto (v6.20 final — 2026-06-17)

- **Bloqueadores reais (apenas técnicos):** conexão Meta ativa (página, pixel, conta), imagem principal do produto, logo e paleta da marca, URL+UTM válidos, orçamento, tabela de preços de IA.
- **Tudo o mais é aviso, nunca bloqueio:** tipo/função do produto (`ai_product_type`, `ai_main_function`), descrição, diferenciais, tom de voz, promessa, claims, restrições. Refino editorial é feito 100% via prompt estratégico + feedback nas propostas. Campos `brand.tone_of_voice`, `brand.approved_main_promise`, `brand.allowed_claims`, `brand.banned_claims`, `brand.do_not_do`, `brand.restrictions` **não geram avisos nem bloqueios**.

## Anti-regressão

- PROIBIDO reintroduzir formulário manual de Página/Pixel/Instagram/Conta/Evento/Janela por conta de anúncios. `MetaProductionConfigCard.tsx` ficou órfão — qualquer reuso futuro precisa autorização explícita.
- PROIBIDO bloquear geração de criativos por ausência de evento de conversão ou janela de atribuição. São sempre derivados.
- PROIBIDO transformar tom de voz, diferenciais ou restrições genéricas em bloqueador sem categoria sensível.
- Testes em `creativeReadinessGate_test.ts` cobrem: derivação automática (testes 05/06), aviso de diferenciais (15), bloqueador condicional de claims (19), aviso de restrições (20).

## Fase 2 (2026-06-16) — Categoria livre + Diretrizes Globais

- Cadastro de produto não tem mais campo fechado de categoria regulatória na UI. Apenas dois campos livres: `ai_product_type` e `ai_main_function` (em `products`).
- Bloqueadores do gate H.4.1 agora exigem `ai_product_type` + `ai_main_function`. `regulatory_category` e `commercial_restrictions` legados ficam só por compatibilidade.
- `brand.allowed_claims` foi rebaixado para aviso — não bloqueia mais.
- Tabela global `platform_commercial_guidelines` (Meta/Google/TikTok × categoria inferida) é fonte única para geração de copy/criativo. RLS: leitura para authenticated, escrita só `platform_admin`.
- Cron mensal `platform-guidelines-monthly-refresh` (dia 1, 03:00 UTC) usa Firecrawl + Lovable AI (`gemini-2.5-flash`) para detectar mudanças e marcar `status='review_needed'`. NUNCA bloqueia geração — serve versão anterior até admin aprovar.
- Helper `_shared/ads-autopilot/guidelineResolver.ts`: `inferCategory(type, function)` por keyword matching determinístico (sem custo de LLM por request), `resolveGuidelinesForProduct` para consumo pelo motor de geração.
- UI super-admin: `/platform/commercial-guidelines` (PlatformAdminGate). Tenant comum não vê.

### Anti-regressão Fase 2
- PROIBIDO reintroduzir dropdown fechado de categoria regulatória — quebra a base livre que alimenta as diretrizes globais.
- PROIBIDO cron alterar diretriz sem revisão humana. `review_needed` é estado obrigatório quando muda algo.
- PROIBIDO bloquear geração quando há diretriz em `review_needed`.
