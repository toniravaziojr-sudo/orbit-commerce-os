## Objetivo
Trocar o toggle global de frete grátis do diálogo de envio do Mercado Livre por um controle **por anúncio**, alinhado à regra de frete grátis obrigatório do ML (R$ 79+).

## Como funciona hoje
- Etapa "Frete" do `MeliListingCreator` tem **um único toggle global** de Frete Grátis aplicado a todos os anúncios em lote.
- Se todos os itens estão acima do piso, o toggle fica forçado/bloqueado em ON; senão, é livre — mas o ajuste vale para **todos** simultaneamente, sem distinção item a item.
- O backend (`meli-publish-listing`) já força `free_shipping=true` por item quando o preço cruza o piso, então a divergência hoje é apenas de UX (o usuário pode achar que desligou e o ML mantém ligado).

## O problema
- Usuário não consegue decidir frete grátis individualmente para os anúncios **abaixo** do piso.
- Não há sinalização visual por anúncio de que aquele item **tem frete grátis obrigatório** pelo ML.
- Falta atalho para "ligar/desligar em todos os elegíveis" de uma vez.

## O que eu faria

### 1. UI — Etapa "Frete" do diálogo de envio (`MeliListingCreator`)
- Substituir o toggle global por uma **lista de anúncios**, cada linha com:
  - Título do anúncio + preço.
  - Toggle "Frete Grátis" por anúncio.
  - Se `preço ≥ R$ 79`: toggle **forçado ON e bloqueado**, com mini badge "Obrigatório pelo Mercado Livre" e tooltip explicando a regra.
  - Se `preço < R$ 79`: toggle livre, padrão OFF (ou herdado do que já estiver salvo).
- Acima da lista, manter o banner-resumo atual (X de N com frete grátis obrigatório).
- Adicionar **duas ações em massa** que afetam **somente os anúncios elegíveis** (abaixo do piso):
  - "Ativar frete grátis em todos os elegíveis"
  - "Desativar frete grátis em todos os elegíveis"
  - Mostrar contador "(N elegíveis)" no botão; desabilitar se N=0.
- Manter o toggle "Retirada no local" como está (escopo global de frete, fora desta entrega).

### 2. Estado e persistência
- Trocar `freeShipping: boolean` global por `freeShippingByListing: Record<listingId, boolean>` no estado do Creator.
- Inicialização: para cada item, se obrigatório → true; senão, herdar do que está em `meli_listings.shipping.free_shipping` (ou false).
- Persistir por anúncio em `meli_listings.shipping` ao alternar o toggle (update individual, sem `persistBulkSettings` global para frete grátis).
- No envio (`meli-publish-listing` payload), enviar o valor escolhido por anúncio; o backend continua reforçando `true` se `preço ≥ piso` (defesa em profundidade — sem alteração de regra).

### 3. Wizard de anúncio único (`MeliListingWizard`)
- Já está correto (badge "Obrigatório" + toggle bloqueado quando acima do piso). Sem mudanças.

### 4. Validação técnica
- Build + typecheck.
- Cenários de teste no diálogo:
  - Lote 100% acima do piso → todos travados ON, ações em massa desabilitadas.
  - Lote 100% abaixo → todos livres, ações em massa funcionam.
  - Lote misto → travados ON aparecem com badge; ações em massa só mexem nos livres.
  - Persistência ao navegar entre etapas (Voltar/Continuar) sem perder a escolha por item.
- Conferência via consulta ao banco: `meli_listings.shipping.free_shipping` por item espelha o toggle.

### 5. Docs
- Atualizar `docs/especificacoes/marketplaces/mercado-livre.md` (seção Frete Grátis v2.5.0 → v2.5.1) descrevendo o controle por anúncio e as ações em massa.
- Atualizar a memória `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` no item "Frete Grátis ML".
- Atualizar `docs/especificacoes/transversais/mapa-ui.md` na entrada do diálogo de envio do ML (Step 9 — Frete).

## Resultado final
Na etapa Frete do diálogo, o lojista vê cada anúncio com seu próprio toggle. Itens acima de R$ 79 aparecem travados ON com aviso "Obrigatório pelo Mercado Livre". Itens abaixo ficam livres, com botões "Ativar/Desativar em todos os elegíveis" para acelerar. O que vai para o ML reflete fielmente o que está na UI, sem surpresa pós-publicação.
