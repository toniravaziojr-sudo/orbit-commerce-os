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

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2025-01-25 | Links de menu com referências inválidas não são mais renderizados |
| 2025-01-24 | Adicionado formulário horizontal de newsletter no footer |
| 2025-01-24 | Nova seção "Newsletter" em FooterSettings.tsx |
| 2025-01-24 | Integração com EmailListSelector para seleção de lista destino |
| 2025-01-19 | Adicionado componente `PaymentIconsQuickSelect` para seleção rápida de bandeiras |
| 2025-01-19 | 12 ícones de pagamento pré-definidos (Visa, Mastercard, Elo, PIX, Boleto, etc.) |
