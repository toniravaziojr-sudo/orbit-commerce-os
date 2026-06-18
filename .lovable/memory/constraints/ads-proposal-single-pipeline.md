---
name: Ads — Proposta sai da fila somente após publish na Meta
description: Proposta de campanha permanece na fila de aprovação até o publish na Meta retornar sucesso; sem seção paralela de "aprovadas aguardando publicação"
type: constraint
---

# Regra (Onda H.5)

A proposta de campanha tem **um único ciclo de vida visível** para o lojista:

1. Aparece na fila "Aguardando ação" (status `pending`).
2. Ao clicar "Visualizar proposta", abre o assistente — proposta **continua na fila** (lojista pode fechar e voltar).
3. **Somente** quando "Publicar na Meta" retorna sucesso, a proposta sai da fila e passa a aparecer apenas no **histórico de Ações da IA**.
4. Recusada/cancelada também sai da fila e vai pro histórico.

## Proibido

- Criar nova seção/lista paralela do tipo "Propostas aprovadas aguardando publicação", "Aguardando criativos", "Pronto para publicar" visível na tela principal de aprovações.
- Marcar a proposta como `approved` sem chamar o publish em sequência (deixa proposta em limbo invisível).
- Botão isolado de "Aprovar estrutura" no rodapé/assistente — só existe "Publicar na Meta" como ação terminal.

## Implementação

- `src/components/ads/StructuredProposalModal.tsx` — `publishToMeta` encadeia `ads-autopilot-execute-approved` → `ads-autopilot-publish-proposal` numa única mutation. Só fecha o modal e invalida queries quando o publish responde sucesso.
- `src/components/ads/AdsPendingApprovalTab.tsx` — não renderiza mais `ApprovedProposalsSection`. O componente e o hook `useApprovedProposalsAwaitingPublish` ficam disponíveis para uso interno/diagnóstico, mas **não podem voltar à tela do lojista** sem aprovação explícita.

## Por que

A jornada antiga tinha aprovar-estrutura como passo separado e uma seção paralela para "criativos prontos / publicar". Lojista ficava confuso (achava que publicar = aprovar, mas a campanha não ia ao ar), e propostas ficavam presas em limbo entre aprovação e publish. Unificar elimina o limbo e torna "Publicar na Meta" a única ação terminal.
