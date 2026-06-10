# Plano — Visualização Estruturada de Propostas (Gestor de Tráfego IA) — v2026-06-10

## Diagnóstico
Hoje o card da fila "Aguardando Ação" já oferece Aprovar / Ajustar / Rejeitar diretamente, o que permite decisão sem visualizar a estrutura completa. O modal atual mostra blocos achatados que não refletem a hierarquia de mídia paga (Campanha → Conjunto(s) → Anúncio(s)).

## UI/UX aprovada
- Card de propostas de campanha estruturadas vira **resumo + 1 botão "Visualizar proposta"**.
- Decisões (Aprovar / Ajustar / Recusar) migram para o rodapé fixo do modal estruturado.
- Modal grande com **árvore lateral**: Visão Geral · Campanha · Conjuntos · Anúncios · Validações · Histórico · Detalhes técnicos (recolhido).
- Fallback mobile mais simples (stepper/empilhado).
- Card de ações operacionais legacy (orçamento, pausa, insight, plano estratégico, conjuntos órfãos) mantém comportamento atual.

## Contrato de dados (aditivo)
- Novo formato canônico `action_data.campaign_structure` { campaign, ad_sets[], ads[] }.
- **Adapter de leitura** `normalizeCampaignStructure(action_data)` aceita payload novo e legacy (`adsets[]`, `ads[]`, `preview.*`, campos planos). Campos ausentes → "Não informado".
- Sem migração, sem DROP/UPDATE em massa, sem mutação do payload original.

## Sequência de execução
1. Criar adapter + tipos em `src/lib/ads/normalizeCampaignStructure.ts`.
2. Criar testes do adapter (`src/test/normalize-campaign-structure.test.ts`).
3. Criar `StructuredProposalModal` (árvore lateral + rodapé fixo).
4. Ajustar `ActionApprovalCard` para propostas estruturadas: substituir os 3 botões pelo único "Visualizar proposta"; reaproveitar handlers atuais (`approveStrategy`, `onApprove`, `onReject`, `onAdjust`) dentro do modal.
5. Reorganizar visualmente o Editor Estruturado para evidenciar a hierarquia Campanha / Conjunto / Anúncio / Feedback (renome de seções; sem alteração de mutations).
6. Atualizar documentação: `docs/especificacoes/marketing/gestor-trafego.md` e `docs/especificacoes/transversais/mapa-ui.md`.
7. Rodar testes.

## Decisões técnicas
- **Gerador (edge function strategist) NÃO é alterado nesta entrega.** A escrita de `campaign_structure` em novas propostas pode ser feita em entrega posterior sem afetar a UI — o adapter é tolerante e cobre tudo on-the-fly. Isso evita risco em código sensível e respeita "evite processamento desnecessário".
- Reaproveitar `ProposalStructuredEditor` (Frente 4.3) como Editor de Ajuste dentro do modal — sem reescrever.
- Reaproveitar `FullContentDialog` interno para a árvore (uma única tela, navegação por estado local).
- Zero chamada de IA ao abrir/navegar/editar/salvar rascunho/recusar/feedback. Apenas "Gerar proposta revisada" e "Aprovar estratégia e gerar criativos" disparam IA, como hoje.

## Restrições respeitadas
Sem publicação automática, sem geração de criativo ao abrir, sem consumo de crédito, sem chamadas Meta/Google/TikTok, sem mem://, sem remover Quality Gate / Product-Funnel Fit Gate / versionamento / rascunho / feedback / payload bruto continua escondido em "Detalhes técnicos".

## Documentação obrigatória
- `docs/especificacoes/marketing/gestor-trafego.md`
- `docs/especificacoes/transversais/mapa-ui.md`
