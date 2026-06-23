📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema lido: sim, via instruções ativas de governança.
- Doc formal do tema lido: sim, especificação do Mercado Livre e mapa de UI.
- Doc oficial do Mercado Livre lido: sim, documentação de atributos e publicação.
- Fluxo afetado identificado: criação/edição em lote de anúncios do Mercado Livre.
- Fonte de verdade identificada: cadastro do produto + categoria escolhida + dicionário oficial do Mercado Livre + dados já salvos no anúncio.
- Módulos impactados listados: Marketplaces/Mercado Livre, cadastro de produtos, publicação de anúncios e documentação transversal de UI.
- Impacto cruzado mapeado: publicação, reedição de rascunhos, atualização de anúncio já publicado, qualidade do anúncio e custo de IA.
- UI impactada? sim; mapa de UI deverá ser atualizado após o ajuste.
- Situação: Diagnóstico concluído; aguardando confirmação do usuário para execução.

📌 STATUS DA ENTREGA: Diagnóstico → Proposta

## Como funciona hoje

O fluxo deveria ter 9 etapas:

```text
Produtos → Categorias → Títulos → Descrições → Características → Condição → Tipo → Preços → Frete
```

Na etapa de características, o sistema cruza cadastro, categoria e regras do Mercado Livre, e só deveria gastar IA quando realmente precisa preencher algo que não foi possível resolver de forma automática.

## O problema

Identifiquei três pontos diferentes, não um único erro:

1. **Reprocessamento automático ao retornar ao dialog**  
   Ao voltar para a etapa de características, o painel dispara nova vinculação automaticamente. Isso explica o comportamento frágil e também gera gasto desnecessário de IA. O correto é: se o anúncio já tem características salvas, carregar o que já existe e só recalcular quando o usuário clicar em **Recalcular**.

2. **Características ainda abaixo do ideal**  
   O motor já melhorou: no teste real do Balm Pós-Banho ele retornou 9 características e o rascunho salvo está com 10. Porém ainda não está fechado como fluxo robusto, porque a tela não usa as características já salvas como primeira fonte e o motor ainda pode descartar atributos recomendados quando não consegue casar exatamente com a lista oficial do Mercado Livre. O fechamento precisa separar melhor: obrigatório, recomendado útil, opcional sem base e campo que não deve ser enviado.

3. **Etapa de preços não aparece para você**  
   O código atual e a documentação já têm a etapa **Preços**, mas o print mostra uma versão com apenas 8 etapas, pulando de **Tipo** para **Frete**. Isso é forte evidência de que o domínio final ainda está servindo uma versão antiga do frontend, ou que há um caminho de abertura do dialog usando uma versão/fluxo antigo. Vou tratar isso como regressão de entrega/publicação, não como “só limpar cache”.

## O que eu faria

### 1. Travar o reprocessamento automático
- Ao abrir a etapa de características, carregar primeiro as características já salvas no anúncio.
- Não chamar IA automaticamente se já houver características salvas.
- Manter **Recalcular** como ação explícita do usuário.
- Se o usuário alterou a categoria, aí sim invalidar as características antigas e pedir nova resolução.
- Evitar chamadas duplicadas quando o usuário troca de aba, volta do cadastro do produto ou reabre o dialog.

### 2. Fechar o motor de características por prioridade
- Criar uma régua clara de qualidade:
  - obrigatórios do Mercado Livre: nunca podem faltar sem bloquear;
  - recomendados úteis: preencher por cadastro/regra/IA quando houver base;
  - opcionais sem base: não inventar;
  - campos técnicos/embalagem/somente leitura: não enviar.
- Usar primeiro o que já está salvo no anúncio.
- Melhorar inferências automáticas de baixo custo antes de chamar IA.
- Reduzir IA para lotes pequenos e apenas nos atributos úteis que ainda ficaram sem resposta.
- Persistir o resultado de forma estável para que o anúncio não perca características ao avançar, voltar ou reabrir.

### 3. Garantir que Preços apareça no caminho real do usuário
- Auditar todos os caminhos que abrem o assistente: **Novo Anúncio**, **Editar em Lote** e edição de rascunho/publicado.
- Garantir que todos usem o fluxo de 9 etapas quando for edição/criação em lote.
- Validar no app publicado/domínio final, não só no ambiente de desenvolvimento.
- Se o domínio estiver com versão antiga, fazer o fechamento de publicação/atualização necessário após o ajuste.

### 4. Validação obrigatória antes de liberar para teste
Vou validar tecnicamente:
- Abrir/reabrir o dialog e confirmar que não recalcula automaticamente quando já há características salvas.
- Clicar **Recalcular** e confirmar que só recalcula por ação manual.
- Confirmar que o Balm Pós-Banho continua com mais que os 5 campos antigos.
- Avançar de **Tipo** para **Preços** e depois **Frete**.
- Confirmar no banco que preço e características foram salvos no anúncio sem alterar o cadastro do produto.
- Conferir logs para garantir ausência de chamadas duplicadas e falhas no motor.
- Validar no domínio final/publicado, porque seu print veio de lá.

## Resultado final esperado

- O dialog não fica “pensando/revinculando” sozinho ao retornar.
- As características já resolvidas ficam salvas e reaproveitadas.
- A IA só roda quando necessário ou quando o usuário pede.
- O anúncio sai com características obrigatórias e recomendadas úteis, sem inventar campos frágeis.
- A etapa **Preços** aparece antes de **Frete** para o usuário ajustar valores.
- O fluxo inteiro fica validado no caminho real de uso.

## Documentação necessária

- Documento de Mercado Livre: atualizar regra de cache/reuso das características e gatilho manual de recálculo.
- Mapa de UI: confirmar o assistente de 9 etapas e a presença obrigatória de Preços no fluxo em lote.
- Plano operacional: registrar validações executadas e estado final.

Se aprovar este plano, eu sigo com a execução completa e só marco como corrigido depois da validação técnica real.