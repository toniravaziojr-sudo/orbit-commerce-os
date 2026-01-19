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
