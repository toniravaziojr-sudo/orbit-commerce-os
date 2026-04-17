---
name: memory-protection-rules
description: Regras de proteção das memórias de governança e escopo permitido da memória
type: constraint
---

# Regras de Proteção de Memória

## Escopo permitido
A pasta `.lovable/memory/` armazena APENAS lembretes de comportamento da IA. Não armazena regras do sistema, arquitetura, fluxos ou especificações de módulos — esses pertencem exclusivamente aos docs (`docs/`).

## Memórias PROTEGIDAS (nunca remover sem autorização explícita)
1. **`governance/working-rules.md`** — Os 5 lembretes obrigatórios de comportamento (Knowledge, comunicação simples, documentação nos docs, validação técnica, teste no tenant `respeiteohomem`)
2. **`governance/documentation-governance.md`** — Regra de Ouro da documentação e hierarquia de 6 camadas
3. **`governance/memory-protection-rules.md`** — Este arquivo

## Proibições
- Recriar memórias com regras do sistema (essas vão para `docs/`)
- Remover qualquer memória da pasta `governance/` sem autorização explícita do usuário
- Adicionar novas memórias fora da pasta `governance/` sem autorização explícita

## Se for necessário criar uma nova memória
Apenas se ela descrever um comportamento novo da IA (ex: nova preferência de fluxo de trabalho do usuário). Caso contrário, criar/atualizar doc em `docs/`.
