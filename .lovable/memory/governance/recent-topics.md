---
name: recent-topics
description: Cache rotativo dos 2 últimos assuntos tratados — atual e anterior. Toda regra técnica aqui DEVE existir também nos docs formais.
type: preference
---

# Assuntos Recentes (rotação obrigatória, máx 2)

## Slot 1 — Assunto ATUAL

**Tema:** Consolidação do fluxo de checkout/funil + leitura correta da métrica carrinho×checkout

**Resumo:**
- Investigação de "queda aparente de margem carrinho×checkout" e 3 erros do Pixel concluiu: refator de 18/abr (CheckoutStepWizard com lazy loading + prefetch) **não quebrou nada**.
- Validação técnica via banco: 27 sessões `converted` com pedido vinculado em 7 dias; 87% dos pedidos com sessão associada; 9 eventos do funil disparando (PageView, ViewCategory, ViewContent, AddToCart, InitiateCheckout, Lead, AddShippingInfo, AddPaymentInfo, Purchase).
- "Bug das 0 sessões completed" não existe — é leitura errada da métrica: o universo correto exclui sessões sem `contact_captured_at` (45 vs. 16 com contato em 7 dias).
- Queda real de 19/abr começa no topo do funil (-22% PageView), provável sazonalidade de Páscoa (sábado de Aleluia) + possível mudança de campanhas Meta.
- 3 erros do Pixel (Shared IPs, IPv6, Mismatched IPs) são antigos (desde 03/abr) e não bloqueiam vendas — adiados para 2º loop com coleta real de amostras.

**Docs formais relacionados:**
- `docs/especificacoes/storefront/checkout.md` §19 — atualizado com seção "Checkout Session — Ciclo de Vida e Métrica de Funil" (estados oficiais, regra de contato, fórmula do universo, caminhos de `completeCheckoutSession`, bug semântico vs. código).
- `.lovable/memory/constraints/checkout-session-funnel-metric-reading.md` — memória anti-regressão criada com as 5 regras de leitura.
- `docs/meta-tracking-changelog.md` — registro histórico dos 3 erros do Pixel (sem nova entrada por enquanto, próximo loop).

---

## Slot 2 — Assunto ANTERIOR

**Tema:** Reorganização da política de memória da IA + auditoria contra docs

**Resumo:**
- Memória passou a aceitar apenas governança + cache rotativo dos 2 últimos assuntos.
- Toda regra técnica na memória precisa estar também nos docs formais (Layer 2/3/4).
- Auditoria executada: a regra técnica do Worker `shops-router` (sanitização de `Set-Cookie`/`Vary`/`Pragma` antes do cache, HTML <2KB = bypass, anti-stale via `metadata.storefront_html_version`) foi migrada para os docs antes de a memória técnica ser removida.
- Knowledge atualizado com a seção "POLÍTICA DA MEMÓRIA OPERACIONAL DA IA".

**Docs formais relacionados:**
- `docs/especificacoes/transversais/padroes-operacionais.md` §7 (Padrão Cache Edge no Worker — atualizado com sanitização de headers e validação MISS→HIT)
- `docs/tecnico/base-de-conhecimento-tecnico.md` §9.1 (anti-stale automático via `VERSION` bump)
- `.lovable/memory/governance/memory-protection-rules.md` (nova política)

---

## Regra de rotação

Quando um terceiro assunto entrar em pauta:
1. Auditar Slot 2 contra os docs (atualizar docs se houver lacuna).
2. Descartar Slot 2.
3. Slot 1 vira Slot 2.
4. Novo assunto entra como Slot 1.
