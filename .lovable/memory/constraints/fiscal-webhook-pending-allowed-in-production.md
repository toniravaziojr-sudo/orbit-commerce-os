---
name: Fiscal Webhook Pending Allowed in Production
description: Em produção, webhook_status="pending" (registrado na Focus, aguardando 1º retorno) NÃO bloqueia emissão. Exigir "validated" cria deadlock chicken-and-egg.
type: constraint
---

**Regra:** O portão de emissão fiscal em produção aceita `webhook_status IN ('validated','pending')`, desde que `webhook_environment` bata com `ambiente` e os demais pré-requisitos (focus_empresa_id, certificado válido, CNPJ match, tenant token) estejam OK.

**Por quê:** O status `pending` só é gravado APÓS sucesso no cadastro remoto na Focus NFe (via `fiscal-webhook-register`). A validação (`validated`) só acontece quando a Focus envia o primeiro callback — e a Focus só envia callback quando uma nota é emitida. Exigir `validated` antes da 1ª emissão causa deadlock permanente: produção bloqueada esperando um retorno que nunca chega porque a emissão está bloqueada.

**Onde aplicado:**
- `supabase/functions/_shared/fiscal-emission-gate.ts` — aceita pending, emite warning.
- `supabase/functions/fiscal-integration-validate/index.ts` — `overall_status='ready'` quando webhook é validated OU pending em produção.

**Proibido:**
- Reintroduzir `webhookStatus !== "validated"` como bloqueio absoluto em produção.
- Criar nova validação de webhook paralela no frontend ou em outro edge — `useFiscalReadiness` e `evaluateEmissionGate` são fontes únicas.

**Caso de origem:** Tenant "Respeite o Homem" (d1a4d0ed-...), NF #1-289, mai/2026 — webhook registrado em produção (hook_id Focus OK), status `pending`, emissão bloqueada eternamente. Ajuste aplicado em 19/mai/2026.
