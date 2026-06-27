# Meta Tracking — Pixel + Conversions API (CAPI)

> **Status:** 🟢 Ativo
> **Versão:** 8.35.0
> **Camada:** Layer 3 — Especificações / Marketing
> **Última atualização:** 2026-06-01
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

## Auditoria 2026-05-07 — Achados e Correções (v8.32.0)

Auditoria conduzida no tenant **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`) a partir de alertas no painel da Meta (predicted_ltv inválido, EMQ baixo no topo de funil, AddToCart com cobertura abaixo de 75%). Os achados abaixo foram confirmados em código e em `marketing_events_log` antes de qualquer correção.

### Achados confirmados

| # | Achado | Causa raiz | Evidência (24h pré-deploy) |
|---|---|---|---|
| 1 | **`predicted_ltv` inválido em Purchase server-side** | `sendCapiPurchase` em `_shared/meta-capi-sender.ts` não emitia `predicted_ltv`; quando o browser falhava o evento chegava sem o campo, e quando emitia com `value=0` (cupom 100%) o painel marcava como inválido. | ~91% dos Purchases server-side sem `predicted_ltv`. |
| 2 | **`_fbp` ausente em CAPI no topo de funil** | `_sfCapi` no `storefront-html` dependia de `document.cookie` no instante do disparo; o cookie `_fbp` é gravado pelo script da Meta de forma assíncrona e não estava disponível no primeiro PageView/ViewCategory/ViewContent. Edge `marketing-capi-track` não tinha fallback. | PageView ~50% com fbp, ViewCategory ~3%, ViewContent 0%. |
| 3 | **AddToCart com cobertura CAPI baixa no fluxo "Comprar agora"** | O botão Comprar agora dispara AddToCart e em seguida `window.location.href='/checkout'` imediatamente. O `fetch + keepalive` era cancelado pela navegação antes de completar; `sendBeacon` só era usado como fallback após falha do fetch. | ~33% de cobertura em AddToCart vs >75% recomendado pela Meta. |
| 4 | **Schema divergente em AddToCart/InitiateCheckout do storefront-html** | Os snippets inline emitidos pela edge `storefront-html` não incluíam `delivery_category`, divergindo do tracker React (que já emitia). Painel da Meta sinalizava parâmetro recomendado ausente. | 0 eventos do storefront com `delivery_category` em AddToCart/InitiateCheckout. |
| 5 | **`view_item_list` aparecendo no painel Meta** (informativo, fora do escopo) | Evento de GA4. Não emitido pelo tracker Meta da plataforma; provavelmente injetado por script externo do tenant. | Não atribuível ao código da plataforma. Mantido como observação. |

### Correções aplicadas (v8.32.0)

| # | Correção | Arquivos |
|---|---|---|
| 1 | Paridade Purchase server-side: `delivery_category='home_delivery'`, `order_status='completed'`, `predicted_ltv = round(value*1.8, 2)` apenas quando `value` é número finito > 0. Mesmo guard aplicado no `trackPurchase` do browser. | `supabase/functions/_shared/meta-capi-sender.ts`, `src/lib/marketingTracker.ts` |
| 2 | Helper `_sfEnsureFbp` no `storefront-html` sintetiza `_fbp` no formato Meta `fb.1.<ms>.<rand>`, persiste cookie 90 dias e expõe `window.__sfFbp` **antes** de qualquer disparo, garantindo paridade Pixel+CAPI já no primeiro PageView. Tracker React passa a usar `getEffectiveFbp()` (window > cookie). Fallback secundário em `marketing-capi-track` lê `_fbp` do header `Cookie` quando ausente em `user_data` — payload explícito do browser sempre vence. | `supabase/functions/storefront-html/index.ts`, `src/lib/visitorIdentity.ts`, `supabase/functions/marketing-capi-track/index.ts` |
| 3 | **Beacon-first pré-navegação** para AddToCart e InitiateCheckout do tracker React: `sendCapi` aceita `beaconFirst=true`. Se `navigator.sendBeacon` retornar `true`, **não há fetch adicional** (evita duplicar evento). Se retornar `false` ou indisponível, cai no fetch+keepalive existente. Outbox em `localStorage` foi avaliada e descartada por risco de duplicação versus o ganho do sendBeacon-first. | `src/lib/marketingTracker.ts` |
| 4 | `delivery_category='home_delivery'` adicionado em AddToCart e InitiateCheckout do `storefront-html` (Pixel + CAPI), inclusive dentro de `contents[]` no AddToCart. Cobre os 3 pontos de disparo (PDP, Comprar agora e cart drawer). | `supabase/functions/storefront-html/index.ts` |

### Validação técnica pós-deploy

Executada em 2026-05-07 logo após o deploy. Confirmações:

- ✅ Fallback de `_fbp` via header `Cookie` na edge: PageView de teste com cookie `_fbp` foi registrado em `marketing_events_log` com `fbp` em `user_data_keys` (event_id `v832-test-pv-001`).
- ✅ Sem cookie e sem `fbp` no payload: `fbp` corretamente **ausente** (event_id `v832-test-pv-002-nofbp`) — o servidor **não** sintetiza `_fbp` próprio, preservando isolamento por visitante.
- ✅ Prerenders marcados `stale` para reemissão do HTML novo (`UPDATE storefront_prerendered_pages SET status='stale' WHERE status='active'`).
- ⏳ Cobertura real de `_fbp`/`delivery_category` no tráfego orgânico depende de tráfego pós-deploy (seed `__sfFbp` é client-side). **Validação consolidada agendada para 2026-05-08** (após 24h de tráfego acumulado).

### Garantias preservadas (não alteradas)

- `purchaseEventTiming` — não alterado.
- Dedup persistente do Purchase (30 dias via `purchaseDedup.ts`) — não alterada, não voltou para `useRef`/memória de aba.
- Sem novo disparo duplicado de Purchase.
- Nenhuma PII em plaintext enviada do browser para CAPI.
- CORS e envelope `200 { success:false }` preservados na edge.
- Sem mistura de dados entre tenants.
- GA4, scripts externos, pixels adicionais e `view_item_list` não alterados.

### Limites residuais conhecidos

- **EMQ no topo de funil para visitantes anônimos** (PageView/ViewCategory/ViewContent) seguirá menor enquanto não houver PII no cofre `_sf_identity` — limitação intrínseca da Meta, não corrigível sem identificação do visitante.
- **Janela de 7 dias da Meta** para EMQ e cobertura refletirem no painel Ads Manager / Events Manager.
- `marketing_events_log` mede **apenas CAPI**; o Pixel browser deve ser validado pelo **Meta Test Events**.

### Pendências paralelas (fora do escopo desta entrega)

- Bug do cron `generate-weekly-insights` rodando com anon key em vez de service role — registrado, sem correção nesta rodada.
- Bug do `get_auth_user_email` — registrado, sem correção nesta rodada.
- Investigação a fundo de `view_item_list` no painel Meta — provavelmente script externo do tenant.

---

## Auditoria 2026-05-12 — Gap residual de `_fbp` em Purchase (v8.33.0)

Medição consolidada 5 dias após a v8.32.0 confirmou que **8 de 9 eventos** atingiram a meta de cobertura `_fbp` (PageView 98%, ViewCategory 99%, ViewContent 100%, AddToCart 100%, InitiateCheckout 100%, Lead 100%, AddShipping/PaymentInfo 100%). **Único evento abaixo da meta:** `Purchase` em **76%** (era 71% pré-v8.32).

### Causa raiz

A página de obrigado (`/thank-you`) é uma rota **SPA-only**: não passa pelo edge `storefront-html`, portanto o helper `_sfEnsureFbp` (que sintetiza `_fbp` antes de qualquer disparo) nunca executa nessa rota. Quando o cliente:
- chega à página de obrigado **direto** após redirect do gateway de pagamento (Mercado Pago, etc.) **sem** ter navegado em rotas servidas pelo edge antes;
- ou está em sessão privada/anônima onde o script do Pixel ainda não inicializou no momento do disparo de Purchase;

→ não há `_fbp` em cookie nem em `window.__sfFbp`, e o Purchase CAPI vai sem `fbp`. O cofre `_sf_identity` cobre PII, mas **não armazena `_fbp`**, portanto não atua como fallback.

### Correção aplicada (v8.33.0)

Novo helper `ensureFbp()` em `src/lib/visitorIdentity.ts` espelha a lógica do edge `_sfEnsureFbp` no cliente. Chamado em `MarketingTracker.initialize()` antes de qualquer evento. Comportamento:

1. Se `window.__sfFbp` já foi semeado pelo edge → no-op.
2. Se cookie `_fbp` já existe (Pixel ou edge anterior) → espelha em `window.__sfFbp` e sai.
3. Caso contrário, sintetiza `fb.1.<ms>.<10-digit-rand>` (formato canônico Meta), persiste como cookie 90d (`Path=/; SameSite=Lax`) e expõe em `window.__sfFbp`.

**Por que é seguro:**
- `fbq('init')` da Meta **respeita cookie `_fbp` pré-existente** — não cria ID concorrente.
- Helper é idempotente: múltiplas chamadas no mesmo tab convergem para o mesmo valor.
- `getEffectiveFbp()` permanece **read-only** conforme contrato existente; toda síntese fica no novo helper.
- Qualquer evento subsequente (Pixel ou CAPI) encontra `_fbp` disponível sincronamente.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/visitorIdentity.ts` | Novo `ensureFbp()` (sintetiza+persiste cookie 90d quando ausente). |
| `src/lib/marketingTracker.ts` | `initialize()` chama `ensureFbp()` após `getOrCreateVisitorId()`. |

### Cobertura esperada pós-v8.33.0

| Evento | `_fbp` esperado |
|---|---|
| Purchase | **≥99%** (era 76%) |
| Demais eventos | mantidos (já em ≥98%) |

### Validação

Aguardar 24-48h de tráfego pós-deploy. Critério de sucesso: `_fbp` em Purchase CAPI ≥99% no `marketing_events_log`. Janela de 7 dias para a Meta refletir EMQ no Events Manager.

### Anti-regressão

Toda nova rota SPA-only que dispare eventos Meta deve assumir que `_fbp` já está garantido por `ensureFbp()` no `initialize` do tracker. **Proibido** sintetizar `_fbp` em outros pontos do código (criaria IDs concorrentes). Ver `mem://constraints/spa-only-route-fbp-seed`.

### Comportamentos esperados — NÃO são bugs (não propor "correções")

Registrado em 2026-05-12 após investigação completa. Futuras IAs **não devem propor mexidas** nestes pontos sem evidência nova:

1. **Cobertura de `_fbc` entre 30–55% nos eventos de funil.** É o **teto natural** do tráfego misto: somente visitantes que chegam com `?fbclid=` (clique em anúncio Meta) terão `_fbc`. Tráfego orgânico, direto, Google, e-mail e WhatsApp **nunca** terão `fbclid`. A implementação atual já cobre todos os pontos possíveis: edge `storefront-html` constrói `_fbc` quando detecta `fbclid` (refresh de janela de atribuição); `visitorIdentity.ts` faz captura redundante no browser, persiste cookie 90d + cópia em `localStorage` (sobrevive a limpezas parciais), espelha `localStorage → cookie` quando o cookie é apagado. **Persistir além disso causaria atribuição incorreta** (creditar conversão a anúncio antigo após visitante voltar por outro canal).

2. **Aviso "IPv6 detected" no Events Manager.** É **informativo**, não erro. Captamos o IP real via Cloudflare (`cf-connecting-ip`) — método oficial recomendado pela Meta. Visitantes com conectividade IPv6-only (cada vez mais comuns no Brasil) sempre gerarão IPv6, e a Meta aceita IPv6 na CAPI desde 2022. **Não existe forma legítima de "converter" IPv6 em IPv4** — são endereços distintos. Forçar conversão sintética degradaria o matching geográfico.

---

## Auditoria 2026-06-01 — Onda 7: Cofre completo no snippet inline do edge HTML (v8.35.0)

Auditoria do tenant **Respeite o Homem** confirmou que, pós-v8.34.0, **8 de 10 eventos** atingiram score ≥9 (Lead/AddShippingInfo/AddPaymentInfo 9.3; Purchase 8.9; PageView 6.8). **Único gap residual:** ViewContent/AddToCart/InitiateCheckout/ViewCategory disparados pelo edge HTML tinham `first_name_hashed`/`city_hashed`/`zip_hashed` em **0%**, mesmo para visitantes recorrentes que já tinham o cofre `_sf_identity` cheio. Painel da Meta refletia EMQ 5.8–6.7 nesses eventos quando deveria estar 7.5–8.5 para a parcela de tráfego identificado.

### Causa raiz

O snippet inline `_sfCapi` no `storefront-html` lia apenas o cofre antigo (`_sf_am_em`, `_sf_am_ph` — email/telefone). **Ignorava** o cofre novo `_sf_identity` (v8.28+), que é exatamente onde moram os hashes de nome/cidade/UF/CEP/país/data nascimento/customer_id. Eventos do edge HTML são disparados **antes** do tracker React carregar (loja SSR), portanto não herdavam a mesclagem que o React já fazia corretamente desde v8.28.0.

### Correção aplicada (v8.35.0)

Adicionado helper `_sfGetIdentity()` ao snippet inline do `storefront-html` que espelha exatamente a leitura feita por `marketingTracker.ts → sendServerEvent` (linhas 391–400):

1. Lê `localStorage._sf_identity`.
2. Valida `expires_at` (TTL 30d); remove se expirado.
3. Devolve **apenas hashes já calculados**: `email_hashed`, `phone_hashed`, `first_name_hashed`, `last_name_hashed`, `city_hashed`, `state_hashed`, `zip_hashed`, `country_hashed`, `date_of_birth_hashed`, `gender_hashed`.
4. Devolve `customer_id` e `lead_id` quando presentes (para `external_id` array e `custom_data.lead_id`).

Em `_sfCapi`, antes do `fetch`:
- Hashes do cofre são mesclados ao `user_data` (regra: explícito do caller vence; cofre só completa o que falta).
- `external_id` vira array `[visitor_id, customer_id]` quando `customer_id` está presente e diverge de `visitor_id`.
- `lead_id` é injetado em `custom_data` quando ausente — fechamento de funil de Lead Ads também para eventos de topo.

**Arquivos alterados:** `supabase/functions/storefront-html/index.ts`.

### Garantias preservadas (anti-regressão)

- **Zero PII em plaintext** sai do navegador — só os campos `*_hashed` que já estão pré-calculados pelo `visitorIdentity.ts` (SHA-256 acontece antes da gravação no cofre).
- **`purchaseEventTiming`** inalterado.
- **Dedup persistente 30d do Purchase** (`purchaseDedup.ts`) inalterado.
- **`event_id` determinístico** Pixel ↔ CAPI inalterado.
- **`getEffectiveFbp()` permanece read-only** — não criamos `_fbp` em ponto novo.
- **Visitante 100% anônimo** (cofre vazio): comportamento idêntico ao anterior — limite intrínseco da Meta, documentado e proibido tentar burlar.
- **`_fbc` 30–55%, IPv6, `view_item_list`**: continuam intocados conforme proibições explícitas.
- **CORS e envelope `200 { success: false }`** preservados.
- **Sem mistura de dados entre tenants** — cofre é por navegador; cada navegador só carrega 1 loja por vez.
- **Prerenders marcados `stale`** após deploy para reemitir HTML novo (regra fixa do pipeline).

### Cobertura esperada pós-v8.35.0

Para a parcela de tráfego com cofre populado (Lead/AddShipping/AddPayment/Purchase ocorridos nos últimos 30 dias):

| Evento | EMQ esperado |
|---|---|
| ViewCategory (edge) | 5.9 → **7.0–8.0** |
| ViewContent (edge) | 5.8 → **7.5–8.5** |
| AddToCart (edge) | 6.7 → **7.5–8.5** |
| InitiateCheckout (edge) | 6.6 → **7.5–8.5** |
| PageView (edge) | 6.8 → **7.5–8.5** |

Para tráfego 100% anônimo (sessão sem nenhum evento de identificação prévia): mantém o teto natural — sem mudança esperada.

### Validação técnica

- ✅ Deploy `storefront-html` concluído (2026-06-01).
- ✅ `storefront_prerendered_pages` marcados `stale` para reemissão do HTML novo.
- ⏳ Cobertura real de hashes de nome/cidade/CEP nos eventos do edge depende de tráfego pós-deploy. **Validação consolidada agendada para 2026-06-03** (após 48h de tráfego acumulado).
- ⏳ Janela de 7 dias para a Meta refletir EMQ no Events Manager.

### Anti-regressão a documentar

Qualquer novo ponto de disparo CAPI fora do tracker React (snippets inline novos, edge functions que emitem eventos diretamente, novas rotas SSR) **DEVE** ler `_sf_identity` via padrão equivalente a `_sfGetIdentity()` antes de despachar. **Proibido** repetir o erro de v8.28→v8.34 onde o React mesclava o cofre e o edge ignorava.

---

## Versionamento

| Versão | Data | Resumo |
|---|---|---|
| **v8.35.0** | **2026-06-01** | **Onda 7 — Cofre completo no snippet inline do edge HTML.** `_sfCapi` em `storefront-html` passa a ler `_sf_identity` completo (nome/cidade/UF/CEP/país/dob/gender hashes + customer_id + lead_id). Eventos do edge (PageView/ViewCategory/ViewContent/AddToCart/InitiateCheckout) herdam PII hashada de visitantes recorrentes — fecha o último gap real de EMQ no topo de funil. `external_id` vira array `[visitor_id, customer_id]` quando ambos presentes; `lead_id` injetado em `custom_data`. Zero PII em plaintext. Prerenders marcados `stale`. Visitante anônimo inalterado. |
| **v8.34.0** | **2026-05-16** | **Paridade total Pixel ↔ CAPI no Purchase + limpeza de campo não-padrão.** (1) **Pixel** passa a enviar `predicted_ltv = round(value*1.8, 2)` quando `value > 0` e finito — antes só o CAPI enviava, criando assimetria de EMQ entre canais. (2) **Removido `order_status: 'completed'`** dos dois canais (Pixel e CAPI): o campo **não consta da lista oficial de `custom_data` da Meta para Purchase** (validado contra Meta Pixel Reference e Conversions API — Standard Parameters em 16/mai/2026); estava sendo enviado fixo como `completed` mesmo em pedidos pendentes (dado incorreto, ignorado pela Meta). Controle de "contar ou não pedido não pago" continua **exclusivamente** via `purchaseEventTiming` (soberania do tenant — inalterado). (3) **`marketing_events_log.order_id`** passa a ser preenchido com o UUID do pedido em todo Purchase server-side, habilitando reconciliação por pedido (antes: 0/62 nos últimos 7 dias). Zero impacto em fiscal, vendas, pagamentos ou logística. Dedup persistente 30d por `event_id` mantido. Sem alteração no momento de disparo do Purchase. |
| **v8.33.0** | **2026-05-12** | **Seed client-side de `_fbp` para rotas SPA-only:** `ensureFbp()` em `visitorIdentity.ts` espelha `_sfEnsureFbp` do edge — sintetiza `fb.1.<ms>.<rand>`, persiste cookie 90d e expõe `window.__sfFbp` quando ambos estão ausentes. Chamado uma vez em `MarketingTracker.initialize()`. Resolve gap de Purchase `_fbp` de 76% → ≥99% para usuários que entram direto em `/thank-you` após redirect de gateway. `getEffectiveFbp()` permanece read-only. |
| **v8.31.0** | **2026-05-05** | **Cobertura CAPI máxima: `marketing-capi-track` aceita custom_data passthrough completo (allowlist removida); Pixel browser inclui `delivery_category=home_delivery` em ViewContent/AddToCart/InitiateCheckout/Purchase; Purchase server-side adiciona `order_status=completed`; ViewContent envia `contents[]` com `item_price` (paridade com AddToCart).** |
| **v8.36.0** | **2026-06-27** | **Pré-hidratação do cofre `_sf_identity` via `?ah=<token>` (clique de e-mail).** `email-track` minta token opaco single-use (TTL 5 min, tabela `identity_prehydration_tokens`) com bundle SHA-256 do subscriber (em/ph/fn/ln/db) **somente** quando o redirect aponta para domínio verificado do mesmo tenant. Nova edge `identity-prehydrate` consome atomicamente o token (UPDATE … WHERE used_at IS NULL AND expires_at > now()). `storefront-html` injeta snippet que hidrata o cofre **apenas se vazio**, remove `?ah=` da URL via `history.replaceState` e bloqueia o 1º `_sfCapi` por até 800ms aguardando o fetch — garante PageView/ViewContent enriquecidos no primeiro carregamento vindo de e-mail. Falha sempre silenciosa: zero regressão em fluxos sem `?ah=`. Limpeza automática diária (pg_cron) de tokens >1d. |
| **v8.30.0** | **2026-05-05** | **Cofre estendido: `db_hash` (data nascimento), `ge_hash`, `lead_id`, `customer_id`. 4 quick wins: `external_id` array, `predicted_ltv` em Purchase, `delivery_category` em todos os eventos de conversão, `lead_id` em `custom_data`. Coleta opcional de data de nascimento em Checkout, Popup, Newsletter Footer e bloco Newsletter Form. `audience-sync-weekly` v1.2.0 com enriquecimento demográfico.** |
| **v8.32.0** | **2026-05-07** | **Paridade Pixel+CAPI de `_fbp` no topo do funil:** `_sfEnsureFbp` no storefront-html sintetiza `_fbp` (formato `fb.1.<ms>.<rand>`, cookie 90d) e expõe `window.__sfFbp` antes de qualquer disparo; tracker React lê via `getEffectiveFbp()` (window > cookie). **Paridade Purchase server-side** em `sendCapiPurchase` (predicted_ltv com guard `value>0`, `delivery_category='home_delivery'`, `order_status='completed'`). **Fallback secundário** em `marketing-capi-track` lendo `_fbp` do header `Cookie` quando ausente em `user_data` (payload do browser sempre vence). **`delivery_category='home_delivery'`** adicionado em AddToCart/InitiateCheckout do storefront-html (Pixel + CAPI), incluindo dentro de `contents[]`. **Beacon-first pré-navegação:** `sendCapi` aceita `beaconFirst=true` para AddToCart/InitiateCheckout do tracker React; se `navigator.sendBeacon` aceitar (`true`), não há fetch duplicado; se falhar, cai em fetch+keepalive (mantém fallback existente). Sem alteração em `purchaseEventTiming`, dedup persistente de 30d ou outbox. Nota: marketing_events_log mede CAPI; Pixel browser deve ser validado no Meta Test Events. EMQ de eventos de topo (PageView/ViewCategory/ViewContent) pode continuar menor para visitantes anônimos sem PII no cofre. Prerenders marcados `stale` para reemitir HTML novo. |

| v8.29.0 | 2026-05-05 | CAPI resiliente a navegação imediata: fast-path síncrono quando `_fbp` já existe; `fbp_wait_ms=800` em AddToCart/InitiateCheckout; `sendBeacon` fallback estendido aos dois eventos. |
| **v8.28.0** | **2026-04-29** | **Cofre `_sf_identity` (PII hashada cumulativa, TTL 30d); backend aceita `first_name_hashed`/`last_name_hashed`/`city_hashed`/`state_hashed`/`zip_hashed`; PageView gated por `_fbp` (polling 5s); checkout passa `userData` completo em AddShippingInfo/AddPaymentInfo; invalidação de 89 prerenders ativos** |
| v8.27.0 | 2026-04-19 | Persistência 30d do Purchase (`purchaseDedup.ts`); event_id normalizado; cookies sintéticos `_fbp`/`_fbc` no edge; `email_hashed`/`phone_hashed` em meio de funil |
| v8.26.0 | 2026-04-15 | `client_ip_from_browser` priorizado sobre headers em CAPI |
| v8.25.0 | 2026-04-10 | `waitForFbp` aumentado para 5s |
| v8.20.0 | 2026-04-05 | Transporte híbrido fetch+keepalive / sendBeacon |

Histórico completo: `docs/meta-tracking-changelog.md`.
