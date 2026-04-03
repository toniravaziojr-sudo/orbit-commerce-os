# Logística (Shipping) — Regras e Especificações

> **STATUS:** ✅ Produção (Correios, Frenet e Loggi operacionais via `shipping-quote`)

> **Camada:** Layer 3 — Especificações / Erp  
> **Migrado de:** `docs/regras/logistica.md`  
> **Última atualização:** 2026-04-03


## Visão Geral

Módulo de gestão de envios, transportadoras, regras de frete grátis e frete personalizado.
O cálculo de frete é centralizado na Edge Function `shipping-quote`, que consulta todos os providers ativos em paralelo e retorna opções unificadas com deduplicação inteligente.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Shipping.tsx` | Página principal |
| `src/hooks/useShipments.ts` | Hook de envios |
| `src/components/shipping/ShippingCarrierSettings.tsx` | Config transportadoras |
| `src/components/shipping/CarrierConfigDialog.tsx` | Diálogo de configuração |
| `src/components/shipping/FreeShippingRulesTab.tsx` | Regras frete grátis |
| `src/components/shipping/CustomShippingRulesTab.tsx` | Frete personalizado |
| `supabase/functions/shipping-quote/index.ts` | Edge Function agregadora multi-provider |
| `supabase/functions/frenet-quote/index.ts` | Edge Function legada (Frenet direto) |

---

## Funcionalidades

| Feature | Status | Descrição |
|---------|--------|-----------|
| Lista de envios | ✅ Ready | Com filtros por status |
| Rastreamento | ✅ Ready | Código de rastreio + polling automático |
| Transportadoras | ✅ Ready | Correios (API Code), Frenet, Loggi |
| Frete grátis | ✅ Ready | Regras condicionais |
| Frete personalizado | ✅ Ready | Tabelas por região |
| Cálculo automático | ✅ Ready | Via APIs (Correios, Frenet) |
| Etiquetas | ✅ Ready | PDF e ZPL via Correios |
| Pré-postagem | ✅ Ready | PLP via Correios |

---

## Status de Envio

| Status | Label | Descrição |
|--------|-------|-----------|
| `pending` | Pendente | Aguardando envio |
| `processing` | Processando | Em preparação |
| `shipped` | Enviado | Postado |
| `in_transit` | Em Trânsito | A caminho |
| `out_for_delivery` | Saiu para Entrega | Último mile |
| `delivered` | Entregue | Concluído |
| `returned` | Devolvido | Retornou |
| `failed` | Falhou | Problema na entrega |

---

## Métricas do Dashboard

| Métrica | Descrição |
|---------|-----------|
| Aguardando Envio | Pedidos pendentes |
| Em Trânsito | Pedidos a caminho |
| Entregues (Mês) | Entregas do mês |
| Taxa de Entrega | % de sucesso |

---

## Hierarquia de Frete Grátis

O sistema aplica frete grátis se **qualquer** uma das 3 fontes for verdadeira:

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| 1 (Máxima) | **Produto** | Campo `free_shipping` no cadastro do produto. Opcionalmente restrito a um método específico via `free_shipping_method`. |
| 2 | **Cupom** | Cupom de desconto do tipo `free_shipping`. Substitui regras de logística. |
| 3 | **Regras de Logística** | Regras condicionais por região, valor mínimo, categoria, etc. |

> Se um produto atingir qualquer uma dessas 3 regras, terá frete grátis.

### Frete Grátis por Método Específico (v1.1)

O frete grátis pode ser vinculado a um **método de envio específico** (ex: PAC), mantendo os demais (ex: SEDEX) com preço integral como upgrades pagos.

| Configuração | Tabela/Coluna | Descrição |
|---|---|---|
| Global (padrão) | `store_settings.default_free_shipping_method` | Método padrão para frete grátis de todos os produtos |
| Por produto (override) | `products.free_shipping_method` | Sobrescreve o global para um produto específico |

**Hierarquia de resolução:** `products.free_shipping_method` → `store_settings.default_free_shipping_method` → frete grátis em TODOS os métodos (se ambos NULL).

**Comportamento na UI:**
- O método gratuito é **pré-selecionado** automaticamente no calculador de frete e checkout
- Badge verde **"FRETE GRÁTIS"** com valor R$ 0,00 e preço original riscado
- Demais métodos exibem preço integral normalmente

**Comportamento na Edge Function (`shipping-quote`):**
- Identifica o método por `service_name` ou `carrier` (case-insensitive, `includes`)
- Zera o `price` apenas da opção correspondente
- Preserva `original_price` para exibição de "de/por"
- Marca com `is_free: true`

**Select dinâmico no ProductForm:**
- As opções do select de `free_shipping_method` vêm dos `shipping_providers` ativos do tenant (hook `useAvailableShippingMethods`)
- Para Correios, filtra pelos `service_codes` configurados no provider
- Opção "Usar padrão da logística" = `null` (herda global)

**UI de configuração global:**
- Componente `DefaultFreeShippingMethodConfig` em `src/components/shipping/DefaultFreeShippingMethodConfig.tsx`
- Renderizado no topo da aba Frete Grátis (`FreeShippingSubTabs`), acima das sub-tabs de regras e conversão
- Persiste em `store_settings.default_free_shipping_method`
- Select dinâmico com as mesmas opções dos providers ativos (`useAvailableShippingMethods`)
- Opção "Todos os métodos (sem restrição)" = `null`

> **Integração com Barra de Conversão:** Quando `applyToExternalRules` está ativo na `BenefitConfig` (`store_settings.benefit_config`), a barra de progresso do carrinho também reconhece frete grátis vindo dessas 3 fontes, não apenas do valor mínimo configurado na barra. Ver `docs/regras/carrinho.md` → Barra de Conversão.

## Regras de Frete Grátis (Logística)

```typescript
interface FreeShippingRule {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  min_order_value: number;      // Valor mínimo do pedido
  min_order_cents: number;      // Valor mínimo em centavos (usado pelo motor central)
  regions: string[];            // Estados/regiões aplicáveis
  categories: string[];         // Categorias de produto
  valid_from: string;           // Início da vigência
  valid_until: string;          // Fim da vigência
  priority: number;             // Ordem de aplicação
}
```

### Motor Central de Frete Grátis (v2.0)

O sistema utiliza um motor centralizado que é a única fonte de verdade para elegibilidade de frete grátis. A barra de conversão **não possui regras próprias** — ela apenas reflete o estado do motor.

**Fonte do threshold:** O `StorefrontConfigContext` busca regras ativas da tabela `free_shipping_rules` e deriva o `logisticsThreshold` pelo menor `min_order_cents` entre as regras ativas. Este valor substitui qualquer `thresholdValue` legado da `benefit_config`.

**Precedência de fontes:**

| Prioridade | Fonte | Comportamento na barra |
|------------|-------|----------------------|
| 1 | Produto (`free_shipping`) | Estado: `granted_by_product` |
| 2 | Cupom (`free_shipping`) | Estado: `granted_by_coupon` |
| 3 | Regra de Logística (`min_order_cents`) | Estado: `progress` ou `achieved` |

**Consumidores do motor:**
- `BenefitProgressBar` (mini-cart e carrinho normal, via prop `compact`)
- Cotação de frete (`shipping-quote`)
- Checkout
- Criação do pedido

**Regra crítica:** A barra pode ser ativada/desativada sem afetar a aplicação real do benefício. Quando desativada, as regras continuam funcionando na cotação e no pedido.

### Navegação — Frete Grátis

As configurações de frete grátis estão centralizadas em **ERP > Logística > Frete Grátis**, organizadas em sub-tabs:

| Sub-tab | Componente | Descrição |
|---------|-----------|-----------|
| Método Padrão | `DefaultFreeShippingMethodConfig` | Método fallback global |
| Regras | `FreeShippingRulesTab` | Regras condicionais por região/valor/categoria |
| Barra de Conversão | `CartConversionConfigTab` | Controles visuais da barra (sem regras de negócio) |

**Componente container:** `FreeShippingSubTabs` renderizado em `Shipping.tsx`.

---

## Frete Personalizado

```typescript
interface CustomShippingRule {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  calculation_type: 'fixed' | 'per_kg' | 'percentage';
  base_value: number;
  per_kg_value: number;
  min_value: number;
  max_value: number;
  regions: string[];
  delivery_time_days: number;
  priority: number;
}
```

---

## Integrações de Transportadora

### Arquitetura de Níveis

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ADMIN PLATAFORMA                               │
│                /integrations → tab "logistics"                       │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐   │
│  │ Loggi OAuth             │   │ Correios                        │   │
│  │ - LOGGI_CLIENT_ID       │   │ (não tem nível plataforma -     │   │
│  │ - LOGGI_CLIENT_SECRET   │   │ cada lojista tem contrato)      │   │
│  └─────────────────────────┘   └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PAINEL DO LOJISTA                               │
│                   /shipping/settings                                 │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐   │
│  │ Loggi                   │   │ Correios (Código de Acesso)     │   │
│  │ - Company ID            │   │ - Usuário (CNPJ)                │   │
│  │ - Endereço origem       │   │ - Código de Acesso às APIs      │   │
│  │                         │   │ - Número do Contrato            │   │
│  │                         │   │ - Cartão de Postagem            │   │
│  └─────────────────────────┘   └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Loggi — Modelo Híbrido

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Plataforma** | OAuth2 global (`LOGGI_CLIENT_ID`, `LOGGI_CLIENT_SECRET`) | Admin → Integrações → Logística |
| **Tenant** | `company_id` (ID do Embarcador) + endereço de origem completo | Loja → Envios → Configurações |

**Fluxo:** Plataforma obtém token OAuth → Tenant só informa seu embarcador e endereço.

**Campos obrigatórios do tenant:**
- `company_id` — ID do Embarcador fornecido pela Loggi
- `origin_cep`, `origin_street`, `origin_number`, `origin_neighborhood`, `origin_city`, `origin_state`

---

### Correios — Modelo 100% Tenant (Código de Acesso às APIs)

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | CNPJ + Código de Acesso às APIs + Contrato + Cartão de Postagem | Loja → Envios → Configurações |

**Fluxo:** Cada lojista tem seu próprio contrato (Meu Correios Empresas) e configura credenciais diretamente usando o método do Código de Acesso.

**Método de autenticação (ÚNICO):**
- **Código de Acesso às APIs** — Igual ao método utilizado pelo Bling. Usa um código permanente gerado no portal CWS em vez da senha do portal. Mais estável e não quebra se o lojista trocar a senha.

**Campos obrigatórios:**
- `usuario` — CNPJ do contrato (sem pontuação)
- `codigo_acesso` — Código permanente gerado em cws.correios.com.br → Gestão de acesso a API's
- `contrato` — Número do contrato (ex: 9912689847)
- `cartao_postagem` — Cartão de postagem vinculado (ex: 0079102786)

**Endpoints utilizados:**
- `POST /token/v1/autentica/cartaopostagem` — Autenticação via Código de Acesso
- `GET /cep/v2/enderecos/{cep}` — Consulta de CEP
- `POST /preco/v1/nacional` — Cotação de frete (PAC, SEDEX)
- `GET /rastro/v1/objetos/{codigo}` — Rastreamento SRO
- `POST /prepostagem/v1/prepostagens` — Criação de pré-postagem (PLP)
- `GET /prepostagem/v1/prepostagens/{codigo}/etiqueta` — Geração de etiquetas PDF/ZPL

---

### Frenet — Modelo Tenant (Gateway)

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | Token de API + CEP de origem | Loja → Envios → Configurações |

**Fluxo:** Gateway que agrega múltiplas transportadoras. Cada tenant tem seu token Frenet.

---

### Status das Integrações

| Transportadora | Cotação | Rastreamento | Etiquetas | Pré-postagem | Status |
|----------------|---------|--------------|-----------|--------------|--------|
| Frenet | ✅ | ✅ (via gateway) | ✅ (via gateway) | ✅ | **Produção** |
| Correios (API Code) | ✅ | ✅ SRO | ✅ PDF/ZPL | ✅ PLP | **Produção** |
| Loggi | ✅ (via Frenet) | 🟧 | 🟧 | 🟧 | **Parcial** — cotação direta depende de confirmação do `externalServiceId` |
| Melhor Envio | 🟧 | 🟧 | 🟧 | 🟧 | **Pendente** |
| Jadlog | 🟧 | 🟧 | 🟧 | 🟧 | **Pendente** |

---

## Edge Function `shipping-quote` — Agregador Multi-Provider

### Arquitetura

```
Cliente → shipping-quote (Edge Function)
                │
                ├─── Regras de Frete Grátis (DB)
                ├─── Regras de Frete Personalizado (DB)
                ├─── Frenet API (token do tenant)
                ├─── Correios API REST v1 (credenciais do tenant)
                └─── Loggi API v2 (OAuth plataforma + company_id tenant)
```

### Fluxo de Execução

1. Resolve tenant pelo host (domain-aware)
2. Busca em paralelo: regras (free/custom), providers ativos, store_settings
3. Para cada provider ativo com `supports_quote = true`, chama adapter específico
4. Aplica timeout de 10s por provider
5. Deduplica opções por `source_provider|carrier|service_code|estimated_days`
6. Retorna regras primeiro (frete grátis no topo), depois opções de transportadoras

### Deduplicação (REGRA CRÍTICA)

A chave de deduplicação **DEVE incluir `source_provider`** para que opções iguais vindas de providers diferentes NÃO sejam mescladas:

```typescript
const key = `${opt.source_provider}|${carrierNorm}|${codeNorm}|${opt.estimated_days}`;
```

**Justificativa:** Se Frenet retorna PAC e Correios direto também retorna PAC, ambas devem aparecer porque os preços podem diferir.

### Correios — Notas Técnicas

- **Autenticação:** Usa `POST /token/v1/autentica/cartaopostagem` com Basic Auth (usuario:codigo_acesso)
- **Cotação:** `POST /preco/v1/nacional` com batch de serviços (SEDEX 03220 + PAC 03298)
- **PROIBIDO:** Enviar `nuContrato` e `nuDR` no payload de preço — causa erro **PRC-124** pois já estão embutidos no token do cartão de postagem
- **Valor Declarado:** Só enviar `servicosAdicionais` com VD se `require_declared_value = true` nas settings do provider
- **Prazo:** Usar campo `prazoEntrega` com fallback para `prazo`, default 5 dias

### Loggi — Notas Técnicas

- **Auth:** OAuth2 com secrets da plataforma (`LOGGI_CLIENT_ID`, `LOGGI_CLIENT_SECRET`)
- **Cotação direta:** Endpoint `POST /v1/companies/{companyId}/quotations` — requer endereço completo (não aceita apenas CEP)
- **Formatos tentados:** `correiosAddress` → fallback `addressLines` — API ainda rejeita com "Address field required"
- **Status atual:** Cotação Loggi funciona via **Frenet gateway** (Frenet retorna opção Loggi)
- **Pendência:** Confirmar formato correto de endereço ou `externalServiceId` com equipe Loggi

---

## Fluxo de Cálculo de Frete

```
1. Cliente informa CEP no checkout
2. Sistema chama shipping-quote com CEP + itens do carrinho
3. Edge Function verifica regras de frete grátis (primeira match)
4. Verifica regras de frete personalizado (todas que match)
5. Consulta transportadoras ativas em paralelo (Frenet, Correios, Loggi)
6. Deduplica opções (por provider + carrier + serviço + prazo)
7. Retorna opções ordenadas: grátis primeiro, depois por preço
8. Cliente seleciona opção
9. Valor adicionado ao pedido
```

---

## Regra Crítica: Filtro de Preço (REGRA FIXA)

| Regra | Descrição |
|-------|-----------|
| **Filtro de preço** | `ShippingPrice >= 0` (inclui frete grátis) |
| **Proibido** | Filtrar com `> 0` pois exclui opções grátis |

Todas as Edge Functions de cotação (frenet-quote, shipping-quote) DEVEM usar `>= 0` para não excluir opções de frete grátis promocional.

---

## Campos de Envio no Pedido

| Campo | Descrição |
|-------|-----------|
| `shipping_carrier` | Transportadora selecionada |
| `shipping_method` | Método (PAC, SEDEX, etc) |
| `tracking_code` | Código de rastreio |
| `shipped_at` | Data de envio |
| `delivered_at` | Data de entrega |
| `shipping_status` | Status atual |
| `estimated_delivery` | Previsão de entrega |

---

## Pendências

- [ ] Integração Melhor Envio
- [ ] Integração Jadlog
- [ ] Cotação direta Loggi (formato de endereço pendente)
- [ ] Rastreamento Loggi
- [ ] Etiquetas Loggi
- [ ] Notificações de status automáticas
