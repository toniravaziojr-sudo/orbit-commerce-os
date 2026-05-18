---
name: Fiscal IBGE Resolution by CEP (Primary Source)
description: Código IBGE e nome oficial do município do destinatário em fiscal_invoices são resolvidos a partir do CEP (ViaCEP/BrasilAPI com cache em cep_cache). Divergência de UF entre CEP e endereço do pedido é AVISO (pendencia_avisos), não bloqueio — SEFAZ é juiz final. Tabela interna ibge_municipios é fallback de última camada.
type: constraint
---

**Regra:**
1. Em qualquer ponto que precise resolver IBGE do destinatário (auto-create, create-draft manual, create-manual avulsa, prepare-invoice), usar `resolveAddressByCep(supabase, cep)` de `supabase/functions/_shared/cep-lookup.ts` PRIMEIRO. Só usar lookup por nome se o CEP não retornar.
2. **Quando o CEP resolve, sobrescrever também `dest_endereco_municipio` com `cepResolved.cidade`.** A SEFAZ valida `xMun` (nome) contra `cMun` (IBGE) na tabela oficial — typo do cliente ("São Franciaco do Sul", "Pofto Alegre", "São Paulo capital", espaço duplo) derruba a NF mesmo com IBGE correto. UF só é sobrescrita quando bate com a do pedido; divergência de UF gera pendência (regra 4).
3. `fiscal-prepare-invoice` deve auto-recuperar IBGE+nome pelo CEP quando o registro estiver desatualizado — pedidos antigos saem de pendência sozinhos no próximo reprocesso.
4. Quando o CEP é resolvido, comparar `UF do CEP` com `dest_endereco_uf` (normalizadas). Se divergente, gravar mensagem em **`pendencia_avisos`** (aviso amarelo informativo), nunca em `pendencia_motivos`. UF mismatch **NÃO bloqueia** criação de NF — quem rejeita é a SEFAZ na emissão. Mensagem padrão: *"Endereço incompatível com o CEP: o CEP pertence a {UF_cep}, mas o pedido informa {UF_pedido}. Confirme cidade e estado com o cliente antes de despachar."*
5. Backfill `fiscal-backfill-ibge` deve: (a) limpar pendências fantasmas obsoletas (`"Cidade do cliente não localizada..."` e `"Não foi possível identificar o município..."`) e (b) migrar mensagens antigas de UF mismatch de `pendencia_motivos` para `pendencia_avisos`.
6. Tabela `cep_cache` é compartilhada entre tenants (CEP é dado público). RLS bloqueia anon/authenticated; uso apenas via service_role nas edge functions.

**Por quê:** a tabela interna `ibge_municipios` tinha apenas 123 de 5.570 municípios brasileiros. Resolver por nome falhava silenciosamente para a maioria dos pedidos, mesmo com grafia correta, travando emissão fiscal em ~50% dos pedidos do tenant Respeite o Homem. Mesmo com IBGE resolvido, nome divergente continuava sendo causa de rejeição da SEFAZ.

**Aplicação:**
- Qualquer nova edge function que monte `fiscal_invoices.dest_endereco_municipio_codigo` DEVE usar `resolveAddressByCep` primeiro E persistir `cepResolved.cidade` em `dest_endereco_municipio`.
- Mudanças no esquema de endereço de `orders` ou `fiscal_invoices` devem preservar `dest_endereco_cep` (8 dígitos sanitizados) como entrada principal.
- Atualizações na tabela `ibge_municipios` não dispensam o CEP-first.

**Incidentes raiz:** 2026-05-18c (IBGE por CEP, 115/219 resolvidos) e 2026-05-18d (nome oficial + limpeza de pendência fantasma, 7 limpas + 4 nomes corrigidos no Respeite o Homem; restaram 4 pendências legítimas).

**Documentado em:** `docs/especificacoes/erp/erp-fiscal.md` (seções "Resolução de IBGE do Município por CEP — Hotfix Universal" e "Hotfix 2026-05-18d").

