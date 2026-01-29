
# Plano: WYSIWYG Unificado (CONCLUÍDO)

## ✅ IMPLEMENTADO (v3 - WYSIWYG Completo)

### Princípio
O Storefront Builder opera em **um único modo**: o próprio editor É o preview/teste. Não existem modos separados.

### Mudanças Realizadas

#### 1. Remoção de Modos Separados
- ✅ Removido `isInteractMode` do `VisualBuilder.tsx`
- ✅ Removido toggle "Modo Testar" do `BuilderToolbar.tsx`
- ✅ Removido banner de modo de interação do `BuilderCanvas.tsx`
- ✅ Props `isInteractMode` removidas de toda a árvore de componentes

#### 2. Arquitetura de Eventos WYSIWYG
- ✅ `BlockRenderer.tsx` usa `onMouseDown` para seleção (não `onClick`)
- ✅ Overlay de hover usa `pointer-events: none` para não interferir
- ✅ Estados CSS `:hover` funcionam em todos os elementos filhos

#### 3. Componentes Funcionais Durante Edição
- ✅ `ProductCTAs.tsx` - Botões de compra funcionam
- ✅ `ProductCard.tsx` - Removido `pointer-events-none` do wrapper
- ✅ Carrosséis de imagem - Navegação funcional
- ✅ Inputs e formulários - Interação real

#### 4. Injeção de Tema em Tempo Real
- ✅ `templateSetId` passado corretamente para todos os editores:
  - `PageBuilder.tsx`
  - `TemplateBuilder.tsx`
  - `BlogPostEditor.tsx`
- ✅ `useBuilderThemeInjector.ts` aplica CSS de hover em `.storefront-container`

### Comportamento Final

| Ação | Resultado |
|------|-----------|
| Hover em botão "Comprar" | ✅ Cor de hover do tema aparece |
| Hover em card de produto | ✅ Sombra/escala aplicadas |
| Clicar em bloco | ✅ Seleciona para edição |
| Clicar em botão (não bloco) | ✅ Executa ação real |
| Editar cores no tema | ✅ Reflete em tempo real no canvas |

### Arquitetura Final

```
┌─────────────────────────────────────────┐
│ .storefront-container (canvas)          │
│  ├── Theme CSS injetado (hovers)        │
│  └── Block Wrapper (onMouseDown)        │
│       ├── Hover Overlay (pointer:none)  │
│       └── Block Content                 │
│            └── Botões/Links             │
│                 └── :hover FUNCIONA!    │
└─────────────────────────────────────────┘
```

### Documentação Atualizada
- ✅ `docs/regras/builder.md` - Nova seção "WYSIWYG Unificado"
