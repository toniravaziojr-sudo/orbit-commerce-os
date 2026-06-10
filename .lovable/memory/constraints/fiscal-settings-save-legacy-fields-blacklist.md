---
name: Fiscal Settings Save — Blacklist de campos legados
description: O serviço de salvar configurações fiscais NUNCA pode quebrar por causa de campo legado removido do schema. Lista negra obrigatória + frontend sem referência aos campos removidos. Auto-remessa não tem mais transportadora padrão — usa sempre a do pedido.
type: constraint
---

# Fiscal Settings Save — Blacklist de campos legados (rev 2026-06-10c)

## Contexto

Em 2026-05-25 as colunas `cfop_intrastadual` e `cfop_interestadual` foram
removidas do schema de `fiscal_settings` (fonte única de CFOP passou a ser
Natureza de Operação — ver
`mem://constraints/cfop-source-of-truth-natureza-operacao`). Em 2026-06-10
o conceito de "transportadora padrão" foi retirado da automação de remessa
(a transportadora vem sempre do próprio pedido / integração do canal de
venda).

Salvar a configuração fiscal estava falhando com PGRST204 mesmo o código
atual não citando esses campos, porque versões antigas do frontend (cache
do React Query, payloads completos reenviados, telas legadas) continuavam
mandando esses campos no body.

## Regra inegociável

1. `supabase/functions/fiscal-settings/index.ts` mantém uma **blacklist
   explícita** que descarta silenciosamente qualquer campo legado conhecido
   antes do `UPDATE`/`INSERT`:
   ```ts
   const LEGACY_KEYS = new Set<string>([
     'cfop_intrastadual',
     'cfop_interestadual',
     'default_shipping_provider',
   ]);
   ```
   Campos removidos no futuro DEVEM entrar nessa lista no mesmo PR que
   remove a coluna.

2. Frontend (`src/hooks/useFiscal.ts`, `src/components/fiscal/settings/*`)
   não pode declarar tipos nem defaults para campos legados. Componentes
   mortos que ainda referenciem esses campos devem ser apagados, não
   "comentados".

3. **Auto-remessa: proibido usar `default_shipping_provider` como fallback.**
   `supabase/functions/shipping-create-shipment/index.ts` resolve a
   transportadora exclusivamente pela ordem: override explícito da chamada
   → `orders.shipping_carrier` (definido pelo checkout / integração do
   canal) → fallback `'correios'`. NUNCA voltar a ler
   `fiscal_settings.default_shipping_provider`.

## O que NUNCA pode acontecer

- Salvar a configuração fiscal devolver PGRST204 / "Could not find the
  'X' column in the schema cache" — se acontecer, é falta de entrada na
  blacklist OU campo enviado pelo frontend que precisa ser removido lá.
- UI exibir "Transportadora Padrão" no bloco de Remessa Automática.
- Motor de criação de remessa usar transportadora diferente da que está
  no pedido sem override humano explícito.

## Anti-regressão

- Antes de remover qualquer coluna de `fiscal_settings`, adicionar a
  chave correspondente no `LEGACY_KEYS` no mesmo PR.
- Antes de declarar "fiscal-settings corrigido", confirmar que:
  1. Salvar configuração com toggles de auto-emissão e auto-remessa
     funciona (sem erro 500).
  2. Logs da edge function mostram "Ignoring legacy fields in payload"
     quando o body trouxer campo legado, sem falhar.
  3. Motor de remessa não tem mais leitura de `default_shipping_provider`.
