

## Plano: Ajustes no Email Marketing — Gestão de Campanhas, Leads e Builder de Automações

### Situacao atual

**Campanhas:** O dropdown de ações mostra apenas "Ver Detalhes" e "Editar". Nao existe opcao de pausar, excluir ou duplicar campanhas.

**Leads/Assinantes:** Na tela de detalhe da lista (`EmailMarketingListDetail`), a tabela mostra os assinantes mas nao oferece acoes individuais — nao ha botao para excluir um lead da lista nem para mover para outra lista.

**Campaign Builder:** Ja existe um builder de campanhas com 3 steps (Configuracao, Conteudo com blocos drag-and-drop, Revisar e Enviar). Porem so suporta envio unico (broadcast). Nao ha modo "builder" para sequencias/automacoes inline — as automacoes usam o ReactFlow separado.

---

### O que sera feito

**1. Acoes de Campanha (Pausar, Excluir, Duplicar)**

Na aba Campanhas do `EmailMarketing.tsx`:
- Adicionar opcoes no dropdown: **Pausar/Retomar**, **Excluir** e **Duplicar**
- Pausar altera o status da campanha para `paused` no banco; Retomar volta para `active`
- Excluir mostra confirmacao e remove a campanha
- Duplicar cria copia como rascunho
- Adicionar mutations correspondentes no `useEmailMarketing.ts`

**2. Gestao individual de Leads na Lista**

Na tela `EmailMarketingListDetail.tsx`:
- Adicionar coluna de acoes na tabela de assinantes com dropdown por linha
- **Excluir da lista**: remove o registro da tabela `email_marketing_list_members` (nao deleta o subscriber global)
- **Mover para outra lista**: dialog que lista as outras listas do tenant, ao confirmar remove da lista atual e insere na lista destino
- Ambas as acoes com confirmacao

**3. Builder de Campanhas com Sequencias (Automacao Simples)**

Atualmente as automacoes usam ReactFlow, que e poderoso mas complexo. A ideia e criar um modo mais simples e pratico, tipo "sequencia linear" dentro do proprio campaign builder:

- No Step 1 (Configuracao), adicionar tipo de campanha: **Envio Unico** (broadcast atual) ou **Sequencia Automatizada**
- Quando "Sequencia Automatizada" for selecionado, o Step 2 muda para um builder de sequencia linear (lista vertical de steps):
  - Cada step pode ser: **Enviar Email**, **Aguardar X dias/horas**, **Condição** (abriu email? clicou?)
  - Interface simples: botao "+ Adicionar Passo" entre cada step
  - Cada step editavel inline (escolher template, definir delay, etc.)
- Na revisao (Step 3), mostra a sequencia completa antes de ativar
- Salva como campanha tipo `sequence` com os steps em JSON no campo `content` ou em tabela dedicada

Isso complementa o ReactFlow (que continua para automacoes complexas) com uma opcao mais acessivel para sequencias simples tipo: "Email de boas-vindas → Espera 3 dias → Email de oferta → Espera 2 dias → Email de lembrete".

---

### Detalhes tecnicos

| Ajuste | Arquivos impactados |
|--------|---------------------|
| Acoes de campanha | `EmailMarketing.tsx`, `useEmailMarketing.ts` |
| Gestao de leads | `EmailMarketingListDetail.tsx` |
| Builder de sequencia | `StepConfig.tsx`, novo componente `SequenceBuilder.tsx`, `StepContent.tsx`, `useEmailCampaignBuilder.ts` |
| Possivel migration | Coluna `content_json` ou tabela `email_campaign_steps` para persistir steps da sequencia |

---

### Resultado final

- Campanhas poderao ser pausadas, retomadas, excluidas e duplicadas direto da listagem
- Leads poderao ser removidos de uma lista ou movidos para outra individualmente
- O builder de campanhas tera um modo de sequencia automatizada simples e visual, sem precisar usar o ReactFlow para fluxos lineares basicos

