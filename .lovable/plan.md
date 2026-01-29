
# Plano Revisado: Unificar Builder com Preview (Abordagem Anti-Regressão)

## Diagnóstico Real do Problema

Após análise detalhada do código, identifiquei a **causa raiz** do problema:

### Problema 1: Classe CSS Inexistente
O arquivo `useBuilderThemeInjector.ts` (linhas 147-268) injeta estilos para `.builder-preview-canvas`:

```css
.builder-preview-canvas button.sf-btn-primary:hover { ... }
```

**MAS** essa classe `.builder-preview-canvas` **NÃO EXISTE** em nenhum lugar do código! O `BuilderCanvas.tsx` (linha 271) usa apenas:

```tsx
className="storefront-container bg-background transition-all duration-300 relative overflow-hidden"
```

### Problema 2: Modo Preview vs Modo Edição
A diferença entre os modos não é visual - é funcional:

| Condição | `isEditing` | Hover CSS funciona? |
|----------|-------------|---------------------|
| Preview Mode (`isPreviewMode=true`) | `false` | ✅ Sim - wrapper não interfere |
| Edit Mode (`isEditing=true`) | `true` | ❌ Não - CSS não está atingindo os elementos |

O CSS do injector está CORRETO para `.storefront-container`, mas algo impede que funcione no modo edição.

### Problema 3: Especificidade CSS insuficiente no contexto de edição
Quando `isEditing=true`, o wrapper do bloco adiciona classes que podem interferir com a propagação de estilos.

## Solução Proposta (Seguindo as Recomendações)

Em vez de "forçar" estilos com `!important` e `z-index`, vamos atacar a raiz:

### Etapa 1: Corrigir CSS do Injector

**Arquivo:** `src/hooks/useBuilderThemeInjector.ts`

Remover todas as referências a `.builder-preview-canvas` (classe inexistente) e focar em `.storefront-container` que é a classe real usada pelo canvas.

**Mudança:**
- Remover seletores com `.builder-preview-canvas`
- Adicionar seletores que funcionem DENTRO do contexto de edição
- Usar seletores que NÃO dependam de `!important` desnecessário

### Etapa 2: Refatorar BlockRenderer para Não Bloquear Hovers

**Arquivo:** `src/components/builder/BlockRenderer.tsx`

**Mudança principal:** O wrapper do bloco usa `hover:outline` que não bloqueia hover por si só. O problema real é que o `handleClick` pode estar capturando eventos demais.

Implementar a estratégia recomendada:
1. Usar pseudo-elemento `::after` para indicador de hover do editor (não bloqueia eventos)
2. Manter hover de outline, mas garantir que seja puramente visual

**Antes (linha 389):**
```tsx
isEditing && 'hover:outline hover:outline-2 hover:outline-primary/50',
```

**Depois:**
```tsx
isEditing && 'relative before:content-[""] before:absolute before:inset-0 before:pointer-events-none before:rounded before:opacity-0 hover:before:opacity-100 before:ring-1 before:ring-primary/30',
```

### Etapa 3: Interceptar Cliques Corretamente

**Arquivo:** `src/components/builder/BlockRenderer.tsx`

Em vez de bloquear `pointer-events`, interceptar cliques em modo edição:

**Mudança:**
```tsx
const handleClick = (e: React.MouseEvent) => {
  if (isEditing && onSelect) {
    const target = e.target as HTMLElement;
    // Se clicou em botão/link e NÃO está no modo interact, selecionar o bloco
    if (target.closest('button, a[href]')) {
      e.preventDefault();
      e.stopPropagation();
    }
    onSelect(node.id);
  }
};
```

Isso mantém o hover funcional nos botões mas impede que cliquem acidentalmente enquanto editam.

### Etapa 4: Simplificar Modos (Opcional)

**Arquivos:** `BuilderToolbar.tsx`, `VisualBuilder.tsx`

Considerar renomear ou redesenhar:
- "Preview" atual → "Preview Externo" (abre em nova aba)
- O canvas JÁ É preview em tempo real

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/hooks/useBuilderThemeInjector.ts` | Remover `.builder-preview-canvas`, focar em `.storefront-container` |
| `src/components/builder/BlockRenderer.tsx` | Refatorar hover do editor para usar `::before/::after` não-intrusivo |
| `src/components/builder/BuilderCanvas.tsx` | (Opcional) Adicionar classe `.builder-editing` quando `isEditing=true` |

## Checklist de Testes

Antes de considerar implementação completa:

| Teste | Resultado Esperado |
|-------|-------------------|
| Hover do botão "Comprar Agora" em modo edição | Cor de hover do tema (ex: vermelho) aparece |
| Hover de links no header em modo edição | Estilo de hover funciona |
| Clicar em botão em modo edição | NÃO executa ação, seleciona o bloco |
| Clicar em botão em modo "Testar" | EXECUTA ação (adiciona ao carrinho) |
| RichText continua editável | Clique dentro do editor funciona |
| Drag & drop de blocos | Continua funcionando |
| Seleção de blocos | Continua mostrando borda azul |

## Benefícios da Abordagem

| Aspecto | Abordagem Anterior | Abordagem Revisada |
|---------|-------------------|-------------------|
| CSS `!important` | Usado extensivamente | Minimizado |
| `z-index` hack | Sim | Não |
| `pointer-events: auto` forçado | Sim | Não |
| Risco de regressão | Alto | Baixo |
| WYSIWYG real | Não | Sim |

## Ordem de Implementação

1. **Primeiro:** Corrigir `useBuilderThemeInjector.ts` (remover classe inexistente)
2. **Segundo:** Testar se isso já resolve o problema
3. **Se necessário:** Refatorar `BlockRenderer.tsx` para overlay não-intrusivo
4. **Por último:** Ajustar interceptação de cliques

## Documentação Necessária

Após implementação, atualizar:
- `docs/regras/builder.md` - Adicionar seção sobre "WYSIWYG Real Time"
- Memory `style/button-hover-states` - Atualizar com nova arquitetura
