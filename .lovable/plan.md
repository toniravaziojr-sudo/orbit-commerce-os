# Numeração soberana da NF + Bloco transportador

**Status:** Ajuste aplicado — pendente de validação técnica em produção (próxima emissão de NF para Respeite o Homem).

## O que foi entregue

### Frente A — Numeração soberana
- `fiscal-emit` e `fiscal-submit` agora sempre enviam `numero` e `serie` explícitos no payload da Focus NFe.
- Tipo `FocusNFePayload` recebeu `numero?` e `serie?`.
- Helper `isDuplicateNumberError` adicionado ao adapter (cobre cStat 539/204 e padrões textuais).
- Retry loop com cap=20: em rejeição por número duplicado, avança cursor e gera novo ref Focus (evita cache de resposta).
- `fiscal_settings.numero_nfe_atual` atualizado de forma monotônica via `lt` (nunca retrocede).
- PV e NF mantêm sequências independentes — vínculo continua via `source_order_invoice_id`.

### Frente B — Bloco transportador
- Novo arquivo `_shared/carrier-registry.ts` com catálogo embutido (Correios com CNPJ canônico; demais carriers reconhecidos por nome/serviço).
- `buildNFePayload` aceita parâmetro `transporte` (razão social, CNPJ, IE, endereço, município, UF, serviço, modalidade, volumes, pesos).
- Modalidade de frete agora é dinâmica: 0 (CIF) para frete grátis com transportadora, 1 (FOB) para frete cobrado, 9 para sem despacho.
- Observação automática "Frete grátis — custo absorvido pelo emitente." e "Serviço de envio: X." quando aplicáveis.

## Como validar (pelo usuário)

1. Emitir 1 NF na Respeite o Homem.
2. Conferir que o número da NF no painel **bate** com o número que chega na Pratika.
3. Conferir que a NF mostra os dados da transportadora (nome + serviço).
4. Caso a transportadora seja Correios, conferir que CNPJ vai preenchido automaticamente.

## Arquivos alterados

- `supabase/functions/_shared/focus-nfe-client.ts` (tipos)
- `supabase/functions/_shared/focus-nfe-adapter.ts` (buildNFePayload + isDuplicateNumberError)
- `supabase/functions/_shared/carrier-registry.ts` (novo)
- `supabase/functions/fiscal-emit/index.ts` (caminho principal)
- `supabase/functions/fiscal-submit/index.ts` (caminho secundário)
- `docs/especificacoes/erp/erp-fiscal.md` (seções novas)
- `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` (aviso opcional)
- `.lovable/memory/constraints/nfe-numero-soberano-e-bloco-transportador.md` (novo)
- `.lovable/memory/index.md` (índice)
