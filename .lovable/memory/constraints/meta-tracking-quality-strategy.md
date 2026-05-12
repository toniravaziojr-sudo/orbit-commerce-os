---
name: meta-tracking-quality-strategy
description: Estratégia de qualidade de identificadores Meta (Pixel + CAPI). Cookies sintéticos no edge, captura de fbclid, IP/UA corretos via CF-Connecting-IP, enriquecimento cumulativo de user_data via cofre de identidade.
type: constraint
---

# Estratégia de Qualidade de Rastreamento Meta

## Regra 1 — `_fbp` sintético no edge (storefront-html)
Toda resposta de `storefront-html` que detecte ausência de `_fbp` no cookie da request DEVE setar um `_fbp` sintético no formato `fb.1.<timestamp_ms>.<random10digits>` via `Set-Cookie` (Path=/, Max-Age=7776000, SameSite=Lax, sem HttpOnly).

Resolve a race condition: CAPI dispara antes do `fbq('init')` gravar o cookie. Cobertura de `_fbp` esperada após v8.27.0: ≥95% em todos os eventos.

## Regra 2 — Captura de `fbclid` para `_fbc`
Sempre que a URL contiver `?fbclid=...`, o edge `storefront-html` DEVE construir `_fbc=fb.1.<timestamp_ms>.<fbclid>` e setá-lo via `Set-Cookie` (mesmas regras do `_fbp`). Garante atribuição de campanha desde o primeiro evento.

## Regra 3 — IP do cliente via Cloudflare
Em `marketing-capi-track`, `client_ip_address` DEVE ser extraído na ordem:
`cf-connecting-ip` → `true-client-ip` → `x-real-ip` → `x-forwarded-for[0]` → `x-envoy-external-address`. Quando o navegador reportar `client_ip_from_browser`, esse vence (resolve "Mismatched IPs" e proxies compartilhados).

## Regra 4 — `user_data` em meio de funil quando disponível
Se houver contato capturado em `checkout_sessions` ou usuário logado, eventos `ViewContent` e `AddToCart` DEVEM passar `user_data` (email/phone/name/city/state/zip) hashed SHA-256 no edge. Sem contato, comportamento atual permanece. Lead/Purchase já fazem isso por design.

## Regra 5 — Cobertura mínima de identificadores ≥95%
Toda nova feature de tracking DEVE preservar cobertura ≥95% de `_fbp`/`_fbc` nos eventos de funil (PageView, ViewContent, AddToCart, InitiateCheckout). IP é sinal complementar, nunca primário.

## Regra 6 — Cofre de identidade cumulativo (`_sf_identity`) — v8.28.0
Todo PII coletado durante a sessão (Lead → Shipping → Payment → Purchase) DEVE ser persistido em `localStorage._sf_identity` já hashado SHA-256, com TTL 30 dias, gerenciado por `src/lib/visitorIdentity.ts`. Eventos subsequentes (incluindo PageView e AddToCart de páginas posteriores) DEVEM mesclar não-destrutivamente esses hashes em `user_data` antes de despachar Pixel/CAPI (`payload.X ?? stored.X`). Backend `meta-capi-sender.ts` aceita campos pré-hashados (`first_name_hashed`, `last_name_hashed`, `city_hashed`, `state_hashed`, `zip_hashed`) — proibido enviar PII em texto puro do browser. Resultado esperado: parâmetros acumulam ao longo do funil, score de Purchase ≥ score de Lead.

## Regra 7 — PageView sincronizado com `_fbp` (Onda 6)
O snippet do edge HTML DEVE atrasar `fbq('track','PageView')` e o CAPI PageView até o `_fbp` estar disponível (polling 250ms × 20 = 5s). Garante que Pixel browser e CAPI server compartilhem o mesmo `fbp` no PageView (deduplicação correta + score consistente). Mesmo princípio aplica-se a qualquer novo evento iniciado pelo edge HTML antes do `_sfMetaReady=true`.

## Regra 8 — CAPI resiliente a navegação imediata (v8.29.0)
Eventos pré-navegação (`AddToCart`, `InitiateCheckout`) DEVEM:
1. Usar `fbp_wait_ms = 800` (em vez do default 5000) ao chamar `sendServerEvent`, evitando que a navegação cancele o `fetch`.
2. Ter `sendBeacon` como fallback no `catch` final do `doFetch` (mesmo bloco que já protegia `Purchase`).
Adicionalmente, `sendServerEvent` DEVE checar `_fbp` síncronamente no início — se já presente, dispara `fetch` imediato sem polling. Eventos sem risco de navegação imediata (PageView, ViewContent, Lead, Shipping, Payment, Purchase) mantêm `fbp_wait_ms = 5000` e fluxo atual.

## Regra 9 — Comportamentos esperados (PROIBIDO propor "correções")
Registrado em 2026-05-12. Não propor mexidas sem evidência nova:
1. **`_fbc` cobertura 30–55% nos eventos de funil** é o teto natural — apenas tráfego com `?fbclid=` (clique em anúncio Meta) gera `_fbc`. Implementação atual já é completa: edge constrói no fbclid, browser persiste cookie 90d + `localStorage` mirror. Persistir além disso causa atribuição incorreta.
2. **Aviso "IPv6 detected" no Events Manager** é informativo, não erro. Captura via `cf-connecting-ip` é o método oficial Meta. IPv6 é aceito desde 2022. Não converter sinteticamente para IPv4 (degrada matching geográfico).

## Doc formal de referência
`docs/especificacoes/marketing/meta-tracking.md` — seções "Estratégia de Cobertura de Identificadores", "Cofre de Identidade Cumulativo", "Técnica 6 — Envio resiliente a navegação imediata" e "Comportamentos esperados — NÃO são bugs".

