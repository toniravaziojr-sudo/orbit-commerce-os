# Regras Gerais — Comandos Fundamentais

> **REGRAS NÃO NEGOCIÁVEIS** — Aplicáveis a TODO o sistema.

## Abordagem Estrutural (Regra Permanente)

Quando um problema/lógica envolver vários componentes (frontend + Edge Functions + banco + RLS + jobs), a correção deve ser feita no **pipeline/lógica global** — não em ajustes item-a-item — para reduzir regressões e retrabalho.

---

## Diagnóstico Obrigatório para Erro Recorrente

Se um erro se repetir mais de 1 vez (mesmo sintoma/rota/stack), **parar "tentativas rápidas"** e instalar diagnóstico antes da próxima correção:

| Diagnóstico | Descrição |
|-------------|-----------|
| **ErrorBoundary** | Na rota afetada com botão "Copiar Diagnóstico" (stack + componentStack + URL + userAgent + timestamp) |
| **Debug Panel** | Opcional via `?debug=1` exibindo: tenant atual, auth state, status/erro das queries, dados mínimos retornados |
| **Logs estruturados** | `console.group` nos hooks críticos (inputs/outputs) para identificar causa raiz |

**Critério:** Só voltar a "corrigir" depois de capturar diagnóstico suficiente para apontar a causa raiz.

---

## Anti-Regressão de Core

**Proibido** refatorar core/base sem autorização explícita do usuário.

---

## Multi-Tenant (Regra Fixa)

- Tudo sempre tenant-scoped
- **Proibido** vazamento de dados/tokens/credenciais entre tenants
- Validar `tenant_id` em TODA operação

---

## CORE DO SISTEMA (Regra Fixa)

**Produtos, Clientes e Pedidos são a base/fonte de verdade.**

Qualquer módulo (marketing, suporte, automações, integrações, fiscal, logística, marketplaces, atendimento etc.) deve ler/alterar o Core via **API interna do Core** (camada de serviço), sem fluxos paralelos nem writes diretos fora dessa camada.

---

## Build (Regra Fixa)

**Não considerar concluído** se build/lint/typecheck falharem.

---

## Feature Incompleta

Esconder via feature-flag. **NUNCA** deixar "UI quebrada" em produção.

---

## Integrações Sensíveis (WhatsApp/Email/Pagamentos/Marketplaces)

**Não quebrar provider em produção.** Se trocar, implementar em paralelo com gate + rollback.

---

## Tenants Âncora

| Tenant | Email | Tenant ID | Descrição |
|--------|-------|-----------|-----------|
| **Super Admin (Platform)** | `toniravaziojr@gmail.com` | `cc000000-0000-0000-0000-000000000001` | Admin da plataforma com Admin Mode Toggle |
| **Tenant Base Especial** | `respeiteohomem@gmail.com` | `d1a4d0ed-8842-495e-b741-540a9a345b25` | Tenant cliente especial (plan=unlimited, is_special=true) |

> "Somente no tenant base especial" = **SPECIAL ONLY** (não afetar platform/admin nem customers).

---

## Admin Mode (Toggle de Contexto)

O Platform Admin tem acesso a dois modos de visualização via toggle pills no header:

| Modo | Ícone | Descrição | Sidebar |
|------|-------|-----------|---------|
| **Plataforma** | `Building2` | Administração do Comando Central | Módulos de admin (Health, Planos, Avisos, Tutoriais, Integrações Plataforma) |
| **Minha Loja** | `Store` | Ferramentas de loja/e-commerce | Todos módulos de cliente (Produtos, Pedidos, CRM, Marketing, etc) |

### Arquivos do Admin Mode

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/AdminModeContext.tsx` | Context + Provider + hooks (useAdminMode, useAdminModeSafe) |
| `src/components/layout/AdminModeToggle.tsx` | Toggle pills UI |
| `src/hooks/usePlatformOperator.ts` | Hook para verificar se usuário é platform admin |

### Regras

| Regra | Descrição |
|-------|-----------|
| **Visibilidade** | Toggle só aparece para platform operators |
| **Persistência** | Modo salvo em `localStorage` (key: `admin-mode-preference`) |
| **Default** | Platform operators iniciam em modo "Plataforma" |
| **Fallback** | Usuários não-admin sempre veem modo "Minha Loja" |
| **Sidebar** | Muda completamente baseado no modo ativo |

---

## Auth / RLS (Resumo Operacional)

| Aspecto | Descrição |
|---------|-----------|
| **Auth** | `auth.users` → `profiles` (id igual) |
| **Multi-tenancy** | `tenants` + `user_roles`; `profiles.current_tenant_id` = tenant ativo |
| **Roles** | Usar `hasRole()` (nunca hardcoded) |
| **Platform admins** | Tabela `platform_admins` (separado). Platform admin não precisa de tenant para acessar |

---

## Arquitetura — Locais Canônicos (Regra Fixa)

| Local Canônico | Responsabilidade |
|----------------|------------------|
| **Integrações (hub)** | Conectar/configurar integrações e credenciais globais |
| **Atendimento** | Todas as mensagens de todos os canais |
| **Marketplaces** | Operações específicas do marketplace |
| **Fiscal (NFe)** | Módulo fiscal/certificado; **não é "integração"** |
| **Logística (/shipping)** | Frete e transportadoras; **não fica em Integrações** |
| **Meu Drive (public.files)** | Fonte de verdade de arquivos/mídias do tenant |
| **Usuários e Permissões** | Equipe do tenant; não confundir com `platform_admins` |

---

## Credenciais Globais (platform_credentials)

| Regra | Descrição |
|-------|-----------|
| **Allowlist** | Qualquer nova key precisa estar na allowlist de edição da function de update (ex.: `EDITABLE_CREDENTIALS`), senão salvar deve falhar |
| **UX admin** | Após salvar, UI deve refletir estado persistido (SET + preview mascarado) e permitir editar/remover |

---

## Regra de Prompts (Lovable)

Problema estrutural/multi-componente → prompt pede correção do **pipeline global**; nunca correção item a item.

---

## Importação — Wizard (Etapas Congeladas)

| Etapa | Nome | Status |
|-------|------|--------|
| 1 | Análise da Loja | **CONGELADA** |
| 2 | Importação de Arquivos | **CONGELADA** |
| 3 | Estrutura da Loja | Em ajuste |

### Regras da Etapa 2

| Regra | Descrição |
|-------|-----------|
| **Batches** | 25–50; health check obrigatório |
| **Produto sem nome** | NUNCA inserir "Produto sem nome"; se faltar name/title → erro |
| **SKU** | Pode ser gerado se faltar (determinístico + único por tenant) |
| **Preço** | Não vira 0 silenciosamente; parse falhou = erro/warning explícito |
| **Pós-validação** | O que o job diz que importou deve aparecer na mesma query/tabela usada pela UI; mismatch = FAILED |

---

## Integrações — UI/UX (Regras Fixas)

| Regra | Descrição |
|-------|-----------|
| **Abas** | Em uma linha (sem duplicidade) |
| **NFe** | Não aparece em Integrações |
| **Frete/Logística** | Não aparece em Integrações (fica em `/shipping`) |
| **Email (domínio)** | Fica em Integrações (aba Emails) |

---

## Marketplaces — Padrão

| Aspecto | Regra |
|---------|-------|
| **Credenciais globais do app** | `platform_credentials` (admin) |
| **Conexão por tenant** | `marketplace_connections` (tenant-scoped) |
| **Tokens em tabela global** | Proibido |
| **Expor secrets globais ao tenant** | Proibido |
| **Navegação** | Marketplaces menu principal; `/marketplaces/mercadolivre` |
| **OAuth** | Conectar em Integrações; menu do marketplace só mostra CTA enquanto não conectado |
| **Pedidos** | `orders.marketplace_source`, `marketplace_order_id`, `marketplace_data` |

---

## Atendimento (Canais) — Regra Fixa

Tudo em **Atendimento**. Mercado Livre alimenta `conversations` + `messages` (`channel_type='mercadolivre'`).

**Proibido:** Manter "Mensagens" como aba principal dentro de Marketplaces.

---

## Logística / Frete — Segurança

| Regra | Descrição |
|-------|-----------|
| **Configuração** | Em `/shipping` |
| **RLS** | Proibido SELECT público amplo em shipping rules |
| **Checkout** | Calcula via Edge Function com service role + filtro tenant |

---

## Origem do Pedido — Ícone + Fiscal

| Regra | Descrição |
|-------|-----------|
| **Badge** | Pedidos exibem badge de origem |
| **Fiscal** | Filtra por origem via `orders.marketplace_source` |
| **Anti-regressão** | Não quebrar comportamento atual |

---

## Usuários e Permissões (RBAC do Cliente)

### Modelo

| Aspecto | Descrição |
|---------|-----------|
| **Tabelas** | `profiles`, `user_roles`, `role_invitations` |
| **RLS de profiles** | Tenant-scoped via `current_tenant_id` |
| **Convites** | Via `role_invitations` com token e expiração |
| **Modo convite** | Usuário só acessa tenant se tiver role ativo |
| **Guards** | Usar `hasRole()` para verificar permissões |
| **Default deny** | Sem role = sem acesso |

---

## Categorias — Módulo Core

### Miniaturas de Categorias

| Regra | Descrição |
|-------|-----------|
| **Cadastro de categoria** | **NÃO** possui campo de miniatura/thumbnail. Apenas nome, slug, descrição e banners. |
| **Miniaturas nos blocos** | Imagens de miniatura são configuradas **diretamente nos blocos do Builder** |
| **Flexibilidade** | Cada bloco pode ter dimensões e imagens diferentes para a mesma categoria |

---

## Produtos, Clientes e Pedidos — Módulos Core

### Core API

Todas as operações de escrita passam pela Core API (Edge Functions):
- `core-orders`
- `core-customers`
- `core-products`

### Auditoria

Todas as alterações são registradas em `core_audit_log`.

### State Machine (Pedidos)

| Status | Transições Permitidas |
|--------|----------------------|
| `pending` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `returned` |
| `delivered` | `returned` |
| `cancelled` | - |
| `returned` | - |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar ou "melhorar" este documento por conta própria. |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]`. |
| **Reporte de lacunas** | Se identificar inconsistência, apenas **REPORTAR** e propor texto para aprovação — **SEM ALTERAR**. |
