---
name: WMS Pratika — Trava de claim para envio combinado
description: send_combined reserva o envio com uma linha "pending" no log e índice único parcial garante 1 só por NF. Elimina race condition entre 2 gatilhos quase simultâneos (autorização da NF + criação da remessa).
type: constraint
---

# WMS Pratika — Claim Lock no envio combinado

## Problema observado (2026-06-11, pedido #616)

Os dois gatilhos reativos (autorização da NF e criação do objeto logístico)
dispararam `send_combined` em janela de ~500ms. A checagem de idempotência
existente (busca por log `combined=success` prévio) **não cobria** essa
janela: ambas as chamadas leram o estado antes da primeira ter gravado o
sucesso. Resultado: a Pratika recebeu a NF duas vezes; a segunda foi
rejeitada com sucesso silencioso e gerou 2 linhas de erro no log, apesar
do fluxo ter funcionado.

## Regra inegociável

Toda invocação de `send_combined` em `wms-pratika-send` DEVE reservar a
operação ANTES de iniciar qualquer chamada SOAP, inserindo no
`wms_pratika_logs` uma linha:

```
operation='combined', reference_id=invoice.id,
reference_type='invoice', status='pending'
```

O índice único parcial `uniq_wms_pratika_combined_inflight` em
`(tenant_id, reference_id) WHERE operation='combined' AND status IN ('pending','success')`
garante que apenas uma reserva por NF possa existir. Se o INSERT falhar
com `unique_violation` (23505), a invocação concorrente retorna 200 com
`{ success: true, already_in_progress: true }` e NÃO chama a Pratika.

Ao final do fluxo, a mesma linha é **atualizada** (não duplicada) para
`status='success'` ou `status='error'` conforme o resultado real.

## O que NUNCA pode acontecer

- Iniciar `send_combined` sem reservar a linha de claim (regressão para
  a race condition).
- Inserir uma segunda linha `combined` no final em vez de atualizar a
  linha de claim (rompe a invariante 1-pending/success por NF).
- Remover o índice único parcial sem migrar para outra trava equivalente
  (advisory lock + UNIQUE seria aceitável; nada menos forte).
- Marcar `status='success'` antes de a Pratika confirmar (a NF e o
  rastreio precisam ter sido aceitos no envelope SOAP).

## Caminhos administrativos com `force=true`

Quando `force=true` (reenvio admin via UI), a trava é **ignorada**: não
há claim e o final insere uma linha nova, conforme comportamento legado.
Isso permite reenvios manuais documentados em log sem conflito com a
linha de sucesso original.

## Implementação

- Migração: `20260611_*_wms_pratika_combined_lock.sql` cria o índice
  único parcial.
- Edge function: `supabase/functions/wms-pratika-send/index.ts` —
  bloco `if (action === 'send_combined')`:
  - Pré-check rápido por `combined=success` continua valendo (atalho).
  - Insere claim `pending`; trata 23505 como already_in_progress.
  - Em sucesso → UPDATE claim para `success`.
  - Em erro → UPDATE claim para `error` com mensagem.

## Como validar

1. Disparar dois `send_combined` paralelos para a mesma NF:
   - O primeiro processa normalmente.
   - O segundo retorna 200 + `already_in_progress=true` sem SOAP.
2. Conferir `wms_pratika_logs`: 1 linha `combined success`, 1 linha
   `nfe success`, 1 linha `tracking success`. Nenhum erro residual.
3. Forçar reenvio (`force=true`) gera linha adicional sem conflito.

## Arquivos / Referências

- `supabase/functions/wms-pratika-send/index.ts`
- `mem://features/external-apps/wms-pratika-integration`
- `mem://constraints/wms-pratika-combined-send-and-cnpj-raw`
- `mem://constraints/wms-pratika-anchored-on-fiscal-invoice`
