

# Integração WMS Pratika — App Externo com Ativação/Desativação

## Resumo

Criar uma nova aba "WMS Pratika" no módulo de Aplicativos Externos (/apps-externos), seguindo o mesmo padrão das abas GTM e Calendar. O app terá toggle de ativação por tenant, configuração de URL do endpoint SOAP, e envio automático de XML da NFe e etiquetas quando ativado.

## Como funciona hoje

- O módulo Apps Externos tem 2 abas: Tag Manager e Calendar
- Cada aba verifica conexão/configuração e oferece gestão simplificada
- NFe é emitida via `fiscal-emit` e etiquetas via `shipping-get-label`, sem envio para sistemas externos

## O que será feito

### 1. Migration — Tabela de configuração do app

Adicionar campos na tabela `tenant_settings` ou criar uma entrada na lógica de apps externos para armazenar:
- `wms_pratika_enabled` (boolean)
- `wms_pratika_url` (string, pré-preenchido com o endpoint padrão)
- `wms_pratika_cnpj` (string, CNPJ usado para identificação no WMS)

### 2. Nova aba na UI — `WmsPratikaTab.tsx`

- Toggle de ativação/desativação (Switch)
- Campo de URL do web service (pré-preenchido)
- Campo de CNPJ para identificação
- Botão "Testar Conexão" (chamada SOAP simples)
- Log de últimos envios (sucesso/erro)
- Seguindo exatamente o padrão visual das abas GTM e Calendar

### 3. Atualização da página ExternalApps

- Adicionar terceira aba "WMS Pratika" com ícone Truck
- Import do novo componente

### 4. Edge Function — `wms-pratika-send`

- Recebe `invoice_id` ou `shipment_id` + `tenant_id`
- Verifica se WMS Pratika está ativado para o tenant
- Baixa XML da NFe (da Nuvem Fiscal ou do campo `xml_url` salvo)
- Monta envelope SOAP e envia para `RecepcaoDocNfe`
- Registra resultado em log
- Operações SOAP suportadas:
  - `RecepcaoDocNfe` — envio do XML
  - `AtualizarCodRastreioNfe` — atualização de rastreio
  - `RecepcaoLoteValidaAutoNfe` — envio de etiquetas em lote

### 5. Helper compartilhado — `_shared/soap-client.ts`

- Função genérica para montar envelope SOAP e executar POST
- Reutilizável para futuras integrações SOAP

### 6. Triggers automáticos (quando ativado)

- No `fiscal-emit`: após autorização da NFe, chamar `wms-pratika-send` se ativado
- No `shipping-get-label`: após geração de etiqueta, enviar para WMS se ativado
- Chamadas fire-and-forget (não bloqueiam o fluxo principal)

### 7. Documentação

- Atualizar memória do módulo External Apps
- Atualizar mapa-ui.md com nova aba
- Registrar na base de conhecimento técnico

## Detalhes Técnicos

```text
Fluxo:
Tenant ativa WMS Pratika em /apps-externos
  └── Toggle ON → salva config no banco

NFe Autorizada → fiscal-emit
  └── Verifica wms_pratika_enabled
      └── Se ON → fire-and-forget → wms-pratika-send
          ├── Baixa XML (Nuvem Fiscal)
          ├── SOAP RecepcaoDocNfe (CNPJ + XML)
          └── Log resultado

Etiqueta Gerada → shipping-get-label
  └── Verifica wms_pratika_enabled
      └── Se ON → fire-and-forget → wms-pratika-send
          ├── SOAP RecepcaoLoteValidaAutoNfe
          └── Log resultado
```

**Sem autenticação SOAP** — CNPJ identifica o cliente no WMS.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Campos de config WMS Pratika |
| `src/components/external-apps/WmsPratikaTab.tsx` | Nova aba UI |
| `src/pages/ExternalApps.tsx` | Adicionar aba |
| `supabase/functions/wms-pratika-send/index.ts` | Edge Function SOAP |
| `supabase/functions/_shared/soap-client.ts` | Helper SOAP genérico |
| `supabase/functions/fiscal-emit/index.ts` | Trigger pós-autorização |
| `supabase/functions/shipping-get-label/index.ts` | Trigger pós-etiqueta |
| `docs/especificacoes/transversais/mapa-ui.md` | Atualizar UI map |

