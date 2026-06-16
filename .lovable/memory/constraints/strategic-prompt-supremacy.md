---
name: Supremacia do Prompt Estratégico (Gestor de Tráfego)
description: O prompt estratégico do lojista é a fonte de verdade máxima do Gestor de Tráfego. Conflitos com regras, funções de produto ou diretrizes de plataforma viram avisos não-bloqueantes na tela de Configurações da IA.
type: constraint
---

## Regra

A partir de 2026-06-16 (v6.20), a hierarquia de autoridade do Gestor de Tráfego / IA passa a ser, do mais forte para o mais fraco:

1. **Prompt estratégico do lojista** (global e por conta de anúncio) — soberano.
2. Configurações manuais do lojista (ROI, ROAS, orçamento, splits, estratégia, funil).
3. Funções e categorias declaradas dos produtos.
4. Diretrizes comerciais das plataformas (Meta/Google/TikTok).
5. Templates e defaults do sistema.

## O que é proibido

- Bloquear ação por conflito **editorial** com diretriz de plataforma, função declarada do produto, descrição ou tipo do produto. Esses casos viram **aviso**, nunca bloqueio.
- Reintroduzir texto na UI dizendo que "as configurações manuais sempre prevalecem" ou que o prompt é "sugestivo". O prompt manda.
- Esconder conflitos do lojista: todo conflito detectado deve ser visível no bloco "Avisos do prompt estratégico" acima do campo de prompt em Configurações da IA (global e por conta).
- **Reintroduzir o bloco "Regras da Marca para Criativos" no Gestor de Anúncios** (campos tom de voz, promessa principal aprovada, claims permitidas/proibidas, restrições, do_not_do). Descontinuado em 2026-06-16. O refino editorial passa a ser feito 100% via prompt estratégico + feedback nas propostas.

## O que continua bloqueando

Apenas falhas **técnicas reais** que impedem fisicamente a operação:
- Conexão de plataforma ausente/expirada (Meta OAuth, conta de anúncios, página, pixel).
- Proposta sem URL de destino, UTM, orçamento, público, posicionamentos, catálogo (quando exigido), variações, formato ou CTA.
- Produto sem imagem principal.
- Marca sem logo ou paleta.
- Tabela de preços de IA ausente (custo não calculável).

## Aplicação obrigatória

- `creativeReadinessGate.ts` (Meta/Ads): itens editoriais como `product.description`, `product.ai_product_type`, `product.ai_main_function` são `warning`, nunca `blocker`. Campos `brand.tone_of_voice`, `brand.approved_main_promise`, `brand.allowed_claims`, `brand.banned_claims`, `brand.do_not_do`, `brand.restrictions` **não geram avisos nem bloqueios** no Gestor de Anúncios (descontinuados).
- `ads-chat-v2` **e `ads-chat` (legado)** (modo estratégico): system prompt declara a hierarquia explícita; diretrizes de plataforma são tratadas como recomendação consultiva.
- `guidelineResolver` e `platform_commercial_guidelines`: contexto consultivo. Quando o prompt do lojista contraria a diretriz, a proposta segue e registra o conflito como aviso.
- UI: `AdsGlobalSettingsTab` e `AdsAccountConfig` mostram (1) um aviso explicando que o prompt é fonte de verdade e que o refino se faz por feedback de proposta, logo acima do campo de prompt; (2) o bloco "Avisos do prompt estratégico" (Fase 2 — `ai-prompt-conflict-analyze` + `ai_prompt_conflict_cache`) logo abaixo.
- `tenant_brand_context` continua vivo apenas para o **modo Vendas (ai-support-chat WhatsApp)** como guardrail de promessas e termos proibidos da marca. Não é mais editado pelo Gestor de Anúncios.

## Doc formal

`docs/especificacoes/marketing/gestor-trafego.md` — seções "Hierarquia de Autoridade (Supremacia do Prompt Estratégico — v6.20)" e "Hierarquia Prompt vs Configurações Manuais (v6.20)".

