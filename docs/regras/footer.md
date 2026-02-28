# Footer — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Quick Reference — Props Canônicos

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `showLogo` | boolean | true | Exibe logo da loja |
| `showStoreInfo` | boolean | true | Exibe nome e descrição |
| `showSac` | boolean | true | Exibe seção de atendimento |
| `showSocial` | boolean | true | Exibe redes sociais |
| `showFooter1` | boolean | true | Exibe menu footer 1 |
| `showFooter2` | boolean | true | Exibe menu footer 2 |
| `showCopyright` | boolean | true | Exibe linha de copyright |
| `footerBgColor` | string | "" | Cor de fundo |
| `footerTextColor` | string | "" | Cor do texto |
| `footerTitlesColor` | string | "" | Cor dos títulos |
| `primaryColor` | string | "" | Cor primária (links) |
| `sacTitle` | string | "Atendimento" | Título da seção SAC |
| `footer1Title` | string | "Institucional" | Título do menu 1 |
| `footer2Title` | string | "Políticas" | Título do menu 2 |
| `copyrightText` | string | "" | Texto customizado de copyright |
| `menuVisualStyle` | `'classic'` \| `'elegant'` \| `'minimal'` | `'classic'` | Estilo visual dos links do menu |
| `badgeSize` | `'small'` \| `'medium'` \| `'large'` | `'medium'` | Tamanho dos selos (pagamento, segurança, frete, lojas) |

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Wrapper** | `src/components/storefront/StorefrontFooter.tsx` | Container e contexto |
| **Conteúdo Principal** | `src/components/storefront/StorefrontFooterContent.tsx` | Toda a lógica e renderização |
| **Settings (Builder)** | `src/components/builder/theme-settings/FooterSettings.tsx` | Configuração no Builder |

---

## Fontes de Dados (Prioridade)

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| 1 | `footer_config` | JSON em `storefront_global_layout` |
| 2 | `store_settings` | Dados do tenant (logo, nome, contato, redes) |
| 3 | `menus` (location='footer_1', 'footer_2') | Menus do footer |
| 4 | Dados Demo | Fallback quando `isEditing=true` e sem dados reais |

---

## Estrutura Visual — Desktop (5 Colunas)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FOOTER PRINCIPAL                                                        │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Logo/    │ │  SAC         │ │ Footer 1 │ │ Footer 2 │ │ Selos/     │ │
│  │ Info     │ │  + Redes     │ │ Menu     │ │ Menu     │ │ Imagens    │ │
│  │ da Loja  │ │  Sociais     │ │          │ │          │ │            │ │
│  └──────────┘ └──────────────┘ └──────────┘ └──────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  LINHA DE COPYRIGHT                                                      │
│  © 2024 Nome da Loja. Todos os direitos reservados.                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Estrutura Visual — Mobile (Blocos Empilhados)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Logo + Nome + Descrição                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    SAC (WhatsApp, Telefone, Email)                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Redes Sociais                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Footer Menu 1                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Footer Menu 2                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Selos (Pagamento/Segurança/Frete)               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Copyright                                       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dados de Contato (SAC)

| Campo | Fonte | Descrição |
|-------|-------|-----------|
| WhatsApp | `store_settings.whatsapp` | Link direto para WhatsApp |
| Telefone | `store_settings.phone` | Link tel: |
| Email | `store_settings.support_email` | Link mailto: |
| Endereço | `store_settings.address` | Texto do endereço |
| Horário | `store_settings.support_hours` | Horário de atendimento |

---

## Redes Sociais Suportadas

| Rede | Campo em `store_settings` |
|------|---------------------------|
| Facebook | `social_facebook` |
| Instagram | `social_instagram` |
| TikTok | `social_tiktok` |
| YouTube | `social_youtube` |
| Link Customizado | `social_custom_url` + `social_custom_label` |

---

## Seções de Imagens/Selos

| Seção | Descrição |
|-------|-----------|
| Pagamento | Logos de bandeiras/métodos de pagamento |
| Segurança | Selos de segurança (SSL, Google Safe, etc) |
| Frete | Logos de transportadoras |
| Lojas Oficiais | Selos de marketplaces |

### Seleção Rápida de Bandeiras de Pagamento

O componente `PaymentIconsQuickSelect` permite adicionar ícones de pagamento pré-definidos em massa.

| Componente | Arquivo |
|------------|---------|
| **Quick Select** | `src/components/builder/theme-settings/PaymentIconsQuickSelect.tsx` |

**Bandeiras Disponíveis:**
| ID | Nome |
|----|------|
| `visa` | Visa |
| `mastercard` | Mastercard |
| `elo` | Elo |
| `amex` | American Express |
| `hipercard` | Hipercard |
| `pix` | PIX |
| `boleto` | Boleto |
| `mercadopago` | Mercado Pago |
| `paypal` | PayPal |
| `nubank` | Nubank |
| `picpay` | PicPay |
| `dinersclub` | Diners Club |

**Comportamento:**
- Botão "Seleção Rápida de Bandeiras" abre picker
- Grid 4 colunas com ícones selecionáveis
- Ícones já adicionados ficam desabilitados
- Botão "Adicionar Todas" adiciona todas de uma vez
- Botão "Adicionar (N)" adiciona apenas selecionadas
- Ícones são SVGs inline (data URI), não dependem de CDN

---

## Estilos Visuais de Menus (Footer)

> Configurável em: **Configurações do tema** → **Rodapé** → **Visual Menus**

| Estilo | Descrição | Efeito Hover |
|--------|-----------|--------------|
| **Classic** | Tradicional com underline | Sublinhado animado da esquerda para direita |
| **Elegant** | Suave com transição de cor | Cor primária com transição suave (300ms) |
| **Minimal** | Limpo e discreto | Apenas mudança de opacidade (0.7 → 1) |

### Prop de Visual Menus (Footer)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `menuVisualStyle` | `'classic'` \| `'elegant'` \| `'minimal'` | `'classic'` | Estilo visual dos links de menu |

### Tamanho dos Selos (Badge Size)

> Configurável em: **Configurações do tema** → **Rodapé** → **Visual Menus** → **Tamanho dos Selos**

**Selos Padrão (Segurança, Frete, Lojas Oficiais):**

| Tamanho | Altura Mobile | Altura Desktop | Referência para Upload |
|---------|---------------|----------------|------------------------|
| **Pequeno** | 24px (h-6) | 32px (h-8) | Suba imagens com ~24-32px de altura |
| **Médio** (padrão) | 32px (h-8) | 40px (h-10) | Suba imagens com ~32-40px de altura |
| **Grande** | 40px (h-10) | 48px (h-12) | Suba imagens com ~40-48px de altura |

**Bandeiras de Pagamento (30% menores para equilíbrio visual):**

| Tamanho | Altura Mobile | Altura Desktop | Referência para Upload |
|---------|---------------|----------------|------------------------|
| **Pequeno** | 17px | 22px | Suba imagens com ~17-22px de altura |
| **Médio** (padrão) | 22px | 28px | Suba imagens com ~22-28px de altura |
| **Grande** | 28px | 34px | Suba imagens com ~28-34px de altura |

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `badgeSize` | `'small'` \| `'medium'` \| `'large'` | `'medium'` | Tamanho padronizado de todos os selos |

---

## Responsividade — Container Queries

| Classe | Breakpoint | Uso |
|--------|------------|-----|
| `.sf-footer-mobile` | Container < 768px | Exibe versão mobile |
| `.sf-footer-desktop` | Container ≥ 768px | Exibe versão desktop |

**Regra Fixa:** Usar classes `sf-*` (container queries) em vez de `md:`, `lg:` (media queries) dentro do storefront.

---

## Dados Demo (Builder)

> **REGRA:** Dados demo aparecem APENAS quando `isEditing=true` E não há dados reais.

| Elemento | Dado Demo | Condição |
|----------|-----------|----------|
| Nome da Loja | "Minha Loja" | Sem logo e sem nome |
| Descrição | "Sua loja online de confiança..." | Sem descrição |
| SAC | Telefone, WhatsApp, Email, Endereço, Horário fictícios | Sem dados de contato |
| Redes Sociais | Facebook, Instagram fictícios | Sem redes configuradas |
| Footer Menu 1 | "Novidades", "Mais Vendidos", "Promoções", "Lançamentos" | Sem menu |
| Footer Menu 2 | "Sobre", "Política de Privacidade", "Termos de Uso", "Contato" | Sem menu |

---

## Regras de Configuração

| Regra | Descrição |
|-------|-----------|
| **Click no canvas** | Mostra mensagem direcionando para "Configurações do tema" |
| **Configuração** | Exclusivamente em "Configurações do tema" → "Rodapé" |
| **Dados de contato** | Fonte única: `store_settings` (tenant-wide) |
| **Reflexo automático** | Alterações em `store_settings` refletem em header E footer |
| **Proibido duplicar** | Não criar props separadas para contato no rodapé |

---

## Newsletter no Footer

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `showNewsletter` | boolean | false | Exibe formulário de newsletter |
| `newsletterTitle` | string | "Receba nossas promoções" | Título da seção |
| `newsletterSubtitle` | string | "Inscreva-se para..." | Subtítulo descritivo |
| `newsletterPlaceholder` | string | "Seu e-mail" | Placeholder do input |
| `newsletterButtonText` | string | "" | Texto do botão (ícone se vazio) |
| `newsletterSuccessMessage` | string | "Inscrito com sucesso!" | Mensagem pós-envio |
| `newsletterListId` | string | "" | ID da lista de marketing destino |

### Componente

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **FooterNewsletterForm** | `src/components/storefront/footer/FooterNewsletterForm.tsx` | Formulário horizontal de captura |

### Integração

- Usa Edge Function `marketing-form-submit` para envio
- Source identificado como `footer_newsletter`
- Suporta seleção de lista via `EmailListSelector` nas configurações

---

## Validação de Links de Menu

> **REGRA CRÍTICA:** Itens de menu com referências inválidas NÃO são renderizados no storefront público.

| Situação | Comportamento |
|----------|---------------|
| `item_type: 'page'` + `ref_id: null` | Item NÃO renderizado |
| `item_type: 'page'` + página inexistente | Item NÃO renderizado |
| `item_type: 'category'` + `ref_id: null` | Item NÃO renderizado |
| `item_type: 'category'` + categoria inexistente | Item NÃO renderizado |
| `item_type: 'external'` + `url: null` | Item NÃO renderizado |
| `item_type: 'external'` + URL válida | Item renderizado normalmente |

### Função de Validação

```typescript
// getMenuItemUrl retorna null para referências inválidas
const url = getMenuItemUrl(item, categories, pages, tenantSlug);
if (!url) return null; // Item não é renderizado
```

### Impacto na Importação

- Dados importados de outras plataformas podem conter `item_type: 'page'` sem páginas correspondentes
- O sistema filtra automaticamente esses itens inválidos
- Recomendação: criar as páginas institucionais antes de vincular nos menus

### Aviso de Itens Ocultos

> **REGRA:** Quando há itens de menu apontando para páginas não publicadas, o sistema exibe aviso em dois locais.

**1. Página de Menus (Admin - `/menus`)**

O componente `MenuPanel` exibe aviso nos painéis Footer 1 e Footer 2:

```tsx
// Arquivo: src/components/menus/MenuPanel.tsx
// Exibido quando unpublishedPageItemsCount > 0 e isFooterMenu
<div className="mx-4 mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
  <span className="text-xs text-amber-600">
    ⚠️ {count} item(ns) oculto(s) - páginas não publicadas
  </span>
</div>
```

**Props necessárias:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `pages` | Array<{id, title, is_published}> | Lista de páginas com status de publicação |
| `location` | 'header' \| 'footer_1' \| 'footer_2' | Tipo do menu (aviso só para footer) |

**2. Builder da Loja Virtual (Editor Visual)**

O componente `StorefrontFooterContent` exibe aviso quando `isEditing=true`:

```tsx
// Arquivo: src/components/storefront/StorefrontFooterContent.tsx
<span className="text-xs text-amber-500">
  ⚠️ {count} item(ns) oculto(s) - páginas não publicadas
</span>
```

**Cálculo (ambos locais):**
```typescript
// MenuPanel: conta itens de página com is_published=false
const unpublishedPageItemsCount = localItems.filter(item => {
  if (item.item_type !== 'page' || !item.ref_id) return false;
  const page = pages.find(p => p.id === item.ref_id);
  return page && page.is_published === false;
}).length;

// StorefrontFooterContent: diferença entre configurados e válidos
const hiddenCount = configuredItems.length - validItems.length;
```

---

## Otimização de Imagens (PageSpeed)

> **REGRA:** Todas as imagens do footer (selos de segurança, formas de envio, lojas oficiais) DEVEM usar o helper `getLogoImageUrl()` de `src/lib/imageTransform.ts` para conversão automática via proxy wsrv.nl.

| Seção | Helper | Tamanho | Atributos obrigatórios |
|-------|--------|---------|------------------------|
| Selos de Segurança | `getLogoImageUrl(url, 200)` | 200px WebP | `loading="lazy" decoding="async"` |
| Formas de Envio | `getLogoImageUrl(url, 200)` | 200px WebP | `loading="lazy" decoding="async"` |
| Lojas Oficiais | `getLogoImageUrl(url, 200)` | 200px WebP | `loading="lazy" decoding="async"` |

**Impacto:** Reduz ~1.5-2MB de payload por página (PNGs 2000px → WebP 200px).

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-02-28 | **PERFORMANCE**: Selos, formas de envio e lojas oficiais agora usam `getLogoImageUrl()` com `loading="lazy"` e `decoding="async"` para otimização PageSpeed |
| 2026-02-02 | **AJUSTE**: Bandeiras de pagamento agora são 30% menores que os outros selos para equilíbrio visual |
| 2026-02-02 | **UNIFICAÇÃO**: Tamanhos de selos padronizados para todos os tipos (Pagamento, Segurança, Frete, Lojas) |
| 2026-02-02 | Referência de dimensões (px) adicionada no UI do builder para orientar uploads |
| 2026-02-01 | **FIX v5**: Movido gerenciamento de `pendingUpdatesRef` para o hook `useThemeFooter` — hook agora retorna `footer` já mesclado com atualizações pendentes |
| 2026-02-01 | `FooterSettings.tsx` simplificado — não precisa mais de estado local para seções de imagem (paymentMethods, etc.) |
| 2026-02-01 | Correção usa `saveThemeSettingsAsync` para aguardar persistência antes de limpar flags |
| 2026-02-01 | **FIX v4**: Novo sistema de `pendingSaveKeysRef` para rastrear chaves em salvamento e evitar sobrescrita por sync |
| 2026-02-01 | Removido `isInitializedRef` que bloqueava re-sincronização; sync agora preserva chaves pendentes |
| 2026-02-01 | **FIX v3**: Estado local é fonte única de verdade; removida invalidação de query no `onSettled` |
| 2026-02-01 | **CRITICAL FIX**: Corrigido bug de persistência de selos usando optimistic updates no useThemeSettings |
| 2026-02-01 | Corrigido bug de stale closures em FooterImageSection que impedia adicionar/remover/substituir selos |
| 2026-02-01 | Adicionado `badgeSize` com 3 tamanhos: Pequeno, Médio, Grande para selos do rodapé |
| 2025-01-30 | Adicionado `menuVisualStyle` com 3 estilos: Classic, Elegant, Minimal |
| 2025-01-30 | Nova seção "Visual Menus" em FooterSettings.tsx |
| 2025-01-25 | Aviso de páginas não publicadas adicionado na página de Menus (admin) |
| 2025-01-25 | Aviso de itens ocultos exibido no Builder quando há páginas não publicadas |
| 2025-01-25 | Removido `.limit(5)` da query de categorias para corrigir validação de links |
| 2025-01-25 | Links de menu com referências inválidas não são mais renderizados |
| 2025-01-24 | Adicionado formulário horizontal de newsletter no footer |
| 2025-01-24 | Nova seção "Newsletter" em FooterSettings.tsx |
| 2025-01-24 | Integração com EmailListSelector para seleção de lista destino |
| 2025-01-19 | Adicionado componente `PaymentIconsQuickSelect` para seleção rápida de bandeiras |
| 2025-01-19 | 12 ícones de pagamento pré-definidos (Visa, Mastercard, Elo, PIX, Boleto, etc.) |
