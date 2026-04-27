// Pipeline F2 — Regra global de FRETE GRÁTIS.
// Aplicada nos prompts: recommendation, product-detail, decision, checkout-assist.
//
// Princípios:
// 1. free_shipping=true vem do cadastro do produto (regra GLOBAL — vale pra
//    qualquer cidade do Brasil, NÃO depende de CEP).
// 2. Quando o produto/oferta em foco tem free_shipping=true, mencione o
//    benefício de forma curta e comercial junto do preço — UMA frase, sem
//    pitch longo.
// 3. Se o cliente perguntar "é frete grátis?" / "tem frete grátis?":
//    - free_shipping=true → responda DIRETAMENTE "Sim, frete grátis pra
//      qualquer cidade", SEM pedir CEP.
//    - free_shipping=false → diga que esse item paga frete e ofereça
//      calcular pelo CEP.
// 4. CEP só é solicitado quando a pergunta for sobre PRAZO de entrega
//    (ou no checkout pra fechar pedido). Frete grátis NÃO precisa de CEP.
// 5. Cenário misto (unidade sem frete grátis, kits com frete grátis):
//    diga isso de forma honesta e curta — ex.: "A unidade paga frete normal,
//    mas os kits saem com frete grátis." NÃO empurre o kit agressivamente;
//    apenas informe o fato.

export const FREE_SHIPPING_RULE = `
### REGRA GLOBAL — FRETE GRÁTIS
- O campo free_shipping vem do cadastro do produto. true = frete grátis
  GLOBAL (qualquer cidade do Brasil, sem depender de CEP).
- Quando free_shipping=true do produto/oferta em foco, mencione o benefício
  de forma curta e comercial junto do preço. UMA frase, sem pitch longo.
  Ex.: "Sai por R$ X, com frete grátis."
- Se o cliente perguntar "é frete grátis?" / "tem frete grátis?":
  • free_shipping=true → responda DIRETO "Sim, frete grátis pra qualquer
    cidade", SEM pedir CEP.
  • free_shipping=false → diga que esse item paga frete e ofereça
    calcular pelo CEP, se ele quiser.
- CEP só é solicitado quando a pergunta for sobre PRAZO de entrega ou no
  fechamento do pedido. Frete grátis NÃO precisa de CEP.
- Cenário misto (unidade sem frete grátis + kit com frete grátis):
  informe de forma honesta e curta ("A unidade paga frete normal, mas os
  kits saem com frete grátis."). NÃO empurre o kit agressivamente;
  apenas informe o fato e deixe o cliente decidir.
`.trim();
