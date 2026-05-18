---
name: Fiscal IBGE Resolution by CEP (Primary Source)
description: Código IBGE do município do destinatário em fiscal_invoices é resolvido a partir do CEP (ViaCEP/BrasilAPI com cache em cep_cache), nunca por nome de cidade como fonte primária. Tabela interna ibge_municipios é fallback de última camada. UF do CEP é cross-validada contra UF do pedido e divergência gera pendência bloqueante.
type: constraint
---

**Regra:**
1. Em qualquer ponto que precise resolver IBGE do destinatário (auto-create, create-draft manual, create-manual avulsa, prepare-invoice), usar `resolveAddressByCep(supabase, cep)` de `supabase/functions/_shared/cep-lookup.ts` PRIMEIRO. Só usar lookup por nome se o CEP não retornar.
2. `fiscal-prepare-invoice` deve auto-recuperar o IBGE pelo CEP quando o registro estiver sem IBGE válido — pedidos antigos saem de pendência sozinhos no próximo reprocesso.
3. Quando o CEP é resolvido, comparar `UF do CEP` com `dest_endereco_uf` (normalizadas). Se divergente, gerar pendência: *"Endereço incompatível com o CEP: o CEP pertence a {UF_cep}, mas o pedido informa {UF_pedido}. Confirme cidade e estado com o cliente antes de despachar."*
4. Divergência apenas de grafia de cidade NÃO gera pendência — CEP é a fonte de verdade da cidade.
5. Tabela `cep_cache` é compartilhada entre tenants (CEP é dado público). RLS bloqueia anon/authenticated; uso apenas via service_role nas edge functions.

**Por quê:** a tabela interna `ibge_municipios` tinha apenas 123 de 5.570 municípios brasileiros. Resolver por nome falhava silenciosamente para a maioria dos pedidos, mesmo com grafia correta (Esmeraldas/MG, Cananéia/SP, Aracruz/ES, etc.), travando emissão fiscal em ~50% dos pedidos do tenant Respeite o Homem.

**Aplicação:**
- Qualquer nova edge function que monte `fiscal_invoices.dest_endereco_municipio_codigo` DEVE usar `resolveAddressByCep` primeiro.
- Mudanças no esquema de endereço de `orders` ou `fiscal_invoices` devem preservar `dest_endereco_cep` (8 dígitos sanitizados) como entrada principal.
- Atualizações na tabela `ibge_municipios` não dispensam o CEP-first; a tabela é fallback de última camada.

**Incidente raiz:** 2026-05-18c. Backfill `fiscal-backfill-ibge` resolveu 115 de 219 pedidos pendentes no tenant Respeite o Homem.

**Documentado em:** `docs/especificacoes/erp/erp-fiscal.md` (seção "Resolução de IBGE do Município por CEP — Hotfix Universal").
