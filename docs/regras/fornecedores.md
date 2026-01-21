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
| `src/hooks/useSupplierSearch.ts` | Busca externa via OpenStreetMap |
| `src/hooks/useSuppliers.ts` | Hook homologados |

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

### Provider Padrão
- **OpenStreetMap/Nominatim** (gratuito, sem API key, sem restrições de armazenamento)
- Geocodificação de localidade para calcular distância
- Busca por texto + filtro por raio

### Fluxo de Busca
1. Usuário digita palavra-chave (mín. 3 caracteres)
2. Usuário informa localidade (opcional) + raio (10-500km)
3. Sistema geocodifica a localidade via Nominatim
4. Busca retorna resultados ordenados por distância
5. Deduplicação por nome + cidade

### Salvando Fornecedor
- Clique em "Salvar" cria registro em `supplier_leads`
- Verificação de duplicidade antes de inserir
- Dados salvos: nome, localização, website, telefone, categoria, notas com endereço completo
- `source` implícito: OpenStreetMap

### Estados da UI
- **Loading**: Skeleton durante busca/geocodificação
- **Empty**: Mensagem "Nenhum fornecedor encontrado"
- **Error**: Mensagem + opção de retry
- **Debounce**: 500ms antes de executar busca

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

## RLS

Todas as tabelas têm RLS ativo com políticas:
- SELECT/INSERT/UPDATE: `user_belongs_to_tenant(auth.uid(), tenant_id)`
- DELETE: apenas `owner` ou `admin`

---

## Regras Anti-Regressão

1. **Busca sempre tenant-scoped**: Fornecedores salvos isolados por tenant
2. **Deduplicação obrigatória**: Não duplicar fornecedor já salvo
3. **Debounce na busca**: Evitar spam de requests (500ms)
4. **Provider abstrato**: Hook `useSupplierSearch` encapsula provider (fácil trocar futuramente)
5. **Sem armazenamento de resultados brutos**: Salvar apenas dados essenciais ao clicar "Salvar"
