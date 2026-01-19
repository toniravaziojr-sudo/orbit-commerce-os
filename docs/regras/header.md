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
| 1 | `header_config` | JSON em `storefront_global_layout` |
| 2 | `store_settings` | Dados do tenant (logo, nome, contato) |
| 3 | `menus` (location='header') | Menu de navegação do header |
| 4 | Dados Demo | Fallback quando `isEditing=true` e sem dados reais |

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
| `noticeText` | string | "" | Texto do aviso |
| `noticeBgColor` | string | "" | Cor de fundo |
| `noticeTextColor` | string | "" | Cor do texto |
| `noticeAnimation` | `'fade'` \| `'slide'` \| `'none'` | 'none' | Animação do texto |
| `noticeActionEnabled` | boolean | false | Exibe botão de ação |
| `noticeActionLabel` | string | "Saiba mais" | Texto do botão |
| `noticeActionUrl` | string | "" | URL do botão |
| `noticeActionTarget` | `'_self'` \| `'_blank'` | '_self' | Target do link |

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

### Estilo do Dropdown (Desktop)

| Característica | Implementação |
|----------------|---------------|
| **Container** | `bg-popover/95 backdrop-blur-md rounded-xl shadow-xl` |
| **Animação** | `animate-in fade-in-0 zoom-in-95 slide-in-from-top-2` |
| **Header** | Título uppercase com separador |
| **Hover** | Indicador lateral animado (barra vertical primary) |
| **Subitems** | Slide para direita com header próprio |
| **Footer** | Link "Ver todos" para categoria pai |
| **Arrow** | Seta rotacionada apontando para trigger |

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
| 2025-01-19 | Adicionado `featuredPromosBgColor` para cor customizada do badge |
| 2025-01-19 | Melhorado dropdown do menu com glassmorphism e indicadores visuais |
| 2025-01-19 | Menu demo interativo com subitens e efeitos de hover |
| 2025-01-19 | Removido emoji ✨ do badge de promoções |
| 2025-01-19 | Upload de thumbnail refinado no builder |
