# Slugs — Especificação Completa

> **Versão:** 1.0.0  
> **Última atualização:** 2026-04-05  
> **Responsável:** Sistema global — afeta todos os módulos que usam identificadores URL-friendly

---

## 1. Visão Geral

Slugs são identificadores URL-friendly usados em rotas públicas (storefront) e internas (admin). Todo slug no sistema segue regras centralizadas de geração, validação e unicidade.

### 1.1 Princípio Fundamental

> **Uma única fonte de verdade para geração de slugs.** Nenhum arquivo do sistema pode conter lógica inline de geração de slug (`.toLowerCase().normalize('NFD').replace(...)` etc.). Toda geração passa obrigatoriamente por uma das funções centralizadas.

---

## 2. Arquitetura

### 2.1 Camadas de Responsabilidade

```
┌──────────────────────────────────────────────────────────────┐
│                    SLUG ARCHITECTURE                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐   Formulários interativos (UI)     │
│  │   useAutoSlug()     │   Auto-gera slug do nome.          │
│  │   src/hooks/        │   Detecta edição manual.           │
│  │   useAutoSlug.ts    │   Para auto-geração se editado.    │
│  └────────┬────────────┘                                     │
│           │ usa internamente                                 │
│           ▼                                                  │
│  ┌─────────────────────┐   Função pura de geração           │
│  │   generateSlug()    │   Converte texto → slug válido.    │
│  │   src/lib/          │   Sem estado, sem side-effects.    │
│  │   slugPolicy.ts     │   Usada também em fallbacks        │
│  └─────────────────────┘   de submit (Pages, Categories).   │
│                                                              │
│  ┌─────────────────────┐   Validação de formato             │
│  │ validateSlugFormat()│   Regex, reservados, tamanho.      │
│  │   src/lib/          │   Retorna { isValid, error }.      │
│  │   slugPolicy.ts     │                                    │
│  └─────────────────────┘                                     │
│                                                              │
│  ┌─────────────────────┐   Importação (server-side)         │
│  │   slugify()         │   Mesma lógica de generateSlug,    │
│  │   src/lib/import/   │   otimizada para pipelines de      │
│  │   utils.ts          │   importação em massa.             │
│  └─────────────────────┘                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Arquivos-Fonte (Fonte de Verdade)

| Arquivo | Responsabilidade | Exports |
|---------|-----------------|---------|
| `src/lib/slugPolicy.ts` | Política global: geração, validação, reservados | `generateSlug()`, `validateSlugFormat()`, `RESERVED_SLUGS`, `normalizeSlug()`, `hasValidSlug()`, `getSlugErrorTooltip()`, `isReservedSlug()` |
| `src/hooks/useAutoSlug.ts` | Hook React para formulários interativos | `useAutoSlug()` |
| `src/lib/import/utils.ts` | Slugify para pipelines de importação | `slugify()` |
| `src/lib/slugValidation.ts` | Re-exports de slugPolicy (backward compat) | Re-exports |

### 2.3 Regra Anti-Regressão

> ⛔ **PROIBIDO** criar `function slugify()` local em qualquer arquivo.  
> ⛔ **PROIBIDO** escrever lógica inline `.toLowerCase().normalize('NFD').replace(...)` para gerar slugs.  
> ⛔ **PROIBIDO** importar slugify de qualquer lugar que não seja `src/lib/import/utils.ts`.  
> ⛔ **PROIBIDO** gerar slug sem usar `generateSlug()`, `useAutoSlug()` ou `slugify()`.

---

## 3. Formato do Slug

### 3.1 Regex

```
/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/
```

### 3.2 Regras de Formato

| Regra | Exemplo válido | Exemplo inválido |
|-------|---------------|-----------------|
| Somente minúsculas | `camiseta-basica` | `Camiseta-Basica` |
| Sem acentos | `ofertas-especiais` | `ofertas-éspeciais` |
| Sem espaços | `minha-loja` | `minha loja` |
| Sem caracteres especiais | `produto-123` | `produto@123` |
| Sem hífen no início/fim | `meu-produto` | `-meu-produto-` |
| Sem hífens consecutivos | `meu-produto` | `meu--produto` |
| Máximo 200 caracteres | — | — |

### 3.3 Algoritmo de Geração

```
entrada → lowercase → remove acentos (NFD) → remove especiais → espaços→hífens → colapsa hífens → remove hífens extremos
```

---

## 4. Slugs Reservados

```typescript
const RESERVED_SLUGS = [
  'admin', 'api', 'auth', 'cart', 'checkout',
  'store', 'login', 'logout', 'register', 'signup',
  'settings', 'profile', 'dashboard', 'null', 'undefined',
  'new', 'edit', 'delete', 'create', 'minhas-compras', 'my-orders'
];
```

Qualquer tentativa de usar um slug reservado retorna `{ isValid: false, error: 'Este slug é reservado e não pode ser usado' }`.

---

## 5. Unicidade (Namespaces)

Slugs **NÃO são globalmente únicos**. São únicos dentro do seu namespace:

| Namespace | Unicidade | Prefixo de rota |
|-----------|-----------|-----------------|
| `product` | `(tenant_id, slug)` | `/product/:slug` |
| `category` | `(tenant_id, slug)` | `/c/:slug` |
| `institutional` | `(tenant_id, type, slug)` | `/p/:slug` |
| `landing` | `(tenant_id, type, slug)` | `/lp/:slug` |
| `tenant` | Global (slug único) | `{slug}.shops.comandocentral.com.br` |

O mesmo slug pode existir em namespaces diferentes sem conflito (ex: produto "oferta" e categoria "oferta").

---

## 6. useAutoSlug — Hook para Formulários

### 6.1 Comportamento

```
┌─────────────────────────────────────────────────────┐
│               useAutoSlug State Machine              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  CRIAÇÃO (isEditing=false, initialSlug=''):          │
│                                                      │
│  [Auto-Generating] ──── user types in slug ────►    │
│       │                 field (setSlug)              │
│       │                      │                       │
│       │                      ▼                       │
│       │              [Manually Edited]               │
│       │              (stops auto-gen)                 │
│       │                                              │
│       │◄──── resetAutoGeneration() ─────┘           │
│       │                                              │
│       ▼                                              │
│  handleNameChange(name)                              │
│  → gera slug automaticamente                         │
│  → retorna slug gerado                              │
│                                                      │
│  EDIÇÃO (isEditing=true, initialSlug='existente'):  │
│                                                      │
│  [Manually Edited] (auto-gen desativada por padrão) │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 6.2 API

```typescript
interface UseAutoSlugOptions {
  initialSlug?: string;    // Slug existente (modo edição)
  isEditing?: boolean;     // Se true, desativa auto-geração
}

interface UseAutoSlugReturn {
  slug: string;                          // Valor atual do slug
  setSlug: (value: string) => void;      // Edição manual (para auto-gen)
  handleNameChange: (name: string) => string; // Chamado ao digitar no nome
  isAutoGenerating: boolean;             // Se ainda está auto-gerando
  resetAutoGeneration: () => void;       // Reset para auto-geração
}
```

### 6.3 Uso Correto

```tsx
// No componente:
const autoSlug = useAutoSlug({
  initialSlug: entity?.slug,
  isEditing: !!entity,
});

// Campo nome — chama handleNameChange:
<Input onChange={(e) => {
  const name = e.target.value;
  const generated = autoSlug.handleNameChange(name);
  if (autoSlug.isAutoGenerating) {
    form.setValue('slug', generated);
  }
  form.setValue('name', name);
}} />

// Campo slug — chama setSlug para marcar edição manual:
<Input onChange={(e) => {
  autoSlug.setSlug(e.target.value);
  form.setValue('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
}} />
```

---

## 7. Mapa Completo de Consumidores

### 7.1 Formulários Interativos (useAutoSlug)

| Consumidor | Arquivo | Comportamento |
|-----------|---------|---------------|
| Categorias | `src/components/categories/CategoryForm.tsx` | Auto-gera do nome, para se slug editado manualmente |
| Produtos | `src/components/products/ProductForm.tsx` | Idem |
| Quizzes | `src/components/quizzes/QuizDialog.tsx` | Idem (via useEffect + watch) |
| Criar Loja | `src/pages/CreateStore.tsx` | Auto-gera sempre (loja nova, sem modo edição) |

### 7.2 Fallbacks de Submit (generateSlug)

Usados como safety net no momento do submit quando o slug pode estar vazio:

| Consumidor | Arquivo | Contexto |
|-----------|---------|----------|
| Categorias (submit) | `src/pages/Categories.tsx` | `slug \|\| generateSlug(name)` |
| Páginas (submit) | `src/pages/Pages.tsx` | `slug \|\| generateSlug(title)` |
| Templates de página | `src/hooks/usePageTemplates.ts` | `slug \|\| generateSlug(name)` |
| Onboarding | `src/pages/start/StartInfo.tsx` | `generateSlug(store_name)` |

### 7.3 Importação em Massa (slugify)

Todos importam de `src/lib/import/utils.ts`:

| Adaptador | Arquivo |
|-----------|---------|
| Shopify | `src/lib/import/platforms/shopify.ts` |
| Nuvemshop | `src/lib/import/platforms/nuvemshop.ts` |
| Bagy | `src/lib/import/platforms/bagy.ts` |
| Yampi | `src/lib/import/platforms/yampi.ts` |
| WooCommerce | `src/lib/import/platforms/woocommerce.ts` |
| Tray | `src/lib/import/platforms/tray.ts` |
| Loja Integrada | `src/lib/import/platforms/loja-integrada.ts` |
| Wix | `src/lib/import/platforms/wix.ts` |
| Index (genérico) | `src/lib/import/platforms/index.ts` |
| Validator | `src/lib/import/validator.ts` (via `sanitizeSlug`) |

### 7.4 Outros Usos (generateSlug)

| Consumidor | Arquivo | Contexto |
|-----------|---------|----------|
| Afiliados | `src/hooks/useAffiliates.ts` | Gera código de afiliado a partir do nome |

### 7.5 Edge Functions (server-side)

| Função | Arquivo | Contexto |
|--------|---------|----------|
| import-helpers | `supabase/functions/_shared/import-helpers.ts` | `slugify()` própria (edge runtime, não compartilha src/) |

> ⚠️ A edge function `import-helpers.ts` mantém sua própria cópia de `slugify` por necessidade técnica — edge functions Deno não importam de `src/`. A lógica deve ser idêntica à de `src/lib/import/utils.ts`.

---

## 8. Validação

### 8.1 validateSlugFormat()

Retorna `{ isValid: boolean, error?: string }`.

Checks em ordem:
1. Slug não vazio
2. Máximo 200 caracteres
3. Regex válido (lowercase, alfanumérico, hífens)
4. Mensagens específicas: maiúsculas, espaços, caracteres especiais, hífens extremos, hífens consecutivos
5. Não é slug reservado

### 8.2 Onde a Validação é Aplicada

| Local | Quando |
|-------|--------|
| `CategoryForm.tsx` | Em tempo real no campo slug |
| `ProductForm.tsx` | Via schema Zod + feedback visual |
| `Pages.tsx` | No submit antes de salvar |
| `CreateStore.tsx` | Via schema Zod |
| `QuizDialog.tsx` | Via schema Zod |

---

## 9. Checklist Anti-Regressão

Para qualquer PR ou alteração que envolva slugs:

- [ ] Nenhuma `function slugify()` local foi criada
- [ ] Nenhum `.toLowerCase().normalize('NFD').replace(...)` inline foi adicionado
- [ ] Formulários interativos usam `useAutoSlug()`
- [ ] Submit fallbacks usam `generateSlug()` de `slugPolicy.ts`
- [ ] Importação usa `slugify()` de `src/lib/import/utils.ts`
- [ ] Edge functions mantêm lógica idêntica a `src/lib/import/utils.ts`
- [ ] Novos módulos com slug foram adicionados à seção 7 deste documento

---

## 10. Histórico de Alterações

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-04-05 | 1.0.0 | Documento criado. Unificação completa: 9 cópias locais de `slugify` removidas, `useAutoSlug` criado, 16 consumidores mapeados. |
