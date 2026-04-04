
# Plano: Listas Padrão de Email Marketing

## O que muda

Todo tenant passa a ter 3 listas de email marketing criadas automaticamente, com tags correspondentes. Isso vale para novos tenants e também será ajustado nos existentes.

| # | Tag (singular) | Cor | Lista (plural) |
|---|----------------|-----|-----------------|
| 1 | Cliente | Verde #10B981 | Clientes |
| 2 | Newsletter PopUp | Ciano #06b6d4 | Newsletter PopUp |
| 3 | Cliente Potencial | Laranja #f97316 | Clientes Potenciais |

## Estado atual

- **Respeite o Homem**: Tem tag "Cliente" + lista "Clientes" ✅. Tem tag "PoupUp" + lista "PoupUp" (nome legado). Falta tag e lista de "Cliente Potencial"/"Clientes Potenciais".
- **Respeite o Homem Admin**: Tem tag "Cliente" sem lista vinculada. Falta tudo o resto.
- **Demais tenants (19)**: Não possuem nenhuma dessas tags/listas.

## O que será feito

### 1. Migration: Função + Trigger + Retroativo

Uma migration SQL que:

- **Cria a função `ensure_default_email_marketing_lists(p_tenant_id)`** — idempotente, cria as 3 tags e 3 listas se não existirem (usando `ON CONFLICT DO NOTHING`). Marca listas como `is_system = true`.
- **Cria trigger `AFTER INSERT ON tenants`** — chama essa função automaticamente para todo tenant novo.
- **Roda retroativamente** — executa a função para todos os tenants existentes.
- **Renomeia "PoupUp" → "Newsletter PopUp"** na tag e na lista do tenant "Respeite o Homem".

### 2. Simplificar o scheduler-tick

Remove o bloco de ~60 linhas do `abandon-sweep` (linhas 224-284) que cria tag/lista "Cliente Potencial" sob demanda. Como agora as listas já existem, o scheduler só precisa buscar a lista existente e inserir o contato. Fica mais simples e rápido.

### 3. Atualizar documentação

- **`docs/especificacoes/marketing/email-marketing.md`** — adicionar seção "Listas Padrão do Sistema" com a tabela das 3 listas, explicar que são criadas automaticamente e não podem ser excluídas.

## Resultado final

- Todo tenant (novo ou existente) terá as 3 listas padrão prontas.
- O nome "PoupUp" será padronizado para "Newsletter PopUp".
- O scheduler-tick fica mais limpo, sem lógica de criação sob demanda.
- A documentação reflete a regra estabelecida.
