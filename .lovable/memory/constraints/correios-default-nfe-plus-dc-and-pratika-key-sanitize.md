---
name: Correios default NF+DC juntas · Pratika exige chave de 44 dígitos · SOAP success real
description: Default de despacho local Correios passa a ser NF+DC juntas quando há NF autorizada (resolve PPN-347). Envio à Pratika sanitiza chave para 44 dígitos numéricos (sem prefixo "NFe"). Sucesso da Pratika exige HTTP 2xx + <Sucesso>true</Sucesso> no envelope SOAP — nunca só HTTP 200.
type: constraint
---

# Correios "NF + DC" default · Pratika chave 44 dígitos · SOAP success real

Três regras complementares descobertas no teste E2E real de 2026-06-05
(duplicação do pedido #581 do tenant Respeite o Homem).

## 1. Default Correios: NF + DC juntas quando há NF autorizada

`shipping-create-shipment` (Correios) decide o documento fiscal vinculado
à pré-postagem assim:

- `preferred_doc` explícito (request body OU `shipment.metadata.preferred_doc`):
  `'nfe' | 'dc' | 'both'` — sempre respeitado.
- **Default sem hint:** se há NF autorizada → `'both'` (NF estruturada +
  observação de DC + `itensDeclaracaoConteudo[]`). Sem NF → `'dc'`.

Motivo: contratos PAC comerciais dos Correios rejeitam pré-postagem só com
chave de NF e exigem DC junto (PPN-347 "Para envio de produtos é necessário
incluir Declaração de Conteúdo"). DC é gratuita, sempre aceita e não atrapalha
contratos que aceitam só NF. Mandar as duas é o único default seguro.

Lojistas cujo contrato aceita apenas a chave da NF podem forçar `'nfe'`
puro via `preferred_doc`.

## 2. Pratika exige chave de acesso com 44 dígitos numéricos

`wms_pratika.AtualizarCodRastreioNfe` aceita `chaveAcesso` **somente** com
os 44 dígitos numéricos da chave. Persistimos a chave em formato canônico
`NFe<44 dígitos>` (47 chars). Antes de enviar à Pratika é obrigatório:

```ts
const chaveLimpa = String(invoice.chave_acesso || '').replace(/\D/g, '');
```

Sem strip, o WMS devolve `<Sucesso>false</Sucesso>` silenciosamente e o
rastreio nunca é vinculado à NF dentro do portal Pratika.

## 3. Sucesso da Pratika exige <Sucesso>true</Sucesso>, nunca só HTTP 200

O contrato SOAP da Pratika devolve HTTP 200 mesmo em rejeição de negócio.
O status real está em `<Sucesso>true|false</Sucesso>` + `<Mensagem>`
dentro do envelope SOAP. `wms-pratika-send` DEVE:

1. Ler o envelope com `parsePratikaSoapResult(body)`.
2. Só marcar `success: true` quando `httpOk && soapResult.ok`.
3. Persistir `soapResult.message` em `wms_pratika_logs.error_message` quando falhar.
4. Detectar também `<Fault><faultstring>` (erros de schema/serializer).

Sem essa leitura, qualquer rejeição vira sucesso fantasma nos logs e quebra
o princípio de rastreabilidade.

## O que NUNCA pode acontecer

- Default do Correios voltar a `'nfe'` puro — regrediria PPN-347 em contratos
  PAC comerciais.
- Enviar `chave_acesso` à Pratika sem strip dos não-numéricos — rastreio
  some silenciosamente.
- `wms-pratika-send` marcar sucesso só por HTTP 200 — esconde rejeição
  real e impede reconciliação.
- Remover o gate de `auto_send_label=false` — lojistas que não usam Pratika
  para rastreio não podem ser forçados.

## Arquivos

- `supabase/functions/shipping-create-shipment/index.ts` — bloco "Escolha do
  documento fiscal pelo lojista" (default = `'both'` quando há NF).
- `supabase/functions/wms-pratika-send/index.ts` —
  `parsePratikaSoapResult()`, `sendSoap()` (success real),
  bloco `update_tracking` (sanitização da chave).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Emissão = despachado…"
  e `docs/tecnico/base-de-conhecimento-tecnico.md` §Pratika SOAP.
- Memórias relacionadas:
  - `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
  - `mem://features/external-apps/wms-pratika-integration`
