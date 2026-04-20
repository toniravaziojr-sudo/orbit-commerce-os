---
name: recent-topics
description: Cache rotativo dos 2 últimos assuntos tratados — atual e anterior. Toda regra técnica aqui DEVE existir também nos docs formais.
type: preference
---

# Assuntos Recentes (rotação obrigatória, máx 2)

## Slot 1 — Assunto ATUAL

**Tema:** Diagnóstico do webhook do WhatsApp Meta — evidências já confirmadas pelo usuário

**Resumo:**
- O usuário já enviou repetidas vezes prints da tela oficial de configuração do webhook no painel de developers da Meta e não deve ser solicitado novamente a reenviar a mesma evidência sem fato novo.
- Evidência visual já confirmada pelo usuário em `developers.facebook.com/.../whatsapp-business/.../wa-settings/`:
  - URL de callback configurada: `https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/meta-whatsapp-webhook`
  - Verify token preenchido na tela
  - Campo `messages` está **assinado/ativado**
  - Campo `messages` apareceu em **v24.0** no print; vários outros campos estavam em `v25.0`
- Essa evidência deve ser tratada como já conhecida durante esta linha de investigação, salvo se o usuário informar que mudou algo.
- Próximos diagnósticos não devem voltar para a etapa de pedir URL/token/messages por print, a menos que haja mudança declarada pelo usuário.

**Docs formais relacionados:**
- Lacuna documental declarada: não existe doc formal específico consolidando o estado factual confirmado por prints desta investigação; isso é apenas cache operacional do assunto atual.

---

## Slot 2 — Assunto ANTERIOR

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

## Regra de rotação

Quando um terceiro assunto entrar em pauta:
1. Auditar Slot 2 contra os docs (atualizar docs se houver lacuna).
2. Descartar Slot 2.
3. Slot 1 vira Slot 2.
4. Novo assunto entra como Slot 1.
