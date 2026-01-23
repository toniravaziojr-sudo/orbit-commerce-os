# Logística (Shipping) — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção)

## Visão Geral

Módulo de gestão de envios, transportadoras, regras de frete grátis e frete personalizado.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Shipping.tsx` | Página principal |
| `src/hooks/useShipments.ts` | Hook de envios |
| `src/components/shipping/ShippingCarrierSettings.tsx` | Config transportadoras |
| `src/components/shipping/FreeShippingRulesTab.tsx` | Regras frete grátis |
| `src/components/shipping/CustomShippingRulesTab.tsx` | Frete personalizado |

---

## Funcionalidades

| Feature | Status | Descrição |
|---------|--------|-----------|
| Lista de envios | ✅ Ready | Com filtros por status |
| Rastreamento | ✅ Ready | Código de rastreio |
| Transportadoras | 🟧 Pending | Configuração |
| Frete grátis | ✅ Ready | Regras condicionais |
| Frete personalizado | ✅ Ready | Tabelas por região |
| Cálculo automático | 🟧 Pending | Via APIs |

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

## Regras de Frete Grátis

```typescript
interface FreeShippingRule {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  min_order_value: number;      // Valor mínimo do pedido
  regions: string[];            // Estados/regiões aplicáveis
  categories: string[];         // Categorias de produto
  valid_from: string;           // Início da vigência
  valid_until: string;          // Fim da vigência
  priority: number;             // Ordem de aplicação
}
```

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
┌─────────────────────────────────────────────────────────┐
│                    ADMIN PLATAFORMA                     │
│         /integrations → tab "logistics"                 │
│  ┌───────────────┐   ┌──────────────────────────────┐   │
│  │ Loggi OAuth   │   │ Correios                     │   │
│  │ Client ID     │   │ (não tem nível plataforma -  │   │
│  │ Client Secret │   │ cada lojista tem contrato)   │   │
│  └───────────────┘   └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  PAINEL DO LOJISTA                      │
│           /shipping/settings                            │
│  ┌───────────────┐   ┌──────────────────────────────┐   │
│  │ Loggi         │   │ Correios                     │   │
│  │ - Company ID  │   │ - CNPJ (usuário)             │   │
│  │ - Endereço    │   │ - Senha portal CWS           │   │
│  │   origem      │   │ - Cartão de Postagem         │   │
│  └───────────────┘   └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
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

### Correios — Modelo 100% Tenant

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | CNPJ + Senha CWS + Cartão de Postagem **ou** Token manual | Loja → Envios → Configurações |

**Fluxo:** Cada lojista tem seu próprio contrato (Meu Correios Empresas) e configura credenciais diretamente.

**Modos de autenticação:**
- **OAuth2 (Recomendado)** — CNPJ, Senha do portal CWS, Cartão de Postagem. Token renovado automaticamente.
- **Token Manual** — Token do portal CWS. Expira a cada 24h.

**Endpoints utilizados:**
- `POST /token/v1/autentica/cartaopostagem` — Autenticação OAuth2
- `GET /cep/v2/enderecos/{cep}` — Consulta de CEP
- `POST /preco/v1/nacional` — Cotação de frete
- `GET /rastro/v1/objetos/{codigo}` — Rastreamento SRO
- `POST /prepostagem/v2/prepostagens` — Criação de pré-postagem
- `GET /prepostagem/v2/etiquetas` — Geração de etiquetas

---

### Frenet — Modelo Tenant (Gateway)

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | Token de API + CEP de origem | Loja → Envios → Configurações |

**Fluxo:** Gateway que agrega múltiplas transportadoras. Cada tenant tem seu token Frenet.

---

### Status das Integrações

| Transportadora | Cotação | Rastreamento | Etiquetas | Status |
|----------------|---------|--------------|-----------|--------|
| Frenet | ✅ | ✅ (via gateway) | ✅ (via gateway) | **Produção** |
| Correios | ✅ | ✅ | ✅ | **Produção** |
| Loggi | ✅ | 🟧 | 🟧 | **Em progresso** |
| Melhor Envio | 🟧 | 🟧 | 🟧 | **Pendente** |
| Jadlog | 🟧 | 🟧 | 🟧 | **Pendente** |

---

## Fluxo de Cálculo de Frete

```
1. Cliente informa CEP no checkout
2. Sistema verifica regras de frete grátis
3. Se não aplicável, calcula frete personalizado
4. Se não houver regra, consulta transportadoras
5. Retorna opções ordenadas por preço/prazo
6. Cliente seleciona opção
7. Valor adicionado ao pedido
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
- [ ] Rastreamento Loggi
- [ ] Etiquetas Loggi
- [ ] Notificações de status automáticas
