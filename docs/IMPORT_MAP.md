# MAPA COMPLETO DE IMPORTAÇÃO - Comando Central

## Visão Geral

Este documento mapeia TUDO que pode ser importado de uma loja e-commerce para nossa estrutura.

## 1. ESTRUTURA DA LOJA (Estrutural)

### 1.1 Páginas Institucionais (`store_pages`)

Páginas de texto que qualquer loja tem. **PADRÕES UNIVERSAIS A DETECTAR:**

| Tipo | Slugs Comuns | Títulos Comuns | Localização Típica |
|------|-------------|----------------|-------------------|
| **Sobre** | `sobre`, `about`, `quem-somos`, `about-us`, `nossa-historia` | Sobre, Sobre Nós, Quem Somos, Nossa História, About Us | Footer col 1, Header |
| **Privacidade** | `privacidade`, `privacy`, `privacy-policy`, `politica-privacidade` | Política de Privacidade, Privacy Policy | Footer col 2 |
| **Termos** | `termos`, `terms`, `termos-de-uso`, `terms-of-service` | Termos de Uso, Termos de Serviço, Terms of Service | Footer col 2 |
| **Troca/Devolução** | `troca`, `devolucao`, `trocas-devolucoes`, `refund-policy`, `returns` | Trocas e Devoluções, Política de Troca, Refund Policy | Footer col 2 |
| **Frete/Envio** | `frete`, `envio`, `shipping`, `shipping-policy`, `entrega` | Política de Frete, Shipping, Entrega | Footer col 2 |
| **FAQ** | `faq`, `duvidas`, `perguntas-frequentes`, `ajuda` | FAQ, Perguntas Frequentes, Dúvidas, Ajuda | Footer, Header |
| **Como Comprar** | `como-comprar`, `how-to-buy`, `como-funciona` | Como Comprar, Como Funciona | Footer |
| **Pagamento** | `pagamento`, `payment`, `formas-pagamento` | Formas de Pagamento, Meios de Pagamento | Footer |
| **Garantia** | `garantia`, `warranty` | Garantia, Política de Garantia | Footer |
| **Contato** | `contato`, `contact`, `fale-conosco` | Contato, Fale Conosco, Contact | Footer, Header |
| **Trabalhe Conosco** | `trabalhe-conosco`, `careers`, `vagas` | Trabalhe Conosco, Carreiras | Footer |
| **Parceiros** | `parceiros`, `partners`, `revenda` | Parceiros, Seja um Parceiro | Footer |

**REGRAS DE DETECÇÃO:**
- Buscar no footer TODAS as colunas
- Buscar links com `/pages/`, `/pagina/`, `/policies/`, `/politicas/`
- NÃO importar: carrinho, checkout, minha-conta, rastreio (nativo), blog (nativo)
- Detectar por conteúdo: se tem formulário/inputs = NÃO importar

### 1.2 Categorias (`categories`)

| Campo | Origem Comum |
|-------|-------------|
| `name` | Título da categoria |
| `slug` | URL path |
| `description` | Meta description ou texto da página |
| `image_url` | Imagem de thumbnail |
| `banner_desktop_url` | Banner da página de categoria |
| `banner_mobile_url` | Banner mobile (se existir) |
| `seo_title` | Meta title |
| `seo_description` | Meta description |
| `parent_slug` | Categoria pai (hierarquia) |

### 1.3 Menus (`menus` + `menu_items`)

**Localizações:**
| Location | Descrição | Padrões de Detecção |
|----------|-----------|---------------------|
| `header` | Menu principal | `<header>`, `<nav>`, `.main-nav`, `.header-menu` |
| `footer` | Footer principal | `<footer>`, `.footer-menu`, `.footer-nav` |
| `footer_1` | Footer col 1 (categorias) | Primeira coluna de links do footer |
| `footer_2` | Footer col 2 (políticas) | Segunda coluna de links do footer |

**Regras de Menu Footer:**
- Footer 1: Categorias principais + Blog + Rastreio (nativos)
- Footer 2: APENAS páginas institucionais (políticas, FAQ, sobre, etc.)

---

## 2. VISUAL DA LOJA (Branding)

### 2.1 Store Settings (`store_settings`)

| Campo | Onde Buscar | Padrões de Detecção |
|-------|------------|---------------------|
| `store_name` | `<title>`, og:site_name, logo alt | Primeiro texto antes de ` - ` ou ` \| ` |
| `store_description` | og:description, meta description | Meta tag description |
| `logo_url` | header img, `.logo`, `[alt*=logo]` | Imagem no header com class/alt "logo" |
| `favicon_url` | `<link rel="icon">`, apple-touch-icon | Link rel icon/shortcut |
| `primary_color` | CSS vars, buttons, links | `--color-primary`, `.btn` background |
| `secondary_color` | CSS vars, header/footer | `--color-secondary`, header bg |
| `accent_color` | Links, destaques | `a` color, hover states |

### 2.2 Contato (`store_settings`)

| Campo | Onde Buscar | Padrões de Detecção |
|-------|------------|---------------------|
| `contact_phone` | footer, header, contato | `tel:`, `(XX) XXXXX-XXXX`, 10-11 dígitos |
| `contact_email` | footer, contato | `mailto:`, email regex |
| `contact_address` | footer | Rua/Av + número + CEP |
| `business_cnpj` | footer | `XX.XXX.XXX/XXXX-XX` (14 dígitos) |
| `business_legal_name` | footer, termos | Próximo ao CNPJ |
| `contact_support_hours` | footer, contato | `horário`, `atendimento`, `Xh às Xh` |

### 2.3 Redes Sociais (`store_settings`)

| Campo | Padrão de Detecção |
|-------|-------------------|
| `social_facebook` | `facebook.com/`, `fb.com/` |
| `social_instagram` | `instagram.com/` |
| `social_whatsapp` | `wa.me/`, `api.whatsapp.com` |
| `social_tiktok` | `tiktok.com/@` |
| `social_youtube` | `youtube.com/c/`, `/channel/`, `/@` |
| `social_custom` | Twitter/X, LinkedIn, Pinterest |

### 2.4 Banners

| Tipo | Onde Buscar | Padrões de Detecção |
|------|------------|---------------------|
| Hero/Slideshow | Homepage | `.slideshow`, `.hero`, `.swiper`, `.carousel` |
| Promoções | Homepage, categorias | `.promo`, `.offer`, `.destaque` |

**Regras de Banner:**
- Desktop: imagens > 800px width
- Mobile: imagens com `mobile`, `m_`, ou < 600px
- Parear desktop/mobile pelo índice do slide

---

## 3. DADOS DA LOJA (Dados)

### 3.1 Produtos (`products`)
- Via CSV, JSON, API
- Campos: name, price, sku, images, description, categories, variants

### 3.2 Clientes (`customers`)
- Via CSV
- Campos: email, name, phone, cpf, addresses

### 3.3 Pedidos (`orders`)
- Via CSV
- Preservar `source_order_number` original
- Renumerar `order_number` interno

---

## 4. FLUXO DE IMPORTAÇÃO

```
1. DETECTAR PLATAFORMA (Shopify, Nuvemshop, etc.)
   ↓
2. FETCH HTML (com Firecrawl se disponível)
   ↓
3. EXTRAIR TUDO:
   - Footer links → Páginas + Menus
   - Header nav → Menus + Categorias
   - Contact info → store_settings
   - Social links → store_settings
   - Branding → store_settings
   - Banners → aplicar na home
   ↓
4. NORMALIZAR (mapear para nossos campos)
   ↓
5. VALIDAR (qualidade, não duplicar)
   ↓
6. APLICAR no banco
```

---

## 5. DETECÇÃO DE PÁGINAS INSTITUCIONAIS

### 5.1 Estratégias de Busca (em ordem)

1. **Footer Links** - Primeira fonte mais confiável
2. **Header Links** - Pode ter "Sobre", "FAQ"
3. **Shopify Policies** - `/policies/privacy-policy`, etc.
4. **Slugs Conhecidos** - Verificar se existem `/pages/sobre`, etc.
5. **JSON Embarcado** - Temas modernos têm menus em JSON

### 5.2 Filtragem

**IMPORTAR:**
- Páginas com `/pages/` ou `/policies/`
- Páginas com conteúdo de texto
- Sobre, FAQ, Políticas, Termos

**NÃO IMPORTAR:**
- Carrinho, Checkout, Login, Cadastro
- Rastreio (temos nativo)
- Blog (temos nativo, só importar posts se possível)
- Páginas com formulários (contato com form)
- Páginas de funcionalidade (compare, wishlist)

---

## 6. QUALIDADE DE IMPORTAÇÃO

### 6.1 Validação Obrigatória

- [ ] Páginas aparecem em `/pages` da UI
- [ ] Menus aparecem em `/menus`
- [ ] Settings aplicadas em `/storefront`
- [ ] Banners visíveis na home (se aplicados)

### 6.2 Relatório

```json
{
  "pages": { "found": 8, "imported": 6, "skipped": 2 },
  "menus": { "header": 5, "footer": 12 },
  "settings": {
    "phone": true,
    "email": true,
    "cnpj": false,
    "social": ["instagram", "facebook"]
  },
  "banners": { "found": 3, "imported": 3 }
}
```
