# Plano — CFOP via Natureza de Operação (sistema global)

## Decisões finais (confirmadas)

1. **Catálogo padrão global** das 16 naturezas-sistema mantido como está. Aplicado a **todos os tenants** (atuais e futuros) automaticamente. Cada tenant pode criar/desativar as suas próprias; as do sistema não podem ser excluídas.
2. **CFOP por item vem automaticamente da Natureza da nota + UF** (intra 5xxx se UF emitente = UF destinatário, inter 6xxx caso contrário). **Edição manual permitida** quando o caso fiscal específico exigir (override por item, com aviso visual).

## Como o CFOP vai funcionar em cada tipo de nota (regra universal)

| Tipo de nota | Natureza padrão sugerida | CFOP intra | CFOP inter |
|---|---|---|---|
| Venda de Mercadoria | Venda de Mercadoria | 5102 | 6102 |
| Venda de Produção Própria | Venda de Produção Própria | 5101 | 6101 |
| Venda para Entrega Futura | Venda para Entrega Futura | 5922 | 6922 |
| Transferência entre filiais | Transferência de Mercadoria | 5152 | 6152 |
| Devolução de Venda (entrada) | Devolução de Venda | 1202 | 2202 |
| Devolução de Compra (saída) | Devolução de Compra | 5202 | 6202 |
| Compra de Mercadoria (entrada) | Compra de Mercadoria | 1102 | 2102 |
| Compra de Uso/Consumo (entrada) | Compra de Material de Uso/Consumo | 1556 | 2556 |
| Remessa para Conserto | Remessa para Conserto | 5915 | 6915 |
| Retorno de Conserto | Retorno de Conserto | 5916 | 6916 |
| Remessa para Demonstração | Remessa para Demonstração | 5912 | 6912 |
| Retorno de Demonstração | Retorno de Demonstração | 1913 | 2913 |
| Remessa em Consignação | Remessa em Consignação | 5917 | 6917 |
| Devolução de Consignação | Devolução de Consignação | 5918 | 6918 |
| Remessa para Troca | Remessa para Troca | 5949 | 6949 |
| Bonificação / Brinde / Amostra | Bonificação ou Amostra Grátis | 5910/5911 | 6910/6911 |
| Simples Remessa (genérica) | Simples Remessa | 5949 | 6949 |

Regra única: ao escolher a Natureza, o sistema preenche o CFOP de **todos os itens** comparando UF do emitente (configurações fiscais) com UF do destinatário da nota. Trocar a natureza recalcula tudo. Editar item-a-item é possível mas exige clique consciente.

## Mudanças por área

### Cadastro de Produto
- Campo CFOP **removido** da tela.
- Permanecem: NCM, CEST, Origem, GTIN, Unidade Comercial, Peso.

### Configurações Fiscais (Emitente)
- Removidos os dois campos de CFOP global.
- Adicionado seletor **"Natureza padrão para vendas automáticas"** (default: "Venda de Mercadoria").

### Catálogo de Naturezas (seed global)
- Seed automático na criação de novo tenant (16 naturezas-sistema).
- Backfill para tenants atuais que estiverem incompletos.
- Naturezas-sistema marcadas como protegidas (não excluíveis, podem ser desativadas).

### Motor de Emissão
- Toda nota recebe **uma natureza obrigatoriamente vinculada**.
- Para cada item: CFOP/CSOSN/CST/finalidade/tipo lidos da natureza, com intra/inter decidido pela UF.
- **Override manual permitido por item** (com badge "editado manualmente").
- Notas automáticas (pedido pago → NF) usam a natureza padrão das configurações.
- Nunca mais lê CFOP do produto nem do CFOP global do emitente.

### UI do Editor de NF
- Seletor de Natureza no topo da nota (obrigatório).
- Troca de natureza pergunta "recalcular todos os itens?" e aplica.
- CFOP por item exibido; ícone de lápis para edição manual; badge quando estiver fora do padrão da natureza.

### Correção da nota 1-321
- Reprocessar com natureza "Transferência de Mercadoria" → todos itens viram 5152. Reenvio à SEFAZ.

## Fases de execução

**Fase 1 — Base (não-quebrante):** vínculo nota↔natureza, seletor de natureza padrão nas configurações, seed/backfill global do catálogo de naturezas. Sistema continua operando como antes.

**Fase 2 — Motor:** todas as funções de criação/atualização de rascunho e emissão passam a ler da natureza vinculada. Override manual respeitado.

**Fase 3 — UI:** remoção do CFOP do cadastro de produto e das configurações; seletor de natureza no editor de NF; edição manual do CFOP por item com indicação visual.

**Fase 4 — Correção:** reprocessamento da 1-321 e validação SEFAZ.

**Fase 5 — Limpeza:** remoção formal dos campos legados do banco depois de 1 ciclo estável.

## Validações obrigatórias

- Cada tenant com natureza padrão definida antes da Fase 2.
- Após Fase 2: nota de teste em cada tipo (Venda intra, Venda inter, Transferência, Devolução, Remessa) e verificação do CFOP correto.
- Após Fase 4: confirmação de autorização da 1-321 na SEFAZ.

## Documentação a atualizar

- `docs/especificacoes/erp/erp-fiscal.md` — nova arquitetura "Natureza como fonte única de CFOP/tributação".
- `docs/especificacoes/transversais/mapa-ui.md` — remoção de campos, novo seletor, edição manual de CFOP.
- Memória anti-regressão: "CFOP por item vem da Natureza vinculada + UF; override manual permitido; produto e configurações não carregam CFOP."

## Anti-regressão

Regra permanente: **"CFOP e tributação por item vêm exclusivamente da Natureza de Operação vinculada à nota, decidindo intra/inter pela UF emitente vs destinatário. Edição manual por item permitida com sinalização. Cadastro de produto e configurações fiscais NÃO carregam CFOP. Catálogo padrão de naturezas é seed global do sistema, idêntico em todos os tenants."**
