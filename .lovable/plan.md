# Frente 4.1 — Inteligência produto×funil e UI/UX do modal (Gestor de Tráfego IA)

**Status:** Ajuste aplicado — pendente de validação visual no painel `/ads`.

## O que mudou no sistema

### A. Inteligência de composição comercial
A IA agora classifica cada produto/oferta em uma das categorias antes de propor a campanha:

- **Produto base** — único, vendido sozinho.
- **Produto principal** — base com sinal de "principal" (tag ou preço de entrada).
- **Kit unitário de apresentação** — composição com 2+ bases diferentes, 1 unidade de cada.
- **Kit de quantidade** — composição com mais de 1 unidade de qualquer base (ex.: Kit 3x).
- **Oferta de recompra/retenção** — tag explícita de recorrência/manutenção.
- **Oferta de upsell/manutenção** — ticket alto + tag de upsell.
- **Composição não identificada** — sem dados suficientes (confiança baixa).

A fonte de verdade é a composição real do produto (Produto → Componentes). Tags, categoria e preço só entram como sinal complementar.

### B. Gate de adequação produto × público
Roda depois do Quality Gate atual (não substitui).

- **Frio (prospecção):** aceita produto base, produto principal e kit unitário de apresentação. Bloqueia kit de quantidade, recompra e upsell.
- **Remarketing/Morno:** tudo aceito (recompra fica como ressalva).
- **Quente:** tudo aceito.
- **Retenção/Clientes:** prefere recompra, upsell e kits maiores.

Quando bloqueia, a UI mostra o motivo em linguagem clara e desabilita o botão "Aprovar e gerar criativos", oferecendo ações sugeridas (trocar produto, mover para Remarketing/Clientes, revisar cadastro).

### C. Modal de proposta reorganizado (Etapa 1)
Na Etapa 1 do fluxo de duas etapas, o modal deixou de usar abas e passou a usar **blocos verticais empilhados**:

1. Badge de adequação produto×público no topo (alta/média/baixa/bloqueada/incerta).
2. Resumo da recomendação em linguagem de negócio.
3. Produto e oferta (tipo comercial, composição, preço, orçamento, botão).
4. Público e exclusões (com linha de Clientes excluídos).
5. Prompt & Copy (aviso amarelo "nenhum criativo final foi gerado ainda" + prompt limpo + formato sugerido + headlines + textos principais + miniatura "Referência visual do produto").
6. Riscos e validações (Quality Gate + Fit Gate + ajustes sugeridos).
7. Detalhes técnicos — recolhido por padrão.

Payload técnico bruto não aparece mais na visualização principal.

### D. Fila de validação
- A proposta antiga **Kit Banho Calvície Zero (3x) em Público Frio** foi **arquivada** como rejeitada, com auditoria preservada (`cleanup_audit = archived_for_fit_gate_validation_2026_06_09`). Caso ruim coberto por testes automatizados, sem poluir a fila visual.
- Nova proposta sintética ativa: **Kit Banho Calvície Zero Dia** (Shampoo 1× + Balm 1× = kit unitário de apresentação) para Público Frio → **adequação alta**, botão liberado.

## Validação técnica executada
- **Composição do Kit Dia** confirmada: 1× Shampoo + 1× Balm → classifica como `kit_unitario_apresentacao`.
- **Composição do Kit 3x arquivado** confirmada: 3× cada componente → classifica como `kit_quantidade` → soft-block em Frio.
- **Fila ativa** verificada: apenas 1 proposta (`c6fef3ed-42e8-4637-98ac-9dfdeadf62f4`).
- **Testes automatizados:** 217/217 passando — incluindo 16 cenários novos cobrindo classificador + gate.

## Validação visual pendente (precisa do usuário)
No painel `/ads` → aba **Propostas pendentes**:

1. Confirmar que aparece **uma** proposta apenas: "Prospecção Frio — Kit Banho Dia (apresentação)".
2. Confirmar **badge verde "Adequação alta"** no cabeçalho do card e no topo do modal.
3. Confirmar **botão "Aprovar e gerar criativos" habilitado** (sem alerta vermelho).
4. Abrir "Ver conteúdo completo" e confirmar:
   - 6 blocos verticais empilhados (não há abas).
   - Bloco "Produto e oferta" mostra **"Tipo comercial: Kit unitário de apresentação"** e **"Composição: 1x Shampoo Calvície Zero + 1x Balm Pós-Banho Calvície Zero (Dia)"**.
   - "Prompt & Copy" mostra aviso amarelo + prompt limpo + miniatura "Referência visual do produto".
   - "Detalhes técnicos" aparece **recolhido** ao final.

## Restrições preservadas
- Nenhuma Nova Estratégia.
- C.4, toggles de autoexecução, Tenant Memory, F.1/F.2 e cadência semanal/mensal intactos.
- Nenhum criativo real gerado, nenhum crédito consumido, nenhuma campanha publicada.
- Nenhuma chamada Meta/Google/TikTok.
- Imagem de produto continua apenas como referência visual.
- Sem memória `mem://constraints/...` — regra anti-regressão vive apenas em `docs/especificacoes/marketing/gestor-trafego.md` §13 e em `docs/especificacoes/transversais/mapa-ui.md`.

## Documentação atualizada
- `docs/especificacoes/marketing/gestor-trafego.md` — nova seção §13 (classificador, gate, modal, anti-regressão).
- `docs/especificacoes/transversais/mapa-ui.md` — nova seção "Frente 4.1" descrevendo badge, soft-block, blocos verticais e detalhes técnicos recolhidos.

## Bloco técnico (registro)
- `supabase/functions/_shared/ads-autopilot/productCommercialClassifier.ts` — classificador puro.
- `supabase/functions/_shared/ads-autopilot/productFunnelFitGate.ts` — gate puro, com `evaluateProductFunnelFit`, `normalizeFunnelStage`, `fitLevelLabel`, `commercialClassLabel`.
- `src/hooks/useProductCommercialFit.ts` — hook React lê produto + composição + payload IA + preço floor do catálogo e devolve `{ classification, fit, components_summary }`.
- `src/components/ads/ActionApprovalCard.tsx` — badge no cabeçalho, alerta de soft-block, bloqueio do botão na Etapa 1 e novo `FullContentDialog` com blocos verticais (apenas no estágio `strategy` do `two_step_v1`).
- `src/test/ads-autopilot-product-funnel-fit.test.ts` — 16 testes.
- Migração Supabase: arquivamento da proposta `f24d6ceb-…` + inserção da nova `c6fef3ed-…`.
