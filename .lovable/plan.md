## 📋 CHECKLIST DE CONFORMIDADE
- Docs lidos: `docs/especificacoes/erp/erp-fiscal.md`, `docs/especificacoes/erp/logistica.md`, `docs/especificacoes/erp/rascunhos-logisticos.md`, `docs/especificacoes/ecommerce/pedidos.md`.
- Memórias relevantes lidas: `fiscal-manual-nf-vs-pedido-venda-separation`, `fiscal-nfe-manual-no-draft-until-save`, `fiscal-pedido-venda-vs-nf-two-records`, `pv-pedido-status-mirror-from-order`, `pv-cancellation-must-mirror-order`, `pv-status-mirrors-child-nf`, `order-cross-module-sync-on-regression`, `order-deletion-cancel-only-and-cascade-cleanup`, `atomic-order-draft-trigger`, `gateway-vs-local-shipping-routing`.
- Fluxos afetados: criação manual de NF avulsa, criação automática de Pedido de Venda, criação automática de Remessa, duplicação/exclusão de PV, divergência histórica PV ↔ Remessa.
- Fonte de verdade: módulo Pedidos é imutável a partir de Fiscal/Logística; PV é fonte de verdade da Remessa em rascunho; Pedido original é fonte de verdade do PV em estados terminais (regra `pv-cancellation-must-mirror-order` permanece).
- Módulos impactados: Fiscal (aba Notas Fiscais e Pedidos de Venda), Logística (Remessas — aba Prontos para Emitir), Pedidos (apenas leitura — não muda).
- Impacto cruzado: gatilhos atômicos de criação de fila; cascata de exclusão de rascunhos; backfill de histórico.
- UI impactada: textos e confirmação dos botões "Duplicar PV" e "Excluir PV". Sem novas rotas.
- Situação: Aguardando confirmação do usuário.

---

## Princípio que vai guiar tudo

> **Remessa logística (em rascunho) é espelho do Pedido de Venda fiscal — não do Pedido original.**
> O Fiscal e o Logístico **nunca** alteram o módulo de Pedidos. O fluxo é sempre: Pedido → PV → Remessa.

Tudo abaixo decorre disso.

---

## Frente 1 — NF de entrada/remessa/transferência não pode criar Pedido de Venda

### Como está hoje
- Ao criar uma NF de entrada (compra, remessa, transferência, devolução) pela aba **Notas Fiscais**, o sistema chama o mesmo motor que cria Pedido de Venda **sem sinalizar que é NF avulsa**.
- Resultado: nasce um Pedido de Venda fantasma na aba **Pedidos de Venda** (foi o que aconteceu com a NF 341 de remessa do Respeite o Homem — PV 340 "Remessa para Armazém Geral" apareceu como pedido de venda).
- O ajuste anterior cobriu o botão "Nova NF-e" da aba Notas Fiscais, mas **não cobriu o diálogo de NF de Entrada**. Por isso voltou.

### O que vou fazer
1. Sinalizar **NF avulsa** em todas as portas de entrada de NF não-venda (entrada, remessa, transferência, devolução, compra).
2. Tornar a regra **obrigatória no servidor**: se a natureza/finalidade não for "venda comum", o sistema rejeita criar como Pedido de Venda — **independente** do que o front mande. Defesa em profundidade, evita regressão futura.
3. A NF nasce direto na aba Notas Fiscais como rascunho de NF (Pendência ou Pronta para Emitir), sem nunca aparecer em Pedidos de Venda.
4. Limpar o registro fantasma (PV 340) da listagem do Respeite o Homem.

### Resultado
- Criar NF de remessa, compra, transferência ou devolução **nunca mais** gera Pedido de Venda fantasma — nem pela UI atual, nem por qualquer UI futura.

---

## Frente 2 — Remessa passa a ser filha do Pedido de Venda

### Como está hoje
- Documentação formal de rascunhos logísticos descreve criação **em paralelo** a partir do pedido aprovado: um caminho gera o PV, outro caminho gera a Remessa. Os dois enxergam só o pedido.
- Por isso duplicar um PV não cria Remessa nova, e excluir um PV não tira a Remessa.

### Decisão arquitetural (decisão técnica minha)
A Remessa em rascunho deixa de nascer do pedido e passa a nascer **do Pedido de Venda**. Para pedidos reais o efeito prático é o mesmo (pedido aprovado → PV nasce no mesmo instante → Remessa nasce do PV no mesmo instante), mas isso resolve duplicação, exclusão e PVs manuais de forma natural.

### O que vou fazer
1. **Nova chave de vínculo:** a Remessa passa a guardar o PV de origem. Quando há pedido real por trás, ela continua sabendo do pedido (para endereço, etiqueta, rastreio), mas a fonte de verdade do espelho é o PV.
2. **Gatilho de criação:** quando um PV nasce (de pedido aprovado, de criação manual ou de duplicação), a Remessa rascunho é enfileirada automaticamente, respeitando a transportadora que o PV definiu e a regra atual de gateway vs. despacho local (Correios, Loggi → fila local; Frenet → fluxo gateway).
3. **Duplicar PV** → cria automaticamente uma Remessa rascunho ligada ao PV duplicado.
4. **Excluir PV em rascunho** (sem NF emitida e sem etiqueta válida) → apaga a Remessa rascunho vinculada. O pedido original no módulo Pedidos **fica intacto**, conforme sua regra.
5. **Sincronia contínua em rascunho:** se o usuário alterar transportadora, peso ou volumes do PV em rascunho, a Remessa rascunho é atualizada automaticamente.
6. **Travas de segurança (não negociáveis):**
   - PV com NF autorizada → não pode ser excluído (regra atual `pv-cancellation-must-mirror-order` permanece).
   - PV com etiqueta despachada/válida → não pode ser excluído.
   - PV vindo de pedido real só vai para cancelado se o pedido original for cancelado primeiro (regra existente permanece).
   - Em nenhuma situação Fiscal/Logística altera, cancela ou apaga registro no módulo Pedidos.
7. **Congelamento ao emitir:** assim que a NF é autorizada e/ou a etiqueta é gerada, o vínculo "congela". A partir daí, mudanças só por ação humana explícita (cancelar NF, regenerar etiqueta).

### Resultado
- Lista de Remessas (Prontos para Emitir) = espelho exato da lista de Pedidos de Venda em rascunho, filtrada pela transportadora configurada.
- Duplicação e exclusão de PV refletem na Logística enquanto for rascunho. Depois de NF/etiqueta válida, vira documento imutável.

---

## Frente 3 — Divergência entre Pedidos de Venda e Remessas Correios

### O que encontrei
- 14 pedidos do Respeite o Homem, todos Correios (Sedex/PAC), entre 20 e 29/abril, ficaram com PV criado **mas sem Remessa**.
- Causa raiz: foram criados **antes** do gatilho atômico atual que garante "PV + Remessa juntos". A partir de 29/abr todo PV nasce com Remessa. É um problema estritamente histórico, mas precisa ser corrigido.

### O que vou fazer
1. **Backfill automático** dos 14 pedidos: reenfileirar no fluxo atual (já adaptado à Frente 2), gerando as Remessas como rascunho na aba "Prontos para Emitir".
2. **Auditoria preventiva**: rodar o mesmo cruzamento em todos os tenants e te entregar o relatório (sem corrigir nada além disso sem te avisar).
3. **Vigilância contínua**: card na Central de Execuções mostrando "Pedidos de Venda sem Remessa". Se voltar a aparecer, você vê na hora.

### Resultado
- Os 14 pedidos aparecem em Remessas para despacho normal.
- Visibilidade permanente se a divergência reaparecer.

---

## Frente 4 — Documentação e anti-regressão

Atualizo (parte obrigatória da entrega):

1. **`docs/especificacoes/erp/erp-fiscal.md`** — adicionar regra explícita "NF avulsa nunca gera Pedido de Venda; PV só nasce de venda ou de criação explícita pela aba Pedidos de Venda".
2. **`docs/especificacoes/erp/rascunhos-logisticos.md`** — registrar a nova fonte de origem (PV em vez de Pedido), mantendo a regra de NF-e autorizada como pré-requisito de emissão de etiqueta.
3. **`docs/especificacoes/erp/logistica.md`** — reforçar que a Remessa rascunho é espelho do PV.
4. **`docs/especificacoes/ecommerce/pedidos.md`** — reforçar a direção única do fluxo (Pedido → PV → Remessa) e a regra de imutabilidade.
5. **Memória existente `atomic-order-draft-trigger`** — atualizar para refletir o novo encadeamento (Pedido → PV → Remessa).
6. **Nova memória** `constraints/remessa-espelha-pv-nao-pedido` — anti-regressão.
7. **Memória existente `fiscal-manual-nf-vs-pedido-venda-separation`** — adicionar cobertura explícita das NFs de entrada.

Sem mudança de rota, então `mapa-ui.md` não precisa de atualização. Só ajusto microtexto dos botões "Duplicar Pedido de Venda" e "Excluir Pedido de Venda" para deixar claro que apaga junto a Remessa rascunho vinculada.

---

## Ordem de execução

1. **Frente 1** — resolve a regressão imediata da NF 341 e bloqueia novas. Risco baixo, ganho imediato.
2. **Frente 3** — backfill dos 14 pedidos, devolve operação ao normal.
3. **Frente 2** — a maior, muda a relação PV ↔ Remessa.
4. **Frente 4** — documentação e memórias.

Cada frente entra com validação técnica antes de eu declarar "ajuste aplicado": criar uma NF de remessa de teste e confirmar que não nasce PV; rodar o backfill e contar as 14 remessas criadas; duplicar um PV de teste e confirmar a Remessa rascunho; excluir um PV rascunho e confirmar que a Remessa some e o pedido original continua.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Trocar a chave da Remessa pode quebrar etiquetas já geradas. | Mudança afeta **apenas rascunhos**. Remessas com etiqueta válida ficam imutáveis e continuam pelo vínculo atual. |
| Backfill criar Remessa duplicada. | Trava de unicidade por pedido já existe; backfill só insere se não houver. |
| Defesa no servidor (Frente 1) bloquear algum fluxo legítimo de PV. | A trava só dispara quando natureza/finalidade **não é venda**. Vendas comuns seguem intocadas. |
| Mudar a origem do gatilho de Remessa atrasar a criação em pedidos reais. | O gatilho passa a disparar no `INSERT` do PV, dentro da mesma transação do gatilho de pedido aprovado. Latência percebida = zero. |
| PV de pedido real ser excluído indevidamente. | Bloqueio existente (`pv-cancellation-must-mirror-order`) permanece: PV vindo de pedido só vai para cancelado se o pedido for cancelado antes. Exclusão livre só vale para PVs manuais/duplicados. |

---

## 📌 STATUS DA ENTREGA: Proposta — aguardando confirmação

Posso seguir nessa ordem (Frente 1 → 3 → 2 → 4)?
