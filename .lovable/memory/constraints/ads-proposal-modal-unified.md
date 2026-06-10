---
name: Ads — Modal único de proposta + ações operacionais inline
description: Roteamento unificado de propostas da IA do Gestor de Tráfego entre StructuredProposalModal e card inline
type: constraint
---

# Regra (v6.13.0)

Toda proposta da IA de Tráfego segue um dos dois padrões. Qualquer regressão para o `ActionDetailDialog` antigo ou para múltiplos dialogs é proibida.

## Modal único (`StructuredProposalModal`)
Usado por: `strategic_plan`, `create_campaign`, `create_adset`, `generate_creative` (e duplicações desses).

- Card mostra resumo + **único botão "Visualizar proposta"** (Eye icon). Sem botões Aprovar/Ajustar/Rejeitar inline.
- Footer fixo do modal: `Recusar proposta` · `Ajustar proposta` · `Aprovar` (rótulo varia: "Aprovar plano" para `strategic_plan`; "Aprovar estratégia e gerar criativos" para Etapa 1 two-step; "Aprovar" default).
- **Plano Estratégico** usa `overviewOnly={true}` — só Visão Geral (Diagnóstico, Estratégia, Próximas ações, Limitações, Impacto). Sem sidebar, sem abas Campanha/Conjuntos/Anúncios, sem gates de completude/compatibilidade/fit (não tem hierarquia).
- Demais (campanha/conjunto/anúncio/criativo) usam o modal completo com sidebar e gates.

## Inline no card (sem dialog)
Usado por ações operacionais simples: `adjust_budget`, `allocate_budget`, `pause_campaign`.

- Card mantém footer com botões Aprovar/Ajustar/Rejeitar.
- Resumo claro no próprio card (antes → depois para orçamento; economia/dia para pausa).
- `activate_campaign` permanece oculto da fila humana (interno).

## Anti-processamento (custo IA)
- Abrir / navegar / iniciar ajuste / recusar = **zero chamada de IA**.
- Só `Aprovar e gerar criativos` (Etapa 1 two-step) consome créditos — e ainda assim **não publica** a campanha.

## Implementação
- `src/components/ads/StructuredProposalModal.tsx` — props: `overviewOnly`, `titleOverride`, `approveLabelOverride`.
- `src/components/ads/ActionApprovalCard.tsx` — set `STRUCTURED_MODAL_TYPES` define roteamento; ações fora desse set caem no fluxo inline.
- Doc: `docs/especificacoes/marketing/gestor-trafego.md` seção "Preview de Ações (StructuredProposalModal + inline)".

## Por que
Antes existiam dois caminhos (modal estruturado para campanha + `ActionDetailDialog` legado para plano estratégico, conjunto, anúncio e criativo) com UX divergente e regras de aprovação espalhadas. Unificar reduz erro de UX, garante regras de gate consistentes e mantém custo de IA previsível.
