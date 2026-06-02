# Declaração de Conteúdo dos Correios — motor único

> Documento de acompanhamento de remessa postal, emitido pelo remetente, para envios em que **não há obrigação de NF-e**. **Não é documento fiscal**, **não é NF-e**, **não é DANFE** e **não é DC-e Sefaz**. Não substitui Nota Fiscal quando a emissão for obrigatória.
> Não confundir com **DC-e Sefaz** (Declaração de Conteúdo Eletrônica fiscal — SINIEF 05/2021), que é tratado em outro fluxo fiscal próprio.

## Princípio
Existe **um único motor** para Declaração de Conteúdo dos Correios em todo o Comando Central:

> 🔒 **Validação de campos obrigatórios:** este motor delega a checagem de
> destinatário, itens e dados da loja ao **Pré-Flight Fiscal/Logístico**
> (`docs/especificacoes/fiscal/preflight-fiscal-logistico.md`). É proibido
> reimplementar essas regras aqui. O motor de DC ainda valida especificamente
> peso total (`weight_required`) e responsabilidade declarada do operador.

- Aba **Pedidos de Venda** (Fiscal) — emissão manual.
- **Gateway logístico** (ex: Frenet) — emissão automática quando o pedido vai despachar sem NF-e.
- **Módulo de Remessas** — futura emissão integrada ao fluxo de despacho.

Todos os caminhos chamam a mesma estrutura. **Proibido** criar caminho paralelo, função paralela ou tabela paralela para Declaração de Conteúdo dos Correios.

## Fonte de verdade
- **Tabela:** `shipping_content_declarations` (não fiscal, escopo por tenant).
- **Edge function:** `correios-content-declaration-issue` (registra, numera e devolve snapshot).
- **PDF:** `src/lib/declaracaoConteudo.ts` (`issueAndDownloadCorreiosContentDeclaration`).
- **Modal de responsabilidade:** `src/components/fiscal/CorreiosContentDeclarationDialog.tsx`.

## Regras de produto
1. A Declaração de Conteúdo é **alternativa**, não padrão. O sistema **não bloqueia** o uso por tipo de tenant (PF, MEI, ME, EPP, LTDA, marketplace ou loja própria), por CNPJ ou por venda comercial. A decisão é do remetente/usuário, com responsabilidade registrada.
2. Antes de qualquer emissão, o usuário **deve**:
   - Selecionar o **motivo da emissão** em lista pronta (campo obrigatório):
     - Venda/remessa sem emissão de NF-e por decisão do remetente
     - Devolução de consumidor final
     - Troca
     - Amostra sem valor comercial
     - Brinde
     - Bem pessoal
     - Outro (campo de texto obrigatório com mínimo 3 caracteres; gravado como `Outro: <detalhe>`)
   - Marcar checkbox de **responsabilidade**.
   - **Em massa (múltiplos pedidos):** o motivo e o aceite valem para **todos** os pedidos selecionados.
3. **Peso e volumes são calculados automaticamente** a partir dos dados do pedido (somatório de `weight_grams × quantidade` dos itens; volumes padrão `1`). O modal **não pede** esses campos ao usuário. Se algum produto do pedido estiver sem peso cadastrado, a geração **falha** para aquele pedido com mensagem clara, sem afetar os demais.
4. **PDF gerado** contém:
   - Título “Declaração de Conteúdo”.
   - Nº interno próprio (ex.: `DC-...`).
   - Data e hora de geração (BRT).
   - Remetente: razão social, CNPJ/CPF, endereço completo (logradouro, número, complemento, bairro), município/UF, CEP, telefone e e-mail (quando disponíveis).
   - Destinatário: nome, CPF/CNPJ/documento, endereço completo, município/UF, CEP, telefone e e-mail (quando disponíveis).
   - Tabela de itens: descrição, quantidade, valor unitário e subtotal.
   - **Valor total declarado**, **Peso total em kg** (sempre preenchido — nunca `-`) e **Quantidade de volumes**.
   - **Motivo informado** pelo usuário.
   - **Texto de responsabilidade** neutro (não afirma automaticamente que o remetente “não é contribuinte”), seguido de avisos: não substitui NF-e quando obrigatória, responsabilidade do remetente, restrições de envio dos Correios, uso indevido pode gerar responsabilidade legal e aviso adicional de que o uso da declaração para omitir documento fiscal obrigatório ou informação tributária pode gerar responsabilidade legal do remetente.
   - Local, data e linha de assinatura do declarante/remetente.
4. **Geração individual:** 1 pedido = 1 PDF (com 1+ páginas se a Declaração ocupar mais que uma folha).
5. **Geração em massa:** 2 ou mais pedidos = **1 único arquivo PDF multipágina**, uma Declaração completa por pedido. Nome sugerido: `Declaracoes-Conteudo-YYYY-MM-DD.pdf`. Não há múltiplos downloads separados.
6. **Histórico** continua **individual** por pedido em `shipping_content_declarations`, com número interno próprio para cada Declaração e vínculo ao respectivo pedido.
7. A emissão **nunca** chama Focus NFe ou Sefaz, **nunca** altera `fiscal_stage`, **nunca** marca o pedido como “fiscalizado”, **nunca** cria NF-e e **não aparece na aba Notas Fiscais**.

## Histórico e auditoria
Cada emissão grava em `shipping_content_declarations`:
- `dc_number` (numeração interna independente da fiscal).
- `reason`, `responsibility_acknowledged`, `acknowledged_by_user_id`.
- `sender_snapshot`, `recipient_snapshot`, `items_snapshot`.
- `total_value_cents`, `total_weight_grams` (sempre preenchido), `volumes_count`, `emission_city`.
- `source` = `manual` | `gateway` | `shipment`.

## Integração com Gateway logístico
`gateway-attach-fiscal-doc` agora prioriza:
1. NF-e autorizada (caminho fiscal padrão).
2. **Declaração de Conteúdo dos Correios** existente para o pedido.
3. Se não houver, emite uma automaticamente com `source='gateway'` antes de anexar à transportadora (usa o peso somado dos itens do pedido).

## Integração com Módulo de Remessas (Correios local) — 2026-06-02
A emissão de remessa pelos Correios via fila local (`shipping-create-shipment`) consulta automaticamente, antes do envio, se já existe Declaração de Conteúdo emitida (`status = 'issued'`) vinculada ao pedido (`order_id`) ou ao Pedido de Venda (`fiscal_invoice_id`). Comportamento:

- **Com NF-e autorizada:** anexa a NF no envio (campos estruturados do CWS) e ignora a Declaração.
- **Sem NF, com Declaração emitida:** anexa o número da Declaração na observação do envio (`observacao: "Declaracao de Conteudo no DC-..."`), satisfazendo a exigência PPN-347 dos Correios.
- **Sem nenhum dos dois:** a emissão é **bloqueada** com mensagem clara em PT-BR pedindo para o operador emitir NF-e ou Declaração no módulo Fiscal antes de despachar. **Não há geração silenciosa.**

Isso preserva o motor único: a Declaração continua sendo emitida apenas pelo módulo Fiscal, com motivo + checkbox de responsabilidade. O Módulo de Remessas apenas **lê e anexa** uma Declaração já emitida.



## Separação técnica obrigatória
| | Declaração de Conteúdo (Correios) | DC-e (Sefaz) |
|---|---|---|
| Natureza | Não fiscal | Fiscal eletrônica |
| Tabela | `shipping_content_declarations` | (futura, separada) |
| Função | `correios-content-declaration-issue` | (futura, separada) |
| Substitui NF-e? | **Não** | Em casos previstos pela Sefaz |

**É proibido** misturar as duas no mesmo registro, função ou nomenclatura.

## Legado removido
- Tabela `fiscal_dce` — **DROP** (estava vazia, sem uso real).
- Edge function `dce-emit` — convertida em **stub 410 deprecated** que aponta para a nova função; nenhum fluxo novo deve invocá-la.

## Como testar pela UI
1. Em **Fiscal → Pedidos de Venda**, selecione um pedido na etapa “Pedido de Venda”.
2. Clique em **Gerar Declaração de Conteúdo** (botão lateral) ou abra a ação no menu da linha.
3. O modal exige apenas: motivo e checkbox de responsabilidade. Peso e volumes vêm dos dados do pedido.
4. Ao confirmar, o PDF é baixado e o registro aparece em `shipping_content_declarations` com `source='manual'`.
5. **Em massa:** selecione vários pedidos → o modal usa o mesmo motivo para todos. É gerado **um único PDF multipágina** com nome `Declaracoes-Conteudo-YYYY-MM-DD.pdf`. O histórico permanece individual.
6. Se algum pedido tiver produto sem peso cadastrado, ele é reportado como falha individual; os demais continuam.
7. Validar: o pedido **não muda de etapa fiscal**; nenhuma chamada a Focus/Sefaz; PDF traz a cláusula de responsabilidade neutra, motivo informado, peso em kg e volumes.
