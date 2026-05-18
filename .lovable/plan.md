## Diagnóstico

**Por que metade dos pedidos falha:** o sistema hoje resolve o código IBGE comparando o nome da cidade digitada com uma tabela interna `ibge_municipios`. Essa tabela tem apenas **123 municípios cadastrados** (o Brasil tem 5.570). Resultado: mesmo cidades grafadas corretamente (Esmeraldas/MG, Cananéia/SP, Aracruz/ES, Mucuri/BA, Pontes e Lacerda/MT, etc.) não são encontradas e o pedido fica pendente.

A maior parte dos casos **não é erro do cliente** — é base interna incompleta.

## O que vou fazer

### 1. Resolver IBGE a partir do CEP (fonte oficial)
O CEP é a chave canônica do endereço. Vou usar a base oficial dos Correios (ViaCEP) que devolve, junto com o endereço, o **código IBGE da cidade** já pronto. Não dependeremos mais de digitação manual nem da tabela interna defasada.

Hierarquia de resolução:
1. **Cache local de CEPs** (consultado primeiro, sem custo nem latência)
2. **ViaCEP** (oficial dos Correios, gratuito) — grava no cache
3. **BrasilAPI** (fallback se ViaCEP estiver fora do ar)
4. **Tabela interna** (último recurso, mantida só para emergência)

### 2. Cross-validação leve (proteção contra envio para endereço errado)
Quando o CEP é resolvido com sucesso, comparo a cidade/UF que veio do CEP com a cidade/UF que o cliente digitou (normalizando acentos, espaços e maiúsculas). Se a UF estiver diferente, gero pendência explícita ("CEP de SP, mas cliente informou RJ — confirme antes de despachar"). Diferença só de grafia da cidade **não** gera pendência (já corrigimos via CEP).

### 3. Backfill dos pedidos já pendentes
Vou rodar uma única vez a re-resolução em todos os pedidos pendentes por esse motivo (no respeite-o-homem e nos demais tenants). Os que voltarem com IBGE válido saem de pendência automaticamente.

### 4. Aplicar no fluxo inteiro
A nova resolução por CEP entra nos 4 pontos que hoje usam o lookup por nome: criação automática de rascunho fiscal, criação manual, criação via wizard e validação no `prepare-invoice`.

### 5. Tabela de cache de CEP
Nova tabela leve `cep_cache` (cep, logradouro, bairro, cidade, uf, ibge, fetched_at). Compartilhada entre todos os tenants (CEP é público). Reduz chamadas externas e dá resiliência se ViaCEP cair.

## Resultado esperado

- Pedidos novos: IBGE resolvido automaticamente em ~99% dos casos, sem intervenção do lojista.
- Pedidos antigos pendentes: a grande maioria deve sair de pendência após o backfill.
- Casos remanescentes (CEP realmente inválido ou divergência UF): pendência clara apontando o problema real.
- Sem mudança de UI ou de fluxo de negócio — o lojista continua não precisando ver/digitar IBGE.

## Detalhes técnicos (referência interna)

- Nova migration: cria `public.cep_cache` (PK = cep 8 dígitos), index by fetched_at, RLS off (dados públicos), grant read/insert via service role.
- Novo módulo `supabase/functions/_shared/cep-lookup.ts`: função `resolveAddressByCep(cep)` com cache+ViaCEP+BrasilAPI, timeout 3s por provider, retorna `{ibge, cidade, uf, logradouro, bairro}` ou null.
- Refator em `fiscal-auto-create-drafts`, `fiscal-create-draft`, `fiscal-create-manual`, `fiscal-prepare-invoice`: chamar `resolveAddressByCep` primeiro; fallback para `getIbgeCodigo` por nome só se CEP não resolver.
- Cross-validação UF: comparação após normalize; pendência específica "CEP pertence a {UF_cep}, mas pedido informou {UF_digitada}".
- Backfill: edge function one-shot `fiscal-backfill-ibge` (ou bloco SQL via reprocesso do `fiscal-prepare-invoice` em loop) — executar manualmente uma vez.
- Atualizar `docs/especificacoes/erp/erp-fiscal.md` com hotfix 2026-05-18c e ajustar memória `fiscal-ibge-destinatario-obrigatorio.md` (CEP é fonte primária de IBGE).

Confirma que sigo?
