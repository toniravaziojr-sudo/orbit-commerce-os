

## Diagnóstico Completo — Header vs Footer

### Causa Raiz Identificada

A diferença fundamental entre header e footer é a **arquitetura de dados**:

- **Footer (`StorefrontFooterContent`)**: É **auto-suficiente** — busca suas próprias categorias, menus e páginas diretamente do banco via `useQuery` hooks internos (linhas 129-228). Não depende de nenhum dado externo.

- **Header (`HeaderBlock` no `BlockRenderer.tsx`)**: É **dependente de context** — recebe `categories`, `headerMenu` e `pagesData` via props passadas pela página pai (ex: `StorefrontHome`). Se esses dados estiverem vazios por qualquer motivo (timing, cache, formato), todos os links de categorias caem no fallback `baseUrl`, que no domínio customizado é `''` (string vazia) — resultando em links que navegam para a página atual (parecem "não funcionar").

### Por que funciona no preview e não no domínio customizado

No preview (`.lovableproject.com`), `baseUrl` retorna `/store/respeite-o-homem`. Mesmo quando os links fazem fallback, eles navegam para a home da loja. No domínio customizado, `baseUrl` é `''`, então o fallback gera links vazios que não fazem nada visível.

### Plano de Correção

**Tornar o `HeaderBlock` auto-suficiente como o `FooterBlock`** — buscar seus próprios dados diretamente do banco, eliminando a dependência de dados passados via context.

#### Alterações:

1. **`src/components/builder/BlockRenderer.tsx` — `HeaderBlock`**
   - Adicionar `useQuery` hooks internos para buscar:
     - Menu items do header (via `menus` + `menu_items` onde `location = 'header'`)
     - Categorias ativas do tenant
   - Usar esses dados como **fonte primária**, com fallback para `context.categories` e `context.headerMenu` (manter retrocompatibilidade com builder)
   - Usar `settings.tenant_id` (já disponível) para as queries

2. **Nenhuma alteração** em `StorefrontHeaderContent.tsx` — o componente já recebe os dados via props corretamente

3. **Nenhuma alteração** nas páginas individuais (StorefrontHome, etc.) — os dados do context continuam sendo passados mas deixam de ser a fonte única

### Detalhes Técnicos

O `HeaderBlock` passará de:
```text
context.categories → StorefrontHeaderContent (frágil, dependente de pipeline)
```
Para:
```text
useQuery(['header-categories', tenantId]) → StorefrontHeaderContent (auto-suficiente)
```

Similar ao padrão do `FooterBlock`/`StorefrontFooterContent` que já funciona perfeitamente.

As queries terão `staleTime: 5min` para não impactar performance (dados de menu/categorias mudam raramente).

