

# Diagnóstico de Status por Seleção no Calendário de Conteúdo

## Como funciona hoje

Quando você seleciona dias no calendário e clica em "Copys IA" ou "Criativos IA", o sistema valida na hora do clique e mostra toasts avisando se falta algo. Mas não há **nenhuma indicação visual prévia** do que está faltando nos cards selecionados — você só descobre quando tenta executar a ação.

## O problema

Você seleciona vários dias, clica para gerar criativos, e só aí descobre que metade dos cards ainda não tem copy. Isso gera frustração e idas e vindas desnecessárias. Não há visibilidade do "estado de prontidão" da seleção.

## O que eu faria

Adicionar um **painel de diagnóstico dinâmico** que aparece dentro da barra de seleção (abaixo dos botões "Limpar seleção" e "Excluir"), mostrando em tempo real o status dos cards selecionados:

### 1. Resumo visual de prontidão (sempre visível na seleção)

Um bloco com ícones coloridos mostrando:
- **✅ X prontos** (têm estratégia + copy + criativo)
- **⚠️ X sem copy** (têm estratégia mas faltam copys)
- **⚠️ X sem criativo** (têm copy mas faltam criativos)
- **❌ X sem estratégia** (vazios, sem título)

### 2. Alerta contextual inteligente (baseado na próxima ação)

Um aviso amarelo/laranja que muda conforme o que falta, exemplos:
- Se clicar em "Copys IA" com cards sem estratégia: *"2 publicações do dia 3 e 5 ainda não têm estratégia e serão ignoradas na geração de copys"*
- Se clicar em "Criativos IA" com cards sem copy: *"3 publicações dos dias 1, 3 e 19 ainda não têm copy. Gere as copys antes dos criativos."*

### 3. Botões de ação desabilitados com tooltip

Em vez de permitir o clique e mostrar toast depois, os botões "Copys IA" e "Criativos IA" ficam **visualmente atenuados** quando nenhum card elegível existe na seleção, com tooltip explicando o motivo. Mas **não travam** quando há pelo menos 1 card elegível (para não bloquear regeneração parcial).

## Resultado final

O usuário vê instantaneamente o que falta em cada seleção, sem precisar clicar para descobrir. O fluxo de regeneração parcial continua funcionando normalmente — quem tem tudo pronto avança, quem não tem recebe o aviso visual.

## Detalhes Técnicos

### Arquivo alterado
- `src/components/media/PlanningTab.tsx`

### Implementação
1. Criar um `useMemo` `selectionDiagnostics` que analisa os items dos `selectedDays` e retorna contagens por status (sem estratégia, sem copy, sem criativo, prontos) + lista dos dias afetados.
2. Renderizar um componente `SelectionDiagnostics` dentro do bloco `isSelectMode && selectedDays.size > 0`, entre os botões existentes e o calendário.
3. Usar badges coloridos (verde/amarelo/vermelho) para cada categoria.
4. Mostrar um `Alert` contextual com os dias específicos quando há inconsistência entre cards selecionados.
5. No `WorkflowStepper`, adicionar lógica para atenuar visualmente steps impossíveis (opacity + tooltip), sem desabilitar completamente quando há pelo menos 1 item elegível.

### Doc afetado
- `docs/regras/campanhas.md` — Atualizar seção do Modo Seleção com o novo diagnóstico visual.

