# Pacotes IA — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-27

---

## Visão Geral

Sistema para comercialização de pacotes de créditos de IA para lojistas. Os pacotes permitem acesso a funcionalidades de inteligência artificial como atendimento automatizado, geração de conteúdo e análise de dados.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/AIPackages.tsx` | Página principal de pacotes |
| `src/hooks/useAIPackages.ts` | CRUD de pacotes e assinaturas |
| `src/components/ai-packages/` | Componentes UI |

## Tabelas

### ai_packages (Gerenciada pela Plataforma)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `name` | TEXT | Nome do pacote |
| `description` | TEXT | Descrição |
| `credits` | INTEGER | Quantidade de créditos incluídos |
| `price_cents` | INTEGER | Preço em centavos (BRL) |
| `features` | JSONB | Lista de features incluídas |
| `is_active` | BOOLEAN | Se está disponível para compra |
| `sort_order` | INTEGER | Ordem de exibição |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

### tenant_ai_subscriptions

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK para tenants |
| `package_id` | UUID | FK para ai_packages |
| `status` | TEXT | `active`, `cancelled`, `expired` |
| `credits_remaining` | INTEGER | Créditos restantes |
| `started_at` | TIMESTAMPTZ | Início da assinatura |
| `expires_at` | TIMESTAMPTZ | Expiração (se aplicável) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

### tenant_ai_usage

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK para tenants |
| `subscription_id` | UUID | FK para tenant_ai_subscriptions |
| `feature` | TEXT | Feature utilizada |
| `credits_used` | INTEGER | Créditos consumidos |
| `metadata` | JSONB | Dados adicionais do uso |
| `created_at` | TIMESTAMPTZ | Data de uso |

## Acesso

- **Lojistas (Tenants)**: Visualizam pacotes disponíveis, contratam e monitoram uso
- **Platform Operators**: Gerenciam pacotes globais (CRUD)

## Layout da Página

### Para Tenants

| Seção | Descrição |
|-------|-----------|
| Pacote Atual | Card com informações do pacote contratado e créditos restantes |
| Histórico de Uso | Tabela com consumo de créditos por feature |
| Pacotes Disponíveis | Grid de cards com pacotes para upgrade/contratação |

### Para Platform Operators

| Seção | Descrição |
|-------|-----------|
| Gerenciar Pacotes | CRUD completo de pacotes de IA |
| Estatísticas | Métricas de adoção e uso por tenant |

## Features de IA (Exemplos)

| Feature Key | Label | Descrição |
|-------------|-------|-----------|
| `ai_support` | Atendimento IA | Respostas automáticas no suporte |
| `ai_content` | Geração de Conteúdo | Descrições de produtos, posts |
| `ai_analytics` | Análise Inteligente | Insights e recomendações |
| `ai_images` | Geração de Imagens | Criação de imagens com IA |
| `ai_campaigns` | Campanhas IA | Criação automática de campanhas |

## Regras de Negócio

1. **Créditos**: Cada ação de IA consome créditos do pacote contratado
2. **Expiração**: Créditos podem expirar conforme regras do pacote
3. **Upgrade**: Tenant pode fazer upgrade a qualquer momento
4. **Limite**: Quando créditos acabam, features de IA são desabilitadas até nova compra

## Fluxo de Contratação

```
1. Tenant visualiza pacotes disponíveis
2. Seleciona pacote desejado
3. Confirma contratação (integração com billing)
4. Sistema cria tenant_ai_subscription
5. Créditos ficam disponíveis imediatamente
```

## Proibições

| Proibido | Motivo |
|----------|--------|
| Créditos negativos | Sempre validar antes de consumir |
| Editar pacotes de outro tenant | RLS obrigatório |
| Deletar histórico de uso | Auditoria |
