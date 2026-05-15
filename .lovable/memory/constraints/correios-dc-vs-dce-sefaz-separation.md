---
name: Correios DC vs DC-e Sefaz Separation
description: Motor único shipping_content_declarations para Declaração de Conteúdo dos Correios (não fiscal). Proibido reusar fiscal_dce, dce-emit ou misturar com DC-e Sefaz.
type: constraint
---

A Declaração de Conteúdo dos Correios é **não fiscal** e tem **um único motor**:

- Tabela: `shipping_content_declarations`
- Edge function: `correios-content-declaration-issue`
- PDF: `src/lib/declaracaoConteudo.ts` → `issueAndDownloadCorreiosContentDeclaration`
- Modal obrigatório: `src/components/fiscal/CorreiosContentDeclarationDialog.tsx`

**Proibido:**
- Reintroduzir `fiscal_dce` (tabela legada removida) ou usar `dce-emit` (stub 410 deprecated) para DC dos Correios.
- Criar caminho paralelo (manual/gateway/remessas devem usar o mesmo motor).
- Confundir Correios DC com DC-e Sefaz (fiscal eletrônica, fluxo separado).
- Emitir sem motivo + checkbox de responsabilidade do usuário.
- Alterar `fiscal_stage` ou chamar Focus/Sefaz no fluxo de Correios DC.

**Por quê:** Correios DC nunca substitui NF-e quando a NF-e é obrigatória; misturar com fluxo fiscal cria risco jurídico e operacional.

**Como aplicar:** Qualquer nova UI ou função que precise gerar DC dos Correios deve usar `correios-content-declaration-issue` + `shipping_content_declarations`. Documentação canônica: `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md`.
