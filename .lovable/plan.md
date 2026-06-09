# Frentes 4.2 / 4.3 / 4.4 parcial — Editor estruturado, versionamento e feedback

**Status:** Ajuste aplicado — pendente de validação visual no painel `/ads`.

## O que ficou pronto

### Frente 4.2 — Modal completo da Etapa 1
O modal "Ver conteúdo completo" das propostas em `two_step_v1` Etapa 1 agora abre com um bloco **"Campanha"** dedicado mostrando nome, objetivo, canal, orçamento diário, link de destino (hyperlink) e botão (CTA). Demais blocos verticais e "Detalhes técnicos" recolhido seguem como antes — payload técnico bruto continua proibido fora desse bloco.

### Frente 4.3 — Editor estruturado da proposta
Botão **"Ajustar"** em propostas Etapa 1 deixou de abrir caixa de texto livre e passou a abrir um **drawer lateral à direita** com a proposta inteira em campos editáveis, dividida em 5 blocos:

1. **Campanha** — nome, objetivo, orçamento diário, link, CTA (canal é somente leitura).
2. **Produto e oferta** — produto, nome de referência, observação.
3. **Público** — funil, descrição, exclusões, região, faixa etária, gênero.
4. **Criativo e copy** — prompt, formato, tom, headline, texto principal, descrição (referência visual continua somente leitura).
5. **Feedback para a IA** — motivo do ajuste, chips de categoria, observação opcional.

Regras invioláveis (anti-IA-desnecessária):
- Abrir / editar / marcar chips / salvar rascunho → **0 chamadas IA**.
- Salvar rascunho persiste em banco (`action_data.draft_patch`), recarrega ao reabrir.
- Apenas **"Gerar proposta revisada"** chama a IA (1 vez).
- Bloqueado quando: faltam campos obrigatórios, link inválido, Fit Gate `soft_block`, ou nenhum campo alterado.

### Versionamento (cadeia de propostas)
Cada revisão cria proposta filha:
- Antiga vira `status='superseded'` + `superseded_by_action_id` apontando para a nova.
- Nova tem `parent_action_id` + `action_data.version = N+1` + `action_data.revision_source` (snapshot do patch).
- Antiga **some** automaticamente da fila "Aguardando Ação" (não está em `ACTIVE_PENDING_STATUSES`).
- Histórico cumulativo em `action_data.adjustment_history`.

### Frente 4.4 parcial — Feedback em Aprovar/Rejeitar
**Já existia** no projeto: o `useAdsAutopilotFeedbackGate` intercepta os cliques de Aprovar e Rejeitar com diálogo de motivos (chips) e textarea opcional, gravando em `ads_autopilot_feedback`. Mantido como está.

No editor estruturado, o feedback de ajuste (motivo + chips + observação) vai junto com o patch da revisão.

**Etapa 4 (não entregue):** Strategist ainda não consome o feedback acumulado. O contrato e o histórico estão prontos, mas a injeção no prompt fica para uma frente futura.

## Validação pendente (precisa do usuário)

No painel `/ads` → aba **Aguardando Ação** → proposta `Prospecção Frio — Kit Banho Dia`:

1. Abrir "Ver conteúdo completo" e confirmar o novo bloco **"Campanha"** com link clicável e CTA traduzido.
2. Clicar em **"Ajustar"** e confirmar que abre o drawer lateral (não o textarea antigo).
3. Confirmar que canal/plataforma aparece bloqueado em cinza.
4. Editar nome da campanha → contador "1 campo alterado" aparece.
5. Clicar em **"Salvar rascunho"** → toast "Rascunho salvo", e nenhum criativo/crédito é mexido.
6. Fechar e reabrir o drawer → as alterações continuam.
7. Clicar em **"Gerar proposta revisada"** → modal de confirmação aparece.
8. Confirmar → nova proposta v2 surge na fila e a antiga some.

## Restrições preservadas
- Nenhuma Nova Estratégia.
- C.4, toggles de autoexecução, Tenant Memory, F.1/F.2 e cadência semanal/mensal intactos.
- Nenhum criativo real gerado, nenhum crédito consumido, nenhuma campanha publicada.
- Nenhuma chamada Meta/Google/TikTok.
- Quality Gate e Fit Gate preservados.
- Imagem de produto continua apenas como referência visual.
- Sem `mem://constraints/...` — regra anti-regressão vive em `docs/especificacoes/marketing/gestor-trafego.md` §14 e `docs/especificacoes/transversais/mapa-ui.md`.

## Documentação atualizada
- `docs/especificacoes/marketing/gestor-trafego.md` — §14 (Editor estruturado, versionamento, feedback, anti-regressão).
- `docs/especificacoes/transversais/mapa-ui.md` — nova entrada das Frentes 4.2/4.3/4.4.

## Bloco técnico (registro)
- Migração: `superseded_by_action_id` (uuid, FK self-reference) + índices `idx_aaa_parent_action` e `idx_aaa_superseded_by`.
- `supabase/functions/ads-autopilot-revise-proposal/index.ts` — orquestrador: marca superseded → invoca Strategist com patch estruturado → linka cadeia. 1 chamada IA por execução.
- `src/components/ads/ProposalStructuredEditor.tsx` — drawer Sheet com formulário, save-draft (DB direct), generate-revised (edge function).
- `src/components/ads/ActionApprovalCard.tsx` — botão "Ajustar" passa a abrir o drawer estruturado para `two_step_v1 strategy`; fallback texto livre para legacy. Modal ganhou bloco "Campanha".
- `src/test/ads-autopilot-structured-editor.test.ts` — 7 testes (diff, validações, contrato).
