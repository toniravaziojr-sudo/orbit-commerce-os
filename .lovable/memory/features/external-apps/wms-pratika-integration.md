---
name: WMS Pratika Integration
description: Integração com WMS Pratika (DDS Informática) via SOAP para envio automático de NFe XML e rastreio, ativável por tenant em Apps Externos
type: feature
---

# Integração WMS Pratika

## Localização
- UI: `/apps-externos` → aba "WMS Pratika"
- Edge Function: `wms-pratika-send`
- Tabelas: `wms_pratika_configs`, `wms_pratika_logs`

## Fluxo
1. Tenant ativa a integração em Apps Externos com toggle
2. Configura URL do endpoint SOAP e CNPJ de identificação
3. Quando NFe é autorizada (`fiscal-emit`), XML é enviado automaticamente via SOAP `RecepcaoDocNfe`
4. Quando etiqueta é gerada (`shipping-get-label`), rastreio é enviado via SOAP `AtualizarCodRastreioNfe`
5. Todas as chamadas são fire-and-forget (não bloqueiam fluxo principal)

## Operações SOAP
- `RecepcaoDocNfe` — envio de XML da NFe + CNPJ
- `AtualizarCodRastreioNfe` — atualização de código de rastreio
- `RecepcaoLoteValidaAutoNfe` — (disponível mas não automatizado)

## Características
- Sem autenticação SOAP — CNPJ identifica o cliente
- Endpoint padrão: `http://wmspratika.ddsinformatica.com.br/WsSoap/WsRecepcaoNfe.asmx`
- Ativação independente por tenant
- Logs de envio com histórico de sucesso/erro
- Botão de teste de conexão na UI

## Triggers automáticos
- `fiscal-emit`: após autorização, se `wms_pratika_configs.is_enabled = true` e `auto_send_nfe = true`
- `shipping-get-label`: após geração de etiqueta, se config ativa e `auto_send_label = true`

## Arquivos
- `src/components/external-apps/WmsPratikaTab.tsx`
- `src/hooks/useWmsPratika.ts`
- `src/pages/ExternalApps.tsx`
- `supabase/functions/wms-pratika-send/index.ts`
