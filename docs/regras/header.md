# Header — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Quick Reference — Props Canônicos

| Prop | Tipo | Descrição |
|------|------|-----------|
| `showSearch` | boolean | Exibe campo de busca |
| `showCart` | boolean | Exibe ícone do carrinho |
| `sticky` | boolean | Header fixo no scroll (desktop) |
| `stickyOnMobile` | boolean | Header fixo no scroll (mobile) |
| `customerAreaEnabled` | boolean | Exibe link "Minha Conta" |
| `showHeaderMenu` | boolean | Exibe menu de navegação |
| `noticeEnabled` | boolean | Exibe barra de aviso |
| `featuredPromosEnabled` | boolean | Exibe promoções em destaque |
| `featuredPromosLabel` | string | Texto do link de destaque |
| `featuredPromosTarget` | string | Destino (ex: `category:slug` ou `page:slug`) |
| `featuredPromosTextColor` | string | Cor do texto de destaque |
| `featuredPromosBgColor` | string | Cor de fundo do badge de destaque |
| `featuredPromosThumbnail` | string | URL da miniatura exibida no hover (desktop) |
| `menuVisualStyle` | `'classic'` \| `'elegant'` \| `'minimal'` | Estilo visual dos dropdowns do menu |
| `menuShowParentTitle` | boolean | Exibe título da categoria pai no dropdown |
| `logoSize` | `'small'` \| `'medium'` \| `'large'` | Tamanho da logo no header |

> ⚠️ **ATENÇÃO:** O destino de promoções em destaque usa `featuredPromosTarget`, NÃO `featuredPromosDestination`.

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Wrapper** | `src/components/storefront/StorefrontHeader.tsx` | Container e controle de sticky |
| **Conteúdo Principal** | `src/components/storefront/StorefrontHeaderContent.tsx` | Toda a lógica e renderização |
| **Dropdown Atendimento** | `src/components/storefront/HeaderAttendanceDropdown.tsx` | Menu de contato/atendimento |
| **Settings (Builder)** | `src/components/builder/theme-settings/HeaderSettings.tsx` | Configuração no Builder |

---

## Fontes de Dados (Prioridade)

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| 1 | `props.logoUrl` (BlockNode) | Logo definida na configuração do header/checkout |
| 2 | `header_config` | JSON em `storefront_global_layout` |
| 3 | `store_settings` | Dados do tenant (logo, nome, contato) |
| 4 | `menus` (location='header') | Menu de navegação do header |
| 5 | Dados Demo | Fallback quando `isEditing=true` e sem dados reais |

### Herança de Logo (REGRA CRÍTICA)

A logo segue uma cadeia de prioridade implementada em `StorefrontHeaderContent.tsx`:

```typescript
// Logo URL - props.logoUrl tem PRIORIDADE sobre storeSettings.logo_url
const effectiveLogoUrl = props.logoUrl && String(props.logoUrl).trim() !== '' 
  ? String(props.logoUrl) 
  : storeSettings?.logo_url || '';
```

| Prioridade | Fonte | Quando Usa |
|------------|-------|------------|
| 1 | `props.logoUrl` | Se definida e não vazia no header_config ou checkout_header_config |
| 2 | `storeSettings.logo_url` | Fallback se props.logoUrl não está definida |

> ⚠️ **PROIBIDO**: Ignorar `props.logoUrl` e usar diretamente `storeSettings.logo_url`. Isso quebra a herança entre checkout e global.

---

## Estrutura Visual — Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BARRA DE AVISO (Opcional)                      │
│  [Texto animado] [Botão de ação opcional]                               │
├─────────────────────────────────────────────────────────────────────────┤
│  LINHA PRINCIPAL                                                         │
│  ┌─────────────┐  ┌───────────────────────────┐  ┌───────────────────┐  │
│  │   Busca     │  │         LOGO              │  │ Atend | Conta | 🛒│  │
│  └─────────────┘  └───────────────────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  LINHA SECUNDÁRIA                                                        │
│  ┌───────────────────┐  ┌─────────────────────────────┐  ┌───────────┐ │
│  │ Promo Destaque    │  │ Menu Header (Categorias...) │  │ (spacer)  │ │
│  └───────────────────┘  └─────────────────────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Estrutura Visual — Mobile

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BARRA DE AVISO (Opcional)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  LINHA PRINCIPAL                                                         │
│  ┌────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │ ☰ Menu │  │         LOGO            │  │      Conta | 🛒         │   │
│  └────────┘  └─────────────────────────┘  └─────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  LINHA SECUNDÁRIA (Extensão Mobile)                                      │
│  ┌───────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │        🔍 Campo de Busca       │  │   Categoria/Promoção Destaque   │ │
│  └───────────────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Configurações da Barra de Aviso

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `noticeText` | string | "" | Texto do aviso (legado, usar noticeTexts) |
| `noticeTexts` | string[] | [] | Array de textos para rotação automática |
| `noticeBgColor` | string | "" | Cor de fundo |
| `noticeTextColor` | string | "" | Cor do texto |
| `noticeAnimation` | `'fade'` \| `'slide-vertical'` \| `'slide-horizontal'` \| `'marquee'` \| `'none'` | 'none' | Animação do texto |
| `noticeActionEnabled` | boolean | false | Exibe botão de ação |
| `noticeActionLabel` | string | "Saiba mais" | Texto do botão |
| `noticeActionUrl` | string | "" | URL do botão |
| `noticeActionTarget` | `'_self'` \| `'_blank'` | '_self' | Target do link |

### Sistema de Rotação de Textos

Quando `noticeTexts` contém múltiplos textos:
- Rotação automática a cada 4 segundos
- Transição suave entre textos usando o efeito selecionado em `noticeAnimation`
- Compatível com todos os efeitos exceto `marquee` (que usa texto contínuo)

### Efeitos de Animação

| Efeito | Descrição |
|--------|-----------|
| `none` | Texto estático, sem animação |
| `fade` | Transição com fade in/out |
| `slide-vertical` | Texto desliza de baixo para cima |
| `slide-horizontal` | Texto desliza da direita para esquerda |
| `marquee` | Rolagem horizontal contínua (texto único, loop infinito) |

> **Nota:** O valor legado `slide` é automaticamente convertido para `slide-vertical`.

---

## Dropdown de Atendimento

| Dados | Fonte | Descrição |
|-------|-------|-----------|
| `phoneNumber` | `store_settings.phone` | Telefone fixo |
| `whatsAppNumber` | `store_settings.whatsapp` | Número WhatsApp |
| `emailAddress` | `store_settings.support_email` | Email de suporte |
| `address` | `store_settings.address` | Endereço físico |
| `businessHours` | `store_settings.support_hours` | Horário de atendimento |

**Comportamento:**
- Abre em hover (desktop) com delay de 150ms
- Abre em click (mobile/acessibilidade)
- Fecha com ESC ou click fora
- Não renderiza se não houver nenhum dado válido

---

## Menu de Navegação Hierárquico

| Característica | Descrição |
|----------------|-----------|
| **Níveis** | Até 3 níveis de profundidade |
| **Desktop** | Dropdowns em hover com animações |
| **Mobile** | Accordion expansível |
| **Tipos de item** | `category`, `page`, `external`, `landing_page` |

### Estilos Visuais de Menus

> Configurável em: **Configurações do tema** → **Cabeçalho** → **Visual Menus**

| Estilo | Descrição | Características |
|--------|-----------|-----------------|
| **Classic** | Tradicional com indicadores | Seta no trigger, header com título, indicador lateral animado no hover, link "Ver todos" no footer |
| **Elegant** | Suave com animações refinadas | Bordas arredondadas (2xl), animação slide-in-from-top-4, efeito scale+border no hover, transições suaves |
| **Minimal** | Limpo e minimalista | Sem setas, sem headers de categoria, sem borders, apenas efeito de cor no hover |

### Props de Visual Menus (Header)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `menuVisualStyle` | `'classic'` \| `'elegant'` \| `'minimal'` | `'classic'` | Estilo visual dos dropdowns |
| `menuShowParentTitle` | boolean | true | Exibe título da categoria pai no dropdown (apenas Classic/Elegant) |

### Detalhes de Implementação por Estilo

**Classic:**
- Container: `bg-popover/95 backdrop-blur-md rounded-xl shadow-xl`
- Animação: `animate-in fade-in-0 zoom-in-95 slide-in-from-top-2`
- Trigger: ChevronDown rotacionado em hover
- Header: Título uppercase com separador
- Hover: Indicador lateral animado (barra vertical primary)
- Footer: Link "Ver todos" para categoria pai

**Elegant:**
- Container: `bg-popover/98 backdrop-blur-lg rounded-2xl shadow-2xl border border-border/50`
- Animação: `animate-in fade-in-0 slide-in-from-top-4 duration-300`
- Trigger: Sem seta
- Header: Título com tipografia refinada (sem uppercase)
- Hover: `scale-[1.02]` + border-left primary + transição suave

**Minimal:**
- Container: `bg-popover rounded-lg shadow-lg`
- Animação: `animate-in fade-in-0 duration-200`
- Trigger: Sem seta
- Header: Não exibe
- Hover: Apenas mudança de cor (primary)

### Menu Demo (Builder)

Quando `isEditing=true` e não há menu real:

| Item | Comportamento |
|------|---------------|
| **Categorias** | Dropdown interativo com subitens demo |
| **Novidades** | Link simples (hover) |
| **Promoções** | Link simples (hover) |
| **Sobre** | Link simples (hover) |
| **Badge** | "Demo • Configure em Menus" |

**Subitens Demo de Categorias:**
- Masculino → Camisetas, Calças, Acessórios
- Feminino → Vestidos, Blusas, Saias
- Infantil
- Promoções

---

## Promoções em Destaque

| Prop | Tipo | Descrição |
|------|------|-----------|
| `featuredPromosEnabled` | boolean | Habilita/desabilita seção |
| `featuredPromosLabel` | string | Texto do badge (ex: "Ofertas da Semana") |
| `featuredPromosTarget` | string | Destino no formato `type:slug` |
| `featuredPromosTextColor` | string | Cor do texto do badge |
| `featuredPromosBgColor` | string | Cor de fundo do badge (fallback: primary) |
| `featuredPromosThumbnail` | string | URL da imagem exibida no hover (desktop) |

**Formatos de Target:**
- `category:slug` → Página de categoria
- `page:slug` → Página institucional
- `landing_page:slug` → Landing page

**Comportamento do Thumbnail:**
- Exibido apenas no desktop
- Aparece em hover sobre o badge
- Animação: `animate-in fade-in-0 zoom-in-95`
- Posição: abaixo do badge, centralizado

---

## Responsividade — Container Queries

| Classe | Breakpoint | Uso |
|--------|------------|-----|
| `.sf-header-mobile` | Container < 768px | Exibe versão mobile |
| `.sf-header-desktop` | Container ≥ 768px | Exibe versão desktop |

**Regra Fixa:** Usar classes `sf-*` (container queries) em vez de `md:`, `lg:` (media queries) dentro do storefront.

---

## Dados Demo (Builder)

> **REGRA:** Dados demo aparecem APENAS quando `isEditing=true` E não há dados reais.

| Elemento | Dado Demo | Condição |
|----------|-----------|----------|
| Nome da Loja | "Minha Loja" | Sem logo e sem nome |
| Atendimento | Telefone, WhatsApp, Email, Endereço, Horário fictícios | Sem dados de contato |
| Menu | Categorias com dropdown interativo + Novidades, Promoções, Sobre | Sem menu configurado |

---

## Regras de Configuração

| Regra | Descrição |
|-------|-----------|
| **Click no canvas** | Mostra mensagem direcionando para "Configurações do tema" |
| **Configuração** | Exclusivamente em "Configurações do tema" → "Cabeçalho" |
| **Dados de contato** | Fonte única: `store_settings` (tenant-wide) |
| **Proibido duplicar** | Não criar props separadas para contato no cabeçalho |

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2025-01-31 | Sistema de rotação de textos (noticeTexts) com múltiplas frases |
| 2025-01-31 | Novos efeitos de animação: slide-vertical, slide-horizontal (separados) |
| 2025-01-31 | Efeito marquee otimizado para evitar duplicação de texto |
| 2025-01-31 | Adicionado `logoSize` com 3 tamanhos: small (32px), medium (40px), large (56px) |
| 2025-01-31 | Corrigido URL de promoções em destaque de `/category/` para `/c/` |
| 2025-01-31 | Ajustadas dimensões da miniatura de promoção de 192x144 para 208x112 (mais larga) |
| 2025-01-30 | Adicionado `menuVisualStyle` com 3 estilos: Classic, Elegant, Minimal |
| 2025-01-30 | Adicionado `menuShowParentTitle` para ocultar/exibir título da categoria pai |
| 2025-01-30 | Nova seção "Visual Menus" em HeaderSettings.tsx |
| 2025-01-19 | Adicionado `featuredPromosBgColor` para cor customizada do badge |
| 2025-01-19 | Melhorado dropdown do menu com glassmorphism e indicadores visuais |
| 2025-01-19 | Menu demo interativo com subitens e efeitos de hover |
| 2025-01-19 | Removido emoji ✨ do badge de promoções |
| 2025-01-19 | Upload de thumbnail refinado no builder |
| 2025-02-28 | Logo do header com `loading="eager"` (above-the-fold) e otimização via `getLogoImageUrl()` |

---

## Otimização de Imagens (PageSpeed)

| Elemento | Função | Atributos |
|----------|--------|-----------|
| **Logo** | `getLogoImageUrl(url, 200)` | `loading="eager"`, `decoding="async"`, `width={180}`, `height={60}` |

> A logo é above-the-fold, portanto usa `loading="eager"` (não lazy).  
> O proxy wsrv.nl redimensiona para 200px e converte para WebP automaticamente.
