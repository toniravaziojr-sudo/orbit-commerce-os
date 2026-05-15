# Declaração de Conteúdo dos Correios — motor único

> Documento dos Correios para acompanhar a remessa quando **não há obrigação de NF-e**. **Não é documento fiscal** e **não substitui NF-e**.
> Não confundir com **DC-e Sefaz** (Declaração de Conteúdo Eletrônica fiscal — SINIEF 05/2021), que é tratado em outro fluxo fiscal próprio.

## Princípio
Existe **um único motor** para Declaração de Conteúdo dos Correios em todo o Comando Central:

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
1. A Declaração de Conteúdo é **alternativa**, não padrão. O sistema **não bloqueia** o uso por tipo de tenant (PF, MEI, ME, EPP, LTDA, marketplace ou loja própria).
2. Antes de qualquer emissão, o usuário **deve**:
   - Selecionar o **motivo da emissão** em lista pronta (campo obrigatório):
     - Venda/remessa sem emissão de NF-e por decisão do remetente
     - Devolução de consumidor final
     - Troca
     - Amostra sem valor comercial
     - Brinde
     - Bem pessoal
     - Outro (exibe campo de texto obrigatório com mínimo 3 caracteres; gravado como `Outro: <detalhe>`)
   - Marcar checkbox de **responsabilidade**, ciente de que a DC não substitui NF-e quando a emissão for obrigatória.
   - **Em massa (múltiplos pedidos):** o motivo selecionado e o aceite de responsabilidade valem para **todos** os pedidos selecionados na mesma operação.
3. O PDF inclui:
   - Cabeçalho com nº interno e data de emissão (BRT).
   - Remetente completo (Razão Social, CNPJ/CPF, endereço, CEP, telefone).
   - Destinatário completo.
   - Tabela de itens com descrição, quantidade, valor unitário e subtotal.
   - **Valor total declarado**, **peso total** e **número de volumes**.
   - **Cláusula legal** (LC 87/1996) + responsabilidade do remetente.
   - **Motivo informado** pelo usuário.
   - Local, data e linha de assinatura.
4. A emissão **nunca** chama Focus NFe ou Sefaz, **nunca** altera `fiscal_stage`, **nunca** marca o pedido como "fiscalizado". É um documento de transporte exclusivo dos Correios.

## Histórico e auditoria
Cada emissão grava em `shipping_content_declarations`:
- `dc_number` (numeração interna independente da fiscal).
- `reason`, `responsibility_acknowledged`, `acknowledged_by_user_id`.
- `sender_snapshot`, `recipient_snapshot`, `items_snapshot`.
- `total_value_cents`, `total_weight_grams`, `volumes_count`, `emission_city`.
- `source` = `manual` | `gateway` | `shipment`.

## Integração com Gateway logístico
`gateway-attach-fiscal-doc` agora prioriza:
1. NF-e autorizada (caminho fiscal padrão).
2. **Declaração de Conteúdo dos Correios** existente para o pedido.
3. Se não houver, emite uma automaticamente com `source='gateway'` e motivo padrão de despacho gateway antes de anexar à transportadora.

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
1. Em **Fiscal → Pedidos de Venda**, selecione um pedido na etapa "Pedido de Venda".
2. Clique em **Declaração de Conteúdo** (botão lateral) ou abra a ação no menu da linha.
3. O modal exige motivo e checkbox de responsabilidade. Sem isso, o botão "Emitir" fica desabilitado.
4. Ao confirmar, o PDF é baixado e o registro aparece em `shipping_content_declarations` com `source='manual'`.
5. Validar:
   - O pedido **não muda de etapa fiscal**.
   - O PDF traz a cláusula legal e o motivo informado.
   - Em massa: selecionar vários pedidos → o modal usa o mesmo motivo para todos.
