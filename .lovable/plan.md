

# Plano: Correção do Bloco de Categorias + Auditoria Completa dos 35 Blocos Personalizáveis

## Problemas Identificados no CategoryShowcase

### Problema 1 — Painel direito cortado
O painel de propriedades tem largura fixa de `w-72` (288px). O conteúdo do `CategoryMultiSelect` (lista de categorias com thumbnails, texto longo) ultrapassa essa largura. Solução: ajustar overflow e truncar textos dentro do painel.

### Problema 2 — Estilo "Cards" ignora seleção de categorias
**Causa raiz encontrada:** No modo "cards", o `CategoryListBlock` só usa a lista de `items` quando `source === 'custom'`. Porém, o campo `source` começa como `'auto'` (mostrar todas). Quando o usuário seleciona categorias no `items`, o `source` não muda automaticamente para `'custom'`, então o bloco continua mostrando TODAS as categorias.

**Solução:** Quando o usuário adicionar categorias via `items`, o sistema deve automaticamente mudar `source` para `'custom'`. Ou, melhor ainda, quando `items.length > 0` no modo cards, tratar como custom independentemente do valor de `source`.

---

## Plano de Execução

### Fase 1 — Correções do CategoryShowcase
1. **Corrigir lógica de source no CategoryListBlock** — quando `items.length > 0`, tratar como custom automaticamente
2. **Corrigir overflow do painel** — truncar nomes longos de categorias e ajustar largura do conteúdo no `CategoryMultiSelect`

### Fase 2 — Auditoria dos 35 Blocos Personalizáveis
Inserir cada bloco em uma página de teste no Builder e verificar:
- O bloco renderiza sem erro?
- As propriedades do painel direito aparecem corretamente?
- Alterar cada configuração reflete visualmente no bloco?
- O painel não tem overflow/corte?

**Blocos a auditar (35):**
- Banners: `Banner`, `BannerProducts`
- Produtos: `ProductShowcase`, `ProductCard`
- Categorias: `CategoryShowcase` (já corrigido na Fase 1)
- Galerias: `VideoCarousel`, `ImageGallery`, `LogosCarousel`
- Conteúdo: `RichText`, `Button`, `Image`, `Video`, `ContentSection`, `Highlights`, `StepsTimeline`, `CountdownTimer`, `StatsNumbers`, `FAQ`, `CustomCode`, `EmbedSocialPost`
- Engajamento: `SocialProof`, `ContactForm`, `Map`, `SocialFeed`, `PersonalizedProducts`, `LivePurchases`, `PricingTable`, `NewsletterPopup`
- Formulários: `NewsletterUnified`, `QuizEmbed`
- Layout: `Section`, `Container`, `Columns`, `Spacer`, `Divider`

### Fase 3 — Correções encontradas na auditoria
Aplicar correções para qualquer problema encontrado.

### Fase 4 — Documentação
- Atualizar o doc de consolidação de blocos (`mem://features/ui-builder/block-consolidation-standard`)
- Registrar problema × solução para cada correção
- Atualizar `mapa-ui.md` se aplicável

---

## Detalhes Técnicos

**Arquivos principais afetados (Fase 1):**
- `src/components/builder/blocks/CategoryListBlock.tsx` — lógica de source
- `src/components/builder/CategoryMultiSelect.tsx` — overflow/truncate
- `src/lib/builder/registry.ts` — possível ajuste no schema

**Método de auditoria (Fase 2):**
- Análise de código: verificar `propsSchema` vs renderização real de cada bloco
- Teste via browser: navegar ao Builder, inserir blocos e verificar interação
- Validação de build: `tsc --noEmit` após correções

