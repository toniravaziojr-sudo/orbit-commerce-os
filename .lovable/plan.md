
# Plano: Geração de Descrição por Link (Simples) e por Composição (Kits)

## Resumo

Alterar o fluxo de geração de descrição completa do produto para funcionar de duas formas distintas conforme o tipo de produto:

1. **Produto Simples**: O dialog pede um link de URL. O sistema faz scrape da pagina via Firecrawl, extrai o conteudo e a IA gera a descricao HTML a partir do conteudo extraido.

2. **Kit (with_composition)**: O sistema verifica se todos os produtos componentes possuem descricao completa. Se algum nao tiver, exibe aviso na UI. Se todos tiverem, coleta as descricoes dos componentes e a IA gera uma descricao unificada do kit.

---

## Mudancas

### 1. `AIDescriptionButton.tsx` - Refatorar props e dialog

**Novas props:**
- `productFormat`: `'simple' | 'with_variants' | 'with_composition'`
- `productId?`: string (necessario para kits, para buscar componentes)

**Comportamento do dialog para `full_description`:**

- **Se `productFormat !== 'with_composition'` (simples/variantes):**
  - Dialog mostra campo de URL obrigatorio (input de link)
  - Instrucoes adicionais (textarea opcional)
  - Botao "Gerar Descricao"
  - Ao gerar: chama edge function com `mode: 'from_link'` + URL

- **Se `productFormat === 'with_composition'` (kit):**
  - Ao clicar no botao, faz query no banco para buscar componentes e suas descricoes
  - Se algum componente nao tem `description` preenchida: exibe toast/alert com lista dos produtos sem descricao, bloqueando a geracao
  - Se todos tem descricao: chama edge function com `mode: 'from_kit'` + array de `{name, description}` dos componentes

### 2. `ai-product-description/index.ts` - Novos modos de geracao

**Novo campo `mode` no body:**
- `'from_link'` - Produto simples: faz scrape via Firecrawl, extrai conteudo, gera descricao
- `'from_kit'` - Kit: recebe descricoes dos componentes, gera descricao unificada
- `'default'` (ou ausente) - Comportamento atual (fallback)

**Fluxo `from_link`:**
1. Recebe `url` no body
2. Chama `firecrawl-scrape` internamente (fetch HTTP para a propria edge function, ou chama Firecrawl API diretamente ja que tem a key)
3. Extrai markdown/html da pagina
4. Passa para a IA com system prompt: "A partir do conteudo extraido desta pagina de produto, gere a descricao HTML..."

**Fluxo `from_kit`:**
1. Recebe `components: Array<{name, description}>` no body
2. System prompt especifico para kits: combinar descricoes sem perder informacoes, destacar diferencial do kit
3. Gera descricao unificada

### 3. `ProductForm.tsx` - Passar novas props

Passar `productFormat` e `productId` para o `AIDescriptionButton` de descricao completa.

---

## Detalhes Tecnicos

### Edge Function - Scrape via Firecrawl

A edge function `ai-product-description` vai chamar a API Firecrawl diretamente (a key `FIRECRAWL_API_KEY` ja esta configurada):

```typescript
// Dentro de ai-product-description quando mode === 'from_link'
const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${firecrawlKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: linkUrl,
    formats: ['markdown'],
    onlyMainContent: true,
  }),
});
```

### System Prompt para Kit

```
Voce recebera as descricoes de cada produto que compoe este kit.
Sua tarefa: criar UMA descricao unificada que:
- Mantenha TODAS as informacoes importantes de cada produto
- Destaque o diferencial/vantagem de comprar o kit completo
- Use a mesma estrutura HTML obrigatoria
- Nao repita informacoes redundantes entre os produtos
```

### Validacao de componentes no frontend (kit)

```typescript
// No AIDescriptionButton, ao clicar para kit:
const { data: components } = await supabase
  .from('product_components')
  .select('component_product_id, component:products!component_product_id(name, description)')
  .eq('parent_product_id', productId);

const missing = components?.filter(c => !c.component?.description?.trim());
if (missing?.length) {
  toast.error(`Crie primeiro a descricao dos produtos: ${missing.map(m => m.component?.name).join(', ')}`);
  return;
}
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/products/AIDescriptionButton.tsx` | Novas props, novo dialog com campo URL, logica de kit |
| `supabase/functions/ai-product-description/index.ts` | Novos modos `from_link` e `from_kit`, integracao Firecrawl |
| `src/components/products/ProductForm.tsx` | Passar `productFormat` e `productId` ao AIDescriptionButton |
| `docs/regras/produtos.md` | Documentar novos fluxos |
