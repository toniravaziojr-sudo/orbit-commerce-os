---
name: Fiscal Retry Ref Must Be Unique
description: Reenvio de NF-e rejeitada ao Focus NFe DEVE gerar novo ref; provedor deduplica por ref e devolve resposta em cache sem reenviar à SEFAZ.
type: constraint
---

# Reenvio de NF-e rejeitada exige ref novo

## Regra
Focus NFe deduplica requisições de autorização por `ref`. Um POST com ref já visto retorna o resultado em cache (`HTTP 200` com a resposta antiga), SEM reenviar a NF-e à SEFAZ.

Toda função que reenvia NF-e (`fiscal-submit`, `fiscal-emit`, e qualquer futura função de retry) DEVE:
- Detectar retry: `invoice.status === 'rejected' && invoice.focus_ref` presente.
- Gerar ref novo via `generateNFeRef(invoiceId, 'retry')` — sufixo `_R<epoch36>`.
- Persistir o novo `focus_ref` na invoice (já feito no fluxo normal de update).

Primeira emissão continua usando o ref base `NFE_<idsemhifen>` (sem sufixo), para preservar idempotência da primeira tentativa.

## Por quê
- Sem ref novo, o usuário corrige a causa da rejeição (regime tributário, CNPJ do certificado, dados do destinatário), clica "Reenviar para SEFAZ", e o Focus devolve a rejeição antiga em ~2s. A SEFAZ nunca é consultada de novo.
- Causa concreta observada: NF 1-289 da loja "Respeite o Homem" ficou presa em rejeição por divergência de regime mesmo após o cadastro ter sido corrigido para MEI, porque todas as tentativas usavam o mesmo ref.

## Como aplicar
- Não inverter: ref base (sem sufixo) NUNCA deve ser usado em retry de rejeitada — só na 1ª emissão.
- Webhook (`fiscal-webhook`) casa por `focus_ref` da invoice, então atualizar esse campo no momento do submit é suficiente para manter o pareamento.
- Limite de 60 caracteres do Focus NFe é respeitado pelo helper (`substring(0, 60)`).
- Ao adicionar nova função de emissão, reutilizar `generateNFeRef(id, 'retry')` — não inventar geração local.

## Pontos de uso
- `supabase/functions/_shared/focus-nfe-adapter.ts` — `generateNFeRef(invoiceId, attempt)`
- `supabase/functions/fiscal-submit/index.ts` — detecta retry e gera ref novo
- `supabase/functions/fiscal-emit/index.ts` — idem
- `supabase/functions/fiscal-webhook/index.ts` — lookup por `focus_ref`
