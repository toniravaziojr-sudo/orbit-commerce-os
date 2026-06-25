## Como funciona hoje

Quando você clica em "Gerar com IA" no cadastro do produto, o sistema envia para a IA de imagem **apenas 3 coisas**: nome do produto, descrição curta e a foto principal. Todo o resto que está no cadastro — marca, tipo, benefícios, público, ingredientes, regulatório, composição de kit, características capilares, etc. — **fica de fora**. Por isso a IA inventa palavras no rótulo e cria benefícios genéricos.

## O problema

Falta contexto. A IA recebe nome + foto e tem que adivinhar o resto.

## O que eu faria

Dar à IA **acesso a todo o cadastro do produto**, sem alterar o fluxo nem a tela, e avisar quando faltar informação importante (sem bloquear).

### 1. Coleta automática de TUDO que existe no cadastro

Ao gerar a imagem, o sistema lê do banco o produto inteiro — **todos os 75 campos do cadastro** mais os dados relacionados — e monta um briefing organizado. Isso inclui:

- **Identidade:** nome, marca, linha, modelo, SKU, GTIN, tipo de produto, formato (simples/kit/combo).
- **Comercial:** preço, preço comparado, promoção ativa, destaque, tags, categoria.
- **Descrições:** descrição completa, descrição curta, palavras-chave, SEO.
- **Ficha técnica:** peso, dimensões, conteúdo líquido (valor + unidade), unidade de medida, código de barras.
- **Cosmético / capilar (quando preenchido):** dermatologicamente testado, hipoalergênico, cruelty-free, vegano, com fragrância, nome da fragrância, tipos de cabelo recomendados, tipos de tratamento, efeitos esperados.
- **Regulatório:** regime (cosmético/medicamento/etc.), categoria regulatória, números ANVISA/AFE, restrições comerciais.
- **Público:** gênero/audiência, garantia.
- **Visão IA do produto (já existe):** papel comercial, "quando recomendar", "quando NÃO indicar", notas de recomendação, tipo IA, função principal.
- **Composição (quando for kit):** os itens reais que compõem o kit, com nome e quantidade.
- **Pontos de dor que o produto resolve** (quando cadastrados).
- **Memória de ajustes anteriores** (correções manuais já feitas para esse produto).

Tudo isso vira um briefing estruturado entregue à IA junto com a foto de referência.

### 2. Briefing organizado em blocos

Em vez de jogar texto solto, o sistema entrega à IA blocos curtos:
**Produto** · **Identidade visual / rótulo** · **Benefícios reais** · **Público** · **Cena recomendada** · **Restrições (o que NÃO mostrar)**.

Reduz alucinação porque a IA passa a copiar do briefing em vez de inventar.

### 3. Trava anti-texto inventado

Quando o pedido envolver texto na imagem ("destaque benefícios", "mostre selo X"):
- Os benefícios e selos vêm **literalmente do cadastro**, entre aspas, como texto a ser usado.
- Se o cadastro não tiver aquela informação, o sistema **não deixa a IA inventar** — usa apenas o que existe.

### 4. Regras de cena coerentes com o tipo

- Produto simples → 1 unidade na cena.
- Kit/combo → mostra os itens reais da composição, na quantidade certa.
- Cosmético com ANVISA → não inventa selos.
- Público definido → cena coerente com gênero/idade.

### 5. Aviso na tela (sem bloquear)

Na hora de gerar, se faltarem campos importantes para a qualidade da imagem, aparece um aviso amarelo discreto no diálogo de geração:

> ⚠️ A IA pode gerar uma imagem genérica porque faltam algumas informações no cadastro deste produto: **Benefícios, Público-alvo, Composição do kit**. [Abrir cadastro] · [Gerar mesmo assim]

O usuário pode gerar do mesmo jeito. Apenas fica avisado.

**Quais campos disparam o aviso (lista resumida):** marca, tipo de produto, benefícios/quando recomendar, público-alvo, conteúdo líquido, composição do kit (se for kit), tipos de cabelo/efeitos (se for cosmético capilar), regulatório (se a categoria exigir).

### 6. Eficiência (sem gasto extra)

- A consulta ao cadastro é **uma única leitura** do banco por geração — produto + relacionados em uma chamada só.
- Nada de chamadas extras de IA: o enriquecimento de contexto acontece **no mesmo prompt** já enviado.
- Memória de ajustes manuais continua sendo aproveitada (já existe).

### 7. Sem mudança no fluxo nem na UI

- Mesmo botão "Gerar com IA".
- Mesma tela.
- Mesmo modelo (Fal.ai — mantido conforme sua decisão).
- Único elemento novo na tela: o aviso amarelo quando faltar informação.

## Resultado final

- IA gera imagens fiéis ao produto real, com a identidade visual correta.
- Para de inventar palavras no rótulo e benefícios fantasma.
- Kits saem com os itens certos.
- Lojista é orientado a completar o cadastro quando faltar algo, sem ser bloqueado.
- Zero custo extra de processamento — uma leitura a mais no banco, nada de IA adicional.

## Confirmação

Pode seguir com a implementação assim?

---

### Detalhes técnicos (referência interna)

- Helper compartilhado em `_shared/product-context-loader.ts` lê `products` (todos os 75 campos), `ai_product_commercial_payload`, `ai_product_relations`, `product_components` (+ join no produto-componente), `product_pain_points`, `product_images`, `meli_product_attribute_memory`, `system_universal_categories` (nome amigável), `tenants` (marca da loja) — em uma única função, com `select` único por tabela.
- Builder `buildProductBriefing(productContext)` monta o bloco estruturado em texto, omitindo seções vazias.
- `creative-image-generate` substitui `product_description` cru por esse briefing dentro de `buildPrompt → contextBrief`. O `product_image_url` continua sendo a referência visual.
- Checagem de completude para o aviso: helper `evaluateImageContextReadiness(productContext)` retorna `{ missing: string[], severity: 'ok'|'warning' }`. Consumido no `AIImageGeneratorDialog` para o banner amarelo.
- Sem alteração de schema, sem alteração no fluxo de jobs/polling, sem alteração de modelo/Fal.
- Cobertura: doc `docs/especificacoes/criativos/contrato-format-size-quality.md` ganha seção "Contexto de produto v1" e nova memória `mem://features/ai/image-generation-product-context-v1`.
