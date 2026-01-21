# Fornecedores — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-21

---

## Visão Geral

Duas camadas: **Leads** (prospecção/busca) e **Fornecedores Homologados** (integrados ao ERP).

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/SupplierLeads.tsx` | Prospecção e busca externa |
| `src/pages/Purchases.tsx` | Fornecedores homologados |
| `src/hooks/useSupplierLeads.ts` | CRUD leads (tenant-scoped) |
| `src/hooks/useSupplierSearch.ts` | Busca externa via Perplexity AI |
| `src/hooks/useSuppliers.ts` | Hook homologados |
| `supabase/functions/search-suppliers/index.ts` | Edge Function para busca Perplexity |

## Tabelas

### supplier_leads
Prospecção de novos fornecedores (tenant-scoped).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants (RLS) |
| `name` | TEXT | Nome do fornecedor |
| `category` | TEXT | cosmeticos, embalagens, logistica, etc |
| `location` | TEXT | Cidade, Estado |
| `website_url` | TEXT | Site |
| `contact_email` | TEXT | Email de contato |
| `contact_phone` | TEXT | Telefone |
| `contact_person` | TEXT | Pessoa de contato |
| `status` | TEXT | prospect, contacted, negotiating, approved, discarded |
| `moq` | TEXT | Quantidade mínima |
| `lead_time_days` | INT | Prazo em dias |
| `notes` | TEXT | Observações |
| `tags` | JSONB | Tags/categorias extras |

### suppliers
Fornecedores ativos para pedidos de compra.

### supplier_types
Categorização (Matéria-prima, Serviços, etc).

---

## Busca Externa de Fornecedores

### Provider: Perplexity AI
- **API**: `https://api.perplexity.ai/chat/completions`
- **Modelo**: `sonar` (busca web em tempo real)
- **Secret**: `PERPLEXITY_API_KEY` (via Lovable Cloud Secrets)
- **Connector ID**: `perplexity`

### Por que Perplexity?
1. **Busca web em tempo real** — Resultados atualizados do Google/Bing
2. **Extração de contatos** — IA extrai telefone, email, site dos resultados
3. **Structured Output** — Resposta em JSON padronizado
4. **Sem restrições de armazenamento** — Diferente do Google Places

### Fluxo de Busca

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Frontend       │      │  Edge Function   │      │  Perplexity AI  │
│  (React)        │─────▶│  search-suppliers│─────▶│  API            │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                         │                        │
        │  keyword + location     │  structured prompt     │
        │                         │                        │
        ▼                         ▼                        ▼
   Debounce 500ms          Build search query        Web search +
                           with location filter      Contact extraction
```

1. Usuário digita palavra-chave (mín. 3 caracteres)
2. Usuário seleciona escopo de localização:
   - **Cidade específica**: "São Paulo, SP"
   - **Estado**: "SP" ou "São Paulo"
   - **Brasil inteiro**: sem filtro de localização
3. Frontend faz debounce de 500ms
4. Edge Function monta prompt estruturado para Perplexity
5. Perplexity retorna JSON com fornecedores encontrados
6. Frontend exibe resultados ordenados por relevância

### Estrutura do Prompt (Edge Function)

```
Busque fornecedores de "{keyword}" {locationFilter}.

Retorne um JSON com array "suppliers" contendo:
- name: Nome da empresa
- location: Cidade, Estado
- phone: Telefone (formato brasileiro)
- email: Email de contato
- website: URL do site
- description: Breve descrição

Limite: 10 resultados mais relevantes.
```

### Filtros de Localização

| Escopo | Filtro no Prompt | Exemplo |
|--------|------------------|---------|
| Cidade | `em {cidade}, {estado}` | "em São Paulo, SP" |
| Estado | `no estado de {estado}` | "no estado de São Paulo" |
| Brasil | `no Brasil` | "no Brasil" |

### Schema de Resposta (JSON)

```typescript
interface SupplierSearchResult {
  suppliers: Array<{
    name: string;
    location: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
  }>;
  citations: string[]; // URLs das fontes
}
```

### Salvando Fornecedor
- Clique em "Salvar" cria registro em `supplier_leads`
- Verificação de duplicidade antes de inserir (por nome + website)
- Dados salvos: nome, localização, website, telefone, email, categoria
- Status inicial: `prospect`

### Estados da UI
- **Loading**: Skeleton durante busca
- **Empty**: "Nenhum fornecedor encontrado para esta busca"
- **Error**: Mensagem + opção de retry
- **Debounce**: 500ms antes de executar busca
- **Min chars**: 3 caracteres mínimos para iniciar busca

---

## Categorias Disponíveis

| Value | Label |
|-------|-------|
| `cosmeticos` | Cosméticos |
| `embalagens` | Embalagens |
| `logistica` | Logística |
| `materia-prima` | Matéria-prima |
| `equipamentos` | Equipamentos |
| `marketing` | Marketing/Design |
| `tecnologia` | Tecnologia |
| `outros` | Outros |

## Status de Leads

| Value | Label | Cor |
|-------|-------|-----|
| `prospect` | Prospecção | gray |
| `contacted` | Contatado | blue |
| `negotiating` | Negociando | yellow |
| `approved` | Aprovado | green |
| `discarded` | Descartado | red |

---

## Configuração da Edge Function

### Arquivo: `supabase/functions/search-suppliers/index.ts`

```typescript
// Headers CORS obrigatórios
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Env var obrigatória
const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
```

### Parâmetros de Entrada

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `keyword` | string | ✅ | Termo de busca (mín. 3 chars) |
| `locationType` | string | ✅ | `city`, `state`, ou `country` |
| `city` | string | ❌ | Cidade (quando locationType = city) |
| `state` | string | ❌ | Estado (quando locationType = city ou state) |

---

## RLS

Todas as tabelas têm RLS ativo com políticas:
- SELECT/INSERT/UPDATE: `user_belongs_to_tenant(auth.uid(), tenant_id)`
- DELETE: apenas `owner` ou `admin`

---

## Regras Anti-Regressão

1. **Busca sempre tenant-scoped**: Fornecedores salvos isolados por tenant
2. **Deduplicação obrigatória**: Não duplicar fornecedor já salvo (nome + website)
3. **Debounce na busca**: Evitar spam de requests (500ms)
4. **Provider abstrato**: Hook `useSupplierSearch` encapsula provider
5. **Sem armazenamento de resultados brutos**: Salvar apenas ao clicar "Salvar"
6. **API Key via Secrets**: Nunca hardcoded, sempre via `Deno.env.get()`
7. **Fallback gracioso**: Se Perplexity falhar, mostrar erro amigável
