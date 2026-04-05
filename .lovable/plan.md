

## Plano: Unificar ImageGallery + ImageCarousel em bloco modular único

### Situacao Atual

**Dois blocos separados com 70% de sobreposicao:**

- `ImageGalleryBlock.tsx` — monolitico (200 linhas), layout grid, lightbox inline
- `ImageCarouselBlock.tsx` — monolitico (454 linhas), carousel embla, lightbox inline, autoplay
- Dois compiladores Edge separados (`image-gallery.ts`, `image-carousel.ts`)
- Duas entradas no `registry.ts`
- Duas entradas no `BlockRenderer.tsx`
- Documentacao trata como blocos independentes (4.6 e 4.7)

**Problemas:**
- Lightbox duplicado (logica identica em ambos)
- Helpers duplicados (aspect ratio, gap classes repetidos)
- Schema de imagem incompativel (`src` vs `srcDesktop/srcMobile`)
- Nao segue o padrao modular ja estabelecido pelo VideoCarousel

### Plano de Execucao

**Etapa 1 — Criar diretorio modular `src/components/builder/blocks/image-gallery/`**

Seguindo exatamente o padrao do VideoCarousel:

| Arquivo | Responsabilidade |
|---------|-----------------|
| `types.ts` | Interface `GalleryImage` unificada (com `src`, `srcMobile`, `linkUrl`), props do bloco, tipos de layout |
| `helpers.ts` | Funcoes puras: `parseImages()`, `getAspectRatioClass()`, `getGapClass()`, `getGridColsClass()` — reutilizando `toSafeNumber` do video-carousel/helpers |
| `ImageCard.tsx` | Card individual com `<picture>` (desktop/mobile), hover effect, zoom overlay |
| `CarouselLayout.tsx` | Layout carousel usando `embla-carousel-react` com `itemsPerSlide`, autoplay, setas, dots |
| `GridLayout.tsx` | Layout grid com colunas configuraveis, gap, paginacao opcional |
| `Lightbox.tsx` | Componente extraido — navegacao, keyboard, contador (responsabilidade unica) |
| `ImageGalleryBlock.tsx` | Orquestrador: recebe `layout` prop, delega para CarouselLayout ou GridLayout |
| `index.tsx` | Re-export publico |

**Etapa 2 — Reutilizar helpers existentes**

- `toSafeNumber` de `video-carousel/helpers.ts` sera importado (ou movido para `src/lib/utils.ts` para compartilhamento real)
- `getGridColsClass` e `getAspectRatioClass` ja existem no video-carousel — avaliar extrair para utils compartilhado ou reimplementar com assinatura especifica para imagens (aspectos diferentes: `square`, `21:9`)
- `cn` de `@/lib/utils` ja existe

**Etapa 3 — Registry unificada**

- Manter entrada `ImageGallery` com novo campo `layout` (select: `grid` | `carousel`)
- Props condicionais com `showWhen`:
  - Grid: `columns`, `borderRadius`
  - Carousel: `slidesPerView`, `autoplay`, `autoplayInterval`, `showArrows`, `showDots`
- Props compartilhadas: `title`, `subtitle`, `images`, `gap`, `aspectRatio`, `enableLightbox`, `backgroundColor`
- Remover entrada separada `ImageCarousel` do registry

**Etapa 4 — Retrocompatibilidade no BlockRenderer**

- `ImageGallery` aponta para novo componente unificado
- `ImageCarousel` mantido como alias no mapa do BlockRenderer, redirecionando para o mesmo componente (paginas ja salvas com `ImageCarousel` continuam funcionando)
- O alias converte `slidesPerView` para `itemsPerSlide` e seta `layout: 'carousel'` automaticamente

**Etapa 5 — Compilador Edge unificado**

- `image-gallery.ts` absorve a logica do carousel (scroll horizontal com CSS snap para storefront estatico)
- `image-carousel.ts` vira alias que chama `imageGalleryToStaticHTML` com `layout: 'carousel'`
- Mapa no `index.ts` mantido para ambos os tipos

**Etapa 6 — Mover `toSafeNumber` para `src/lib/utils.ts`**

- Utilitario compartilhado entre video-carousel e image-gallery
- Video-carousel passa a importar de `@/lib/utils` em vez de local

**Etapa 7 — Atualizar documentacao**

- `builder.md`: Unificar secoes 4.6 e 4.7 em uma unica secao "Galeria de Imagens (ImageGallery)" com subsecoes Grid e Carousel
- `paridade-builder-publico.md`: Atualizar mapa de arquivos
- `loja-virtual.md`: Atualizar referencia

**Etapa 8 — Testes e validacao**

- Verificar build sem erros
- Testar que blocos `ImageCarousel` ja existentes em paginas salvas continuam renderizando (alias)
- Testar ambos layouts (grid e carousel) no Builder
- Verificar compilador Edge gera HTML correto para ambos modos
- Validar lightbox funciona em ambos layouts

### Detalhe Tecnico — Schema Unificado de Imagem

```text
GalleryImage {
  id?: string
  src: string          // obrigatorio (desktop principal)
  srcMobile?: string   // opcional, para <picture>
  alt?: string
  caption?: string
  linkUrl?: string     // opcional, wrap em <a>
}
```

Retrocompatibilidade: imagens salvas como `{ srcDesktop }` serao normalizadas no `parseImages()` para `{ src: srcDesktop }`.

### Detalhe Tecnico — Registry Unificada

```text
ImageGallery
  layout: select [grid, carousel]  (default: grid)
  — Grid: columns (2/3/4), borderRadius
  — Carousel: slidesPerView (1/2/3/4), autoplay, autoplayInterval, showArrows, showDots
  — Compartilhado: title, subtitle, images, gap, aspectRatio, enableLightbox, backgroundColor
```

### Riscos e Mitigacao

| Risco | Mitigacao |
|-------|-----------|
| Paginas salvas com tipo `ImageCarousel` | Alias no BlockRenderer + alias no compilador Edge |
| Props incompativeis (`srcDesktop` vs `src`) | `parseImages()` normaliza ambos formatos |
| Regressao no lightbox | Componente extraido testavel isoladamente |
| Build quebrado | Validacao de TypeScript + build antes de fechar |

