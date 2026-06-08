# Plano — Numeração própria do Objeto de Postagem + remoção da criação manual

## Contexto

Hoje, na aba de Objetos de Postagem da Logística, a coluna "Pedido" mostra o
número do **Pedido** quando ele existe e cai para o número do **Pedido de
Venda** quando não existe (PV manual/duplicado). Isso mistura duas numerações
diferentes na mesma lista, e por isso objetos recriados ou recuperados aparecem
em posição estranha.

Além disso, existe hoje no canto da aba "Prontos para emitir" um botão **"Criar
novo objeto"** que abre um diálogo para criar um Objeto de Postagem sem passar
por Pedido de Venda. Isso fere a regra canônica do sistema (vínculo do objeto
precisa ser sempre com o Pedido de Venda) e gera objetos órfãos sem produto,
sem peso e sem rastreabilidade fiscal.

## Objetivo

1. Dar ao **Objeto de Postagem** uma numeração própria, sequencial por loja, no
   mesmo padrão do Pedido, Pedido de Venda, Nota Fiscal e Remessa.
2. Atribuir esse número automaticamente no momento em que o objeto é criado,
   independente da origem (PV manual, duplicação ou pedido pago real).
3. Garantir que objetos recriados por auto-cura, reconciliação ou
   reprocessamento usem o **próximo número da sequência** e por isso caiam
   sempre na ordem correta da lista (decrescente pelo número do próprio
   objeto).
4. Remover do sistema a possibilidade de criar Objeto de Postagem manualmente
   pela tela de Logística.

## O que muda

### Numeração própria do Objeto de Postagem

- Cada Objeto de Postagem passa a ter um número próprio, sequencial por loja,
  começando em 1.
- O número é gravado no momento da criação e nunca muda, mesmo em reemissão
  ou auto-cura.
- Objetos antigos (legado) recebem um número retroativo único, na ordem
  cronológica em que foram criados, para não embaralhar a lista.
- A listagem da aba "Objetos de Postagem" (Prontos, Emitidos e Pendentes)
  passa a exibir e ordenar por **esse** número (decrescente). Acaba a mistura
  com número do Pedido/PV.
- Onde antes a lista mostrava `##592` (número do pedido), passa a mostrar o
  número do objeto. O número do Pedido/PV vinculado continua disponível como
  informação secundária na linha (para o operador continuar enxergando a
  origem), apenas deixa de ser a chave de ordenação.

### Remoção da criação manual

- Remover o botão **"Criar novo objeto"** da aba "Prontos para emitir".
- Remover o diálogo/fluxo de criação manual que esse botão abre.
- Manter intactas todas as outras ações (editar destinatário, emitir etiqueta,
  gerar Declaração de Conteúdo, excluir objeto, retentativa).
- Reforçar a regra: **Objeto de Postagem só nasce a partir de um Pedido de
  Venda** (manual, duplicado ou criado automaticamente a partir de pedido
  pago). Pedidos via gateway (Frenet) continuam fora desse fluxo, como já é
  hoje.

### Governança / anti-regressão

- Atualizar a documentação de Logística e o padrão operacional transversal
  registrando:
  - Objeto de Postagem tem numeração própria.
  - Ordenação obrigatória pelo número do próprio módulo, decrescente.
  - Proibida criação manual de Objeto de Postagem fora do fluxo do Pedido
    de Venda.
- Registrar memória anti-regressão travando essas duas regras.
- Atualizar o mapa de UI com a remoção do botão.

## Resultado final

- Toda criação ou recriação de Objeto de Postagem (manual, duplicação, pedido
  real, auto-cura) recebe o próximo número da sequência da loja.
- A lista fica sempre na ordem numérica decrescente do próprio objeto —
  duplicação, reemissão ou recuperação sempre cai no lugar certo.
- Não existe mais caminho na UI para criar um Objeto de Postagem "do nada".

## Pendência cruzada (já validada antes deste plano)

A correção do fluxo de auto-cura do PV órfão (Maria da Glória / PV 395)
continua valendo e é **pré-requisito** para este plano: sem ela, o
recém-numerado objeto recriado nunca chegaria a ser enfileirado. Aquela
correção é feita junto, no mesmo deploy:

- Unicidade da fila de rascunhos passa a valer só para entradas em aberto
  (concluídas/canceladas/falhas não bloqueiam reabertura).
- Reconciliação automática detecta PV ativo sem objeto válido e enfileira
  nova tentativa.
- Dedup do processador só considera objeto ativo (ignora cancelado).

## Validação após aplicar

1. Criar um PV novo manual → conferir que o objeto nasce com o próximo
   número da sequência e aparece no topo da lista.
2. Duplicar um PV existente → conferir que o objeto novo recebe um número
   novo (não herda o do original) e fica acima na lista.
3. Conferir que objetos antigos continuam visíveis, com número retroativo,
   na ordem cronológica correta.
4. Conferir que o botão "Criar novo objeto" não existe mais em nenhuma aba
   do módulo de Logística.
5. PV 395 (Maria) ganha objeto na próxima execução do cron, com número novo
   na sequência.

## Fora do escopo

- Numeração de Remessas, Pedido, Pedido de Venda e Nota Fiscal — sem
  mudanças.
- Pedidos via gateway (Frenet) — fluxo intacto.
- UI das outras abas (Remessas, Rastreios, Dashboard) — só passam a usar o
  novo campo para ordenar; layout não muda.

## Bloco técnico (opcional)

- Nova coluna `numero` (`bigint`) em `shipments`, sequencial por
  `tenant_id`, alocada por função `allocate_shipment_numero(p_tenant_id)`
  (mesmo padrão de `allocate_remessa_numero`). Índice único parcial
  `(tenant_id, numero)` e índice de ordenação
  `(tenant_id, numero DESC)`.
- Atribuição via trigger `BEFORE INSERT` em `shipments` quando `numero IS
  NULL`. Cobre criação por `scheduler-tick` (PHASE 1.6),
  `shipping-create-shipment`, reconciliação e qualquer caminho legado, sem
  precisar tocar cada chamador.
- Backfill único, ordenado por `created_at ASC` por tenant, atribuindo
  números a registros existentes.
- `ShipmentGenerator` / `RemessasManager` / `TrackingTab` passam a:
  - exibir `shipment.numero` como coluna primária;
  - ordenar via `sortByNumberDesc(items, s => s.numero, s => s.created_at)`.
  - manter o número do PV/Pedido como info secundária.
- Remover em `ShipmentGenerator.tsx`: botão "Criar novo objeto" (linha
  ~872), `openCreateDraft` handler, dialog e estado relacionado. Limpar
  imports órfãos.
- Atualizar `src/integrations/supabase/types.ts` automaticamente após a
  migração.

---

Mantenho o plano consolidado: numeração própria + remoção do botão de
criação manual, junto com o pré-requisito de auto-cura já acordado. Posso
seguir para a implementação?
