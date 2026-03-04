

# Diagnóstico Raiz + Plano de Correção Cirúrgica

## Achados Confirmados por Análise de Dados

### 1. Header/Footer: NÃO é bug de código — é bug de dados
O código em `StorefrontAILandingPage.tsx` funciona **corretamente**: linhas 266-267 leem `show_header ?? false` e linhas 313-337 condicionam o render ao valor real. A rota em `App.tsx` (L230) está **fora** do `TenantStorefrontLayout`, então não herda shell externo.

**O problema real**: O registro `t123` no banco tem `show_header: true` e `show_footer: true`. Isso acontece porque esse registro foi criado antes do deploy da correção no `CreateLandingPageDialog.tsx`, ou os toggles foram ativados no editor. O `CreateLandingPageDialog` já insere com `false` (L196-197). O default da coluna no banco já é `false`.

**Correção**: Atualizar t123 no banco para `show_header: false, show_footer: false`.

### 2. Imagens de oferta erradas: O backend NÃO busca kits relacionados
Este é o problema **mais grave** e estrutural. O LP `t123` tem **apenas 1 produto selecionado**: `Shampoo Calvície Zero` (produto `simple`). Porém, existem **14 kits** que contêm esse produto como componente (via `product_components`), cada um com sua **própria imagem primária** profissional.

O que acontece hoje:
- O backend monta `productPrimaryImageMap` apenas com os `product_ids` selecionados (1 produto)
- A IA recebe apenas 1 thumb e inventa a seção de "kits" com a mesma imagem repetida
- Os kits reais (com thumbs profissionais) existem no catálogo mas não são passados para a IA

**Correção**: No STEP 1 do `index.ts`, após buscar os produtos selecionados, consultar `product_components` para encontrar kits (`with_composition`) que contêm esses produtos. Incluir seus dados (nome, preço, imagem primária) no `productPrimaryImageMap` e no `productsInfo`.

### 3. Provas sociais reais ignoradas
Existem pastas reais no Drive:
- `Feedback Clientes` (id: `3379009a...`)
- `Review clientes` (id: `8bb4339a...`)

E existe 1 arquivo de review (`1768714772803-1xuve9.png`).

O STEP 3 (DRIVE REFERENCES) busca arquivos por **nome do produto**, não por **pastas de prova social**. As pastas de feedback não são consultadas.

**Correção**: Adicionar busca explícita no STEP 3 por arquivos em pastas cujo nome contenha "feedback", "review", "prova", "resultado". Passar essas imagens como `socialProofImageSet` separado no mapa de assets.

### 4. CTAs desproporcionais
O CSS utilities não impõe limites de tamanho para CTAs. A IA tem liberdade total para definir font-size, padding e width dos botões.

**Correção**: Adicionar regras de CTA no CSS utilities (`wrapInDocumentShell` e `buildCssUtilities`) com max-width, font-size padronizado e padding controlado.

---

## Plano de Correção (4 tarefas)

### Tarefa 1: Corrigir dados do t123
**Tipo**: SQL direto
- `UPDATE ai_landing_pages SET show_header = false, show_footer = false WHERE slug = 't123'`

### Tarefa 2: Auto-descobrir kits relacionados no backend
**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts` (STEP 1, ~L762-821)

Após buscar os produtos selecionados, adicionar:
```sql
SELECT pc.parent_product_id, p.name, p.price, p.compare_at_price, p.sku
FROM product_components pc
JOIN products p ON p.id = pc.parent_product_id
WHERE pc.component_product_id IN (selectedProductIds)
  AND p.deleted_at IS NULL
  AND p.product_format = 'with_composition'
  AND p.status = 'active'
```

Para cada kit encontrado, buscar sua `is_primary` image e adicionar ao `productPrimaryImageMap` e ao `productsInfo`. Isso garante que cards de oferta/pricing usem a thumb correta de cada kit.

### Tarefa 3: Buscar provas sociais do Drive
**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts` (STEP 3, ~L862-906)

Adicionar busca por imagens em pastas cujo nome contém "feedback", "review", "prova", "resultado":
```sql
-- Buscar folders de prova social
SELECT id FROM files WHERE tenant_id = ? AND is_folder = true 
  AND (filename ILIKE '%feedback%' OR filename ILIKE '%review%' OR filename ILIKE '%prova%' OR filename ILIKE '%resultado%')

-- Buscar imagens nessas folders (via storage_path match)
SELECT storage_path, original_name, metadata FROM files 
  WHERE tenant_id = ? AND is_folder = false AND mime_type LIKE 'image/%'
  AND storage_path LIKE ANY(folder_paths)
```

Passar as URLs públicas dessas imagens como slot `PROVA SOCIAL REAL` no mapa de assets, com instrução explícita para a IA usar essas imagens na seção de depoimentos/resultados.

### Tarefa 4: Restringir CTAs no CSS utilities
**Arquivos**: 
- `supabase/functions/ai-landing-page-generate/index.ts` (CSS utilities, ~L595-627)
- `src/lib/aiLandingPageShell.ts` (buildCssUtilities)

Adicionar regras CSS para CTAs:
```css
.cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
  max-width: 400px;
  font-size: clamp(14px, 1.1vw, 18px);
  padding: 14px 32px;
  border-radius: 8px;
  display: inline-block;
  box-sizing: border-box;
}
```
E no mobile:
```css
@media (max-width: 768px) {
  .cta-button, [class*="cta"], a[style*="padding"][style*="background"] {
    max-width: 100%;
    font-size: 16px !important;
    padding: 14px 24px !important;
  }
}
```

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| SQL direto | Fix t123 show_header/show_footer |
| `supabase/functions/ai-landing-page-generate/index.ts` | Auto-descobrir kits; buscar provas sociais; CTA constraints no CSS utilities |
| `src/lib/aiLandingPageShell.ts` | CTA constraints no buildCssUtilities (paridade) |

## O que NÃO muda
- Arquitetura V4.2 body-only (mantida)
- Pipeline compartilhada (mantida)
- Parser/hard checks (mantidos)
- Componente StorefrontAILandingPage (funciona corretamente)
- CreateLandingPageDialog (já corrigido)

