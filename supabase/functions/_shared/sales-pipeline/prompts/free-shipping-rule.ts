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
// 5. Cobertura cruzada da MESMA LINHA (não da família ampla):
//    se o item em foco paga frete MAS existem packs/kits da MESMA LINHA
//    (mesmo produto-base — ex.: a unidade da Loção e os packs 2x/3x/6x dela)
//    com frete grátis, mencione de forma honesta e curta. Cite os packs
//    EXATAMENTE como descritos em
//    `ofertas_com_frete_grátis_na_mesma_linha` do PRODUTO EM FOCO ou em
//    `family_shipping_summary.free_shipping_offers` do retorno de
//    search_products. NÃO empurre o pack agressivamente — apenas informe.

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

### COBERTURA CRUZADA — MESMA LINHA (NÃO FAMÍLIA AMPLA)
- "Mesma linha" = mesmo produto-base. Ex.: a unidade da Loção e os packs
  2x/3x/6x DELA são a mesma linha. A loção e o balm NÃO são a mesma linha,
  mesmo sendo da mesma família/dor.
- Fonte da informação: campo \`ofertas_com_frete_grátis_na_mesma_linha\` no
  bloco "PRODUTO EM FOCO" e/ou \`family_shipping_summary.free_shipping_offers\`
  no retorno de search_products. SÓ cite o que estiver explícito ali — NUNCA
  invente "tem outro produto com frete grátis".
- Quando o item em foco PAGA frete e existem ofertas da mesma linha COM frete
  grátis, mencione UMA frase curta e honesta, com os labels exatos
  (ex.: "3x", "6x"):
  • "A unidade paga frete normal. Já os packs 3x e 6x dela saem com frete grátis."
- Quando o cliente pergunta direto "é frete grátis?" e o item em foco paga
  frete, MAS existem packs da mesma linha com frete grátis:
  • "A unidade paga frete. Mas se quiser, os packs 3x e 6x dela têm frete grátis."
  • Não pergunte CEP. Não empurre o pack — informe e deixe o cliente decidir.
- Se NÃO existem ofertas da mesma linha com frete grátis, NÃO invente
  comparação com outras linhas/famílias.

### CASO MISTO ÚTIL — RECOMENDAÇÃO
- Quando você listar opções (search_products) e existir mistura clara
  (unidade paga, kits/packs com frete grátis), pode dizer de forma curta:
  "A unidade sai por R$ X. Nos packs 3x e 6x o frete é grátis."
  Sempre os labels EXATOS retornados pela tool. Sem pressão de venda.
`.trim();
