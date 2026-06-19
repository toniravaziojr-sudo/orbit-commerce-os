## Status

Ajuste aplicado — pendente de validação pela republicação.

## Contexto novo (2026-06-19, após relato do usuário)

Proposta "Fast Upgrade" falhou ao publicar com erro genérico da Meta
(code=100, subcode=4834011 — "Parâmetro inválido"). Diferente do caso
anterior ("Shampoo Calvície Zero", CBO), esta campanha é ABO: orçamento
por conjunto (R$ 15/dia por conjunto) e sem orçamento na campanha.

## Causa raiz

O publicador sempre enviava `bid_strategy` no nível da campanha (default
"LOWEST_COST_WITHOUT_CAP"), mesmo em ABO. A Meta rejeita silenciosamente
estratégia de lance no nível da campanha quando não existe orçamento de
campanha (CBO). Por isso só ABO quebrava; CBO sempre funcionou.

Diagnóstico confirmado pela proposta no banco:
- `budget_mode = ABO`
- `daily_budget_cents` da campanha nulo
- `bid_strategy` da campanha nulo na proposta (era injetado pelo default
  do publicador no momento do POST)
- 3 conjuntos, cada um com seu próprio orçamento

## Correção aplicada

No publicador, ao montar o corpo de criação da campanha:
- CBO: continua enviando `daily_budget_cents` e `bid_strategy` na
  campanha (comportamento que sempre funcionou).
- ABO: NÃO envia `daily_budget_cents` nem `bid_strategy` na campanha.
  Ambos passam a viver exclusivamente no conjunto, como a Meta exige.

Nenhuma alteração de UI, de regra de negócio nem de fluxo. Apenas
correção técnica do tradutor proposta→Meta.

## Próximo passo

Republicar a proposta "Fast Upgrade" (continua em "Aguardando
aprovação"). Expectativa: campanha criada em ABO, 3 conjuntos com R$ 15
diários cada, sem o erro de parâmetro inválido.

## Documentação a atualizar

- Memória `ads-publish-full-parity-meta`: regra explícita "ABO não envia
  bid_strategy nem daily_budget no nível de campanha".
- Base de conhecimento técnico: lição "Meta rejeita bid_strategy de
  campanha sem CBO ativo (code 100 / subcode 4834011)".

## Histórico anterior (já resolvido em 2026-06-19, v2.0.0)

Plano antigo era sobre "Conquistar novos clientes" (v1.7→v1.9). Esse
caminho foi REVOGADO pela regra v2.0.0 atual: o publicador não tenta
mais ativar essa flag automaticamente; usa exclusão manual de público
de clientes nos conjuntos frios. Mantido aqui só como histórico.
