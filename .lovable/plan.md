## 📋 Checklist de Conformidade
- ✅ Doc de Regras lido (`.lovable/memory/constraints/meta-tracking-quality-strategy.md`, `purchase-event-emission-rules.md`)
- ✅ Doc formal lido (`docs/especificacoes/marketing/meta-tracking.md` v8.27.0, `docs/meta-tracking-changelog.md`)
- ✅ Fluxo identificado: emissão Pixel + CAPI ao longo do funil
- ✅ Fonte de verdade: `marketingTracker.ts` (browser) + `meta-capi-sender.ts` (server) + `storefront-html` (Edge HTML)
- ✅ Módulos impactados: storefront, checkout, edge tracking, edge sender
- ✅ Impacto cruzado: Lead → Checkout (já existia falha), nenhum impacto em outros módulos
- ✅ UI impactada? Não. mapa-ui.md não muda.
- 📌 Situação: **Aguardando confirmação do usuário**

---

## Diagnóstico medido em produção (respeite-o-homem, 48h)

```text
Evento             total  fbp   fbc   email  phone  nome   city/uf/cep
PageView            608   43%   22%    5%     5%    0%      0%
ViewCategory        202    0%   17%    5%     5%    0%      0%
ViewContent          89    1%   10%    2%     2%    0%      0%
AddToCart            26    0%    4%    0%     0%    0%      0%
InitiateCheckout     34   47%   23%    0%     0%    0%      0%
Lead                 22  100%   50%  100%   100%  100%      0%
AddShippingInfo      17  100%   47%    0%     0%    0%      0%
AddPaymentInfo       13  100%   46%    0%     0%    0%      0%
Purchase             17   76%   35%  100%   100%  100%    100%
```

Comparado às metas oficiais da doc v8.27.0 (`≥95%` em fbp e PII), só Purchase está aderente. Há **6 lacunas reais**.

## Como funciona hoje

- "Memória" do funil só existe via `_sf_am_em` e `_sf_am_ph` (email/phone hash em localStorage).
- Essa memória **só é gravada no Purchase** — depois que o pedido fechou. O usuário só ganha enriquecimento na próxima sessão.
- Edge HTML (`storefront-html`) lê `_sf_am_*` do localStorage; SPA tracker idem.
- Backend (`meta-capi-sender`) só aceita pré-hash de **email e phone**. Para nome/city/uf/cep ele exige texto plano e hasheia.
- Lead, AddShippingInfo, AddPaymentInfo passam PII no momento do disparo, mas **não a persistem** para os eventos seguintes.
- AddShippingInfo e AddPaymentInfo são chamados sem `userData` no `CheckoutStepWizard`, mesmo com `formData` cheio.
- AddToCart dispara antes do `_fbp` existir (cobertura 0%).
- Edge HTML PageView dispara antes do Pixel injetar `_fbp` (cobertura 43%).

## As 6 lacunas que explicam as quedas

1. **Lead não persiste a PII capturada** para os eventos seguintes na mesma sessão.
2. **`CheckoutStepWizard` não passa `userData` em AddShippingInfo/AddPaymentInfo**, mesmo tendo todos os dados em `formData`.
3. **Backend não aceita pré-hash para nome/cidade/UF/CEP** — só email/phone — então não dá para enriquecer eventos pré-Purchase com endereço sem reescrever o backend.
4. **Endereço (city/state/zip) nunca é persistido** para sessão seguinte.
5. **AddToCart dispara antes do `_fbp` carregar** (`waitForFbp` configurado para 3s, mas o evento sai imediatamente no clique).
6. **Edge HTML PageView dispara sem aguardar o Pixel injetar `_fbp`** (`_sfMetaReady` existe mas não é usado como gate).

## O que eu faria — plano em 5 ondas (sem regressão)

Regra anti-regressão central: **acumular, nunca substituir**. Merge sempre não-destrutivo (`payload.X ?? stored.X`). Nenhum evento perde parâmetro existente.

### Onda 1 — Estender backend para aceitar pré-hash de TODA a PII
Em `supabase/functions/_shared/meta-capi-sender.ts` (`MetaUserData` + `buildHashedUserData`), adicionar campos pré-hashed para todos os atributos de identidade, espelhando o padrão já existente de `email_hashed`/`phone_hashed`:
- `first_name_hashed`, `last_name_hashed`, `city_hashed`, `state_hashed`, `zip_hashed`, `country_hashed`

Comportamento: se `_hashed` vier preenchido, usar direto (sem re-hashear). Se vier o campo plano, usa o caminho atual. Total compatibilidade retroativa — nada que já funciona é alterado.

Em `marketing-capi-track/index.ts` (interface `TrackRequest.user_data`), aceitar e repassar esses campos novos.

> ⚠️ **Por que isso é necessário:** sem pré-hash no client, eu teria que persistir nome/endereço em texto plano em `localStorage`, o que viola privacidade e LGPD. Pré-hashar no client e passar `_hashed` ao backend é a única solução segura.

### Onda 2 — Cofre de identidade persistente no client (`_sf_identity`)
Em `src/lib/visitorIdentity.ts`, adicionar:
- `storeIdentity(partial: { email?, phone?, firstName?, lastName?, city?, state?, zip? })` — recebe valores em **texto plano**, hasheia (SHA-256, lowercase, trim) e grava em `localStorage._sf_identity`. Merge não-destrutivo (campos existentes nunca são apagados; só atualizados se o novo valor for diferente).
- `getStoredIdentity()` — retorna `{ em_hash, ph_hash, fn_hash, ln_hash, ct_hash, st_hash, zp_hash }` se existirem.
- TTL: 30 dias (mesmo padrão do `purchaseDedup`).

Compatibilidade: `_sf_am_em` e `_sf_am_ph` continuam sendo gravados em paralelo (Edge HTML inline ainda lê eles). Zero regressão no caminho do Edge.

### Onda 3 — Pontos de captura passam a alimentar o cofre
Em `src/lib/marketingTracker.ts`:
- **`trackLead`**: chamar `storeIdentity({ email, phone, firstName, lastName })` ANTES do `sendCapi`.
- **`trackAddShippingInfo`**: chamar `storeIdentity({ email, phone, firstName, lastName, city, state, zip })`.
- **`trackAddPaymentInfo`**: idem.
- **`trackPurchase`**: substituir `storeAdvancedMatchingData` por `storeIdentity(...)` completo (mantém `_sf_am_em`/`_sf_am_ph` como side-effect para compat com Edge HTML).

Resultado: a partir do momento em que o usuário entrega cada dado, **todos os eventos seguintes na mesma sessão e nos próximos 30 dias herdam aquele dado**.

### Onda 4 — Cada CAPI lê o cofre e injeta o que faltar (acumulação real)
Em `src/lib/marketingTracker.ts → sendServerEvent`, antes de montar o body:
1. Ler `getStoredIdentity()`.
2. Para cada campo do cofre, injetar no `user_data` **somente se o evento não já tiver explicitamente aquele campo** (merge não-destrutivo).
3. Mapear cofre → payload: `em_hash → email_hashed`, `ph_hash → phone_hashed`, `fn_hash → first_name_hashed`, `ln_hash → last_name_hashed`, `ct_hash → city_hashed`, `st_hash → state_hashed`, `zp_hash → zip_hashed`.

No Edge HTML (`storefront-html → _sfGetAM`):
- Expandir para ler também `_sf_identity` e mesclar todos os campos.
- Mesmo princípio: só adiciona o que não veio explicitamente.

### Onda 5 — `CheckoutStepWizard` passa `userData` que já tem
- Linha 616: `trackAddShippingInfo(shipping.selected.label)` → `trackAddShippingInfo(shipping.selected.label, { email: formData.customerEmail, phone: formData.customerPhone, name: formData.customerName, city: formData.shippingCity, state: formData.shippingState, zip: formData.shippingPostalCode })`.
- Linha 728: `trackAddPaymentInfo(paymentMethod)` → `trackAddPaymentInfo(paymentMethod, { mesmos campos })`.

Trivial — todos os campos já estão em `formData`. Sem isso, a Onda 3 não tem o que gravar nesses pontos.

### Onda 6 — Endurecer captura de `_fbp`
- **AddToCart e ViewContent (SPA)**: usar `waitForFbp(5000)` (já é o timeout máximo no código atual; AddToCart hoje cai para 3s). Como o tracking é fire-and-forget com `keepalive`, não há custo de UX.
- **Edge HTML inline (`_sfCapi`)**: aumentar poll de 12 para 20 ticks (5s).
- **Edge HTML PageView**: gate na flag `window._sfMetaReady` — disparar PageView só após Pixel injetar (já existe a flag em `loadMeta`, mas o `_sfCapi('PageView')` é chamado dentro do `loadMeta` ANTES do `_sfMetaReady=true`; trocar a ordem para Pixel injetar primeiro, esperar 1 tick, então disparar PageView).

Ganho esperado: PageView 43% → ~90%, AddToCart 0% → ~85%, ViewContent 1% → ~85%.

## Resultado final esperado

```text
Evento             fbp     PII (em+ph+fn+ln)   Endereço (ct+st+zp)
PageView           ~90%    herdado se houver    herdado se houver
ViewCategory       ~90%    herdado              herdado
ViewContent        ~90%    herdado              herdado
AddToCart          ~85%    herdado              herdado
InitiateCheckout   ~95%    herdado              herdado
Lead               100%    100%                 0% (ainda não tem)
AddShippingInfo    100%    100%                 100% ← passa a passar userData
AddPaymentInfo     100%    100%                 100% ← passa a passar userData
Purchase           ~95%    100%                 100% ← _fbp sobrevive ao redirect
```

Score Match Quality projetado: PageView 6.5 → ~9; meio de funil 4.9 → ~8.5; Purchase 9.1 → 9.5+.

## Garantias de segurança e zero-regressão

1. **Privacidade**: `localStorage._sf_identity` armazena APENAS hashes SHA-256. Texto plano nunca persiste no client.
2. **Compat retroativa do backend**: campos `_hashed` novos são opcionais. Se o cliente atual não os enviar, o caminho de PII em texto plano segue funcionando intocado.
3. **Compat do Edge HTML**: `_sf_am_em` e `_sf_am_ph` continuam gravados em paralelo; `_sfGetAM` só ganha capacidade adicional de ler `_sf_identity`. Páginas servidas por Edge antigo (cache) continuam funcionando.
4. **Merge não-destrutivo em 3 camadas**: client (sendServerEvent), Edge (`_sfCapi`), backend (`buildHashedUserData` já prefere `_hashed` antes do plano). Em nenhuma camada um valor explícito é substituído por valor herdado.
5. **Validação técnica obrigatória pós-deploy**: query no `marketing_events_log` 24h depois confirmando: (a) cobertura de email/phone em ViewContent/AddToCart subiu de 2% para ≥80%; (b) cobertura de fbp subiu para ≥85% em todos eventos; (c) nenhum evento perdeu cobertura de campo que tinha antes (especialmente `external_id`, `client_ip_address`, `client_user_agent` — devem manter 100%).
6. **Rollout**: deploy único (são alterações coordenadas; faseamento aumenta risco de inconsistência entre client e backend). Janela de monitoramento de 24h com query automática de cobertura.

## Documentação a atualizar (na mesma entrega)

- `docs/especificacoes/marketing/meta-tracking.md` → nova **Técnica 5 — Cofre de Identidade Persistente do Visitante**; tabela de cobertura mínima atualizada para refletir herança via cofre; bump v8.28.0.
- `docs/meta-tracking-changelog.md` → entrada v8.28.0 com diagnóstico (números) + lacunas + correções aplicadas.
- `.lovable/memory/constraints/meta-tracking-quality-strategy.md` → adicionar **Regra 6 — Cofre de identidade persistente** e **Regra 7 — Acumulação não-destrutiva ao longo do funil** (PII de uma etapa enriquece todas as seguintes; merge nunca sobrescreve valor explícito).
- Indexar nova memória em `mem://index.md`.

## É isso? Confirma que eu executo as 6 ondas em entrega única coordenada?

Posso fazer:
- **Opção A (recomendada):** as 6 ondas em uma entrega única + monitoramento 24h. É coerente porque as 4 primeiras dependem umas das outras (backend precisa aceitar `_hashed` ANTES do client começar a mandar; senão Meta recebe campo desconhecido).
- **Opção B (mais conservadora):** primeiro Onda 1 (backend só) e validar 24h sem ninguém usando. Depois Ondas 2–6 juntas. Adiciona 24h ao cronograma mas isola risco de schema.

Qual opção?

---

### Bloco técnico (referência)

**Arquivos impactados:**
- `supabase/functions/_shared/meta-capi-sender.ts` — `MetaUserData` ganha 6 campos `_hashed`; `buildHashedUserData` prefere `_hashed` quando presente.
- `supabase/functions/marketing-capi-track/index.ts` — `TrackRequest.user_data` aceita os 6 campos novos; passa adiante para o sender.
- `src/lib/visitorIdentity.ts` — `storeIdentity`, `getStoredIdentity`, `clearStaleIdentity`, helpers de hash SHA-256.
- `src/lib/marketingTracker.ts` — `sendServerEvent` mescla cofre; `trackLead`/`trackAddShippingInfo`/`trackAddPaymentInfo`/`trackPurchase` chamam `storeIdentity`; `waitForFbp` recebe override por evento.
- `src/components/storefront/checkout/CheckoutStepWizard.tsx` — passa `userData` em AddShippingInfo (linha ~616) e AddPaymentInfo (linha ~728).
- `supabase/functions/storefront-html/index.ts` — `_sfGetAM` lê `_sf_identity` e devolve TODOS os hashes; PageView gateado em `_sfMetaReady`; poll `_fbp` 5s.

**Anti-regressão (testes manuais pós-deploy):**
- Visitante novo: PageView dispara, sem PII (correto). Adiciona ao carrinho — AddToCart dispara com fbp ✅.
- Visitante completa Lead — todos eventos seguintes carregam email/phone/nome ✅.
- Visitante completa AddShippingInfo — todos eventos seguintes carregam endereço ✅.
- Visitante volta 3 dias depois (mesmo navegador) — PageView já sai com email/phone/nome/endereço herdados ✅.
- Pedido Pagar.me hospedado: redirect ida e volta — Purchase dispara com `_fbp` (sobreviveu via cookie first-party) e PII (sobreviveu via `_sf_identity` em localStorage) ✅.
