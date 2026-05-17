---
name: memory-protection-rules
description: Política de memória da IA — escopo permitido e regra "memória sem doc é proibida"
type: constraint
---

# Política de Memória Operacional da IA

## Escopo permitido (o que PODE ficar na memória)

A pasta `.lovable/memory/` aceita exclusivamente **memórias de governança** (pasta `governance/`) — lembretes permanentes de COMO a IA deve agir. Reforçam o Knowledge.

Tudo o que não se encaixa nesse escopo NÃO entra na memória.

## Regra de Ouro: memória sem doc é proibida

Toda regra de sistema que aparece na memória DEVE existir nos docs formais (Layer 2/3/4). Se uma regra está só na memória e não nos docs, isso é uma quebra: atualizar o doc primeiro, depois a memória pode permanecer como reforço.

A memória NUNCA é fonte de verdade. Os docs são. A memória é cache de reforço comportamental.

## Assuntos em Andamento → doc oficial, não memória

A continuidade de frentes de trabalho ativas, pendências e backlog é mantida no **doc oficial** `docs/especificacoes/transversais/assuntos-em-andamento.md`.

Regras desse doc:
- Só entra um assunto quando o operador pedir explicitamente.
- Só sai um assunto quando o operador pedir explicitamente.
- A IA nunca adiciona, edita ou remove itens por iniciativa própria.
- Não há rotação automática, não há limite de quantidade, não há expiração.
- Atualizações de status dentro de um item só podem ser feitas quando o operador confirmar a mudança no chat.

## Memórias PROTEGIDAS (nunca remover sem autorização explícita)

1. `governance/working-rules.md` — Lembretes obrigatórios de comportamento
2. `governance/documentation-governance.md` — Regra de Ouro da documentação e hierarquia de camadas
3. `governance/memory-protection-rules.md` — Este arquivo

## Proibições

- Criar memórias com regras de sistema que não existam nos docs (atualizar doc primeiro).
- Remover qualquer arquivo da pasta `governance/` sem autorização explícita.
- Adicionar memórias fora da pasta `governance/` sem autorização explícita.
- Adicionar, alterar ou remover qualquer item de `assuntos-em-andamento.md` sem pedido explícito do operador.
- Tratar a memória como fonte de verdade em substituição aos docs.

## Quando criar/atualizar memória

- **Comportamento novo da IA solicitado pelo operador** → atualiza `governance/`.
- **Regra de sistema descoberta/alterada** → atualiza o doc apropriado primeiro; só então pode ser referenciada na memória.
- **Frente de trabalho ativa / pendência / backlog** → NÃO vai para memória; vai para `docs/especificacoes/transversais/assuntos-em-andamento.md` somente sob pedido explícito.
