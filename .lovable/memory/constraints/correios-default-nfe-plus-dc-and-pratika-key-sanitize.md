---
name: Correios default NF+DC juntas (independe de DC nativa) · Pratika exige chave 44 dígitos · SOAP success real
description: Default Correios é NF+DC quando há NF — observação fica "Conteudo descrito conforme itens declarados" quando não há DC nativa emitida (não viola "proibido emitir DC silenciosamente" porque NÃO emite DC nativa nossa, só preenche o campo da pré-postagem). Envio Pratika sanitiza chave para 44 dígitos. Sucesso Pratika exige HTTP 2xx + <Sucesso>true</Sucesso>.
type: constraint
---

# Correios "NF + DC" default · Pratika chave 44 dígitos · SOAP success real

Três regras complementares descobertas no teste E2E real de 2026-06-05
(duplicações dos pedidos #581 e Osvaldo no Respeite o Homem).

## 1. Default Correios: NF + itens da declaração juntos quando há NF

`shipping-create-shipment` (Correios) decide o documento fiscal vinculado
à pré-postagem assim:

- `preferred_doc` explícito (request body OU `shipment.metadata.preferred_doc`):
  `'nfe' | 'dc' | 'both'` — sempre respeitado.
- **Default sem hint:** se há NF autorizada → `'both'`. Sem NF → `'dc'`.

**Composição do payload em `'both'`:**

1. Campos estruturados da NF (`chaveAcessoNotaFiscal` 44 dígitos +
   `numeroNotaFiscal` + `serieNotaFiscal` + `valorNotaFiscal`).
2. `observacao`:
   - Se há DC nativa emitida no nosso sistema → `"Declaracao de Conteudo no DC-XXXX"`.
   - Se NÃO há DC nativa → `"Conteudo descrito conforme itens declarados"`
     (genérica, sempre válida).
3. `itensDeclaracaoConteudo[]` — sempre montado a partir dos itens do pedido.

**Por quê:** contratos PAC comerciais dos Correios rejeitam pré-postagem só
com chave de NF (PPN-347 *"É obrigatório informar Declaração de Conteúdo"*).
DC anexada no payload é gratuita, sempre aceita e não atrapalha contratos
mais permissivos. Esta composição satisfaz o contrato sem emitir DC nativa
formal — portanto NÃO viola
`mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
("proibido emitir DC silenciosamente"): emissão de DC nativa continua manual,
o que mandamos para Correios é só o campo do payload deles.

**Fallback de segurança:**
- `'nfe'` sem NF → `'dc'`.
- `'both'` sem NF → `'dc'`.
- `'dc'` sem DC nativa e com NF → `'both'` (sobe para o caminho seguro).

Lojistas cujo contrato aceita apenas a chave da NF podem forçar `'nfe'`
puro via `preferred_doc`.

## 2. Pratika exige chave de acesso com 44 dígitos numéricos

`wms_pratika.AtualizarCodRastreioNfe` aceita `chaveAcesso` **somente** com
os 44 dígitos numéricos. Persistimos a chave em formato canônico
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

## O que NUNCA pode acontecer

- Default do Correios voltar a `'nfe'` puro quando há NF — regrediria PPN-347.
- `'both'` montar payload sem `itensDeclaracaoConteudo[]` quando não há DC
  nativa — era o bug original do meu primeiro fix.
- Enviar `chave_acesso` à Pratika sem strip dos não-numéricos.
- `wms-pratika-send` marcar sucesso só por HTTP 200.
- Emitir DC nativa formal automaticamente dentro do shipping-create-shipment
  (a DC nativa segue exigindo emissão manual no Módulo Fiscal/Logística).

## Validação E2E confirmada (2026-06-05)

PV duplicado #393 → NF #396 autorizada (chave
`35260663269917000106550010000000141990807293`) → etiqueta
`AP042544595BR` emitida com payload `'both'` sem DC nativa → 2 envios
Pratika com `<Sucesso>true</Sucesso>` real (NF + rastreio).

## Arquivos

- `supabase/functions/shipping-create-shipment/index.ts` — bloco "Observação
  fiscal (DC)" e "Escolha do documento fiscal pelo lojista".
- `supabase/functions/wms-pratika-send/index.ts` — `parsePratikaSoapResult()`,
  `sendSoap()`, bloco `update_tracking` (sanitização da chave).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Documento fiscal
  vinculado à pré-postagem" e `docs/tecnico/base-de-conhecimento-tecnico.md`.
- Memórias relacionadas:
  - `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
  - `mem://features/external-apps/wms-pratika-integration`
