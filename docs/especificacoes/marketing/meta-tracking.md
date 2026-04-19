# Meta Tracking — Pixel + Conversions API (CAPI)

> **Status:** 🟢 Ativo
> **Versão:** 8.27.0
> **Camada:** Layer 3 — Especificações / Marketing
> **Última atualização:** 2026-04-19
> **Doc relacionado:** `docs/meta-tracking-changelog.md` (histórico de notas e cobertura)

---

## Visão Geral

O sistema dispara eventos para a Meta por **dois canais simultâneos** desduplicados pelo `event_id`:

1. **Pixel (Browser)** — JavaScript `fbq('track', ...)` no navegador.
2. **CAPI (Server)** — chamada server-to-server via edge `marketing-capi-track` → Meta Conversions API.

**Princípio:** os dois canais sempre disparam para o mesmo evento. O `event_id` igual nos dois lados garante que a Meta conte como **1 conversão** (não 2). No log bruto da Meta aparecem 2 eventos (browser + server), o que é **comportamento esperado**.

---

## Eventos Suportados

| Evento | Quando dispara | Pixel | CAPI |
|---|---|---|---|
| `PageView` | Carregamento de qualquer página da loja | ✅ | ✅ |
| `ViewCategory` | Abertura de página de categoria | ✅ | ✅ |
| `ViewContent` | Abertura de página de produto | ✅ | ✅ |
| `Search` | Submit de busca | ✅ | ✅ |
| `AddToCart` | Adição de item ao carrinho | ✅ | ✅ |
| `InitiateCheckout` | Início do checkout | ✅ | ✅ |
| `Lead` | Captura de contato (email/telefone) | ✅ | ✅ |
| `AddShippingInfo` | Confirmação de frete | ✅ | ✅ |
| `AddPaymentInfo` | Confirmação de pagamento | ✅ | ✅ |
| `Purchase` | Pedido criado/pago (depende de `purchaseEventTiming`) | ✅ | ✅ |

---

## Regras de Emissão do Evento Purchase

### Modos disponíveis (configuração soberana do tenant)

`store_settings.checkout_config.purchaseEventTiming`:

| Valor | Comportamento | Uso típico |
|---|---|---|
| `all_orders` (padrão) | Dispara `Purchase` no momento em que o pedido é criado, independente do status de pagamento | Lojas com mix de PIX/Boleto que precisam alimentar o algoritmo da Meta com volume |
| `paid_only` | Dispara `Purchase` apenas quando o pagamento é confirmado | Lojas que querem evitar contagem de PIX expirado |

> **🚫 Proibido alterar `purchaseEventTiming` sem autorização explícita do tenant.** É decisão de negócio do dono da loja, não da plataforma.

### Persistência 30 dias (anti re-fire)

Toda emissão de `Purchase` no navegador é protegida por **dedup persistente em `localStorage`**:

- **Chave:** `sf_purchase_fired_<tenant_id>_<order_normalizado>`
- **TTL:** 30 dias
- **Implementação canônica:** `src/lib/purchaseDedup.ts`
- **Funções:** `hasPurchaseAlreadyFired`, `markPurchaseAsFired`, `cleanupExpiredPurchaseDedup`

**Cenários cobertos:**
- Reabertura do link de obrigado.
- Refresh da página.
- Botão voltar do navegador.
- Compartilhamento do URL.

> **❌ É proibido voltar a usar `useRef` ou memória de aba para esse controle.** Memória de aba não sobrevive a refresh nem reabertura.

### `event_id` determinístico (paridade Pixel↔CAPI)

Browser e servidor devem gerar **byte-a-byte o mesmo `event_id`**. Formato único:

```
purchase_<mode>_<order_normalizado>
```

Onde:
- `mode` ∈ `{created, paid}` (mapeia a `all_orders` → `created`, `paid_only` → `paid`)
- `order_normalizado` = string apenas com `[a-z0-9]` em lowercase (remove `#`, espaços, hífens)

**Implementações canônicas:**
- Browser: `src/lib/marketingTracker.ts` → `generateDeterministicPurchaseEventId`
- Server: `supabase/functions/_shared/purchase-event-id.ts` → `buildDeterministicPurchaseEventId`

> **❌ Qualquer divergência quebra a deduplicação Pixel↔CAPI no painel da Meta.** Toda alteração em uma das implementações DEVE espelhar na outra.

---

## Estratégia de Cobertura de Identificadores

A qualidade do match na Meta depende dos identificadores enviados em cada evento. A meta operacional é cobertura **≥95%** de `_fbp` e `_fbc` em todos os eventos de funil (PageView, ViewContent, AddToCart, InitiateCheckout, Lead, Purchase).

### Técnica 1 — `_fbp` sintético no edge (Frente E1)

**Problema resolvido:** race condition. A CAPI dispara antes do `fbq('init')` gravar o cookie no navegador → eventos iniciais saem sem `_fbp` → match degradado.

**Solução:** o edge `storefront-html` (a cada renderização):
1. Lê o cookie `_fbp` da request.
2. Se ausente, gera um sintético no formato oficial: `fb.1.<timestamp_ms>.<random10>`.
3. Grava via `Set-Cookie`: `Path=/; Max-Age=7776000; SameSite=Lax` (90 dias, sem HttpOnly para o Pixel ler).
4. O navegador encontra o cookie já pronto no primeiro carregamento → `fbq('init')` respeita.

**Implementação:** `supabase/functions/storefront-html/index.ts` → `decideMetaCookies` + `buildSyntheticFbp`.

### Técnica 2 — Captura de `fbclid` para `_fbc` (Frente E2)

**Problema resolvido:** atribuição de campanha perdida. Usuário chega via anúncio com `?fbclid=...`, mas se a primeira página é renderizada server-side antes do JS rodar, perde-se a captura.

**Solução:** o edge `storefront-html` detecta `fbclid` na query string e:
1. Constrói `_fbc=fb.1.<timestamp_ms>.<fbclid>` (formato oficial Meta).
2. Grava via `Set-Cookie` com as mesmas regras do `_fbp`.

**Resultado:** atribuição de campanha 1:1 desde o primeiro Pixel.

### Técnica 3 — Enriquecimento de `user_data` em meio de funil (Frente E3)

**Problema resolvido:** `ViewContent` e `AddToCart` saíam sem PII identificável → Match Quality "Good" no painel.

**Solução:**
1. Quando `Lead` ou `Purchase` é disparado, o navegador armazena `email` e `phone` **já hashed (SHA-256)** em `localStorage._sf_am_em` e `_sf_am_ph`.
2. Toda chamada CAPI subsequente lê esses valores e os passa como `email_hashed` / `phone_hashed` no payload.
3. A edge `marketing-capi-track` repassa `email_hashed`/`phone_hashed` ao `meta-capi-sender`, que os usa **sem re-hashear** (campos `em`/`ph` no `user_data` final).

**Implementação:**
- Browser: `src/lib/marketingTracker.ts` → `sendServerEvent` lê `_sf_am_em`/`_sf_am_ph`.
- Server: `supabase/functions/_shared/meta-capi-sender.ts` → `buildHashedUserData` aceita `email_hashed`/`phone_hashed` e usa direto.

> **⚠️ Crítico:** valores hashed devem ir nos campos `email_hashed`/`phone_hashed`, NUNCA nos campos `email`/`phone` (que são re-hasheados pelo backend).

### Técnica 4 — IP do cliente via Cloudflare (Frente E4)

**Problema resolvido:** alerta "Mismatched IPs" no painel da Meta. IP do navegador (Pixel) ≠ IP enviado na CAPI (vem de proxy ou header errado).

**Solução:** em `marketing-capi-track`, `client_ip_address` é extraído na ordem:

1. `payload.user_data.client_ip_from_browser` (quando o navegador reporta o próprio IP via call inicial)
2. `cf-connecting-ip` (header Cloudflare oficial)
3. `true-client-ip`
4. `x-real-ip`
5. `x-forwarded-for[0]`
6. `x-envoy-external-address`

`client_user_agent` vem do header `User-Agent` da request original do navegador, nunca do servidor.

**Cobertura mínima esperada:** 100% em todos os eventos CAPI.

---

## Tabela de Causas Comuns: Inflação Aparente vs Real

Antes de afirmar "inflação de Purchase", validar os 3 pontos abaixo:

| Causa Aparente | É inflação real? | Como confirmar |
|---|---|---|
| 2 eventos no log da Meta para 1 pedido (browser + server) | **❌ NÃO** | Painel da Meta deduplica por `event_id` → conta como 1 conversão. Inspecionar o painel "Visão geral", não o "Log de eventos brutos". |
| Pedido PIX expirado contado como Purchase sob `purchaseEventTiming = all_orders` | **❌ NÃO** | É comportamento por design. Mudar para `paid_only` exige autorização do tenant. |
| Janela em UTC mostra mais eventos que o esperado | **❌ NÃO** | Recontar em fuso `America/Sao_Paulo` (BRT). Eventos do dia anterior em UTC podem cair no dia atual em BRT (ou vice-versa). |
| Re-fire no log antigo (pré-v8.27.0) | **✅ Sim, mas histórico** | A persistência de 30 dias só cobre eventos novos. Logs antigos não devem ser comparados pós-correção. |
| Mesmo pedido aparece 2x no `marketing_events_log` em datas distantes | **✅ Sim, anomalia** | Investigar: trigger duplicada, webhook reentrante, cliente reabrindo link sem dedup. |

---

## Cobertura Mínima por Evento (meta operacional pós-v8.27.0)

| Evento | `_fbp` | `_fbc` (quando há fbclid) | `client_ip_address` | `client_user_agent` | PII (`em`/`ph`) |
|---|---|---|---|---|---|
| PageView | ≥95% | ≥95% | 100% | 100% | Best-effort |
| ViewCategory | ≥95% | ≥95% | 100% | 100% | Best-effort |
| ViewContent | ≥95% | ≥95% | 100% | 100% | Best-effort* |
| AddToCart | ≥95% | ≥95% | 100% | 100% | Best-effort* |
| InitiateCheckout | ≥95% | ≥95% | 100% | 100% | ≥80% |
| Lead | 100% | ≥95% | 100% | 100% | 100% |
| AddShippingInfo | 100% | ≥95% | 100% | 100% | 100% |
| AddPaymentInfo | 100% | ≥95% | 100% | 100% | 100% |
| Purchase | 100% | ≥95% | 100% | 100% | 100% |

\* Dependente de o cliente ter passado em Lead/Purchase anteriormente na mesma sessão (PII hashed em `localStorage`).

---

## Configurações por Tenant

`store_settings.checkout_config`:

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `purchaseEventTiming` | `'all_orders' \| 'paid_only'` | `all_orders` | Quando disparar Purchase |
| `meta_pixel_id` | string | `null` | ID do Pixel da Meta |
| `meta_access_token` | secret | `null` | Token CAPI |
| `meta_capi_enabled` | boolean | `false` | Liga/desliga CAPI |
| `meta_enabled` | boolean | `false` | Liga/desliga Pixel |

---

## Referências de Implementação

| Função | Arquivo |
|---|---|
| Tracker principal (browser) | `src/lib/marketingTracker.ts` |
| Hook React | `src/hooks/useMarketingEvents.ts` |
| Provider de contexto | `src/components/storefront/MarketingTrackerProvider.tsx` |
| Dedup persistente do Purchase | `src/lib/purchaseDedup.ts` |
| Edge — recebe e encaminha CAPI | `supabase/functions/marketing-capi-track/index.ts` |
| Sender CAPI compartilhado | `supabase/functions/_shared/meta-capi-sender.ts` |
| Normalizador de event_id (server) | `supabase/functions/_shared/purchase-event-id.ts` |
| Edge que injeta cookies sintéticos | `supabase/functions/storefront-html/index.ts` |
| Página de obrigado (origem do Purchase) | `src/components/storefront/ThankYouContent.tsx` |

---

## Versionamento

| Versão | Data | Resumo |
|---|---|---|
| v8.27.0 | 2026-04-19 | Persistência 30d do Purchase (`purchaseDedup.ts`); event_id normalizado; cookies sintéticos `_fbp`/`_fbc` no edge; `email_hashed`/`phone_hashed` em meio de funil |
| v8.26.0 | 2026-04-15 | `client_ip_from_browser` priorizado sobre headers em CAPI |
| v8.25.0 | 2026-04-10 | `waitForFbp` aumentado para 5s |
| v8.20.0 | 2026-04-05 | Transporte híbrido fetch+keepalive / sendBeacon |

Histórico completo: `docs/meta-tracking-changelog.md`.
