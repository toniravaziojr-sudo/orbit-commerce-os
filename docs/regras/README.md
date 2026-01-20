# Regras por Módulo

Este diretório contém as regras e especificações separadas por módulo para consulta rápida.

---

## Índice Completo

### 📋 REGRAS GERAIS
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [regras-gerais.md](./regras-gerais.md) | Regras universais do sistema | ✅ Ready |
| [edge-functions.md](./edge-functions.md) | Padrões para Edge Functions | ✅ Ready |
| [tenants.md](./tenants.md) | Multi-Tenancy e Isolamento | ✅ Ready |
| [dominios.md](./dominios.md) | Domínios e DNS | ✅ Ready |

---

### 🛒 E-COMMERCE (Admin)
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [pedidos.md](./pedidos.md) | Gestão de Pedidos | ✅ Ready |
| [checkouts-abandonados.md](./checkouts-abandonados.md) | Checkouts Abandonados | ✅ Ready |
| [produtos.md](./produtos.md) | Catálogo de Produtos | ✅ Ready |
| [categorias.md](./categorias.md) | Categorias de Produtos | ✅ Ready |
| [clientes.md](./clientes.md) | CRM de Clientes | ✅ Ready |
| [descontos.md](./descontos.md) | Cupons de Desconto | ✅ Ready |

---

### 🏪 LOJA ONLINE (Storefront)
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [loja-virtual.md](./loja-virtual.md) | Arquitetura Geral da Loja | ✅ Ready |
| [builder.md](./builder.md) | Builder/Editor Visual | ✅ Ready |
| [header.md](./header.md) | Cabeçalho + Menus | ✅ Ready |
| [footer.md](./footer.md) | Rodapé | ✅ Ready |
| [carrinho.md](./carrinho.md) | Carrinho de Compras | ✅ Ready |
| [checkout.md](./checkout.md) | Página de Checkout | ✅ Ready |
| [pagina-produto.md](./pagina-produto.md) | Página de Produto | ✅ Ready |
| [pagina-categoria.md](./pagina-categoria.md) | Página de Categoria | ✅ Ready |
| [pagina-obrigado.md](./pagina-obrigado.md) | Página de Obrigado | ✅ Ready |
| [paginas-institucionais.md](./paginas-institucionais.md) | Páginas Institucionais | ✅ Ready |
| [blog.md](./blog.md) | Blog da Loja | ✅ Ready |

---

### 📢 MARKETING
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [ofertas.md](./ofertas.md) | Aumentar Ticket (Bump/Upsell) | ✅ Ready |
| [avaliacoes.md](./avaliacoes.md) | Avaliações de Produtos | ✅ Ready |
| [midias-uploads.md](./midias-uploads.md) | Meu Drive / Uploads | ✅ Ready |
| [marketing-integracoes.md](./marketing-integracoes.md) | Integrações de Marketing | 🟧 Pending |
| [email-marketing.md](./email-marketing.md) | Email Marketing | 🟧 Pending |
| [campanhas.md](./campanhas.md) | Criador de Campanhas | 🟧 Pending |

---

### 💬 CRM (Relacionamento)
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [crm.md](./crm.md) | Notificações e Atendimento | 🟧 Pending |
| [suporte.md](./suporte.md) | Central de Suporte | 🟧 Pending |

---

### 📊 ERP (Gestão)
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [erp.md](./erp.md) | Fiscal / Financeiro / Compras | 🟧 Pending |
| [logistica.md](./logistica.md) | Logística e Frete | 🟧 Pending |

---

### 🤝 PARCERIAS
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [afiliados.md](./afiliados.md) | Programa de Afiliados | 🟧 Pending |
| [influencers.md](./influencers.md) | Gestão de Influencers | 🟧 Pending |
| [fornecedores.md](./fornecedores.md) | Gestão de Fornecedores | 🟧 Pending |

---

### 🛍️ MARKETPLACES
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [mercado-livre.md](./mercado-livre.md) | Integração Mercado Livre | 🟧 Pending |

---

### ⚙️ SISTEMA
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [usuarios-permissoes.md](./usuarios-permissoes.md) | Usuários e RBAC | ✅ Ready |
| [planos-billing.md](./planos-billing.md) | Planos e Cobrança | 🟧 Pending |
| [integracoes.md](./integracoes.md) | Hub de Integrações | 🟧 Pending |
| [platform-emails.md](./platform-emails.md) | Emails da Plataforma (Admin) | ✅ Ready |
| [auxiliar-comando.md](./auxiliar-comando.md) | Auxiliar de Comando (IA) | 🟧 Pending |
| [importacao.md](./importacao.md) | Importação de Dados (3 Etapas) | ✅ Ready |

---

## Resumo de Status

| Status | Quantidade | Significado |
|--------|------------|-------------|
| ✅ Ready | **26** | 100% funcional e validado |
| 🟧 Pending | **13** | Em construção/incompleto |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar estes documentos por conta própria |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]` |

---

## Documento Principal

O documento principal com TODAS as regras consolidadas: [`docs/REGRAS.md`](../REGRAS.md)
