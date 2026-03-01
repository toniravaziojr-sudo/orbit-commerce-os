

## Diagnóstico Completo da Geração de Títulos ML

### Problemas Identificados (3 causas raiz)

**1. Validação excessivamente restritiva no bulk (`meli-bulk-operations`)**
Os logs mostram que a IA **gera bons títulos** (47-52 chars, ex: "Balm Respeite o Homem Antiqueda Crescimento 60g") mas a função `isValidGeneratedTitle` rejeita TODOS porque `hasSufficientProductCoverage` exige que keywords do nome interno do produto ("calvicie", "banho", "zero") apareçam no título. Como o título otimizado para SEO usa termos melhores ("Antiqueda", "Crescimento"), a validação falha e cai no fallback que retorna o nome original cru.

**2. Validação fraca demais no regenerar individual (`meli-generate-description`)**
A versão individual usa uma `isValidGeneratedTitle` simplificada (sem `hasSufficientProductCoverage`) que aceita títulos de apenas 10 chars. O resultado: "Balm Respeite o Homem Pós" (25 chars) passa na validação e é retornado imediatamente no attempt 1, sem incentivo para gerar títulos mais completos.

**3. Prompt insuficiente e modelo fraco para regeneração individual**
O regenerar individual usa `gemini-2.5-flash` (mais fraco) enquanto o bulk usa `openai` (mais forte). O prompt do regenerar individual não inclui um tamanho mínimo explícito e não enfatiza que o título deve PREENCHER o espaço disponível.

### Plano de Correção

**Arquivo: `supabase/functions/meli-generate-description/index.ts`**

1. Substituir a validação simples `isValidGeneratedTitle(candidate, maxTitleLen)` por uma versão que exija no mínimo 60% do `maxTitleLen` (ex: 36 chars para categorias de 60)
2. Adicionar tamanho mínimo dinâmico ao prompt: "O título DEVE ter entre X e Y caracteres"
3. Adicionar feedback loop no retry: informar que o título anterior era muito curto
4. Trocar modelo de `gemini-2.5-flash` para `google/gemini-2.5-pro` para melhor qualidade
5. Aumentar temperature inicial de 0.35 para 0.5 para mais variedade ao regenerar
6. Passar `preferProvider: 'openai'` como no bulk, para consistência

**Arquivo: `supabase/functions/meli-bulk-operations/index.ts`**

7. Relaxar `hasSufficientProductCoverage`: em vez de exigir keywords do nome interno, aceitar títulos que contenham a marca OU o tipo do produto (ex: "Balm"). Isso permite que a IA otimize para SEO sem ser forçada a repetir o nome interno do cadastro.
8. Reduzir `requiredMatches` de 2 para 1 quando o título já contém a marca completa

### Resultado Esperado

- Títulos de 40-60 chars (para categorias de 60) em vez de 23-33 chars
- Variedade real ao regenerar (não apenas trocar a última palavra)
- Bulk não descarta mais títulos bons da IA em favor do nome cru do produto
- Consistência entre bulk e regenerar individual

### Detalhes Técnicos

```text
ANTES (regenerar individual):
  Prompt: "Gere UM título... MÁXIMO 60 chars"
  Validação: length >= 10 ✓ → aceita "Balm Respeite o Homem Pós" (25 chars)
  
DEPOIS:
  Prompt: "Gere UM título... ENTRE 36 E 60 chars. Preencha o espaço."
  Validação: length >= 60% de maxTitleLen → rejeita < 36 chars → retry → título completo

ANTES (bulk):
  IA gera: "Balm Respeite o Homem Antiqueda Crescimento 60g" (47 chars) ✓
  hasSufficientProductCoverage: keywords "calvicie","banho","zero" → 0/2 matches → REJEITA
  Fallback: retorna nome cru "Balm Pós-Banho Calvície Zero (Dia)"

DEPOIS:
  hasSufficientProductCoverage: aceita se contém marca ("Respeite o Homem") OU tipo ("Balm") → ACEITA
```

