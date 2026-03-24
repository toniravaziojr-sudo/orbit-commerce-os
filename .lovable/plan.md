

# Analise Meta Pixel/CAPI — Problemas Identificados nos Prints

## Resumo dos Achados

Analisando os prints e o codigo, identifiquei **5 problemas corrigiveis** e **1 limitacao estrutural**.

---

## PROBLEMA 1 (CRITICO): Purchase server-side sem IP e User-Agent (25% cobertura)

**Print**: Purchase mostra IP 25%, UA 25%, fbp 25%, external_id 25%

**Causa**: O `process-events` envia Purchase CAPI via `sendCapiPurchase` para pedidos `paid_only`, mas **nao inclui** `client_ip_address`, `client_user_agent`, `fbp`, `fbc` nem `external_id`. Esses dados nao sao armazenados em nenhum lugar acessivel pelo server-side.

Os 25% com IP/UA sao os Purchase enviados pelo browser (via `sendServerEvent` no `marketingTracker.ts`), onde o edge function extrai IP dos headers HTTP.

**Correcao**: Salvar `client_ip`, `client_user_agent`, `fbp`, `fbc` e `visitor_id` na `checkout_sessions` no momento do checkout (browser-side), e ler esses dados no `process-events` quando disparar Purchase CAPI server-side.

---

## PROBLEMA 2 (ALTO): ViewContent e AddToCart com fbp e external_id quase zero

**Print**: ViewContent fbp 0.95%, external_id 17.14%. AddToCart fbp 6.12%, external_id 22.45%.

**Causa**: O tracker usa inicializacao deferida (`requestIdleCallback` / `setTimeout 2s`). Quando `trackViewContent` dispara, o `sendServerEvent` chama `getMetaIdentifiers()` que le o cookie `_fbp`. Mas o `_fbp` e criado pelo script Meta Pixel que **tambem carrega deferido**. Resultado: no momento do CAPI call, o cookie `_fbp` ainda nao existe.

O `external_id` (`_sf_vid`) tambem tem baixa cobertura porque `getOrCreateVisitorId()` so e chamado dentro de `initialize()` do tracker, que tambem e deferido.

**Correcao**: 
- Criar o `_sf_vid` ANTES da inicializacao deferida (no MarketingTrackerProvider, sincrono)
- Para `_fbp`: aguardar brevemente ou verificar antes de cada CAPI call se o cookie ja existe (o Pixel leva ~1-2s para criar)

---

## PROBLEMA 3 (ALTO): IP compartilhado entre usuarios (57% dos PageView)

**Print**: "Enderecos IP de clientes estao associados a varios usuarios — 57% dos eventos afetados"

**Causa**: A edge function `marketing-capi-track` extrai IP dos headers. Os headers mais confiaveis (`cf-connecting-ip`) podem nao estar presentes em todos os ambientes. Se cair no `x-forwarded-for`, pode pegar o IP do load balancer/proxy ao inves do cliente real. Em ambientes sem Cloudflare na frente, o IP pode ser o do proprio Supabase edge runtime.

**Correcao**: Enviar o IP real do cliente como parametro no body do request (browser sabe o IP via `RTCPeerConnection` ou simplesmente usar um servico de IP lookup), OU aceitar que esta e uma limitacao da arquitetura de edge functions onde nem sempre temos o IP real do visitante. A melhor alternativa e garantir que os outros parametros de identidade (fbp, fbc, external_id) estejam sempre presentes para compensar.

---

## PROBLEMA 4 (MEDIO): IP do Pixel nao bate com IP do CAPI (50% dos PageView)

**Print**: "Envie enderecos IP que correspondam aos enderecos IP do Pixel"

**Causa**: Relacionado ao Problema 3. O Pixel (browser) envia o IP real do usuario. A CAPI (edge function) envia o IP que chega nos headers do Supabase, que pode ser diferente (proxy/CDN). Isso causa mismatch.

**Correcao**: Mesma do Problema 3 — melhorar identidade para que a Meta nao dependa tanto de IP para match.

---

## PROBLEMA 5 (MEDIO): ViewContent/InitiateCheckout com baixa cobertura de Email/Phone

**Print**: ViewContent email 0.95%, phone 0.95%. InitiateCheckout nao mostra email/phone.

**Causa**: Esses eventos sao pre-checkout — o usuario ainda nao forneceu email/phone. Isso e esperado e nao e um bug. Porem, o sistema ja tem `_sf_am_em` e `_sf_am_ph` no localStorage (de checkouts anteriores do mesmo visitante). O `sendServerEvent` ja inclui esses dados stored, mas a cobertura e baixa porque poucos visitantes ja fizeram checkout antes.

**Correcao**: Nao ha muito a fazer para visitantes novos. Para visitantes recorrentes, o sistema ja envia. Isso e comportamento normal.

---

## PROBLEMA 6 (BAIXO): "Baixa taxa de cobertura CAPI para ViewContent"

**Print**: Diagnostico principal

**Causa**: Consequencia dos Problemas 2 e 5. Com fbp/external_id faltando, a Meta nao consegue deduplicar os eventos CAPI com os do Pixel, resultando em "baixa cobertura" mesmo que os eventos estejam chegando.

**Correcao**: Resolver Problema 2 resolve este automaticamente.

---

## Plano de Correcao (4 itens acionaveis)

### 1. Criar `_sf_vid` sincronamente (antes do defer)
- Em `MarketingTrackerProvider`, chamar `getOrCreateVisitorId()` fora do `useEffect` deferido
- Garante que external_id esta disponivel para qualquer CAPI call

### 2. Adicionar retry de `_fbp` no `sendServerEvent`
- Antes de enviar CAPI, verificar se `_fbp` ja existe
- Se nao, agendar micro-delay (500ms) e tentar novamente
- Para ViewContent/AddToCart que disparam logo apos page load

### 3. Salvar identidade do cliente na `checkout_sessions`
- Migration: adicionar colunas `client_ip`, `client_user_agent`, `visitor_id`, `fbp`, `fbc` na tabela `checkout_sessions`
- No momento do checkout (browser), salvar esses dados via `checkout-session-complete` ou update da session
- No `process-events`, ler esses dados e incluir no `sendCapiPurchase`

### 4. Garantir forwarding de IP na edge function
- Revisar cadeia de headers no `marketing-capi-track`
- Adicionar log diagnostico permanente para monitorar qual header fornece o IP

---

## O que NAO precisa de correcao

- **Lead 9.3/10** — esta excelente, sem acao necessaria
- **Purchase server-side funcionando** — os prints mostram Servidor: 1-2 eventos, confirmando que o fix v8.20.0 da constraint do events_inbox resolveu o problema anterior
- **Email/Phone no Purchase 100%** — perfeito, o PII do checkout esta sendo enviado corretamente

---

## Impacto Esperado

| Evento | Score Atual | Esperado apos fix |
|--------|-------------|-------------------|
| PageView | 5.1 | 6-7 (IP limitado por arquitetura) |
| ViewContent | 3.8 | 6-7 |
| AddToCart | 4.9 | 6-7 |
| InitiateCheckout | 5.1 | 6-7 |
| Purchase | 6.1 | 8-9 |

