

## Plano: Fluxo de 6 Etapas com Validação ML Sincronizada

### Problema
O Creator atual tem 3 etapas (Selecionar → Configurar tudo junto → Processar escondido). O usuário não vê nem valida os resultados de IA. Categorias, títulos e descrições não são verificados contra as regras do Mercado Livre antes de salvar.

### Novo Fluxo

```text
Etapa 1: Selecionar Produtos       (checkboxes, busca, selecionar todos)
Etapa 2: Gerar Títulos IA          (cria drafts → bulk_generate_titles → preview editável)
Etapa 3: Gerar Descrições IA       (bulk_generate_descriptions → preview editável)
Etapa 4: Categorizar via ML API    (bulk_auto_categories → preview com troca manual via MeliCategoryPicker)
Etapa 5: Condição                  (Novo / Usado — aplicado a todos)
Etapa 6: Tipo de Anúncio           (Clássico / Premium / Grátis → salva e fecha)
```

### Sincronização com o Mercado Livre

**Títulos (Etapa 2):**
- Edge function `bulk_generate_titles` já gera títulos com prompt otimizado (tipo de produto primeiro, max 60 chars, sem emojis/CAPS)
- Preview mostra cada título gerado ao lado do nome original do produto
- Input editável com contador de caracteres (max 60) e validação visual (vermelho se > 60)
- Botão "Regenerar" individual por item chama `meli-generate-description` com `generateTitle: true`

**Descrições (Etapa 3):**
- Edge function `bulk_generate_descriptions` converte HTML → texto plano seguindo regras ML
- Regras enforced no prompt: sem HTML, sem links, sem contato, sem emojis, max 5000 chars
- Preview colapsável (primeiras 3 linhas visíveis, expandir para ver completa)
- Textarea editável para ajustes manuais
- Botão "Regenerar" individual chama `meli-generate-description` (modo descrição)

**Categorias (Etapa 4):**
- Edge function `bulk_auto_categories` usa `domain_discovery/search` da API oficial do ML
- Fallback: Search API → filtros de categoria → primeira resultado
- Preview mostra `[Produto] → [Categoria Nome]` com path completo (ex: "Beleza > Cuidados Pessoais > Barba")
- Resolve nome legível via `GET /categories/{id}` (path_from_root) — NÃO exibe IDs crus
- Botão para trocar categoria manualmente via `MeliCategoryPicker` (componente já existente)
- Categorias são sempre IDs válidos do ML (formato `MLBxxxx`)

**Condição (Etapa 5):**
- Valores aceitos pela API ML: `new`, `used`, `not_specified`
- Cards de seleção visual com radio-style

**Tipo de Anúncio (Etapa 6):**
- Valores da API ML: `gold_special` (Clássico), `gold_pro` (Premium), `free` (Grátis)
- Cards de seleção visual com descrição das diferenças
- Botão "Salvar Anúncios" aplica condição + listing_type via `updateBulkListings` e fecha

### Mudanças Técnicas

**1. Reescrever `MeliListingCreator.tsx`**

- `Step` muda para: `"select" | "titles" | "descriptions" | "categories" | "condition" | "listing_type"`
- 6 step indicators no header
- Etapa 2 (títulos): cria drafts via `createBulkListings`, depois chama `bulk_generate_titles` com `listingIds`. Armazena resultados em state `generatedData[]` para preview. Busca listings atualizados do banco após IA.
- Etapa 3 (descrições): chama `bulk_generate_descriptions` com mesmos `listingIds`. Atualiza state com descrições.
- Etapa 4 (categorias): chama `bulk_auto_categories` com mesmos `listingIds`. Resolve nomes de categorias via `meli-search-categories?categoryId=XXX`. Permite trocar via `MeliCategoryPicker`.
- Etapas 5-6: selects visuais que aplicam `updateBulkListings` em batch.

Estado local:
```typescript
interface GeneratedItem {
  listingId: string;
  productId: string;
  productName: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryPath: string;
}
```

**2. Adicionar `updateBulkListings` em `useMeliListings.ts`**

Nova mutation para atualizar condição e listing_type em batch:
```typescript
updateBulkListings: async ({ ids, data }) => {
  await supabase.from('meli_listings').update(data).in('id', ids);
}
```

**3. Edge function `meli-bulk-operations` — ajuste na action `bulk_auto_categories`**

Atualmente o `bulk_auto_categories` pula listings que já têm `category_id`. No novo fluxo, os drafts são criados sem categoria, então isso funciona. Mas precisa resolver o nome da categoria no response para o frontend exibir sem chamada extra. Ajustar para retornar `categoryName` e `categoryPath` junto com o `categoryId`.

**4. Nenhuma mudança nas regras de IA dos prompts** — já estão corretas (títulos com tipo de produto primeiro, descrições texto plano sem HTML/links).

### Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/marketplaces/MeliListingCreator.tsx` | **Reescrever** — 6 etapas com preview/edição |
| `src/hooks/useMeliListings.ts` | **Editar** — adicionar `updateBulkListings` |
| `supabase/functions/meli-bulk-operations/index.ts` | **Editar** — `bulk_auto_categories` retorna nome/path da categoria |
| `docs/regras/mercado-livre.md` | **Atualizar** — documentar fluxo de 6 etapas |

