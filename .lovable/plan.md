📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema lido
- Doc formal do tema lido
- Fluxo afetado identificado
- Fonte de verdade identificada
- Módulos impactados listados
- Impacto cruzado mapeado
- UI impactada? mapa-ui.md atualizado (ou lacuna declarada): deverá ser atualizado
- Situação: Sem ação de escrita proposta ainda

📌 STATUS DA ENTREGA: Proposta

## Como funciona hoje
Hoje o sistema separa parcialmente duas coisas:
1. ativação técnica do canal;
2. saúde operacional do recebimento.

Mas ainda existe um ponto crítico: quando a troca de WABA acontece, o sistema passa a tratar o novo vínculo como “conectado” cedo demais. Em paralelo, outras partes do produto continuam lendo esse sinal binário de conexão como se ele significasse “está funcionando de ponta a ponta”.

Além disso, as regras anti-regressão hoje existem em mais de um lugar, mas não como uma única regra formal e obrigatória do fluxo. Por isso elas não estão impedindo o retorno ao mesmo diagnóstico.

## O problema
O seu caso confirma um padrão estrutural:

- antes da troca de WABA, o atendimento funcionava;
- depois da troca, o sistema manteve sinais de “conectado”;
- isso permite regressão de leitura e volta ao mesmo loop de hipótese já vencida.

Também identifiquei uma segunda falha de governança:
- a memória não pode ser a fonte principal dessas regras;
- se a regra anti-regressão ficar só como reforço comportamental, ela não blinda o fluxo;
- ela precisa existir nos documentos formais e no diagnóstico operacional do produto.

Em termos práticos, hoje falta uma proteção específica para o cenário “migração/troca de WABA”: o sistema não rebaixa automaticamente o status para “vínculo trocado, operação ainda não comprovada”.

## O que eu faria
### 1) Corrigir a lógica do pós-troca de WABA
Criar um estado operacional específico para troca/migração de WABA, algo na linha de:
- vinculado, mas sem operação comprovada;
- vinculado, em observação pós-migração;
- recepção comprometida após troca de conta;
- operando normalmente.

Objetivo: impedir que a troca de WABA seja tratada como sucesso completo só porque os identificadores foram salvos.

### 2) Separar de vez “vínculo” de “operação real”
Padronizar a leitura do WhatsApp em duas camadas obrigatórias:
- camada 1: vínculo/configuração
- camada 2: operação real de recepção

A interface e os alertas passariam a usar sempre as duas camadas juntas, nunca apenas “conectado/desconectado”.

Objetivo: parar de chamar de saudável um canal que só está tecnicamente vinculado.

### 3) Instalar uma regra anti-regressão formal no lugar certo
Essa regra deve ser armazenada em 3 níveis com papéis diferentes:

- Documento formal do módulo: regra funcional do fluxo de troca de WABA e validação do canal
- Base de conhecimento técnico: lição anti-regressão do bug e padrão proibido
- Memória: apenas reforço curto para evitar repetição imediata nas próximas sessões

Resposta direta à sua pergunta: a regra não deve depender só da memória. O lugar principal é a documentação formal do sistema e a base técnica. A memória entra só como lembrete complementar.

### 4) Ajustar os pontos da interface que hoje leem só “conectado”
Atualizar os pontos que hoje resumem WhatsApp como pronto/não pronto para que passem a mostrar:
- vinculado
- aguardando comprovação operacional
- recepção instável
- recepção comprometida
- saudável

Objetivo: evitar leitura falsa de normalidade no hub de integrações, alertas e painel principal.

### 5) Criar detecção automática para “troca de WABA sem validação operacional”
Sempre que houver mudança de conta/número vinculados, o sistema deve:
- abrir um período de observação;
- exigir nova evidência operacional;
- gerar alerta se não houver confirmação de recebimento;
- impedir que o status final volte para “saudável” só com vínculo técnico.

Objetivo: tornar esse tipo de quebra visível e tratável sem depender de interpretação manual.

## Resultado final
Depois do ajuste, o sistema vai:
- reconhecer troca de WABA como evento sensível;
- parar de marcar o canal como plenamente saudável cedo demais;
- mostrar claramente a diferença entre “está vinculado” e “está funcionando”;
- registrar a anti-regressão no lugar correto;
- reduzir muito a chance de voltar ao mesmo diagnóstico já vencido.

## Onde a regra anti-regressão deve ficar
Fonte principal:
- documentação formal do fluxo de WhatsApp/atendimento e integrações

Reforço técnico obrigatório:
- base de conhecimento técnico do projeto

Reforço operacional temporário:
- memória da IA

Regra prática:
- se estiver só na memória, não está blindado o suficiente
- se estiver no doc formal + base técnica, aí vira regra de verdade do sistema

## Implementação proposta
1. Revisar o fluxo de troca de WABA e criar estado de observação pós-migração
2. Reclassificar os status públicos do WhatsApp em vínculo vs operação
3. Atualizar os pontos da interface que ainda usam leitura binária
4. Registrar a anti-regressão no doc formal do módulo
5. Registrar o caso na base de conhecimento técnico
6. Atualizar o mapa de UI, porque haverá mudança de estados e mensagens visíveis
7. Validar o cenário completo de troca de WABA até recepção real

## Validação técnica prevista após implementação
- Confirmar que uma troca de WABA não deixa mais o canal aparecer como saudável imediatamente
- Confirmar que o painel principal, integrações e atendimento exibem o mesmo estado
- Confirmar que ausência de recepção após migração gera alerta operacional
- Confirmar que a presença de vínculo técnico sem operação cai em estado intermediário, não em “ok”
- Confirmar que o fluxo volta para saudável somente após evidência real de operação

## Documentação necessária
📝 DOCUMENTAÇÃO NECESSÁRIA:
- Documento de integrações: incluir regra de troca de WABA e estado pós-migração
- Documento de CRM/atendimento: incluir distinção obrigatória entre vínculo e operação real
- Base de conhecimento técnico: registrar este bug como anti-regressão estrutural
- Mapa de UI: atualizar estados e mensagens visíveis do WhatsApp
- Memória: manter apenas como reforço, nunca como fonte principal