## 📋 CHECKLIST DE CONFORMIDADE
- [x] Doc de Regras do Sistema lido (governança)
- [x] Docs formais lidos: `docs/especificacoes/logistica/logistica-externa.md`, `docs/especificacoes/marketplaces/mercado-livre.md`, memórias de fiscal/shipping/customers
- [x] Fluxos identificados: rastreio Correios, reconcile fiscal #658, fluxo fiscal+logístico de pedidos ML, cadastro/dedupe de cliente ML
- [x] Fonte de verdade: `shipment_events` (Correios), `fiscal_invoice_events` (autorização SEFAZ), `orders.sales_channel='marketplace'` (canal), `customers.cpf` (dedupe), Profile Enrichment Policy + Systemic Tag Cliente
- [x] Módulos impactados: Logística Interna, Logística Externa, Fiscal (PV + NF), Pedidos (ML), Clientes, Email Marketing
- [x] Impacto cruzado: `enqueue_fiscal_draft`, cron reconcile, sync ML, trigger `customer_metrics_sync_v2`, `systemic-tag-cliente`
- [x] UI impactada → `mapa-ui.md` será atualizado
- **Situação:** Diagnóstico em andamento — aguardando aprovação do plano

---

## Diagnóstico (4 problemas distintos)

### 1) Card "Problemas de envio/entrega" sem motivo real dos Correios
- Card mostra só "Falha" + rastreio.
- O motivo já existe em `shipment_events.description` (ex.: #633 = "Tentativa de entrega não efetuada" em FORTALEZA-CE 26/06 19:01).
- Sem tratativa específica para **"Aguardando retirada na agência"** (status pós 3 tentativas dos Correios, prazo padrão **7 dias corridos** para retirada antes de devolução ao remetente).

### 2) Pedido #658 (Alexandre) — NF nunca foi curada
- Confirmado: NF nº 442 está em `draft`/`pronta_emitir` apesar do evento `authorized` gravado em 27/06 13:30:41 (e `email_sent` em seguida).
- Cenário clássico que motivou o `fiscal-reconcile-authorized`. O cron está agendado para 8h–16h BRT seg-sex, mas o caso real **nunca foi disparado retroativamente**. Por isso o pedido não mudou — o ajuste só preparou a cura automática.

### 3) Pedidos do ML (#662 e #663) não entram no fluxo fiscal completo
- Confirmado: ambos com `sales_channel='marketplace'`, `payment_status='approved'`, geraram apenas o **Pedido de Venda** (nº 450 e 451, `fiscal_stage='pedido_venda'`). **Nenhuma NF foi enfileirada.**
- Causa raiz: gatilho de promoção PV→NF não está rodando para canal marketplace; ciclo ML→NF→envio da chave→etiqueta→Pratika nunca arranca.

### 4) Cliente do ML duplicou no lead e não trouxe dados completos
- Confirmado no banco:
  - **2 pedidos do ML (#662 e #663) do mesmo CPF `48027413915` apontam para o mesmo `customer_id`**, mas com **emails sintéticos diferentes** (`meli-2000017149792188@…` e `meli-2000017149957656@…`).
  - O `customer` está com `cpf`, `phone`, `total_orders` e `total_spent` **vazios/zerados**, embora os pedidos tenham CPF e valor.
  - **`email_marketing_subscribers` recebeu 2 entradas** (uma por order id), gerando o lead duplicado em /email-marketing.
  - Tela do cliente mostra "R$ 0,00" e "Total de Pedidos: 0" — a métrica não foi recalculada e o pedido aparece "Em separação" sem refletir nos totais.
- Causas:
  - Dedupe de cliente está usando email sintético em vez de **CPF como chave primária** quando o pedido vem do ML.
  - `meli-sync-orders` não está propagando `cpf`/`phone`/`address` para o registro do cliente (Profile Enrichment Policy não aplicada na ingestão ML).
  - Subscriber do email marketing é criado a partir do email do pedido sem filtrar domínios sintéticos `@marketplace.local`.
  - Trigger `customer_metrics_sync_v2` provavelmente não disparou na inserção via sync (ou dispara mas o canal marketplace passa fora do filtro).

---

## O que eu faria

### Onda 1 — Motivo real do Correios + Aguardando retirada
1. **`tracking-poll`:** mapear descrições que indicam "Aguardando retirada" (ex.: "Objeto aguardando retirada no endereço indicado", "Aguardando retirada em unidade dos Correios"). Quando detectado:
   - `delivery_status='awaiting_pickup'`
   - Persistir em `shipments.metadata`: `pickup_unit`, `pickup_address`, `pickup_deadline` (occurred_at + 7 dias corridos), `attempt_count`.
2. **`orders.shipping_status`:** propagar `awaiting_pickup` (transição já existe em `orderTransitions.ts`).
3. **UI Logística — card de "Problemas de envio/entrega":**
   - Exibir **última descrição real** dos Correios + cidade + data/hora.
   - Se `awaiting_pickup`: card amarelo dedicado com endereço da agência e contagem regressiva (X dias para retorno).
   - Distinção visual: vermelho = falha/devolução; amarelo = aguardando retirada.
4. **Notificações:** garantir que a regra `awaiting_pickup` já existente dispare na mudança de status (sem duplicar).

### Onda 2 — Cura do #658 + validação do reconciliador
1. Disparar `fiscal-reconcile-authorized` manualmente uma vez contra Respeite o Homem.
2. Validar: NF 442 sobe para `authorized`, com `chave_acesso`, `fiscal_stage=emitida`, side-effects encadeados (link com remessa #324, e-mail).
3. Confirmar que remessa #324 libera para emissão de etiqueta.

### Onda 3 — Pedidos do ML no fluxo fiscal e logístico externo
1. **Trigger fiscal universal:** ajustar `enqueue_fiscal_draft` (ou helper específico) para que pedidos com `sales_channel='marketplace'` + `payment_status='approved'` sejam promovidos de PV→NF automaticamente, herdando dados do PV criado pelo `meli-sync-orders`.
2. **Encadeamento canônico para ML:**
   ```
   Pedido ML → PV → NF autorizada → meli-send-invoice (chave ao ML)
     → ML libera etiqueta → meli-fetch-shipment → marketplace_shipments
     → external-shipping-sync-cron → Pratika
   ```
3. **Backfill controlado:** rodar promoção PV→NF para #662 e #663 após validar o gatilho. Sem operação destrutiva.
4. **`/fiscal?tab=pedidos`:** se filtro atual oculta marketplace, remover exclusão.
5. **`/external-shipping`:** garantir que cada pedido ML aparece com estado real (`awaiting_invoice` → `ready_to_ship` → `label_issued` → `in_transit`).

### Onda 4 — Cliente do ML (dedupe + enriquecimento + lead único) — **NOVA**
1. **Dedupe canônico no `meli-sync-orders`:**
   - Chave de identidade primária = **CPF/CNPJ** (quando presente no `billing_info`). Se já existir `customer` com o mesmo CPF no tenant, **reaproveitar** em vez de criar novo. Chave secundária = `ml_buyer_id` salvo em `customers.metadata.marketplace.mercadolivre.buyer_id` (para casos sem CPF).
   - Email sintético `meli-…@marketplace.local` continua válido apenas como rótulo de contato; **nunca como chave de dedupe**.
2. **Enriquecimento (Profile Enrichment Policy):** ao sincronizar pedido ML, preencher campos vazios do cliente: `cpf`, `phone`, endereço completo (vindo de `/shipments` → `destination.receiver_address`), `full_name` real. **Sem sobrescrever** campos já preenchidos pelo lojista (regra Profile Enrichment).
3. **Email Marketing — não inscrever sintéticos:** subscribe automático deve **filtrar emails com domínio `@marketplace.local`** (ou flag `is_synthetic_email=true` na `customers`). Sem opt-in real, nada de lista de marketing — alinhado com LGPD e com a política de leads do projeto.
4. **Métricas:** confirmar que `customer_metrics_sync_v2` cobre marketplace; se não, ajustar para incluir. Recalcular para os 2 pedidos do João Carlos para a tela do cliente parar de mostrar R$ 0,00.
5. **Backfill controlado:**
   - Mesclar o cliente duplicado (mover assinaturas/pedidos para o `customer_id` canônico, descartar duplicata; **sem deletar histórico de pedidos**).
   - Remover os 2 subscribers sintéticos do Email Marketing.
   - Preencher CPF/phone/endereço do cliente único.
   - Recalcular `total_orders` e `total_spent`.

### Onda 5 — Validação técnica + docs
- Para cada onda: consulta real ao banco confirmando o efeito.
- Atualizar:
  - `docs/especificacoes/logistica/logistica-externa.md` — motivo Correios + Aguardando retirada + fluxo ML completo
  - `docs/especificacoes/marketplaces/mercado-livre.md` — promoção PV→NF automática + dedupe/enriquecimento de cliente ML + exclusão de marketing
  - `docs/especificacoes/transversais/mapa-ui.md` — card "Aguardando retirada"
  - Memória nova: `mem://constraints/marketplace-customer-dedupe-by-document` (CPF/CNPJ é chave canônica; email sintético nunca dedupa; subscribers de email marketing excluem `@marketplace.local`).

---

## Pontos abertos / decisões que precisam da sua confirmação
1. **UX do cliente sintético em /customers e /customers/{id}:** hoje aparece "meli-…@marketplace.local" como email principal. Não vou mudar a UI sem sua aprovação. Sugestão técnica (não aplicada até você confirmar): exibir apenas "Sem e-mail informado pelo Mercado Livre" + manter o sintético oculto no detalhe, mas ainda usável internamente para vínculo. **Aprovar mudança de UI?**
2. **Backfill dos 2 pedidos ML reais (#662/#663):** envolve criar NF, deduplicar cliente e remover 2 subscribers — é ação corretiva em dados de produção. Faço com idempotência e log, mas é **ação de escrita em massa**. Preciso da sua autorização explícita.
3. **Sem mudanças no design ou no copy fora do estritamente necessário** (card "Aguardando retirada" reutiliza o mesmo padrão visual amarelo já existente em outros estados de aviso).

## Resultado final
- Logística: card de problema mostra a razão exata dos Correios e trata corretamente "Aguardando retirada" com endereço e prazo.
- Fiscal: #658 curado, reconciliador validado como rede de segurança real.
- ML: pedidos passam a percorrer PV → NF → chave ao ML → etiqueta → Pratika sem intervenção manual.
- Cliente ML: 1 cliente por CPF, com dados completos (CPF, telefone, endereço), totais corretos, **sem duplicar lead** no Email Marketing.

---

**Confirma os 3 pontos abertos acima e eu sigo na ordem Onda 1 → 2 → 3 → 4 → 5?**