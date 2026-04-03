# Regras por Módulo

Este diretório contém as regras e especificações separadas por módulo para consulta rápida.

---

## Índice Completo

### 📋 REGRAS GERAIS
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [regras-gerais.md](./regras-gerais.md) | Regras universais do sistema | ✅ Ready |
| [feature-rollout.md](./feature-rollout.md) | Protocolo de Feature Rollout (Admin First) | ✅ Ready |
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
| [geracao-imagens-ai.md](./geracao-imagens-ai.md) | Geração de Imagens com IA | ✅ Ready |
| [marketing-integracoes.md](./marketing-integracoes.md) | Integrações de Marketing | 🟧 Pending |
| [email-marketing.md](./email-marketing.md) | Email Marketing | 🟧 Pending |
| [campanhas.md](./campanhas.md) | Criador de Campanhas (Blog/Social/YouTube) | ✅ Ready |

---

### 💬 CRM (Relacionamento)
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [crm.md](./crm.md) | Notificações e Atendimento | 🟧 Pending |
| [suporte.md](./suporte.md) | Central de Suporte | 🟧 Pending |
| [pacotes-ia.md](./pacotes-ia.md) | Pacotes de Créditos IA | ✅ Ready |

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

---

### 🛍️ MARKETPLACES
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [mercado-livre.md](./mercado-livre.md) | Integração Mercado Livre | 🟧 Pending |
| [shopee.md](./shopee.md) | Integração Shopee | ✅ Ready |

---

### ⚙️ SISTEMA
| Arquivo | Descrição | Status |
|---------|-----------|--------|
| [central-comando.md](./central-comando.md) | Central de Comando (Dashboard, Agenda, Widgets) | ✅ Ready |
| [usuarios-permissoes.md](./usuarios-permissoes.md) | Usuários e RBAC | ✅ Ready |
| [planos-billing.md](./planos-billing.md) | Planos e Cobrança | ✅ Ready |
| [integracoes.md](./integracoes.md) | Hub de Integrações | 🟧 Pending |
| [configuracoes-sistema.md](./configuracoes-sistema.md) | Configurações do Sistema (Pagamentos, etc.) | ✅ Ready |
| [platform-emails.md](./platform-emails.md) | Emails da Plataforma (Admin) | ✅ Ready |
| [platform-admin.md](./platform-admin.md) | Avisos e Tutoriais (Platform Admin) | ✅ Ready |
| [auxiliar-comando.md](./auxiliar-comando.md) | Auxiliar de Comando (IA) | ✅ Ready |
| [importacao.md](./importacao.md) | Importação de Dados (3 Etapas) | ✅ Ready |

---

## Resumo de Status

| Status | Quantidade | Significado |
|--------|------------|-------------|
| ✅ Ready | **34** | 100% funcional e validado |
| 🟧 Pending | **7** | Em construção/incompleto |

---

## ⚠️ WORKFLOW OBRIGATÓRIO (NÃO NEGOCIÁVEL)

**ANTES de qualquer implementação, ajuste ou análise:**

1. Identificar quais arquivos serão afetados
2. Consultar mapeamento na seção [Custom Knowledge]
3. **LER o documento de regras correspondente usando `lov-view`**
4. Verificar regras específicas que impactam a mudança
5. Seguir especificações à risca (sem interpretar ou "melhorar")
6. Só então iniciar implementação

| Proibido | Motivo |
|----------|--------|
| Alterar arquivos SEM ler doc de regras | Causa regressões |
| Interpretar/melhorar regras por conta | Documento é fonte de verdade |
| Assumir que sabe as regras de memória | Sempre ler na sessão atual |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar estes documentos por conta própria |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]` |

---

## Documentos Principais

### 🆕 Nova Estrutura Documental (Layer 2)
O documento canônico de regras estruturais do sistema: [`docs/REGRAS-DO-SISTEMA.md`](../REGRAS-DO-SISTEMA.md)

> Este documento pertence à nova estrutura de 4 camadas e é a fonte de verdade para regras macro, fluxos canônicos, contratos entre módulos e fontes de verdade. Em caso de conflito com os docs legados abaixo, o REGRAS-DO-SISTEMA.md vence.

### Documento Legado
O documento antigo com regras consolidadas (em transição): [`docs/REGRAS.md`](../REGRAS.md)
