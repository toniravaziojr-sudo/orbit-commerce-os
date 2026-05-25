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

**Fase 1 — Base (não-quebrante):** ✅ Concluída — vínculo nota↔natureza, seletor de natureza padrão nas configurações, seed/backfill global do catálogo (16 naturezas) em todos os tenants.

**Fase 2 — Motor:** ✅ Concluída — `fiscal-auto-create-drafts`, `fiscal-create-draft` e `fiscal-create-manual` resolvem a natureza (explícita → padrão do tenant → "Venda de Mercadoria" → fallback 5102/6102) e escolhem CFOP intra/inter por UF.

**Fase 3 — UI:** ✅ Concluída — CFOP removido do cadastro fiscal de produto e do ProductSelector; campos de CFOP global removidos das Configurações Fiscais e substituídos pelo seletor "Natureza padrão para vendas automáticas"; no editor de NF o CFOP de todos os itens é derivado automaticamente da Natureza + UF, com badge "manual" e botão "Restaurar" quando há override por item.

**Fase 4 — Correção da NF 1-321:** dispensada por decisão do usuário (refazendo a nota manualmente).

**Fase 5 — Limpeza:** ✅ Concluída em 2026-05-25 — campos legados removidos do banco (`fiscal_products.cfop_override`, `fiscal_settings.cfop_intrastadual`, `fiscal_settings.cfop_interestadual`) e do código (interface FiscalProduct, ProductSelector, FiscalProductsConfig).

**Fase 6 — Ciclo de rejeição e revalidação:** ✅ Concluída em 2026-05-25 — rejeição da SEFAZ não deixa mais NF em etapa `emitida`; a nota volta para `pendencia` com o motivo salvo, e qualquer salvamento de NF já existente na aba Notas Fiscais revalida automaticamente a etapa para devolver `pronta_emitir` quando estiver consistente.

**Documentação:** ✅ Concluída — `docs/especificacoes/erp/erp-fiscal.md` recebeu o complemento do ciclo rejeição → pendência → revalidação; `docs/tecnico/base-de-conhecimento-tecnico.md` recebeu a lição técnica; memória anti-regressão criada em `mem://constraints/fiscal-stage-rejection-cycle`.

## Validações realizadas

- Banco confirmado: restam apenas `fiscal_invoices.cfop`, `fiscal_invoice_items.cfop` (resultado, suporta override) e `fiscal_operation_natures.cfop_intra/inter` (fonte). Os 3 campos legados foram dropados.
- Código: zero referências a `cfop_override`, `cfop_intrastadual` e `cfop_interestadual` em `src/` e `supabase/functions/` (ignorando migrações antigas e docs).
- Build passou após remoção dos campos da interface `FiscalProduct` e ajustes em `FiscalProductsConfig.tsx` e `ProductSelector.tsx`.



## Anti-regressão

Regra permanente: **"CFOP e tributação por item vêm exclusivamente da Natureza de Operação vinculada à nota, decidindo intra/inter pela UF emitente vs destinatário. Edição manual por item permitida com sinalização. Cadastro de produto e configurações fiscais NÃO carregam CFOP. Catálogo padrão de naturezas é seed global do sistema, idêntico em todos os tenants."**
