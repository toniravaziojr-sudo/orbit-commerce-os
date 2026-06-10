# Plano — Onda D: base de produção Meta Ads enxuta

**Status:** Entregue 2026-06-10. Sucessora da Onda C (ownership por nível).

## Entregue nesta rodada

### D.1 — Limpeza da aba Campanha
- Removido o bloco "Resumo herdado dos anúncios" do `CampaignSection` no modal de proposta.
- A aba Campanha agora exibe **apenas** nome, objetivo, canal, modo de compra, tipo de orçamento, orçamento diário, status inicial e racional.
- Link, CTA e tracking só aparecem na aba Anúncio/Criativo. Campos legados continuam disponíveis no normalizer para compatibilidade técnica, mas não vazam para UI.

### D.2 — Configuração de Criação Meta (persistida)
- Nova tabela `ads_meta_production_config` (1 registro por tenant × conta de anúncios).
- Fonte de verdade operacional usada pelo Strategist. Não é mock, não é temporária.
- Campos cobertos:
  - **Identidade:** página do Facebook, conta do Instagram.
  - **Mensuração:** Pixel, evento de conversão padrão, janela de atribuição.
  - **Campanha:** objetivo, modo de compra, tipo de orçamento, orçamento diário padrão, status inicial.
  - **Conjunto:** país, idioma, idade min/max, gênero, posicionamentos, tipo de público, etapa de funil, exclusão de clientes, públicos personalizados, lookalikes.
  - **Anúncio/Criativo:** CTA, formato, UTM padrão, estratégia de imagem de referência.
- Defaults seguros aplicados automaticamente: BR, pt_BR, 18-65, todos, Advantage+, Leilão, objetivo `sales`, status `PAUSED`, CTA `SHOP_NOW`, formato `1x1`.
- Não inventa Pixel, Página, Instagram Actor ou evento — vai como pendência.

### D.3 — UI: bloco "Configuração de Criação Meta"
- Componente `MetaProductionConfigCard` em `src/components/ads/`.
- Renderizado no topo do card de cada conta Meta dentro de Gestor de Tráfego IA → Configurações Gerais → Meta Ads.
- Mostra dados configurados, pendentes obrigatórios (vermelho) e opcionais (cinza).
- Permite salvar configuração parcial — Página/Pixel/Evento só bloqueiam publicação real (etapa C, futura).
- Hook `useAdsMetaProductionConfig` com helpers `isProductionConfigReadyForStrategy` e `isProductionConfigReadyForPublish`.

### D.4 — Gates por etapa
- `runStructureCompletenessGate(structure, { stage })` aceita 3 etapas:
  - **strategy (default):** Campanha + Conjunto + Anúncio/Criativo minimamente prontos. Evento de conversão = warning, não blocker.
  - **creative:** apenas Criativo (produto, link, CTA, copy/prompt, formato, referência).
  - **publish:** evento de conversão obrigatório (Pixel). Página e Pixel ficam para a configuração de produção.
- O modal de proposta segue chamando o gate na etapa `strategy` (default), portanto o erro "evento de conversão pendente" deixou de bloquear aprovação de estratégia.

### D.5 — Strategist usa a Configuração de Criação Meta
- `gatherContext` carrega todas as configs Meta do tenant e indexa por `ad_account_id`.
- Novo helper `buildMetaProductionConfigBlock()` injeta no prompt do Strategist Meta um bloco "CONFIGURAÇÃO DE CRIAÇÃO META (PRODUÇÃO)" com os defaults reais — ou instruções de fallback conservador quando não houver config.
- O prompt explicita que dados não configurados devem aparecer como `requires_user_input`. Pixel/Página/Instagram/Evento nunca podem ser inventados.
- Regras herdadas da Onda C continuam: objetivo no enum canônico, sem link/CTA na Campanha, sem conjunto vazio.

### D.6 — Testes e documentação
- `src/test/ads-gates.test.ts` atualizado para a nova semântica por etapa (5 novos cenários cobrindo strategy/creative/publish).
- Suíte rodada: `ads-gates` (13) + `ads-meta-adapter` (8) + `normalize-campaign-structure` (8) — **29/29 verdes**.
- Documentação: este plano + `docs/especificacoes/marketing/gestor-trafego.md` (seção Onda D adicionada).

## Restrições respeitadas
- Zero criativo gerado, zero crédito consumido.
- Zero publicação Meta/Google/TikTok.
- Zero chamada Meta para criar campanha.
- Zero IA chamada ao abrir, navegar, editar ou salvar.
- Sem cron mensal, sem admin avançado de compatibilidade, sem Google/TikTok operacional.
- Sem regeneração automática de proposta para validar.
- Sem criação de tabela/configuração não utilizada pelo fluxo real.

## Pendente para próximas ondas
- Etapa C (publicação real Meta): leitura da Configuração de Criação Meta + criação efetiva via API.
- Adapters compiladores Google/TikTok.
- Cron mensal de verificação automática de baseline.
- Admin de compatibilidade.
