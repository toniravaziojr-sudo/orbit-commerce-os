
# Plano revisado — Base genérica para gateways de frete (Frenet, Melhor Envio, SuperFrete, Intelipost…) + Roteamento por capacidade + DC-e + status "Atendido"

Esta revisão consolida o que você pediu nas três rodadas anteriores e generaliza a base para qualquer gateway de frete futuro. **Não é um plano só para a Frenet** — a Frenet entra como o primeiro caso real de uso de uma arquitetura que já nasce pronta para Melhor Envio, SuperFrete, Intelipost e similares.

---

## 0. Diagnóstico do que já existe (auditado agora)

- A tabela `shipping_providers` **já tem** os campos `supports_quote` e `supports_tracking`.
- Os toggles **já estão na UI** (`CarrierConfigDialog.tsx`, `ShippingCarrierSettings.tsx`) e **já gravam** no banco.
- O `shipping-quote` **já filtra** por `supports_quote`.
- O `tracking-poll` **já filtra** por `supports_tracking`.
- O que **não existe ainda**: classificação `gateway × contrato × manual`, regras de roteamento por capacidade, fila de sincronização para gateways, DC-e, status "Atendido" e badge na Central de Execuções.

Ou seja: a base de capacidades já está lá. Falta usá-la para **decidir o destino operacional** de cada pedido e para **excluir gateways do fluxo de remessa local**.

---

## 1. Tipo de provedor (genérico, serve para qualquer transportadora)

Adicionar à `shipping_providers`:

- `provider_kind` enum:
  - `gateway` — agregador externo que recebe o pedido por API e devolve etiqueta/tracking pelo painel próprio (Frenet, Melhor Envio, SuperFrete, Intelipost…).
  - `contract` — contrato direto onde o sistema gera etiqueta/romaneio localmente (Correios, Loggi direto, Jadlog direto…).
  - `manual` — sem integração; lojista informa rastreio na mão.
- `gateway_capabilities` jsonb (opcional) — flags por gateway: `accepts_invoice_key`, `accepts_dce`, `supports_webhook_tracking`, `supports_label_download`. Permite a UI ligar/desligar botões sem escrever código novo a cada novo gateway.

Seed inicial:
- Frenet → `gateway`, aceita NF-e e DC-e, suporta webhook.
- Correios, Loggi, Jadlog (quando integrado direto) → `contract`.
- "Frete por terceiros" → `manual`.

---

## 2. Capacidades (já existem) — definição final do que cada uma significa

| `supports_quote` | `supports_tracking` | Habilitado para |
|---|---|---|
| ✅ | ✅ | Receber pedidos roteados pela escolha do cliente; executar fluxo operacional completo (remessa local se `contract`, sync se `gateway`). |
| ❌ | ✅ | Receber pedidos por **herança de rastreamento** (ver regra 3.4). |
| ✅ | ❌ | Apenas calcular frete na vitrine. Caso especial 3.3. |
| ❌ | ❌ | Inativo operacionalmente. |

Os toggles continuam no card de cada integração, com tooltip explicando o efeito.

---

## 3. Regras de roteamento (genéricas — valem para qualquer combinação de integrações)

Aplicadas no momento em que o pedido é confirmado/pago, por uma função SQL única `resolve_order_shipping_provider(order_id)`:

1. **Há frete escolhido pelo cliente** (checkout, link de checkout, pedido manual com transportadora informada): a integração responsável é a que oferta aquele serviço **e está ativa**.
2. **Mais de uma integração com Cotação+Rastreamento ativos**: cada pedido segue para a integração escolhida pelo cliente. Sem ambiguidade.
3. **Só uma integração ativa, e ela tem apenas Cotação (sem Rastreamento em ninguém)**: a integração assume o pedido, mas:
   - Não gera remessa local nem sincroniza tracking.
   - Permite emitir NF-e e/ou DC-e normalmente.
   - Aciona um **badge dispensável** na Central de Execuções: "Ative Rastreamento em alguma integração de frete para destravar remessas e tracking." Reaparece a cada novo pedido nesse cenário.
4. **A integração escolhida pelo cliente não tem Rastreamento, mas existe outra com Rastreamento ativo**: o pedido herda essa segunda integração apenas para fins de remessa/tracking.
5. **Pedido manual sem frete selecionado**: bloqueado na UI. Lojista é obrigado a escolher transportadora + serviço **ou** marcar "Frete por terceiros" (vai direto para fiscal, sem remessa nem rastreio).
6. **Marketplace**: nunca entra em logística. Vai só para fiscal e devolve a chave da NF-e ao marketplace.
7. **Importado (histórico)**: fora de logística e fiscal. Aparece só em Pedidos/Relatórios.
8. **Link de checkout**: meio de envio é obrigatório no momento da criação do link.

A função grava em `orders`:
- `resolved_shipping_provider_id`
- `resolved_shipping_provider_kind` (`gateway`/`contract`/`manual`)
- `resolved_shipping_reason` (`customer_choice` | `tracking_inheritance` | `single_active` | `manual_third_party` | `marketplace`)

---

## 4. Separação operacional (resolve a sua dor: "gateway não deve aparecer em remessas")

- **Provedor `contract`** → entra em `shipping_draft_queue` → vira remessa local → aparece na aba **Remessas** do módulo Logística.
- **Provedor `gateway`** → entra em `gateway_sync_queue` → não aparece em Remessas → aparece apenas em:
  - **Pedidos** (com selo "Frenet/Melhor Envio/…")
  - **Fiscal → Pedidos** (para emitir NF-e ou DC-e)
  - **Logística → Rastreamento** (status vindo do gateway via webhook ou polling)
- **Provedor `manual` / Frete por terceiros** → não entra em remessa nem em sync. Vai direto para fiscal.

A trigger `enqueue_fiscal_draft` é atualizada para fazer esse roteamento; o trigger paralelo de logística passa a checar `provider_kind` e só enfileira em `shipping_draft_queue` quando for `contract`.

---

## 5. Pipeline genérico de gateway (reaproveitável)

Em vez de criar funções com nome "frenet-…", a base é genérica:

- **Edge function `gateway-sync-order`** — recebe `(order_id, provider_id)`, despacha para o adapter do gateway correspondente (`frenetAdapter`, `melhorEnvioAdapter`, `superFreteAdapter`, …) sob `supabase/functions/_shared/shipping-gateways/`.
- **Edge function `gateway-attach-fiscal-doc`** — anexa NF-e ou DC-e autorizada ao pedido no gateway. Mesmo despacho por adapter.
- **Edge function `gateway-webhook`** — endpoint único `/functions/v1/gateway-webhook/{provider}` que valida assinatura/IP do gateway e atualiza o pedido (status, tracking, etiqueta).
- **Tabela `gateway_sync_queue`** — fila genérica `(id, tenant_id, order_id, provider_id, action, status, attempts, last_error, payload, processed_at)` com `action` em `sync_order | attach_invoice | attach_dce | request_label`.

Cada novo gateway no futuro = um novo arquivo de adapter + uma linha no seed. Zero alteração no resto da arquitetura.

---

## 6. Fiscal: NF-e e DC-e

- **DC-e (Declaração de Conteúdo Eletrônica)** via Nuvem Fiscal: nova tabela `fiscal_dce` espelhando `fiscal_invoices`, edge function `dce-emit`.
- Aba **Notas Fiscais** ganha duas ações em massa:
  - "Emitir Declaração de Conteúdo"
  - "Enviar ao gateway de frete" (rótulo dinâmico — "Enviar à Frenet", "Enviar ao Melhor Envio" — conforme `resolved_shipping_provider`). Disponível apenas para pedidos `gateway` com NF-e ou DC-e autorizada.
- Emitir NF-e **ou** DC-e move o pedido para o status `fulfilled` ("Atendido").

---

## 7. Status novo: "Atendido" (`fulfilled`)

```text
Pago → Atendido (NF-e ou DC-e emitida) → Enviado → Entregue
```

- Adicionado ao enum `OrderStatus` e a todas as listas/filtros (Pedidos, Fiscal, Logística).
- Aba **"Pedidos em Aberto"** dentro do Fiscal renomeada para **"Pedidos"**: lista pagos + atendidos ainda não enviados, com ações em massa de NF-e, DC-e e (quando aplicável) Sincronizar com gateway.
- Selo de cor própria, distinto de "Pago" e "Enviado".

---

## 8. Central de Execuções

Três famílias novas de aviso:

1. Badge dispensável "Ative Rastreamento em uma integração de frete" (cenário 3.3).
2. Falha ao sincronizar pedido com o gateway (com retry e link para o pedido).
3. Falha ao anexar NF-e/DC-e no gateway.

Todos com texto dinâmico pelo nome do gateway envolvido.

---

## 9. UI/UX — checagem completa, lacunas que faltavam no plano anterior

- **Configurações → Integrações de Frete**:
  - Toggles Cotação/Rastreamento já existem; adicionar **tooltip explicando a matriz** de combinações.
  - Adicionar selo visual do `provider_kind` no card ("Gateway" / "Contrato" / "Manual").
  - Validação: se o tenant tiver só uma integração com Cotação ligada e Rastreamento desligado em todas, mostrar inline-warning idêntico ao da Central.
- **Pedidos (lista)**:
  - Nova coluna/etiqueta de status "Atendido".
  - Badge "Sincronizado com [gateway]" para pedidos `gateway`.
  - Filtros atualizados (status + tipo de provedor).
- **Pedido manual (criação)**:
  - Campo Transportadora + Serviço **obrigatórios**, com opção "Frete por terceiros".
- **Link de checkout (criação)**:
  - Meio de envio **obrigatório**.
- **Fiscal → Pedidos** (aba renomeada):
  - Ações em massa: "Emitir NF-e", "Emitir Declaração", "Enviar ao gateway".
  - Filtro adicional por tipo de provedor.
- **Fiscal → Notas Fiscais**:
  - Ação em massa "Enviar ao gateway de frete" (visível só quando há pedidos `gateway` selecionados).
- **Logística → Remessas**:
  - **Filtra automaticamente fora todos os pedidos `gateway` e `manual`**. Banner explicativo no topo: "Pedidos de gateways de frete (Frenet, Melhor Envio…) são gerenciados no painel da própria plataforma. Veja-os em Rastreamento."
- **Logística → Rastreamento**:
  - Mostra todos. Cada linha indica a origem do status (gateway/contrato/manual).
  - Pedidos `gateway` ganham botão "Abrir no painel [gateway]".
- **Central de Execuções**:
  - Cards descritos no item 8.

---

## 10. Backend — resumo objetivo

- Migrações: `provider_kind`, `gateway_capabilities`, novos campos em `orders`, tabelas `fiscal_dce` e `gateway_sync_queue`, novo valor `fulfilled` no enum de status.
- Função SQL: `resolve_order_shipping_provider(order_id)` — implementa item 3.
- Triggers atualizados: `enqueue_fiscal_draft` chama o resolver e roteia para `shipping_draft_queue` ou `gateway_sync_queue` conforme `provider_kind`.
- Edge functions novas (genéricas): `gateway-sync-order`, `gateway-attach-fiscal-doc`, `gateway-webhook`, `dce-emit`.
- `_shared/shipping-gateways/` com `frenetAdapter.ts` (única implementação real agora) + interface `IShippingGatewayAdapter` documentada para futuros gateways.
- `tracking-poll` passa a ignorar pedidos `gateway` (eles recebem status por webhook).

---

## 11. Documentação a atualizar (na mesma entrega — obrigatório)

- `docs/especificacoes/erp/logistica.md` — `provider_kind`, matriz de capacidades, regras de roteamento, separação Remessas vs Rastreamento, pipeline genérico de gateway.
- `docs/especificacoes/erp/erp-fiscal.md` — DC-e, status "Atendido", ação "Enviar ao gateway".
- `docs/especificacoes/ecommerce/pedidos.md` — novo status, obrigatoriedade de frete em manual e link, marketplaces e importados fora da logística.
- Novo `docs/especificacoes/erp/integracoes-frete.md` — padrão de adapter para futuros gateways.
- `docs/especificacoes/transversais/mapa-ui.md` — renomeação de aba, badges, novos botões.
- Memórias novas:
  - `mem://constraints/shipping-provider-capability-routing` — regras do item 3.
  - `mem://features/logistics/gateway-vs-contract-providers` — separação operacional + pipeline genérico.
  - `mem://features/fiscal/dce-issuance-standard` — fluxo DC-e e status "Atendido".

---

## 12. Rollout

1. Migrações + seed (Frenet=`gateway`, Correios/Loggi=`contract`).
2. Backend em modo "shadow" 24h no tenant `respeiteohomem` (grava classificação e fila, mas não atua).
3. Ativação real para `respeiteohomem`, monitorada na Central de Execuções.
4. Liberação geral.
5. Docs e memórias atualizadas na mesma entrega.

---

**Resumo do que mudou em relação ao plano anterior:**
- Arquitetura **genérica** de gateways (adapter + fila + webhook único), não mais centrada na Frenet.
- Aproveitamento de `supports_quote` e `supports_tracking` que **já existem** no banco e na UI.
- Função SQL única `resolve_order_shipping_provider` como fonte de verdade do roteamento.
- UI ganha selo de `provider_kind`, banner em Remessas, botão "Abrir no painel do gateway", validação inline em Configurações.
- Rótulos dinâmicos dos botões pelo nome do gateway.

**Confirma esse plano para eu sair do modo plano e implementar?**
