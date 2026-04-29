---
name: AI Product Detail Image Mandatory On First Mention
description: Modo Vendas WhatsApp — em product_detail, send_product_image é obrigatória na 1ª apresentação real do produto (1x por produto, respeitando janela Meta 24h).
type: constraint
---

No estado `product_detail` da Pipeline F2, a tool `send_product_image` DEVE ser chamada junto com `get_product_details` na primeira vez que a IA descreve o produto, desde que haja imagem cadastrada. Limite: 1 imagem por produto por conversa. Se já enviou, não repete.

**Why:** Cliente decide melhor vendo o produto. Em conversa real de WhatsApp, faltar imagem na 1ª menção é gap imediato — o cliente pede foto ou abandona. Tornar obrigatória na 1ª menção reduz turnos e aumenta conversão.

**How to apply:** Regra está no prompt `product-detail.ts`. Respeitar janela Meta 24h (memória `whatsapp-meta-integration-standard-v3-2`); se fora da janela, só template aprovado e a imagem não vai. Se aparecer envio em outro estado, é violação de tools liberadas.
