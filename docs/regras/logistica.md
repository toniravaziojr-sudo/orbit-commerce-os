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

| Transportadora | Status | Descrição |
|----------------|--------|-----------|
| Correios | 🟧 Pending | PAC, SEDEX |
| Melhor Envio | 🟧 Pending | Agregador |
| Jadlog | 🟧 Pending | Rodoviário |
| Loggi | 🟧 Pending | Último mile |
| Intelipost | 🟧 Pending | Gateway |

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

- [ ] Integração Correios API
- [ ] Integração Melhor Envio
- [ ] Cálculo automático por peso
- [ ] Etiquetas de envio
- [ ] Rastreamento automático
- [ ] Notificações de status
