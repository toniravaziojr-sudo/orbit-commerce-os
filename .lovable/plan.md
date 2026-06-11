# Auditoria do fluxo Pedido → PV → NF → Remessa — Plano REVISADO

## Revisão prévia (o que mudou em relação à primeira versão)
Após reler as regras oficiais e conferir o banco, removi do plano itens que pareciam bug mas são comportamento normal do sistema. Isso evita regressão.

- **Tipo do documento fiscal vazio**: NÃO é bug. 302 de 304 notas históricas seguem o mesmo padrão; o tipo real é controlado por outro campo já preenchido corretamente. Removido do plano.
- **Espelho de status PV ↔ Pedido**: o mecanismo JÁ existe e está ativo (gatilho `fiscal_invoices_sync_pv_status` + função `sync_pedido_status_for_order`). O nome citado na memória é antigo. Não vou recriar nada — apenas validar se está derivando o status certo no caso do #612.
- **Evento "Pedido criado" ausente no #612**: o pedido foi criado em fluxo de teste, não pelo checkout. Não é bug, é o caminho usado. Removido.
- **Vínculo da NF cancelada #415**: a desvinculação após cancelamento pode ser intencional (regra de reaproveitamento/auditoria). NÃO mexer sem confirmação — passa para "investigar antes de propor".

## 1. Pontas soltas REAIS confirmadas

### 1.1 Pedido #612 ficou com status errado (CRÍTICO)
- Histórico do pedido registra "Remessa emitida e despachada via Correios" às 03:45.
- Mas o status do pedido continua "Em processamento", e a data de despacho não foi gravada.
- **Causa provável** (técnico): a função que cria a remessa registra o evento no histórico mas o `UPDATE orders SET status='dispatched'` não persistiu na mesma transação.
- **Sintoma cruzado**: o status do Pedido de Venda Fiscal #417 já mostra "Concluído" (o espelho calculou pelo histórico), enquanto o Pedido em si segue "Em processamento". Dois cards mostrando coisas diferentes para o mesmo pedido — fere a regra de paridade entre Pedidos e Fiscal.

### 1.2 Ambiente fiscal divergente (CRÍTICO — viola "Fiscal Produção Universal")
- Configuração do tenant: **Produção** ✅
- Notas #415, #416 e PV #417 gravadas no banco como **Homologação** ❌
- A chave da SEFAZ confirma emissão real em **Produção** (posição de ambiente = 1).
- Existe gatilho que impede regredir a configuração, mas **não há gatilho equivalente impedindo gravar nota com ambiente errado**. Por isso a divergência passou.

### 1.3 Remessa em duplicidade no #612
- Quando o Pedido de Venda foi criado, o sistema enfileirou automaticamente uma remessa-rascunho. Ela tentou rastrear, não achou nada e ficou em estado "Falha".
- Depois, a remessa real foi criada manualmente e recebeu o rastreio AD558980543BR.
- Resultado: 2 remessas para o mesmo pedido. Uma "Falha" (lixo na tela de Logística) e uma válida.
- A regra correta é **uma única remessa por pedido**, criada uma vez e atualizada com o rastreio quando a etiqueta sai.

## 2. Plano de correção

### Fase A — Correções estruturais

**A1. Status do pedido após despacho (resolve 1.1)**
- Garantir que a emissão da etiqueta atualize o pedido para "Despachado" e grave a data de despacho de forma atômica.
- Cobrir tanto o fluxo manual (botão "Emitir etiqueta" no Módulo de Remessas) quanto qualquer fluxo automático.
- Critério de aceite: emitir etiqueta → pedido vai para "Despachado" → PV mostra "Despachado" → cards de Pedidos e Fiscal mostram o mesmo status.

**A2. Travar ambiente de produção também na escrita da nota (resolve 1.2)**
- Estender a regra "produção universal": quando a configuração do tenant está em produção, qualquer nota gravada DEVE entrar como produção. Se vier diferente, o sistema corrige automaticamente e registra na auditoria.
- Cobre passado e futuro: novos rascunhos nascem corretos; tentativas de gravar em homologação são bloqueadas.

**A3. Eliminar a remessa duplicada (resolve 1.3)**
- Definir um único ponto de criação da remessa por pedido.
- Quando o Pedido de Venda dispara o enfileiramento automático e já existe remessa válida para o pedido, reutilizar a existente em vez de criar outra.
- Não criar shipment como "Falha" só porque o poll inicial de rastreio falhou (rastreio só existe depois da etiqueta).

### Fase B — Limpeza dos dados de teste (somente após Fase A aprovada e aplicada)
Tudo restrito ao tenant Respeite o Homem e às 3 notas/2 remessas/1 pedido do teste de hoje:

1. Corrigir ambiente das notas #415, #416 e PV #417 para "Produção" (alinha com a chave real da SEFAZ).
2. Atualizar o pedido #612 para "Despachado" com a data correta do despacho (03:45 BRT).
3. Remover a remessa em "Falha" do pedido #612 (mantém a remessa real com o rastreio).
4. Recalcular o status do PV #417 (deve continuar "Despachado/Concluído" após Fase A, agora coerente com o Pedido).

**O que NÃO vou mexer (precisa nova autorização):**
- NF #415 cancelada: fica no histórico. Não vou tentar restaurar vínculo com o pedido sem antes confirmar a regra fiscal aplicável.
- NF #416 autorizada: permanece como está; só corrige o campo "ambiente".
- Nenhum outro tenant. Nenhuma outra nota/pedido fora do teste.

### Fase C — Alinhamento documental
Atualizar na mesma entrega:
1. **Doc do módulo Logística / Remessas** — registrar: numerador único via função oficial (já corrigido), ponto único de criação da remessa por pedido, e transição automática do pedido para "Despachado" na emissão da etiqueta.
2. **Doc do módulo Fiscal** — registrar o guarda de ambiente também na escrita da nota (não só na configuração).
3. **Memória "Fiscal Produção Universal"** — acrescentar a camada de proteção na escrita da nota.
4. **mapa-ui.md** — verificar se há mudança visível ao usuário; provavelmente não há mudança de UI, só correção de comportamento.

### Fase D — Validação técnica (executada por mim antes de declarar concluído)
1. Pedido #612 com status "Despachado" e data preenchida.
2. Notas do teste com ambiente "Produção".
3. Apenas 1 remessa válida no pedido #612, com rastreio e etiqueta.
4. Cards de Pedidos e Fiscal mostrando o mesmo status para o #612.
5. Teste de não-regressão: criar PV em outro pedido de rascunho (sem emitir etiqueta) e confirmar que NÃO nasce uma remessa-fantasma em "Falha".
6. Conferir logs do Pratika para garantir que o envio anterior continua íntegro.

O que depende de você: rodar um pedido real do início ao fim para confirmar que o status "Despachado" aparece automaticamente após emitir a etiqueta no fluxo de produção.

## 3. Decisões técnicas que vou tomar sem perguntar
Pelo seu critério (decisões técnicas/fluxo são minhas; mudanças de contexto/UI passam por você):
- Forma de aplicar o guarda de ambiente na nota (gatilho no banco vs validação na borda) — vou pelo gatilho, é o mais seguro e cobre todos os caminhos de gravação.
- Onde colocar a transição do pedido para "Despachado" — dentro da mesma transação que cria a remessa, com `RETURNING` validado. Sem isso, o evento de histórico pode ficar dessincronizado.
- Não criar shipment com `delivery_status='failed'` como subproduto da criação do PV — passa a nascer em "Rascunho" (já é o estado correto pela regra "Shipping Management Flow").

## 4. O que vou confirmar com você antes de executar
- Início da Fase A (mudança estrutural).
- Início da Fase B (limpeza dos dados de teste).
- Texto final das atualizações dos docs e memória antes de salvar.

---

Confirma seguir? Posso começar pela Fase A, parar para sua validação técnica, e só então tocar nos dados (Fase B).
