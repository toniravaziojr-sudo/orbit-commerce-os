---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) Profile Enrichment Policy — validação real PENDENTE (2026-05-05)

**Status macro:**
- Implementação ✅ aplicada (função `enrich_customer_from_order` + extensão do trigger `after_order_approved_sync`).
- Backfill manual do pedido #409 (Respeite o Homem) ✅ validado: cadastro do cliente populado com CPF, nascimento e endereço completo.
- **Validação real em produção PENDENTE:** aguardando entrada de um novo pedido aprovado para confirmar que o trigger dispara automaticamente fim-a-fim (sem intervenção manual).

**Combinado com o usuário:**
- Quando entrar um pedido novo aprovado, o usuário avisa.
- Lovable então valida: (a) trigger disparou, (b) `enrich_customer_from_order` rodou sem warning, (c) cadastro do cliente foi atualizado com os dados do pedido novo (pessoais campo-a-campo + endereço como bloco atômico se CEP veio), (d) e-mail intocado.

**Tenant de validação:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

**Fonte de verdade documental:**
- `docs/especificacoes/ecommerce/clientes.md` §3.1 e §4.6.1
- `docs/especificacoes/storefront/checkout.md`
- `docs/especificacoes/sistema/automacao-patterns.md` (histórico 2026-05-05)
- `mem://features/customers/profile-enrichment-policy-standard`

---

## 2) Motor Universal de Créditos — Fase 3 shadow mode youtube-upload (EM ANDAMENTO, aguardando conexão YouTube real)

**Status macro:**
- Fase 0 (documental) ✅ aprovada.
- Fase 1 (fundação) ✅ executada e validada.
- Fase 2A (motor v2) ✅ executada e validada.
- Fase 2B (catálogo + UI admin de preços/custos) ✅ executada e validada.
- Fase 3 (primeiro plug em shadow): youtube-upload **plugado em shadow mode v2**, v1 segue como única cobrança real. Aguardando 1 upload piloto + 1 upload não-piloto para iniciar janela de observação de 7 dias.

**O que já foi feito na Fase 3:**
- youtube-upload instrumentado em shadow mode: registra `service_usage_events` com `motor_version=v2`, `mode=shadow`, `pricing_model=fixed_credits`, `v1_credits`, `v2_credits_estimated`, `delta_abs`, `delta_pct`, `divergence_alert`, `idempotency_key`. v2 NÃO escreve em `credit_ledger` nem debita `credit_wallet`.
- Tenant piloto **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`) configurado em `tenant_credit_motor_config`: `motor_v2_enabled=false`, `shadow_service_keys=['platform.youtube_upload']`, `live_service_keys=[]`, `live_categories=[]`.
- Auditoria de `credit_wallet` revelou gap estrutural: **5 tenants legados sem carteira** (piloto + 4 outros), criados antes do auto-provisionamento via `start-create-basic-account`. Não existe trigger `on_tenant_created`.
- **Carteira de teste provisionada** para o piloto: `balance_credits=500`, `reserved_credits=0`, `lifetime_purchased=0`, `lifetime_consumed=0`. Linha em `credit_ledger`: `transaction_type=adjust`, `credits_delta=+500`, `metadata.not_customer_purchase=true`, `metadata.technical_test_balance=true`, `reason=phase_3_shadow_validation` (NÃO é receita).
- Validações READ-ONLY OK: snapshot pré-upload limpo (0 eventos shadow), config motor intacta, RLS em `service_pricing` confirmado (tenant não lê `cost_usd`/markup/margin).

**Onde paramos exatamente (bloqueio atual):**
- Query de tenants com YouTube conectado retornou **0** em produção. Nenhum upload pode ser executado ainda.
- Recomendação atual: **NO-GO** para iniciar janela de 7 dias até existir 1 upload piloto + 1 upload não-piloto validados.

**Restrições ativas (NÃO violar ao retomar):**
- Não ativar live (`motor_v2_enabled` segue `false`).
- Não fazer cutover.
- Não plugar outras funções pagas em shadow ainda.
- Não criar trigger `on_tenant_created` nem fazer backfill de wallet dos 4 tenants legados restantes nesta fase.

**Docs fonte de verdade:**
- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`
