---
name: Correios CWS prepostagem — nomes oficiais de campos e parser de erro
description: Pré-postagem CWS v1 exige nomes oficiais (pesoInformado, codigoFormatoObjetoInformado, alturaInformada, larguraInformada, comprimentoInformado, cienteObjetoNaoProibido, modalidadePagamento, itensDeclaracaoConteudo). Nomes legados (pesoObjeto, codigoFormatoObjeto, alturaEmCentimetro) são ignorados pela API e geram PPN-348/null. Parser de erro aceita msgs string[] e {texto}[].
type: constraint
---

# Correios CWS prepostagem — payload oficial e parser de erro

## Endpoint
`POST https://api.correios.com.br/prepostagem/v1/prepostagens`

## Nomes oficiais dos campos (CWS v1)

Confirmados na gem oficial `correios_api` 1.0.3 e em integrações em produção:

| Campo | Tipo | Observação |
|---|---|---|
| `idCorreios` / `numeroCartaoPostagem` | string | Cartão de postagem |
| `codigoServico` | string | Ex.: `03220` SEDEX, `03298` PAC |
| `modalidadePagamento` | string | `"2"` = à faturar (contrato) |
| `pesoInformado` | string (gramas) | **NÃO usar `pesoObjeto` nem `peso`** |
| `codigoFormatoObjetoInformado` | string | `"1"`=envelope, `"2"`=caixa, `"3"`=cilindro. **NÃO usar `codigoFormatoObjeto`** |
| `alturaInformada` / `larguraInformada` / `comprimentoInformado` / `diametroInformado` | string (cm) | **NÃO usar `alturaEmCentimetro` etc.** |
| `cienteObjetoNaoProibido` | string `"1"` | Obrigatório (PPN-330) |
| `valorDeclarado` | number | Valor total |
| `remetente` / `destinatario` | objeto | Inclui `nome`, `cpfCnpj` (só dígitos), `dddTelefone`+`telefone` e/ou `dddCelular`+`celular`, `email`, `endereco{cep,logradouro,numero,complemento,bairro,cidade,uf}` |
| `chaveAcessoNotaFiscal` / `numeroNotaFiscal` / `serieNotaFiscal` / `valorNotaFiscal` | — | Quando vinculado a NF-e |
| `observacao` | string | Quando vinculado a Declaração de Conteúdo (`Declaracao de Conteudo no DC-...`) |
| `itensDeclaracaoConteudo` | array | Obrigatório quando há DC. Cada item: `conteudo`, `descricao`, `quantidade` (string), `valor` (string `0.00`), `peso` (string gramas) |

## Telefones
Sanitização obrigatória: só dígitos, máximo 12 (DDD + 9 dígitos). DDD vai em `dddTelefone`/`dddCelular`; número fixo (8 dígitos) em `telefone`; celular (9 dígitos começando com 9) em `celular`. Nunca enviar string única com DDI/formatação.

## Vínculo fiscal (obrigatório)
- **NF-e autorizada:** preencher `chaveAcessoNotaFiscal` + `numeroNotaFiscal` + `serieNotaFiscal` + `valorNotaFiscal`.
- **Declaração de Conteúdo emitida:** preencher `observacao` (`Declaracao de Conteudo no DC-...`) **e** `itensDeclaracaoConteudo`.
- **Nenhum dos dois:** bloquear no pré-flight (`docs/especificacoes/fiscal/preflight-fiscal-logistico.md`). Nunca emitir DC silenciosamente no Módulo de Remessas.

## Parser de erro
Resposta de erro vem em `msgs` (CWS atual: `string[]`; legado: `{texto}[]` ou `{mensagem}[]`). Parser obrigatório:

```ts
const messages = Array.isArray(rawMsgs)
  ? rawMsgs.map((m: any) =>
      typeof m === 'string' ? m : (m?.texto || m?.mensagem || m?.message || '')
    ).filter(Boolean)
  : [];
```

Falhas conhecidas que indicam nome de campo errado:
- `PPN-348: Não foram informados todos os itens da Declaração de Conteúdo...` — falta `itensDeclaracaoConteudo` OU `pesoInformado`.
- `Formato de objeto nao encontrado para o codigo: null` — campo enviado como `codigoFormatoObjeto` em vez de `codigoFormatoObjetoInformado`.
- `Peso: Peso do objeto não informado` — campo enviado como `pesoObjeto`/`peso` em vez de `pesoInformado`.

## Anti-regressão
- Pré-flight unificado (`mem://constraints/preflight-fiscal-logistico-portao-unico`) é o portão prévio.
- Este parser e estes nomes de campos são a defesa final.
- Qualquer adição/alteração no payload da pré-postagem deve consultar a gem `correios_api` 1.0.3 ou outra referência em produção antes de publicar.

## Arquivo
`supabase/functions/shipping-create-shipment/index.ts` (função `createCorreiosShipment`).
