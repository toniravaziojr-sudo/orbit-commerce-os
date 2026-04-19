---
name: meta-tracking-quality-strategy
description: Estratégia de qualidade de identificadores Meta (Pixel + CAPI). Cookies sintéticos no edge, captura de fbclid, IP/UA corretos via CF-Connecting-IP, enriquecimento de user_data quando contato existir.
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

## Doc formal de referência
`docs/especificacoes/marketing/meta-tracking.md` — seção "Estratégia de Cobertura de Identificadores".
