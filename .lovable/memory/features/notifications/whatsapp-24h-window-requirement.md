# Memory: features/notifications/whatsapp-24h-window-requirement
Updated: now

## Comportamento do WhatsApp Business API

A API do WhatsApp Business da Meta possui uma **janela de atendimento de 24 horas**. Este é um comportamento esperado da plataforma, NÃO um bug do sistema.

### Regras de Entrega

| Tipo de Mensagem | Quando é Entregue |
|------------------|-------------------|
| **Mensagem de Texto** | Apenas se o cliente enviou mensagem nas últimas 24h |
| **Template Aprovado** | Sempre entregue (proativo) |

### Comportamento Observado

Quando uma notificação é enviada como texto livre para um cliente que NÃO tem conversa ativa:
1. A API da Meta **aceita** a requisição
2. Retorna um `message_id` válido (wamid.HB...)
3. O log mostra `status: sent`
4. **MAS a mensagem NÃO é entregue ao destinatário**

### Diagnóstico

Para verificar se o problema é a janela de 24h:
1. Verificar em `conversations` se o número do cliente tem `last_customer_message_at` nas últimas 24h
2. Se não há conversa ou está expirada, a mensagem não será entregue

### Solução

Para notificações proativas (confirmação de pagamento, atualização de pedido, etc.):
1. Criar templates de mensagem na plataforma Meta
2. Aguardar aprovação da Meta
3. Configurar as regras de notificação para usar `template_name` em vez de texto livre
4. O sistema já suporta templates em `meta-whatsapp-send` (parâmetros: `template_name`, `template_language`, `template_components`)

### Arquivos Relevantes
- `supabase/functions/meta-whatsapp-send/index.ts` - Suporta templates (linhas 124-136)
- `supabase/functions/process-events/index.ts` - Atualmente envia `template_key: null`
- `src/components/notifications/RuleFormDialogV2.tsx` - UI de regras (precisa campo para template)
