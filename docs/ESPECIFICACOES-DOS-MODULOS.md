# ESPECIFICAÇÕES DOS MÓDULOS — Índice da Layer 3

> **Versão:** 1.1.0  
> **Status:** ✅ Ativo  
> **Última atualização:** 2026-04-03  
> **Tipo:** Índice canônico + regras de organização (NÃO é um doc de especificação em si)

---

## 1. Propósito

Este documento é o **índice da Layer 3** da hierarquia documental. Ele:

- Define a organização dos docs de especificação modular
- Mapeia cada módulo ao seu arquivo
- Estabelece regras de manutenção
- NÃO contém especificações funcionais (essas ficam nos docs modulares)

---

## 2. Regras de Organização

### 2.1 O que ENTRA na Layer 3

- Comportamento funcional: telas, campos, botões, estados, fluxos internos
- Validações e exceções por módulo
- Tabelas/schema relevantes ao módulo
- Hooks, componentes e edge functions centrais
- Permissões e **contratos locais** do módulo

### 2.2 O que NÃO ENTRA (pertence ao Layer 2)

- Regras macro de multi-tenancy, anti-regressão, feature rollout
- **Contratos entre módulos** (ex: fonte de verdade de pricing)
- Regras de segurança globais (RLS, RBAC macro)
- Padrões de comunicação entre layers

### 2.3 Exemplo: Contrato Local vs Contrato Entre Módulos

| Tipo | Exemplo | Onde fica |
|------|---------|-----------|
| **Contrato local** | "O campo `sku` do produto é obrigatório e único por tenant" | Layer 3 (`ecommerce/produtos.md`) |
| **Contrato entre módulos** | "O preço exibido no checkout vem de `order_items.unit_price`, nunca do catálogo em tempo real" | Layer 2 (`REGRAS-DO-SISTEMA.md`) |

Regra prática: se a regra afeta **apenas o módulo**, é contrato local (Layer 3). Se define **como dois ou mais módulos interagem**, é contrato entre módulos (Layer 2).

### 2.4 Regra de Manutenção

- **Cada módulo tem seu doc próprio** — nunca misturar módulos no mesmo arquivo
- **Atualizações** seguem o protocolo Propose-Confirm-Apply do Knowledge

### 2.5 Cuidados Especiais

- **`sistema/edge-functions.md`**: Manter apenas parte funcional por domínio. Padrões técnicos universais ficam no Layer 2.
- **`sistema/tenants.md`**: Manter apenas parte funcional/operacional. Regra macro de isolamento já está no Layer 2.

### 2.6 Template para Módulos Pendentes (🟧)

Todo doc marcado como 🟧 Stub deve conter no mínimo:

- Status Atual (o que já existe implementado)
- Escopo Previsto (o que o módulo deve cobrir)
- Dependências (módulos dos quais depende)
- Observações (notas para implementação futura)

---

## 3. Status dos Módulos — Definição Formal

| Status | Significado | Fonte de verdade |
|--------|-------------|------------------|
| **✅ Ativo** | Doc migrado com conteúdo funcional completo. Cobre telas, fluxos, validações e contratos locais do módulo. | `docs/especificacoes/` é fonte de verdade. Legado em `docs/regras/` é obsoleto. |
| **🟧 Parcial** | Doc migrado mas com lacunas conhecidas. Conteúdo existente é válido, porém seções importantes ainda precisam ser detalhadas. | `docs/especificacoes/` é fonte de verdade para o que já está documentado. Legado pode conter informação complementar ainda não migrada. |
| **🟧 Stub** | Doc criado como placeholder. Contém apenas estrutura mínima e notas de escopo. O módulo ainda não foi especificado em detalhe. | Legado em `docs/regras/` (se existir) continua como referência transitória até que o stub seja expandido. |

**Regra de transição:** O doc novo em `docs/especificacoes/` só se torna fonte de verdade do módulo quando o arquivo correspondente existir **e** estiver com status ✅ Ativo ou 🟧 Parcial (para as seções já documentadas). Para módulos 🟧 Stub, o legado em `docs/regras/` permanece como referência válida.

---

## 4. Referência Cruzada

- **Layer 1 (Knowledge):** Governa comportamento da IA
- **Layer 2 (Doc de Regras do Sistema):** `docs/REGRAS-DO-SISTEMA.md` — regras estruturais macro
- **Layer 3 (Este índice):** Comportamento funcional detalhado por módulo
- **Layer 4 (Manual):** Referência técnica ampla

---

## 5. Mapa de Módulos

### 5.0 Transversais

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `transversais/padroes-ui.md` | Loading, datas, diálogos, responsividade | ✅ Ativo |

### 5.1 E-commerce (Core)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `ecommerce/pedidos.md` | Pedidos, estados, ghost orders | ✅ Ativo |
| `ecommerce/produtos.md` | Produtos, variantes, kits, IA | ✅ Ativo |
| `ecommerce/categorias.md` | Categorias, hierarquia, drag-drop | ✅ Ativo |
| `ecommerce/clientes.md` | Clientes, leads, identidade por email | ✅ Ativo |
| `ecommerce/descontos.md` | Cupons, promoções, primeira compra | ✅ Ativo |

### 5.2 Loja Online (Storefront)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `storefront/loja-virtual.md` | Arquitetura geral, Edge/SPA, rotas | ✅ Ativo |
| `storefront/builder.md` | Editor visual, WYSIWYG, blocos | ✅ Ativo |
| `storefront/header.md` | Cabeçalho, menus, busca, sticky | ✅ Ativo |
| `storefront/footer.md` | Rodapé, SAC, selos, newsletter | ✅ Ativo |
| `storefront/carrinho.md` | Carrinho, mini-cart, cross-sell | ✅ Ativo |
| `storefront/checkout.md` | Checkout, pagamento, frete | ✅ Ativo |
| `storefront/pagina-produto.md` | Página de produto, galeria, variantes | ✅ Ativo |
| `storefront/pagina-categoria.md` | Página de categoria, filtros, grid | ✅ Ativo |
| `storefront/pagina-obrigado.md` | Pós-compra, upsell, retentativa | ✅ Ativo |
| `storefront/paginas-institucionais.md` | Páginas institucionais, IA essenciais | ✅ Ativo |
| `storefront/blog.md` | Blog, campanhas IA, SEO | ✅ Ativo |
| `storefront/landing-pages.md` | Landing pages IA e Builder | ✅ Ativo |
| `storefront/sistema-cores.md` | Tema, tokens CSS, pipeline cores | ✅ Ativo |

### 5.3 Marketing

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `marketing/ofertas.md` | Bump, cross-sell, upsell, compre junto | ✅ Ativo |
| `marketing/avaliacoes.md` | Avaliações de produtos | ✅ Ativo |
| `marketing/midias-uploads.md` | Mídias e uploads | ✅ Ativo |
| `marketing/geracao-imagens-ia.md` | Geração de imagens com IA | ✅ Ativo |
| `marketing/campanhas.md` | Campanhas de marketing | ✅ Ativo |
| `marketing/criativos.md` | Criativos de anúncios | ✅ Ativo |
| `marketing/ai-criativos.md` | Criativos gerados por IA | ✅ Ativo |
| `marketing/marketing-integracoes.md` | Integrações de marketing | 🟧 Parcial |
| `marketing/email-marketing.md` | Email marketing | 🟧 Parcial |
| `marketing/quizzes.md` | Quizzes interativos | ✅ Ativo |

### 5.4 CRM

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `crm/crm-atendimento.md` | CRM e atendimento | 🟧 Parcial |
| `crm/suporte.md` | Suporte ao cliente | 🟧 Parcial |
| `crm/pacotes-ia.md` | Pacotes de créditos IA | ✅ Ativo |
| `crm/chatgpt.md` | Atendimento ao cliente via ChatGPT | ✅ Ativo |
| `crm/checkouts-abandonados.md` | Recuperação de checkouts | ✅ Ativo |

### 5.5 ERP

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `erp/erp-fiscal.md` | ERP e fiscal (NF-e, NCM) | ✅ Ativo |
| `erp/logistica.md` | Logística e frete | 🟧 Parcial |
| `erp/pagbank.md` | Integração PagBank | ✅ Ativo |

### 5.6 Marketplaces

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `marketplaces/mercado-livre.md` | Integração Mercado Livre | 🟧 Parcial |
| `marketplaces/shopee.md` | Integração Shopee | 🟧 Stub |
| `marketplaces/tiktok-shop.md` | Integração TikTok Shop | ✅ Ativo |
| `marketplaces/extrator-b2b.md` | Extrator B2B | ✅ Ativo |

### 5.7 Sistema

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `sistema/central-comando.md` | Dashboard e central de comando | ✅ Ativo |
| `sistema/auxiliar-comando.md` | Assistente IA do admin | ✅ Ativo |
| `sistema/usuarios-permissoes.md` | Usuários, roles, RBAC | ✅ Ativo |
| `sistema/planos-billing.md` | Planos e cobrança | ✅ Ativo |
| `sistema/configuracoes.md` | Configurações do sistema | ✅ Ativo |
| `sistema/importacao.md` | Importação de dados | ✅ Ativo |
| `sistema/hub-integracoes.md` | Hub de integrações | 🟧 Parcial |
| `sistema/dominios.md` | Domínios custom e DNS | ✅ Ativo |
| `sistema/tenants.md` | Tenants (parte funcional) | ✅ Ativo |
| `sistema/edge-functions.md` | Edge Functions (parte funcional) | ✅ Ativo |

### 5.8 Plataforma

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `plataforma/platform-admin.md` | Admin da plataforma | ✅ Ativo |
| `plataforma/platform-emails.md` | Emails transacionais | ✅ Ativo |

### 5.9 Parcerias

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `parcerias/afiliados.md` | Programa de afiliados | 🟧 Parcial |
| `parcerias/influencers.md` | Programa de influencers | 🟧 Stub |

---

## 6. Estatísticas

| Métrica | Valor |
|---------|-------|
| Total de módulos | 55 |
| ✅ Ativos | 43 |
| 🟧 Parciais | 10 |
| 🟧 Stubs | 2 |
| Grupos temáticos | 9 (+1 transversal) |

---

## 7. Transição dos Docs Legados

Os docs em `docs/regras/` foram a fonte de verdade original. A transição para `docs/especificacoes/` segue regras **por módulo**, não em bloco:

### 7.1 Regra de Transição por Módulo

| Status do doc novo | `docs/especificacoes/` | `docs/regras/` (legado) |
|--------------------|------------------------|-------------------------|
| **✅ Ativo** | Fonte de verdade. Todas as atualizações vão aqui. | Obsoleto. Não deve ser consultado nem editado. |
| **🟧 Parcial** | Fonte de verdade para seções já documentadas. | Pode conter informação complementar ainda não migrada. Consultar como apoio, não como autoridade. |
| **🟧 Stub** | Placeholder. Não é fonte de verdade. | Continua como referência transitória válida até o stub ser expandido. |

### 7.2 Regra Geral

- **Nunca editar** um doc legado em `docs/regras/` — toda evolução vai para `docs/especificacoes/`
- A promoção de 🟧 → ✅ acontece quando o doc modular for revisado e considerado completo
- Docs legados sem correspondente em `docs/especificacoes/` (ex: `regras-gerais.md`, `feature-rollout.md`, `paridade-builder-publico.md`) foram absorvidos pelo Layer 2 ou pela seção transversal e não possuem doc modular próprio

---

*Fim do índice Layer 3.*
