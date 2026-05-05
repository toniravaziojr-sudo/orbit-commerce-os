# Meta Tracking — Pixel + Conversions API (CAPI)

> **Status:** 🟢 Ativo
> **Versão:** 8.30.0
> **Camada:** Layer 3 — Especificações / Marketing
> **Última atualização:** 2026-05-05
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

## Cofre de Identidade Cumulativo (`_sf_identity`) — v8.28.0

**Problema resolvido:** parâmetros perdidos ao longo do funil. Lead alimentava email/phone, mas eventos posteriores (AddShippingInfo, AddPaymentInfo, Purchase) só tinham acesso ao que o componente atual conhecia. Resultado: score do Purchase ficava **abaixo** do score do Lead — o oposto do que deveria acontecer numa cadeia natural.

### Princípio
Todo PII coletado durante a sessão é **persistido já hashado SHA-256** em `localStorage._sf_identity` (TTL 30 dias). Cada novo evento de funil **mescla não-destrutivamente** os hashes guardados antes de despachar Pixel/CAPI. Como a fusão é `payload.X ?? stored.X`, dados explícitos do evento atual prevalecem; só completa o que estiver faltando.

### Estrutura do cofre
```
_sf_identity = {
  email_hashed?: string,
  phone_hashed?: string,
  first_name_hashed?: string,
  last_name_hashed?: string,
  city_hashed?: string,
  state_hashed?: string,
  zip_hashed?: string,
  expires_at: number   // epoch ms (30 dias)
}
```

### Pontos de captura (acumulam no cofre)
| Evento | Campos gravados |
|---|---|
| `Lead` | email, phone, first_name, last_name |
| `AddShippingInfo` | email, phone, first/last name, city, state, zip |
| `AddPaymentInfo` | email, phone, first/last name, city, state, zip |
| `Purchase` | tudo do checkout |

### Pontos de leitura (mesclam do cofre)
**Todos** os eventos CAPI (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, ...). Inclusive o PageView do edge HTML mescla via inline script antes de despachar.

### Backend — campos pré-hashados aceitos
`supabase/functions/_shared/meta-capi-sender.ts` aceita os seguintes campos como **já hashados** (sem re-hash):
- `email_hashed`, `phone_hashed`
- `first_name_hashed`, `last_name_hashed`
- `city_hashed`, `state_hashed`, `zip_hashed`

> **🚫 Proibido enviar PII em texto puro do browser para esses campos.** Hashing acontece exclusivamente em `src/lib/visitorIdentity.ts` antes de gravar no cofre.

**Implementação:**
- Cofre: `src/lib/visitorIdentity.ts` (`storeIdentity`, `readIdentity`, `mergeIdentityIntoUserData`)
- Mesclagem em todos os eventos: `src/lib/marketingTracker.ts` → `sendServerEvent`
- Edge HTML: `supabase/functions/storefront-html/index.ts` (snippet inline lê `_sf_identity` antes do PageView)

---

## PageView Sincronizado com `_fbp` — v8.28.0 (Onda 6)

**Problema resolvido:** mesmo com cookie sintético, em ambiente real o `fbq('init')` podia atrasar e o PageView do CAPI saía antes de o Pixel browser confirmar o `_fbp`. Resultado: PageView browser e PageView server divergiam no `fbp` → match imperfeito.

### Solução
O snippet do edge HTML agora **atrasa** `fbq('track', 'PageView')` e o CAPI PageView até o `_fbp` estar disponível, com polling de **250ms × 20 = 5s máximo**. Quando o cookie é detectado, marca `window._sfMetaReady = true` e dispara os dois canais com o mesmo `fbp`.

### Garantias
- Mesmo `event_id` em Pixel e CAPI (deduplicação Meta correta)
- Mesmo `_fbp` nos dois lados (score consistente)
- Fallback: se 5s passarem sem cookie, dispara mesmo assim (não bloqueia rastreamento)

> **Regra futura:** qualquer novo evento iniciado pelo edge HTML antes do `_sfMetaReady=true` deve seguir o mesmo padrão de espera.

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

## Cobertura Mínima por Evento (meta operacional pós-v8.28.0)

A meta passou a ser **PII acumulada** em todos os eventos pós-Lead. A regra de ouro: **o score de cada evento deve ser maior ou igual ao do evento anterior na cadeia natural**.

| Evento | `_fbp` | `_fbc` (quando há fbclid) | `client_ip_address` | `client_user_agent` | PII (`em`/`ph` + endereço) |
|---|---|---|---|---|---|
| PageView | 100% (gated) | ≥95% | 100% | 100% | Best-effort¹ |
| ViewCategory | ≥95% | ≥95% | 100% | 100% | Best-effort¹ |
| ViewContent | ≥95% | ≥95% | 100% | 100% | Best-effort¹ |
| AddToCart | ≥95% | ≥95% | 100% | 100% | Best-effort¹ |
| InitiateCheckout | ≥95% | ≥95% | 100% | 100% | ≥80% |
| Lead | 100% | ≥95% | 100% | 100% | 100% (em/ph/nome) |
| AddShippingInfo | 100% | ≥95% | 100% | 100% | 100% (+ endereço) |
| AddPaymentInfo | 100% | ≥95% | 100% | 100% | 100% (+ endereço) |
| Purchase | 100% | ≥95% | 100% | 100% | 100% (cofre completo) |

¹ Se o visitante já passou em Lead/Purchase em qualquer sessão dos últimos 30 dias, herda do cofre `_sf_identity`.

---

## Snapshot de Qualidade — 2026-04-29 (baseline pré-v8.28.0)

Notas observadas no Gerenciador de Eventos da Meta no dia da entrega da v8.28.0 (servem como **linha de base** para comparar a próxima medição em 24-48h):

| Evento | Score Pixel | Score CAPI | Observação |
|---|---|---|---|
| PageView | 6.5 | 6.5 | Maior cobertura de identificadores no funil |
| Lead | 8.0 | 8.0 | Pico de PII no funil — referência mínima esperada para Purchase |
| AddToCart | — | — | `_fbp` em 0% (race condition) — alvo prioritário da Onda 6 |
| AddShippingInfo | 7.x | 7.x | PII parcial — alvo da Onda 5 |
| AddPaymentInfo | 7.x | 7.x | PII parcial — alvo da Onda 5 |
| Purchase | 7.5 | 7.5 | **Abaixo do Lead** — anomalia que motivou o plano |

**Lacunas identificadas que motivaram a v8.28.0:**
- `_fbp` em AddToCart: **0%**
- `_fbp` em Purchase CAPI: **76%**
- PII (nome/cidade/CEP) não chegava no Purchase mesmo tendo sido digitada no checkout
- Cada evento coletava informações de forma independente, sem acumular

**Meta da próxima medição (após 24-48h da v8.28.0):**
- `_fbp` ≥95% em todos os eventos (incluindo PageView via gated, AddToCart via cookie sintético)
- Score Purchase **≥** Score Lead (cadeia natural respeitada)
- PII completa (em/ph/nome/cidade/UF/CEP) presente em AddShippingInfo, AddPaymentInfo e Purchase

---

---

## Técnica 6 — Envio resiliente a navegação imediata (v8.29.0)

**Problema observado.** Em fluxos com navegação imediata após o clique (botão "Comprar agora" que vai direto para `/checkout`, e o próprio "Ir para checkout" do carrinho), o `fetch` do CAPI é cancelado pelo navegador antes de sair da máquina do usuário. O Pixel browser dispara síncrono e chega na Meta; o CAPI não. Resultado: Meta sinaliza alerta amarelo em `AddToCart` e `InitiateCheckout` por baixa cobertura de identificadores no servidor.

**Causa raiz.** `sendServerEvent` chamava `waitForFbp(5000)` antes de qualquer envio. Mesmo quando `_fbp` já existia (cofre sintético do edge HTML), o polling adicionava 0–250ms de atraso, suficiente para a navegação cancelar a request.

**Ajuste aplicado.**

1. **Fast-path síncrono.** `sendServerEvent` lê `_fbp` síncrono no início. Se presente, dispara `fetch` imediatamente, sem polling. Vale para todos os eventos.
2. **Janela curta para eventos pré-navegação.** `trackAddToCart` e `trackInitiateCheckout` passam `fbp_wait_ms: 800` (default permanece 5000 para os demais).
3. **`sendBeacon` como fallback estendido.** O bloco que antes só protegia `Purchase` agora cobre também `AddToCart` e `InitiateCheckout`. Se o `fetch` falhar por cancelamento/unload, `navigator.sendBeacon` é disparado com `text/plain`.

**Eventos não afetados.** PageView, ViewContent, ViewCategory, Lead, AddShippingInfo, AddPaymentInfo, Purchase mantêm `fbp_wait_ms = 5000` e estratégia atual. Score de Purchase preservado.

**Cobertura esperada após v8.29.0:**

| Evento | Cobertura `_fbp` esperada | Score esperado |
|---|---|---|
| PageView | ≥95% | 6–7 |
| ViewContent | ≥95% | 7–8 |
| AddToCart | **≥95% (era ~17%)** | **7–9** |
| InitiateCheckout | ≥95% | 8–9 |
| Lead | ≥98% | ≥9 |
| AddShippingInfo | ≥98% | ≥9 |
| AddPaymentInfo | ≥98% | ≥9 |
| Purchase | ≥99% | ≥9.3 |

**Validação pós-deploy.** Janela de observação de 7 dias antes de qualquer nova alteração. Critério de sucesso: alerta amarelo em `AddToCart` fechado no Events Manager e score de Purchase ≥9.0 mantido.

---

## Técnica 7 — Cofre estendido (`db`/`ge`/`lead_id`/`external_id` array) — v8.30.0

**Problema observado.** Mesmo com o cofre `_sf_identity` (v8.28.0) cobrindo nome/cidade/UF/CEP, o sistema não enviava à Meta dois parâmetros oficiais de alto peso para EMQ — `db` (date of birth) e `ge` (gender) — nem aproveitava o `external_id` como **array** ([visitor + customer]) quando o cliente está identificado.

### Mudanças (4 quick wins + cofre estendido)

1. **Cofre `_sf_identity` v8.30 — novos campos:**
   - `db_hash` — SHA-256 de `YYYYMMDD` da data de nascimento.
   - `ge_hash` — SHA-256 de `m`/`f` (single char, lowercase).
   - `lead_id` — UUID gerado em `trackLead`, persistido para reuso em Purchase.
   - `customer_id` — quando logado, persistido para `external_id` array.
2. **`external_id` como array** `[sf_vid, customer_id]` — visitor + customer ID.
3. **`predicted_ltv`** — em `Purchase`, valor = `value × 1.8` (multiplier conservador).
4. **`delivery_category: 'home_delivery'`** — em AddToCart, InitiateCheckout, AddShippingInfo, AddPaymentInfo, Purchase.
5. **`lead_id` em `custom_data`** — gerado em Lead, replicado em Purchase para fechamento de funil de Lead Ads.

### Captura de `db` e `ge`

Coleta opcional, controlada pelo lojista via toggles:
- **Builder > Tema > Página Checkout > "Pedir data de nascimento"** (`requestBirthDate` + `birthDateRequired`).
- **Builder > Tema > Rodapé > Newsletter > "Pedir data de nascimento"** (`newsletterShowBirthDate` + `newsletterBirthDateRequired`).
- Blocos `newsletter_form` e `newsletter_popup` (props `showBirthDate` / `birthDateRequired`).

Validação universal: idade mínima 13, máxima 120 anos. Persistência:
- `checkout_sessions.customer_birth_date` (DATE)
- `orders.customer_birth_date` (DATE)
- `customers.birth_date` (DATE — primeira ocorrência via política de enriquecimento)
- Cofre `_sf_identity.db_hash` (SHA-256 do formato `YYYYMMDD`)

`ge` permanece preparado no cofre, sem coleta ativa nesta entrega.

### Backend — campos aceitos

`supabase/functions/_shared/meta-capi-sender.ts`:
- `date_of_birth_hashed` → `user_data.db`
- `gender_hashed` → `user_data.ge`
- `external_id` array → enviado como recebido (sem hash)

### Cobertura esperada

| Evento | EMQ esperado |
|---|---|
| Lead | ≥9.3 (era 8.0) |
| Purchase | ≥9.5 (era 7.5) |

A edge `audience-sync-weekly` (v1.2.0) também passa a enriquecer com dados demográficos hashados — ver `audience-sync-weekly.md`.

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
| **v8.29.0** | **2026-05-05** | **CAPI resiliente a navegação imediata: fast-path síncrono quando `_fbp` já existe; `fbp_wait_ms=800` em AddToCart/InitiateCheckout; `sendBeacon` fallback estendido aos dois eventos. Sem mudança em PageView/ViewContent/Lead/Shipping/Payment/Purchase.** |
| **v8.28.0** | **2026-04-29** | **Cofre `_sf_identity` (PII hashada cumulativa, TTL 30d); backend aceita `first_name_hashed`/`last_name_hashed`/`city_hashed`/`state_hashed`/`zip_hashed`; PageView gated por `_fbp` (polling 5s); checkout passa `userData` completo em AddShippingInfo/AddPaymentInfo; invalidação de 89 prerenders ativos** |
| v8.27.0 | 2026-04-19 | Persistência 30d do Purchase (`purchaseDedup.ts`); event_id normalizado; cookies sintéticos `_fbp`/`_fbc` no edge; `email_hashed`/`phone_hashed` em meio de funil |
| v8.26.0 | 2026-04-15 | `client_ip_from_browser` priorizado sobre headers em CAPI |
| v8.25.0 | 2026-04-10 | `waitForFbp` aumentado para 5s |
| v8.20.0 | 2026-04-05 | Transporte híbrido fetch+keepalive / sendBeacon |

Histórico completo: `docs/meta-tracking-changelog.md`.
