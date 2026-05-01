---
name: WhatsApp Cart Converted Only On Payment Confirmation
description: whatsapp_carts.status='converted' só deve ser definido pelo webhook do gateway de pagamento confirmando o pedido. Marcar no momento de gerar o link de checkout cria deadlock se o cliente pedir o link novamente.
type: constraint
---

**Regra:** `whatsapp_carts.status` permanece `active` enquanto a IA estiver no fluxo de venda, mesmo após `generate_checkout_link` ser chamada. A transição para `converted` é responsabilidade do webhook de confirmação do pedido (gateway).

**Por quê:** descoberto na Reg #2.11 (conversa `dc4943c8-…`, turno 6). O handler `generate_checkout_link` em `ai-support-chat/index.ts` (linha ~1925) marcava `status: "converted"` imediatamente. Quando o cliente disse "Manda o link" pela 2ª vez, a tool buscou cart com `status='active'`, não achou, retornou "Carrinho vazio" e a LLM caiu em loop de pedir confirmação — quebrando a venda.

**Como aplicar:**
- Em `generate_checkout_link`, apenas atualizar `updated_at`. NÃO mexer em `status`.
- A tool pode ser chamada N vezes para o mesmo cart — cada chamada gera um novo `checkout_links` row, mas o cart continua válido.
- A conversão real é responsabilidade de quem processa o webhook do pagamento (Pagar.me, Mercado Pago, etc.) — esse fluxo já existe separadamente.

**Não fazer:**
- Marcar `converted` em qualquer ponto do `ai-support-chat`.
- Adicionar TTL agressivo no cart (ex: deletar após X minutos) para "limpar".

**Sinal de regressão:** cliente pede "manda o link" duas vezes na mesma conversa, segunda chamada retorna "Carrinho vazio" e a IA pede para confirmar o produto novamente.
