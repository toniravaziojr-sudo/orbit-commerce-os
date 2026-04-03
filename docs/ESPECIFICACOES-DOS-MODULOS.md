# ESPECIFICAÇÕES DOS MÓDULOS — Índice da Layer 3

> **Status:** 🟢 Ativo  
> **Versão:** 1.0.0  
> **Camada:** Layer 3 — Especificações Funcionais  
> **Última atualização:** 2026-04-03

---

## ⚠️ AVISO — NATUREZA DESTE DOCUMENTO

Este documento é o **índice canônico** da Layer 3 da hierarquia documental. Ele **NÃO contém especificações** — apenas organiza e aponta para os docs modulares em `docs/especificacoes/`.

**O que este documento define:**
- Regras de organização da Layer 3
- Mapa completo de todos os módulos com status
- Regra de manutenção e criação de novos docs
- Referência cruzada com Layer 2

---

## 1. PAPEL DA LAYER 3

| Aspecto | Descrição |
|---------|-----------|
| **Governa** | Comportamento funcional detalhado por módulo (telas, botões, estados, campos, fluxos internos) |
| **Autoridade** | Funcional — resolve conflitos sobre detalhe de módulo |
| **Não governa** | Regras estruturais, contratos entre módulos, fluxos macro (→ Layer 2) |
| **Não governa** | Conduta da IA, checklist, proposta (→ Layer 1 / Knowledge) |

---

## 2. REGRAS DE ORGANIZAÇÃO

### 2.1 Estrutura de Diretórios

Cada módulo tem seu próprio arquivo `.md` dentro de `docs/especificacoes/`, organizado por grupo temático:

```
docs/especificacoes/
  ├── transversais/     → Padrões compartilhados (UI, datas, erros)
  ├── ecommerce/        → Core: pedidos, produtos, clientes, categorias, descontos
  ├── storefront/       → Loja pública: builder, checkout, páginas, blog
  ├── marketing/        → Ofertas, avaliações, campanhas, criativos, email
  ├── crm/              → Atendimento, suporte, chatgpt, checkouts abandonados
  ├── erp/              → Fiscal, logística, pagbank
  ├── marketplaces/     → Mercado Livre, Shopee, TikTok Shop, Extrator B2B
  ├── sistema/          → Comando, permissões, billing, configurações
  ├── plataforma/       → Platform admin, platform emails
  └── parcerias/        → Afiliados, influencers
```

### 2.2 Regras de Manutenção

| Regra | Descrição |
|-------|-----------|
| **Um módulo = um arquivo** | Nunca misturar dois módulos no mesmo doc |
| **Conteúdo funcional apenas** | Regras estruturais/macro pertencem à Layer 2 |
| **edge-functions.md** | Apenas parte funcional por domínio; padrões técnicos universais ficam na Layer 2 ou transversais |
| **tenants.md** | Apenas parte funcional/operacional; regras de isolamento ficam na Layer 2 |
| **Sem duplicação** | Se uma regra já existe na Layer 2, referenciar — não copiar |
| **Stubs padronizados** | Módulos pendentes seguem template mínimo (ver seção 4) |

### 2.3 O que ENTRA em cada doc modular

- Telas, campos, botões, estados, fluxos internos
- Validações e exceções do módulo
- Schema/tabelas relevantes ao módulo
- Hooks, componentes e edge functions centrais
- Permissões e contratos locais
- Pendências do módulo

### 2.4 O que NÃO ENTRA

- Regras macro (multi-tenancy, anti-regressão, feature rollout) → Layer 2
- Padrões técnicos universais → Transversais ou Layer 2
- Conduta da IA → Knowledge (Layer 1)

---

## 3. MAPA DE MÓDULOS

### 3.1 Transversais

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `transversais/padroes-ui.md` | Loading states, datas, diálogos, erros, responsividade, formatação | ✅ Ativo |

### 3.2 E-commerce (Core)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `ecommerce/pedidos.md` | Ciclo de vida, máquina de estados, UI, integrações | ✅ Ativo |
| `ecommerce/produtos.md` | Catálogo, variantes, kits, estoque, IA descrições | ✅ Ativo |
| `ecommerce/clientes.md` | CRM, tags, métricas, tiers, identidade por email | ✅ Ativo |
| `ecommerce/categorias.md` | Hierarquia, slugs, vinculação a produtos | 🔜 A migrar |
| `ecommerce/descontos.md` | Cupons, regras, tipos de desconto | 🔜 A migrar |

### 3.3 Storefront (Loja Pública)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `storefront/loja-virtual.md` | Arquitetura geral, rotas, edge-rendering | 🔜 A migrar |
| `storefront/builder.md` | Editor visual, WYSIWYG, blocos, toolbar | 🔜 A migrar |
| `storefront/header.md` | Header da loja, configurações | 🔜 A migrar |
| `storefront/footer.md` | Footer da loja, configurações | 🔜 A migrar |
| `storefront/carrinho.md` | Carrinho, mini-cart, frete | 🔜 A migrar |
| `storefront/checkout.md` | Checkout completo, pagamento, segurança | ✅ Ativo |
| `storefront/pagina-produto.md` | Página de produto pública | 🔜 A migrar |
| `storefront/pagina-categoria.md` | Página de categoria pública | 🔜 A migrar |
| `storefront/pagina-obrigado.md` | Thank You page, retry | 🔜 A migrar |
| `storefront/paginas-institucionais.md` | Páginas institucionais | 🔜 A migrar |
| `storefront/blog.md` | Blog da loja | 🔜 A migrar |
| `storefront/landing-pages.md` | Landing pages IA | 🔜 A migrar |
| `storefront/sistema-cores.md` | Temas de cores, CSS variables | 🔜 A migrar |

### 3.4 Marketing

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `marketing/ofertas.md` | Order bump, upsell, cross-sell, compre-junto | 🔜 A migrar |
| `marketing/avaliacoes.md` | Reviews, importação, aprovação | 🔜 A migrar |
| `marketing/midias-uploads.md` | Drive de mídia, uploads | 🔜 A migrar |
| `marketing/geracao-imagens-ia.md` | Geração de imagens com IA | 🔜 A migrar |
| `marketing/campanhas.md` | Planejamento de campanhas | 🔜 A migrar |
| `marketing/criativos.md` | Criativos de anúncios | 🔜 A migrar |
| `marketing/marketing-integracoes.md` | Integrações de marketing | 🟧 Pending |
| `marketing/email-marketing.md` | Email marketing | 🟧 Pending |
| `marketing/quizzes.md` | Quizzes interativos | 🔜 A migrar |

### 3.5 CRM

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `crm/crm-atendimento.md` | CRM e atendimento ao cliente | 🟧 Pending |
| `crm/suporte.md` | Suporte IA | 🟧 Pending |
| `crm/pacotes-ia.md` | Pacotes de créditos IA | 🔜 A migrar |
| `crm/chatgpt.md` | Integração ChatGPT | 🔜 A migrar |
| `crm/checkouts-abandonados.md` | Recuperação de checkouts | 🔜 A migrar |

### 3.6 ERP

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `erp/erp-fiscal.md` | ERP e módulo fiscal | 🔜 A migrar |
| `erp/logistica.md` | Logística e frete | 🟧 Pending |
| `erp/pagbank.md` | Integração PagBank | 🔜 A migrar |

### 3.7 Marketplaces

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `marketplaces/mercado-livre.md` | Integração Mercado Livre | 🟧 Pending |
| `marketplaces/shopee.md` | Integração Shopee | 🟧 Pending |
| `marketplaces/tiktok-shop.md` | Integração TikTok Shop | 🔜 A migrar |
| `marketplaces/extrator-b2b.md` | Extrator B2B | 🔜 A migrar |

### 3.8 Sistema

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `sistema/central-comando.md` | Dashboard e central de execuções | 🔜 A migrar |
| `sistema/auxiliar-comando.md` | Auxiliar IA do comando central | 🔜 A migrar |
| `sistema/usuarios-permissoes.md` | RBAC, convites, perfis | 🔜 A migrar |
| `sistema/planos-billing.md` | Planos, billing, checkout de assinatura | 🔜 A migrar |
| `sistema/configuracoes.md` | Configurações do sistema | 🔜 A migrar |
| `sistema/importacao.md` | Wizard de importação | 🔜 A migrar |
| `sistema/hub-integracoes.md` | Hub de integrações | 🟧 Pending |
| `sistema/dominios.md` | Domínios e DNS | 🔜 A migrar |
| `sistema/tenants.md` | Funcional de tenants | 🔜 A migrar |
| `sistema/edge-functions.md` | Funcional de edge functions | 🔜 A migrar |

### 3.9 Plataforma

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `plataforma/platform-admin.md` | Administração da plataforma | 🔜 A migrar |
| `plataforma/platform-emails.md` | Emails transacionais da plataforma | 🔜 A migrar |

### 3.10 Parcerias

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `parcerias/afiliados.md` | Programa de afiliados | 🟧 Pending |
| `parcerias/influencers.md` | Programa de influencers | 🟧 Stub |

---

## 4. TEMPLATE PARA MÓDULOS PENDENTES (🟧)

Todo doc marcado como 🟧 Pending deve conter no mínimo:

```markdown
# Módulo: [Nome]

> **Status:** 🟧 Pending — A ser detalhado durante implementação  
> **Última atualização:** [data]

## 1. Escopo Atual
[O que existe hoje no sistema]

## 2. O que Falta
[Funcionalidades/telas pendentes de implementação]

## 3. Dependências
[Módulos dos quais depende ou que dependem dele]

## 4. Observações
[Notas sobre prioridade, decisões pendentes, etc.]
```

---

## 5. TRANSIÇÃO DOS DOCS LEGADOS

### 5.1 Convivência

Durante a transição, os docs legados em `docs/regras/` continuam existindo. Quando o doc modular correspondente em `docs/especificacoes/` estiver ativo (✅), ele é a **fonte de verdade** para aquele módulo. O doc legado fica como referência histórica.

### 5.2 Regra de Precedência

| Situação | Fonte de Verdade |
|----------|------------------|
| Doc modular ativo (✅) em `especificacoes/` | Doc modular |
| Doc modular ainda não migrado (🔜) | Doc legado em `regras/` |
| Doc modular pending (🟧) | Nenhum — a ser definido |
| Conflito entre doc modular e legado | Doc modular vence |

---

## 6. REFERÊNCIA CRUZADA

| Layer | Documento | Status |
|-------|-----------|--------|
| 1 — Governança | Knowledge (Custom Instructions) | ✅ Ativo |
| 2 — Regras do Sistema | `docs/REGRAS-DO-SISTEMA.md` | ✅ Ativo |
| **3 — Especificações** | **Este índice + `docs/especificacoes/`** | **✅ Ativo** |
| 4 — Manual do Sistema | Manual técnico consolidado | 🔜 Pendente |

---

*Fim do índice.*
