---
name: ai-channel-outbound-dispatcher
description: Único caminho de saída para a IA em Messenger, IG DM/Comments, FB Comments, ML, Shopee, TikTok Shop é o channel-dispatcher.ts. Webhooks nunca enviam direto. Metadata da conversa precisa carregar IDs específicos por canal.
type: constraint
---

A entrega de saída da IA para os canais Messenger, Instagram DM, Instagram Comments, Facebook Comments, Mercado Livre, Shopee e TikTok Shop é exclusiva do dispatcher unificado em `supabase/functions/_shared/channel-dispatcher.ts`, chamado dentro de `ai-support-chat` no STEP 10.

Webhooks de canal (meta-page-webhook, meta-instagram-webhook, meli-webhook, shopee-webhook, tiktok-shop-webhook) são responsáveis SOMENTE por ingerir o inbound, persistir mensagem, criar/atualizar conversa com o `metadata` correto e disparar `shouldAiRespond` + `invokeAiSupportChat`. Eles **não devem** enviar a resposta diretamente para o canal.

Metadata mínima exigida na conversa para cada canal:
- `facebook_messenger`: `page_id`, `sender_id`
- `instagram_dm`: `page_id`, `ig_user_id`, `sender_id`
- `facebook_comments`: `page_id`, `comment_id`
- `instagram_comments`: `page_id`, `comment_id`
- `mercadolivre`: `meli_question_id`
- `shopee`: `shopee_buyer_id` (ou `from_id`) e `shopee_shop_id`
- `tiktok_shop`: `tiktok_conversation_id`

**Por quê:** evita duplicação de lógica de envio, mantém um único ponto para anti-spam, retries, gates e auditoria.
