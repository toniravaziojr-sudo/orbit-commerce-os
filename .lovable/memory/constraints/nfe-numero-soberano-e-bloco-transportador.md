---
name: NF-e — numeração soberana e bloco transportador obrigatórios
description: Toda emissão de NF-e via Focus passa `numero`/`serie` explicitamente e inclui bloco transportador (razão social + serviço + volumes + valor frete + modalidade) resolvido por catálogo embutido. PV e NF têm numerações independentes; vínculo é sempre por source_order_invoice_id.
type: constraint
---

# NF-e — Numeração soberana e bloco transportador

## Regra inegociável (2026-06-09)

### 1. Numeração soberana
- `fiscal-emit` e `fiscal-submit` **sempre** enviam `numero` e `serie`
  explícitos no payload Focus NFe (`buildNFePayload` aceita os campos no
  primeiro argumento). O número que o lojista vê no sistema é o mesmo
  que a SEFAZ autoriza e o mesmo que chega na Pratika.
- Em rejeição por duplicidade de número (cStat 539/204, ou mensagem
  textual de "número já utilizado/inutilizado/cadastrado"), o motor
  incrementa `numero += 1`, gera novo `ref`, atualiza
  `fiscal_settings.numero_nfe_atual` (monotônico via `lt`), e tenta
  novamente. Cap de 20 tentativas.
- **Caminho B oficial**: nunca tentamos manter a sequência interna
  artificialmente. O cursor se realinha sozinho com a SEFAZ no primeiro
  ciclo de retry. Tenants novos começam do 1.
- PV (`fiscal_stage='pedido_venda'`) e NF (`fiscal_stage IN ('nf','emitida')`)
  têm sequências independentes. Numerações divergem por design (duplicar
  PV/NF avança apenas seu próprio cursor). **Vínculo canônico é por
  `source_order_invoice_id`, nunca por igualdade de números.**
- A função `isDuplicateNumberError(errorText, responseData)` em
  `focus-nfe-adapter.ts` é a fonte única de detecção de duplicidade.

### 2. Bloco transportador
- `buildNFePayload` aceita parâmetro `transporte` que popula os campos
  oficiais da Focus NFe (sufixo `_transportador`, conforme
  campos.focusnfe.com.br/nfe/NotaFiscalXML.html):
  `nome_transportador`, `cnpj_transportador` (14 dígitos) **ou**
  `cpf_transportador` (11 dígitos),
  `inscricao_estadual_transportador`, `endereco_transportador`,
  `municipio_transportador`, `uf_transportador`.
- Volumes vão em **array** `volumes: [{ quantidade, especie,
  peso_bruto, peso_liquido }]` — NUNCA usar os antigos campos achatados
  `quantidade_volumes_transportados` / `peso_bruto_total_*` (Focus
  ignora silenciosamente e a SEFAZ recebe NF sem transportadora).
- Resolução obrigatória via `_shared/carrier-registry.ts` →
  `resolveCarrier({ carrierName, serviceName })`. Catálogo embutido tem
  Correios com CNPJ canônico. Demais transportadoras (Jadlog, Loggi,
  Mercado Envios, Total Express, Azul Cargo, Braspress, Shopee Xpress,
  Rodonaves, Latam Cargo) são reconhecidas por nome/serviço mas CNPJ
  fica null — emissão segue com aviso opcional na NF.
- Modalidade de frete é determinada por:
  - Override explícito de `invoice.modalidade_frete` se válido (0/1/2/9)
  - Sem transportadora E sem valor de frete → 9 (sem frete)
  - Frete grátis com transportadora → 0 (emitente absorve) + observação
    automática "Frete grátis — custo absorvido pelo emitente."
  - Frete cobrado → 1 (destinatário)
- Nome do serviço (PAC, SEDEX, JADLOG, etc.) entra como observação
  adicional ("Serviço de envio: X.") — padronizado entre Frenet, Melhor
  Envio e marketplaces.

## O que NUNCA pode acontecer

- Enviar NF-e sem `numero` e `serie` no payload (deixar Focus gerar
  internamente). Quebra paridade com WMS Pratika.
- Reaproveitar `ref` quando o `numero` foi incrementado por duplicidade
  — Focus devolveria resposta em cache. Sempre `generateNFeRef(_, 'retry')`.
- Recriar índice único sobre `(tenant_id, order_id)` em `fiscal_invoices`
  agregando PV e NF — quebra o modelo Bling (ver
  `mem://constraints/fiscal-pv-and-nf-coexistence-partial-indexes`).
- Tratar divergência natural de numeração entre PV e NF como bug.
- Bloquear emissão por falta de CNPJ da transportadora — é aviso
  opcional, NÃO bloqueante (alguns tenants não usam WMS).
- Adicionar CNPJ ad-hoc no catálogo sem fonte pública verificada.

## Arquivos

- `supabase/functions/_shared/focus-nfe-client.ts` — tipo `FocusNFePayload`.
- `supabase/functions/_shared/focus-nfe-adapter.ts` — `buildNFePayload` +
  `isDuplicateNumberError`.
- `supabase/functions/_shared/carrier-registry.ts` — catálogo + resolver.
- `supabase/functions/fiscal-emit/index.ts` — caminho principal com
  retry loop completo.
- `supabase/functions/fiscal-submit/index.ts` — caminho secundário,
  mesma lógica.

## Doc oficial

- `docs/especificacoes/erp/erp-fiscal.md` §"Numeração soberana" e
  §"Bloco transportador".
- `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` §"Aviso
  opcional de transportadora".

## Anti-regressão obrigatória

Toda mudança em `fiscal-emit`, `fiscal-submit`, `focus-nfe-adapter` ou
`carrier-registry` deve garantir:
1. `numero`/`serie` saem no payload Focus.
2. Bloco transportador é montado quando há nome de transportadora.
3. Retry de duplicidade está intacto e respeita cap=20.
4. Observação automática de frete grátis aparece quando aplicável.
