---
name: memory-protection-rules
description: Política de memória da IA — escopo permitido, rotação dos 2 últimos assuntos e regra "memória sem doc é proibida"
type: constraint
---

# Política de Memória Operacional da IA

## Escopo permitido (o que PODE ficar na memória)

A pasta `.lovable/memory/` aceita exclusivamente:

1. **Memórias de governança** (pasta `governance/`) — Lembretes permanentes de COMO a IA deve agir. Reforçam o Knowledge.
2. **Cache rotativo dos 2 últimos assuntos tratados** (arquivo `governance/recent-topics.md`) — Resumo do assunto atual e do imediatamente anterior. Pode incluir regras técnicas, desde que essas regras também existam nos docs formais.

Tudo o que não se encaixa nesses dois escopos NÃO entra na memória.

## Regra de Ouro: memória sem doc é proibida

Toda regra de sistema que aparece na memória DEVE existir nos docs formais (Layer 2/3/4). Se uma regra está só na memória e não nos docs, isso é uma quebra: atualizar o doc primeiro, depois a memória pode permanecer como reforço.

A memória NUNCA é fonte de verdade. Os docs são. A memória é cache de reforço comportamental + contexto recente.

## Rotação obrigatória dos 2 últimos assuntos

`governance/recent-topics.md` mantém no máximo 2 slots:
- **Slot 1: assunto-atual** — o que estamos tratando agora
- **Slot 2: assunto-anterior** — o assunto imediatamente anterior

Quando entrar um terceiro assunto, o slot "anterior" é descartado, o "atual" passa a "anterior" e o novo entra como "atual". Antes de descartar qualquer slot, auditar: se houver regra técnica relevante que ainda não esteja nos docs, atualizar os docs primeiro.

## Memórias PROTEGIDAS (nunca remover sem autorização explícita)

1. `governance/working-rules.md` — Os 5 lembretes obrigatórios de comportamento
2. `governance/documentation-governance.md` — Regra de Ouro da documentação e hierarquia de 6 camadas
3. `governance/memory-protection-rules.md` — Este arquivo
4. `governance/recent-topics.md` — Slots rotativos dos 2 últimos assuntos

## Proibições

- Criar memórias com regras de sistema que não existam nos docs (atualizar doc primeiro).
- Remover qualquer arquivo da pasta `governance/` sem autorização explícita.
- Adicionar memórias fora da pasta `governance/` sem autorização explícita.
- Manter mais de 2 assuntos no slot rotativo.
- Tratar a memória como fonte de verdade em substituição aos docs.

## Quando criar/atualizar memória

- **Comportamento novo da IA solicitado pelo usuário** → atualiza `governance/`.
- **Novo assunto entra em discussão** → rotaciona `recent-topics.md` (após auditoria contra docs).
- **Regra de sistema descoberta/alterada** → atualiza o doc apropriado primeiro; só então pode ser referenciada na memória rotativa.
