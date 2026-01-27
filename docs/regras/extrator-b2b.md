# Extrator B2B (Prospecção de Públicos) — Regras e Especificações

> **REGRAS FIXAS** — Módulo de extração de dados empresariais para prospecção B2B.

---

## Visão Geral

O módulo **Extrator B2B** permite extrair dados de empresas por nicho, região e CNAE para criar públicos e listas de prospecção (Email/WhatsApp).

**Localização:** Utilitários → Extrator B2B (`/utilities/b2b-extractor`)

---

## Compliance e Restrições (CRÍTICO)

| Regra | Descrição |
|-------|-----------|
| **Google Maps/Places** | **PROIBIDO** scraping/extração para exportação de leads (viola termos) |
| **Fontes permitidas** | Apenas dados públicos (CNPJ/Receita), POI licenciados, ou provedores B2B |
| **LGPD** | Requer base legal (consentimento/legítimo interesse) para uso dos dados |
| **WhatsApp** | Exige opt-in antes de permitir exportação para campanhas |
| **Auditoria** | Todas as exportações são logadas (quem, quando, quantos registros) |

---

## Fontes de Dados Suportadas

### 1. CNPJ (Dados Públicos da Receita)
| Campo | Descrição |
|-------|-----------|
| **Origem** | API de consulta CNPJ ou base tratada offline |
| **Dados** | Razão social, nome fantasia, CNAE, endereço, situação cadastral |
| **Limitação** | Não inclui telefone/email (apenas cadastrais) |

### 2. CNPJ.ws (API Comercial)
| Campo | Descrição |
|-------|-----------|
| **Origem** | https://www.cnpj.ws/docs/api-publica |
| **Dados** | CNPJ completo + QSA + Simples Nacional |
| **Limite Free** | 3 consultas/minuto |
| **Credencial** | `CNPJ_WS_API_KEY` (opcional para rate limit maior) |

### 3. BrasilAPI (Dados Públicos)
| Campo | Descrição |
|-------|-----------|
| **Origem** | https://brasilapi.com.br/docs |
| **Endpoints** | `/cnpj/v1/{cnpj}`, `/cep/v2/{cep}` |
| **Dados** | CNPJ, CEP, IBGE, feriados |
| **Limite** | Gratuito, sem autenticação |

### 4. Enriquecimento (Provedores B2B)
| Provedor | Dados | Credencial |
|----------|-------|------------|
| DataSeek | Telefone, email, decisores | `DATASEEK_API_KEY` |
| DataStone | Telefone, email, porte | `DATASTONE_API_KEY` |
| BrazilVerify | Validação de contatos | `BRAZILVERIFY_API_KEY` |

---

## Arquitetura

### Componentes

```
src/
├── pages/
│   └── B2BExtractor.tsx              # Página principal
├── components/
│   └── b2b-extractor/
│       ├── B2BSearchForm.tsx         # Formulário de busca
│       ├── B2BResultsTable.tsx       # Tabela de resultados
│       ├── B2BAudienceBuilder.tsx    # Construtor de públicos
│       ├── B2BExportDialog.tsx       # Modal de exportação
│       ├── B2BSourceSelector.tsx     # Seletor de fontes
│       └── B2BConsentManager.tsx     # Gerenciador de consentimento
├── hooks/
│   └── useB2BExtractor.ts            # Hook principal
│   └── useB2BAudiences.ts            # Hook de públicos
supabase/
└── functions/
    ├── b2b-search/                   # Busca em fontes
    ├── b2b-enrich/                   # Enriquecimento
    └── b2b-export/                   # Exportação com auditoria
```

### Tabelas (Banco de Dados)

```sql
-- Fontes/Conectores por tenant
CREATE TABLE b2b_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_type TEXT NOT NULL, -- 'cnpj_ws', 'brasil_api', 'dataseek', 'datastone', etc.
  api_key TEXT, -- Criptografado
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs de busca
CREATE TABLE b2b_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  source_type TEXT NOT NULL,
  filters JSONB NOT NULL, -- {uf, cidade, cnae, keyword, etc.}
  total_found INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Entidades (empresas) encontradas
CREATE TABLE b2b_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID REFERENCES b2b_search_jobs(id),
  -- Identificadores
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  -- Classificação
  cnae_principal TEXT,
  cnae_secundarios TEXT[],
  porte TEXT, -- MEI, ME, EPP, DEMAIS
  natureza_juridica TEXT,
  -- Endereço
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  -- Contatos (enriquecidos)
  telefone TEXT,
  telefone_source TEXT, -- Origem do dado
  email TEXT,
  email_source TEXT,
  website TEXT,
  -- Status
  situacao_cadastral TEXT,
  data_abertura DATE,
  -- Metadados
  enrichment_status TEXT DEFAULT 'pending', -- pending, enriched, failed
  confidence_score NUMERIC(3,2), -- 0.00 a 1.00
  source_data JSONB, -- Dados brutos da fonte
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cnpj)
);

-- Públicos (listas salvas)
CREATE TABLE b2b_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  filters_snapshot JSONB, -- Filtros usados para criar
  total_entities INTEGER DEFAULT 0,
  entities_with_email INTEGER DEFAULT 0,
  entities_with_phone INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Membros do público
CREATE TABLE b2b_audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID NOT NULL REFERENCES b2b_audiences(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES b2b_entities(id) ON DELETE CASCADE,
  consent_status TEXT DEFAULT 'unknown', -- unknown, opted_in, opted_out
  consent_date TIMESTAMPTZ,
  consent_source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(audience_id, entity_id)
);

-- Auditoria de exportações
CREATE TABLE b2b_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  audience_id UUID REFERENCES b2b_audiences(id),
  export_type TEXT NOT NULL, -- 'csv', 'crm', 'email_list', 'whatsapp'
  records_exported INTEGER NOT NULL,
  filters_used JSONB,
  consent_acknowledged BOOLEAN DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## UX — Fluxo de 3 Etapas

### Etapa 1: Busca (Pesquisa)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **Fonte** | Select | CNPJ.ws, BrasilAPI, Enriquecimento |
| **UF** | Select | Estado brasileiro |
| **Cidade** | Autocomplete | Filtro por município |
| **CNAE** | Autocomplete | Código ou descrição |
| **Palavra-chave** | Text | Nome fantasia, atividade |
| **Situação** | Select | Ativo, Baixada, Suspensa |
| **Porte** | MultiSelect | MEI, ME, EPP, DEMAIS |

**Saída:** Lista paginada com preview dos resultados.

### Etapa 2: Enriquecimento

| Ação | Descrição |
|------|-----------|
| **Deduplicação** | Por CNPJ (ou nome+endereço se CNPJ ausente) |
| **Normalização** | Telefone (E.164), email (lowercase, validação) |
| **Enriquecimento** | Via provedor configurado (DataSeek, etc.) |
| **Rastreabilidade** | Cada campo tem `_source` indicando origem |

### Etapa 3: Criar Público e Exportar

| Ação | Descrição |
|------|-----------|
| **Nomear público** | Nome, descrição, tags |
| **Selecionar entidades** | Checkbox ou "Selecionar todos" |
| **Exportar CSV** | Empresas e/ou Contatos |
| **Enviar ao CRM** | Criar Companies/Contacts internos |
| **Criar lista Email** | Vincula ao Email Marketing |

---

## Exportação — Regras de Compliance

| Tipo | Requisito |
|------|-----------|
| **CSV genérico** | Auditoria obrigatória |
| **Email Marketing** | Checkbox "Confirmo base legal" |
| **WhatsApp** | Só entidades com `consent_status = 'opted_in'` |
| **CRM interno** | Cria com flag `source = 'b2b_extractor'` |

---

## APIs Externas — Exemplos de Uso

### CNPJ.ws
```typescript
// GET https://publica.cnpj.ws/cnpj/{cnpj}
const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
const data = await response.json();
// { razao_social, estabelecimento: { cnae_fiscal, logradouro, ... } }
```

### BrasilAPI
```typescript
// GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
const data = await response.json();
// { razao_social, cnae_fiscal, municipio, uf, ... }
```

### Busca por CNAE (via ReceitaWS ou base offline)
```typescript
// Recomendação: manter tabela local de CNAEs
// e cruzar com base de CNPJs por UF/Cidade
```

---

## Navegação e RBAC

| Aspecto | Valor |
|---------|-------|
| **Rota** | `/utilities/b2b-extractor` |
| **Módulo RBAC** | `utilities` (submodule: `b2b-extractor`) |
| **Permissão mínima** | `viewer` para buscar, `editor` para exportar |
| **Menu** | Utilitários → Extrator B2B |

---

## Checklist de Implementação

| Item | Status |
|------|--------|
| Tabelas no banco | 🔲 Pendente |
| RLS policies | 🔲 Pendente |
| Edge Function `b2b-search` | 🔲 Pendente |
| Edge Function `b2b-enrich` | 🔲 Pendente |
| Edge Function `b2b-export` | 🔲 Pendente |
| Página `B2BExtractor.tsx` | 🔲 Pendente |
| Componentes de busca | 🔲 Pendente |
| Componentes de resultado | 🔲 Pendente |
| Componentes de exportação | 🔲 Pendente |
| Integração CNPJ.ws | 🔲 Pendente |
| Integração BrasilAPI | 🔲 Pendente |
| Auditoria de exportação | 🔲 Pendente |
| Atualização sidebar/RBAC | 🔲 Pendente |

---

## Próximos Passos (Sugestão)

1. **Fase 1 (MVP):** 
   - Busca por CNPJ individual (BrasilAPI)
   - Busca por UF + CNAE (requer base offline ou parceiro)
   - Tabela de resultados + exportação CSV

2. **Fase 2 (Enriquecimento):**
   - Integração com provedor de enriquecimento
   - Campos de telefone/email com rastreabilidade

3. **Fase 3 (Públicos):**
   - Criar/gerenciar públicos
   - Integração com Email Marketing e CRM interno

---

## Observações Importantes

### Sobre Google Maps/Places

O **Google Maps Platform** (Places API, Search API) **proíbe explicitamente**:
- Extração/exportação de dados para uso fora do serviço
- Uso para criar listas de diretórios ou leads
- Armazenamento de dados do Maps para fins de publicidade

**Alternativa:** Usar POI datasets licenciados (Foursquare, TomTom) ou dados públicos (CNPJ/Receita).

### Sobre Busca em Lote por CNAE

A busca por CNAE em larga escala (ex: "todas as academias de SP") **não é trivial** com APIs gratuitas. Opções:
1. **Base offline** de CNPJs (disponível via dados.gov.br, requer processamento)
2. **Parceiro comercial** que oferece busca por CNAE (DataSeek, Econodata, etc.)
3. **Scraping regulamentado** de fontes públicas (com rate limiting e robots.txt)

---

## Referências

- [BrasilAPI - Documentação](https://brasilapi.com.br/docs)
- [CNPJ.ws - API Pública](https://www.cnpj.ws/docs/api-publica)
- [Dados Abertos CNPJ - Receita Federal](https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj)
- [LGPD - Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
