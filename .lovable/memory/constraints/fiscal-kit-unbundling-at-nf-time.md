---
name: Fiscal Kit Unbundling Acontece em PV→NF (não no PV)
description: O desmembramento de kit em componentes acontece exclusivamente em fiscal-prepare-invoice (transição Pedido de Venda → Nota Fiscal). Pedido de Venda sempre preserva o kit como kit. Proibido reintroduzir desmembramento em fiscal-auto-create-drafts ou fiscal-create-draft.
type: constraint
---

**Regra (2026-05-20):** O desmembramento de kit em componentes acontece **apenas** em `supabase/functions/fiscal-prepare-invoice/index.ts`, no momento da clonagem PV → NF, usando o motor `_shared/kit-unbundler-fiscal-items.ts`.

**Proibido:**
- Chamar `unbundleKitItems` (ou qualquer variante de desmembramento) em `fiscal-auto-create-drafts/index.ts` ou `fiscal-create-draft/index.ts`. Pedido de Venda DEVE espelhar o pedido original (kit como kit).
- Persistir `kits_unbundled: true` em eventos de criação de PV. Esse flag agora só faz sentido em eventos da NF (`event_type='kit_unbundled'` em `fiscal_invoice_events` ligados ao `invoice_id` da NF filha).
- Validar completude fiscal de componentes (NCM/peso/origem) no PV. A validação de componentes só ocorre depois da expansão, dentro de `fiscal-prepare-invoice`.

**Obrigatório em `fiscal-prepare-invoice`:**
1. Quando `inv.fiscal_stage === 'pedido_venda'` e itens são clonados para a nova NF, ler `fiscal_settings.desmembrar_estrutura` no instante da operação.
2. Se ativo, passar os itens clonados por `unbundleFiscalItems` ANTES do INSERT em `fiscal_invoice_items`.
3. Resolver `product_id` dos itens via `order_item_id → order_items.product_id` (caminho primário) com fallback por SKU → `products.id` (cobre PV manual).
4. Tributos dos componentes recalculados via `calculateItemTaxes` com `fiscal_products` do componente; CFOP herda override do componente, fallback para CFOP do kit, fallback final para `5102`.
5. Rateio proporcional ao preço de venda de cada componente; diferença de centavos absorvida no último componente para preservar exatamente `valor_total` da NF.
6. Quando houver desmembramento efetivo, recompor `peso_bruto`/`peso_liquido` a partir do peso dos componentes (`products.weight` em gramas, convertido para kg).
7. Re-buscar `fiscal_invoice_items` do `workingInvoiceId` antes da validação de NCM/CFOP/quantidade quando `snapshotCreated && desmembrou` — caso contrário, a validação rodaria sobre os itens-kit em memória (incorreto).
8. Registrar evento `kit_unbundled` em `fiscal_invoice_events` com `kits_expanded`, `kits_without_components` e `source_pedido_venda_id` para auditoria.

**Casos cobertos:**
- Kit com componentes cadastrados + config ativa → NF nasce com componentes.
- Kit sem componentes cadastrados + config ativa → NF nasce com kit inteiro + evento `kit_unbundled` listando o kit em `kits_without_components`.
- Config desativada → NF clona itens do PV sem alteração (kit como kit).
- Mesmo PV gerando segunda NF → respeita configuração e cadastro atuais (não reutiliza decisão da primeira NF).
- Duplicar NF já desmembrada → clona como está (não re-desmembra nem re-junta).

**Por quê:**
- Pedido de Venda = espelho fiel do pedido do cliente (consistente com `mem://constraints/fiscal-pedido-venda-vs-nf-two-records`).
- Decisão sempre atual: mudar config ou corrigir cadastro do kit reflete na próxima NF, inclusive de PVs antigos.
- Eficiência de cloud: desmembramento sai do caminho automático (todo pedido aprovado) e vai para o caminho manual (só quando NF é realmente solicitada).

**Doc oficial:** `docs/especificacoes/erp/erp-fiscal.md` seção "Desmembramento de Kits (Composições)".
