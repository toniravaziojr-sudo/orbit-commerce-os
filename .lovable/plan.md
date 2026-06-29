📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras lido ✅ (working-rules, governance, layer 2 fiscal/logística)
- Doc formal do tema lido ✅ (logistica-externa.md, fiscal-emit-persist-authorized memória, shipping-remessa-self-heal)
- Fluxo afetado: (a) UI das abas Logística Interna/Externa + atalhos Central de Execuções e badge "Envio" do módulo Pedidos; (b) pipeline de persistência do estado "autorizado" da NF.
- Fonte de verdade: `shipments.delivery_status` + `tracking_code`/`posted_at` (UI); `fiscal_invoices.status='authorized'` (fiscal).
- Módulos impactados: Logística Interna, Logística Externa, Pedidos, Central de Execuções, Fiscal.
- Impacto cruzado mapeado ✅.
- UI impactada → mapa-ui.md será atualizado.
- Situação: Aguardando confirmação do usuário.

---

## Parte 1 — UI/UX: "Problemas de envio/entrega" separado de "Pendentes"

### Como funciona hoje
- A aba "Objetos de postagem" tem 3 sub-abas: **Prontos para emitir**, **Objetos emitidos** e **Pendentes**. A sub-aba "Pendentes" hoje lista qualquer remessa com `delivery_status='failed'` — misturando dois problemas diferentes:
  - Falhas **antes do despacho** (não conseguiu gerar etiqueta: pré-flight, NF ausente, erro Correios/Frenet).
  - Falhas **depois do despacho** (objeto postado que voltou, sumiu ou teve tentativa de entrega não efetuada — ex.: #633).
- O card **"Entregas problemáticas"** na Central de Execuções (`useExecutionCounts.useProblematicShipments`) leva para `/shipping` genérico, sem filtro.
- O badge **"Envio"** no módulo Pedidos abre o detalhe do pedido — não leva para a aba onde o objeto está sendo tratado.

### O problema
- Operador de emissão e operador de pós-venda dividem a mesma fila visual, sem separação clara.
- Atalhos não posicionam o usuário no objeto certo.

### O que eu faria

**1) Nova sub-aba "Problemas de envio/entrega"** em Logística Interna **e** Logística Externa (dentro de "Objetos de postagem"), sem alterar nenhum fluxo de dados:
- Helper único `classifyShipmentBucket(shipment)` em `src/lib/shipping/shipmentBuckets.ts` (espelhando o padrão de `src/lib/support-queues.ts`) com 4 buckets: `ready`, `issued`, `pending_issuance`, `delivery_problem`.
  - `pending_issuance` = `delivery_status='failed'` **e** `tracking_code IS NULL` (não saiu para a transportadora).
  - `delivery_problem` = `delivery_status IN ('failed','returned','unknown')` **e** `tracking_code IS NOT NULL` (já foi despachado e deu problema depois).
- A sub-aba "Pendentes" passa a usar o bucket `pending_issuance`; a sub-aba nova usa `delivery_problem`. Mesmo `useQuery`, só muda o filtro derivado.

**2) Card "Entregas problemáticas" (Central de Execuções → Rastreio)** passa a navegar para a aba certa:
- `navigateTo` deixa de ser `/shipping` cru e passa a ser `/shipping?tab=objetos&aba=problemas` (Logística Interna). Se a transportadora do objeto for de gateway externo (Frenet, ML, Shopee), abre `/external-shipping?tab=objects&aba=problemas`. Quando o contador agrega os dois, mantém destino padrão na Interna e a Externa absorve via mesmo deep-link.

**3) Badge "Envio" no módulo Pedidos** vira atalho contextual via helper `resolveShippingDeepLink(order)`:
- `delivery_status` em problema (`failed/returned/unknown` com tracking) → aba **problemas**.
- Em trânsito / saiu para entrega / entregue → aba **rastreios** (já existe).
- Aguardando etiqueta / falha de emissão → aba **pendentes**.
- Sem envio (digital/retirada) → tooltip, sem ação (como hoje).
- O destino respeita a regra `gateway-vs-local-shipping-routing`: gateway externo → `/external-shipping`; demais → `/shipping`. Query string `?order=<id>` faz scroll + highlight do card.

### Resultado final
- Operador de emissão vê só falhas de geração de etiqueta em "Pendentes".
- Operador de pós-venda vê devoluções, extravios e tentativas de entrega falhas em "Problemas de envio/entrega".
- Qualquer atalho (Central de Execuções, badge "Envio" do Pedido) cai na aba certa, no objeto certo.
- Zero mudança de fluxo backend, zero migração de dados, zero alteração de schema.

### Pontos que NÃO mudo sem sua autorização
- Não introduzo novos `delivery_status` no banco — uso só os existentes (`failed/returned/unknown/draft/...`).
- Não mexo em relatórios, KPIs do Dashboard ou ranking de transportadoras.
- Não altero o módulo Rastreios.

---

## Parte 2 — Fluxo Fiscal: por que o #658 ficou órfão e como blindar de vez

### Diagnóstico real
A regra `fiscal-emit-persist-authorized-before-side-effects` está corretamente aplicada em `fiscal-emit`. Mas existem **três caminhos** que marcam uma NF como autorizada na SEFAZ, e só um segue a regra:

| Função | Persiste status + chave + stage antes dos side-effects? |
|---|---|
| `fiscal-emit` (síncrono) | ✅ Sim |
| `fiscal-check-status` (polling Focus) | ⚠️ Faz UPDATE de status, mas **não seta `fiscal_stage='emitida'`** e chama `linkNFeToShipment` sem try/catch isolado |
| `fiscal-webhook` (callback Focus) | ⚠️ Lógica própria paralela, fácil de divergir |

No pedido #658, `fiscal_invoice_events` mostra:
- 13:30:41 → evento `authorized` com `chave_nfe`, protocolo e DANFE válidos.
- 13:30:43 → evento `email_sent` (side-effect rodou).
- Mesmo registro em `fiscal_invoices` continua `status='draft'`, `chave_acesso=NULL`, `fiscal_stage='pronta_emitir'`.

Ou seja: a função reconheceu a autorização, disparou side-effect, mas a única fonte de verdade do banco divergiu — provavelmente porque dois caminhos (re-submit + polling/webhook) bateram no mesmo registro com payloads parciais, ou porque o `fiscal_stage` não foi setado e algum gatilho de derivação rebaixou o estado.

### O problema estrutural
- **3 funções escrevendo o estado autorizado**, cada uma com seu próprio `updateData`. Toda regra nova precisa ser replicada nos 3 — qualquer esquecimento gera estado órfão.
- **Sem trava de concorrência** entre emit + polling + webhook na mesma NF.
- **Sem detecção automática** de "evento `authorized` existe mas invoice não está autorizada".

### O que eu faria (solução sólida, sem gambiarra, sem regressão)

**A. Helper único de persistência canônica** — `supabase/functions/_shared/fiscal-persist-authorized.ts`
- Função `persistAuthorizedState({ invoiceId, tenantId, focusStatusData, callerModule })` monta o payload completo (status, fiscal_stage, chave_acesso, número, série, xml_url, danfe_url, authorized_at, protocolo, focus_ref), aplica idempotência (não rebaixa estado terminal) e devolve `{ persisted, invoice }`.
- `fiscal-emit`, `fiscal-check-status` e `fiscal-webhook` passam a chamar **só este helper** para gravar autorização.
- Side-effects ficam em `fireAuthorizedSideEffects(invoice, callerModule)` com `try/catch` individual por efeito (link de remessa, email, WMS) — só roda se `persisted === true`.

**B. Trava de concorrência via advisory lock**
- Antes do UPDATE: `SELECT pg_try_advisory_xact_lock(hashtext('fiscal_invoice:' || invoice_id))`. Se não obtiver, retorna `concurrent_update_skipped` e o caller só relê o estado final. Elimina race entre os 3 caminhos.

**C. Reconciliador automático** — `supabase/functions/fiscal-reconcile-authorized/index.ts`
- Cron a cada 5 min (via `pg_cron` + `pg_net`): varre `fiscal_invoice_events` com `event_type='authorized'` cuja `fiscal_invoices` correspondente não esteja `authorized`. Reaplica `persistAuthorizedState` usando o `event_data.focus_response` já salvo. Self-heal sem intervenção humana.
- Adicionalmente, trigger `AFTER INSERT ON fiscal_invoice_events WHEN event_type='authorized'`: enfileira reconciliação imediata na `fiscal_draft_queue` (ou nova fila `fiscal_reconcile_queue`) se a NF ainda não estiver `authorized` — reduz a janela de inconsistência para segundos.

**D. UI de incidente fiscal (não esconder)**
- O hook `useOrderRegressionAlerts` já existe e mostra banner laranja no detalhe do pedido. Estendo para detectar a divergência específica "evento `authorized` sem invoice `authorized`" e mostrar: "NF autorizada na SEFAZ, reconciliando automaticamente." Quando o reconciliador resolve, o banner some.
- Remessa que ficou em "Falha" por falta de NF é re-elegida automaticamente porque `fireAuthorizedSideEffects` reexecuta `linkNFeToShipment`.

**E. Recuperar o #658 agora**
- Rodar o novo reconciliador uma vez sobre o tenant: ele identifica a NF 442 órfã, reaplica `persistAuthorizedState` usando o `focus_response` do evento de 13:30:41, religa a remessa, e o objeto sai de "Pendentes". Sem SQL avulso, sem migração manual.

**F. Memória + doc**
- Atualizar `mem://constraints/fiscal-emit-persist-authorized-before-side-effects` para citar as 3 funções e o uso obrigatório do helper.
- Nova memória `mem://constraints/fiscal-authorized-state-canonical-writer`.
- Atualizar `docs/especificacoes/erp/erp-fiscal.md` com o pipeline canônico autorizado + reconciliador.

### Resultado final
- Uma única função grava o estado autorizado em qualquer caminho.
- Concorrência travada por advisory lock.
- Self-heal de divergência SEFAZ vs banco em ≤ 5 min.
- Nenhuma gambiarra, nenhum rebaixamento de fluxo: o `fiscal-emit` continua robusto, só passa a delegar; os outros 2 caminhos ganham a mesma blindagem.

### Limites e pontos que NÃO faço sem sua autorização
- Não altero schema de `fiscal_invoices` (apenas trigger novo em `fiscal_invoice_events` + uma cron).
- Não introduzo nova UI fora do banner já existente.
- Não toco em `fiscal-cancel`, `fiscal-inutilizar`, criação de PV/draft.
- Não mexo no fluxo de email/WMS além de movê-los para dentro do `fireAuthorizedSideEffects`.

---

## Validação técnica que vou executar antes de fechar
- **UI**: Playwright abrindo `/shipping`, `/external-shipping`, módulo Pedidos: confirmar 4 sub-abas, deep-link funcionando, badge "Envio" navegando ao objeto certo.
- **Fiscal**: forçar `fiscal-reconcile-authorized` no tenant piloto, validar via SQL que a NF 442 fica `status='authorized'`, `chave_acesso` preenchido, `fiscal_stage='emitida'`, e que a remessa associada deixa o bucket de falha.
- Smoke test: nova emissão real no #658 (ou pedido equivalente) com simulação de re-submit concorrente, verificar que advisory lock impede duplicidade.

---

## Status atual

📌 **STATUS DA ENTREGA:** Diagnóstico em andamento — aguardando confirmação do plano.

---

## Detalhes técnicos (opcional)

**UI**
- `src/lib/shipping/shipmentBuckets.ts` (novo).
- `src/components/shipping/ShipmentGenerator.tsx`: 4ª `TabsTrigger value="problemas"`; queries derivadas pelo helper.
- `src/pages/ExternalShipping.tsx`: sub-aba paralela dentro de "Objetos de postagem".
- `src/components/orders/OrderList.tsx`: `Link` no badge Envio via `resolveShippingDeepLink`.
- `src/hooks/useExecutionCounts.ts`: `navigateTo` contextual.
- `src/pages/ShippingDashboard.tsx` + `ExternalShipping.tsx`: leitura de `?aba=` e `?order=`.

**Fiscal**
- `supabase/functions/_shared/fiscal-persist-authorized.ts` (novo).
- `supabase/functions/_shared/fiscal-authorized-side-effects.ts` (novo).
- Refator de `fiscal-emit`, `fiscal-check-status`, `fiscal-webhook` para delegar.
- `supabase/functions/fiscal-reconcile-authorized/index.ts` (novo) + schedule via `supabase--insert` (pg_cron + pg_net).
- Migration: trigger `AFTER INSERT ON fiscal_invoice_events` para enfileirar reconciliação imediata; (opcional) tabela `fiscal_reconcile_queue` (com GRANTs e RLS).

---

📝 **DOCUMENTAÇÃO NECESSÁRIA (no fechamento):**
- `docs/especificacoes/logistica/logistica-interna.md` e `logistica-externa.md` — nova sub-aba e regra de classificação.
- `docs/especificacoes/transversais/mapa-ui.md` — nova sub-aba + atalhos contextuais.
- `docs/especificacoes/erp/erp-fiscal.md` — pipeline canônico de autorização + reconciliador.
- Memórias `fiscal-emit-persist-authorized-before-side-effects` (atualizar) e `fiscal-authorized-state-canonical-writer` (novo).

**Confirma que eu sigo com este plano?**
