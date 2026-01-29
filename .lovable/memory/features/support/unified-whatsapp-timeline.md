# Memory: features/support/unified-whatsapp-timeline
Updated: now

## Timeline Unificada de WhatsApp

Todas as mensagens enviadas pelo WhatsApp (notificações ou atendimento) agora aparecem na timeline do cliente no módulo de Atendimento.

### Implementação

A função `run-notifications` agora chama `registerInAttendanceTimeline()` após cada envio bem-sucedido de WhatsApp:

1. **Busca ou cria conversa**: Procura conversa ativa para o telefone, ou cria nova com status `bot` e tag `notification`
2. **Insere mensagem**: Registra na tabela `messages` com `sender_type: 'system'`
3. **Atualiza contadores**: Atualiza `last_message_at` da conversa

### Comportamento

| Tipo de Mensagem | Aparece no Atendimento? | sender_type |
|------------------|-------------------------|-------------|
| Notificação (pedido confirmado, etc) | ✅ Sim | `system` |
| Resposta da IA | ✅ Sim | `bot` |
| Resposta do agente | ✅ Sim | `agent` |
| Mensagem do cliente | ✅ Sim | `customer` |

### Arquivos Modificados

- `supabase/functions/run-notifications/index.ts` — Versão v1.3.0

### Notas

- A função `registerInAttendanceTimeline` é não-bloqueante (erros são logados mas não impedem o envio)
- Conversas iniciadas por notificação recebem tag `notification` para fácil identificação
- O cliente é automaticamente vinculado se o telefone corresponder a um registro em `customers`
