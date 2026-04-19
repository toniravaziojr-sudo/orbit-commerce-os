---
name: recent-topics
description: Cache rotativo dos 2 últimos assuntos tratados — atual e anterior. Toda regra técnica aqui DEVE existir também nos docs formais.
type: preference
---

# Assuntos Recentes (rotação obrigatória, máx 2)

## Slot 1 — Assunto ATUAL

**Tema:** Estabilização completa do rastreamento Meta (Pixel + CAPI) v8.27.0

**Resumo:**
- 4 frentes implementadas: (A) persistência 30d do dedup do Purchase via `localStorage` em `src/lib/purchaseDedup.ts`; (B) `event_id` determinístico normalizado `purchase_<mode>_<order_normalizado>` byte-a-byte idêntico em browser e server; (C/E1+E2) cookies sintéticos `_fbp`/`_fbc` no edge `storefront-html` (v8.27.0) via `Set-Cookie`, resolvendo race condition `fbq('init')` vs CAPI; (E3) enriquecimento de `ViewContent`/`AddToCart` com `email_hashed`/`phone_hashed` do `localStorage` (PII capturada em Lead/Purchase anteriores).
- **Bug crítico corrigido**: código anterior passava hash em campo `email` cru, backend re-hasheava (hash de hash → match quebrado). Solução: novos campos `email_hashed`/`phone_hashed` passados sem re-hash.
- Validação técnica: `X-Storefront-Version: v8.27.0` ativo, `Set-Cookie: _fbp=fb.1.<ts>.<rnd>` confirmado em response real, banco mostra `event_id` normalizado (`purchase_created_305`), edge `marketing-capi-track` deployada, IP via `cf-connecting-ip` em 100%.
- Soberania do tenant `respeite-o-homem` preservada: `purchaseEventTiming = all_orders` mantido (decisão de negócio).

**Docs formais relacionados:**
- `docs/especificacoes/marketing/meta-tracking.md` — doc Layer 3 oficial criado (regras de emissão Purchase, estratégia de cobertura ≥95%, tabela inflação aparente vs real, cobertura mínima por evento)
- `docs/meta-tracking-changelog.md` — Registro #3 (19/abr/2026 — v8.27.0) adicionado
- `docs/especificacoes/storefront/pagina-obrigado.md` — seção "Disparo do Evento Purchase" adicionada
- `.lovable/memory/constraints/purchase-event-emission-rules.md` — 4 regras anti-regressão (persistência 30d, event_id normalizado, soberania do tenant, leitura correta de inflação)
- `.lovable/memory/constraints/meta-tracking-quality-strategy.md` — 5 regras de qualidade (`_fbp` sintético, `fbclid` capture, IP via Cloudflare, `user_data` em meio de funil, cobertura mínima ≥95%)

---

## Slot 2 — Assunto ANTERIOR

**Tema:** Consolidação do fluxo de checkout/funil + leitura correta da métrica carrinho×checkout

**Resumo:**
- Investigação de "queda aparente de margem carrinho×checkout" e 3 erros do Pixel concluiu: refator de 18/abr (CheckoutStepWizard com lazy loading + prefetch) **não quebrou nada**.
- Validação técnica via banco: 27 sessões `converted` com pedido vinculado em 7 dias; 87% dos pedidos com sessão associada; 9 eventos do funil disparando.
- "Bug das 0 sessões completed" não existe — leitura errada da métrica: o universo correto exclui sessões sem `contact_captured_at`.
- Queda real de 19/abr começa no topo do funil (-22% PageView), provável sazonalidade de Páscoa + mudanças de campanhas Meta.
- 3 erros do Pixel (Shared IPs, IPv6, Mismatched IPs) tratados no Slot 1 atual (v8.27.0).

**Docs formais relacionados:**
- `docs/especificacoes/storefront/checkout.md` §19 — atualizado
- `.lovable/memory/constraints/checkout-session-funnel-metric-reading.md`

---

## Regra de rotação

Quando um terceiro assunto entrar em pauta:
1. Auditar Slot 2 contra os docs (atualizar docs se houver lacuna).
2. Descartar Slot 2.
3. Slot 1 vira Slot 2.
4. Novo assunto entra como Slot 1.
