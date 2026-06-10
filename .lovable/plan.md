# Plano — Motor de Propostas Completo do Gestor de Tráfego IA

**Status:** Onda 0 + Onda A + Onda B mínima entregues em 2026-06-10.

## Entregue nesta rodada

### Onda 0 — Baseline oficial de capacidades
- Doc dedicado: `docs/especificacoes/marketing/plataformas-baseline.md` com fontes oficiais consultadas, data de consulta e status por plataforma.
- Meta Ads: **verificado**, baseline `meta-2026-06-10-baseline`, próxima verificação em 30 dias.
- Google Ads e TikTok Ads: **não verificados** (placeholder) — bloqueiam aprovação e geração de criativo até verificação humana.

### Onda A — CanonicalCampaignPlan v2 + Strategist
- `action_data.campaign_structure` ganha `schema_version` (1 = legacy, 2 = canônico). Mesmo nome de campo, sem migração, sem `UPDATE` em massa, sem remoção de legacy.
- Adapter (`normalizeCampaignStructure`) continua tolerante a propostas antigas e passa a ler campos canônicos por conjunto (location, age_min/max, gender, placements, optimization_goal, conversion_event, budget_brl).
- Strategist do plano estratégico passa a exigir, por conjunto de anúncios: região, idade, gênero, posicionamentos, meta de otimização, evento de conversão e local de conversão.
- Quando a IA não sabe um campo obrigatório, preenche com `requires_user_input` — nunca inventa, nunca deixa silencioso.

### Onda B mínima — Registro de capacidades
- 3 tabelas novas: `platform_capabilities`, `platform_compatibility_checks`, `platform_compatibility_alerts`.
- Acesso: leitura para usuários logados, escrita para admin de plataforma, controle total via service_role.
- Snapshot inicial semeado: Meta verificada, Google/TikTok placeholders não verificados.

### Gates novos
- **Structure Completeness Gate** (`src/lib/ads/gates/structureCompleteness.ts`) — bloqueia "Aprovar estratégia e gerar criativos" quando faltam campos obrigatórios ou há `requires_user_input`.
- **Platform Compatibility Gate inicial** (`src/lib/ads/gates/platformCompatibility.ts`) — bloqueia quando plataforma está não verificada, revisão necessária, vencida, com falha de verificação, ou última verificação > 60 dias; também bloqueia objetivo/evento fora da capacidade registrada.
- Ambos são puros, sem IA, sem rede.

### UI mínima
- Aba "Visão Geral" do modal estruturado: novo bloco **Validações** com bloqueios em vermelho e alertas em cinza.
- Rodapé do modal: faixa amarela explicando por que a aprovação está bloqueada.
- Botão "Aprovar estratégia e gerar criativos": desabilitado quando há qualquer bloqueio.
- Botões "Ajustar proposta" e "Recusar proposta": continuam disponíveis.

### Testes
- 10 novos testes em `src/test/ads-gates.test.ts` — todos passando.
- 8 testes existentes do adapter — continuam passando (18/18).

### Documentação
- `docs/especificacoes/marketing/plataformas-baseline.md` (novo)
- `docs/especificacoes/marketing/gestor-trafego.md` (nova seção "Motor de Propostas — Onda 0 + A + B mínima")
- `docs/especificacoes/transversais/mapa-ui.md` (nova seção "Validações de completude e compatibilidade")

## Restrições respeitadas

- Zero chamada de IA ao abrir, navegar, editar ou salvar rascunho.
- Zero criativo gerado.
- Zero publicação Meta/Google/TikTok.
- Zero consumo de crédito.
- Sem cron mensal.
- Sem admin completo de compatibilidade.
- Google Ads e TikTok Ads ficam preparados (placeholder no registro), mas não operacionais.
- `mem://` não tocado.
- Quality Gate, Product/Funnel Fit Gate, versionamento e editor: intactos.

## Próximas ondas (fora desta entrega)

- Cron mensal sem IA para verificar mudanças nas fontes oficiais (hash + alertas).
- Tela de admin "Compatibilidade das Plataformas" (Gestor de Tráfego IA → Configurações Gerais).
- Snapshot real de Google Ads e TikTok Ads após verificação humana.
- Adapters compiladores (Meta/Google/TikTok) gerando rascunho de publicação.
