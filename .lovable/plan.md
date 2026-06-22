## Objetivo
Resolver os 3 pontos abertos no Mercado Livre:
1. Atalho na aba **Pendências** para abrir o cadastro do produto.
2. Preencher marca "Respeite o Homem" nos 8 SKUs do Kit Banho Calvície Zero que estão sem marca.
3. Fazer o assistente de anúncios enviar **TODOS** os atributos pedidos pelo Mercado Livre, não só os básicos.

Resumo da investigação:
- O Mercado Livre dá pontuação ao anúncio com base em quantos atributos relevantes (obrigatórios + recomendados) vão preenchidos. Hoje o sistema só envia os básicos (marca, GTIN, SKU, garantia, condição) + auto-preenchimento de obrigatórios. Os recomendados, que sobem o score, nunca vão.
- Existe um motor pronto que resolve atributos por categoria (cadastro + derivações de kit/peso/conteúdo + dicionário universal + IA). Esse motor já é usado na tela de edição individual, mas **não** no assistente de criação em lote — por isso a pontuação fica baixa.

## O que vai ser feito

### 1) Atalho na aba Pendências
Em cada linha de pendência cuja causa seja "dado faltando no cadastro do produto" (ex.: marca vazia), adicionar botão **"Abrir cadastro do produto"**. O botão abre **em nova aba**, direto na tela de edição do produto. O lojista corrige, salva e fecha a aba.

**Sincronização após o ajuste:** quando o lojista voltar para a aba Pendências, o sistema detecta o retorno de foco e **revalida automaticamente** a lista de pendências e os anúncios — sem cron e sem assinatura em tempo real (zero custo de cloud). Se por algum motivo a revalidação automática não couber em alguma tela, mostro um aviso discreto "Os dados podem ter mudado em outra aba — atualizar agora" com botão de refresh.

### 2) Marca dos 8 SKUs (Respeite o Homem)
Preencher marca = "Respeite o Homem" nos 8 produtos abaixo (são 8, não 7 como falei antes — apareceu mais um "Noite"):
- 0050 Kit Banho Calvície Zero Noite
- 0051 Kit Banho Calvície Zero (FLEX) Noite
- 0052 Kit Banho Calvície Zero (2x) Noite
- 0053 Kit Banho Calvície Zero (3x) Noite
- 0060 Kit Banho Calvície Zero (FLEX)
- 0061 Kit Banho Calvície Zero
- 0062 Kit Banho Calvície Zero (2x)
- 0063 Kit Banho Calvície Zero (3x)

### 3) Envio completo de atributos ao Mercado Livre
**Nova etapa "Características" no assistente**, posicionada **entre "Descrições" e "Condição"** (conforme você aprovou). Para cada anúncio em preparação, essa etapa:
- Busca os atributos exigidos e recomendados pelo Mercado Livre para a categoria escolhida.
- Auto-preenche o máximo a partir do cadastro do produto, derivações (kit, peso, unidades por embalagem, conteúdo líquido, regime regulatório) e do dicionário universal; o que sobrar de obrigatório é sugerido pela IA para o lojista revisar.
- Mostra resumo por produto: "X preenchidos, Y para revisar, Z faltando", com o mesmo atalho "Abrir cadastro do produto" quando faltar algo que precisa vir do cadastro.
- Salva tudo no rascunho antes de avançar para "Condição".

A publicação passa a enviar tudo o que foi resolvido — sem mudar nada na lógica de publicação além de garantir que ela não sobrescreva o que o lojista revisou.

Vale tanto na criação em lote quanto na reabertura de rascunhos.

**Reenvio para os 14 já publicados:** conforme você decidiu, **não entra neste plano**. Você refaz o processo do zero depois que os ajustes estiverem prontos.

## Resultado final
- Aba Pendências com atalho de 1 clique para o cadastro, abrindo em nova aba e atualizando sozinha quando o lojista volta.
- 8 SKUs com marca preenchida, prontos para publicar sem erro.
- Toda criação nova de anúncio nasce com **todos** os atributos relevantes preenchidos e score alto no Mercado Livre.

## Documentação que será atualizada na mesma entrega
- Especificação do Mercado Livre — nova etapa "Características" e atalho na aba Pendências.
- Mapa de UI — nova etapa no assistente e novo botão na aba Pendências.

## Bloco técnico (opcional)
- `MeliListingsTab.tsx`: novo botão "Abrir cadastro do produto" (alvo `_blank`, rota `/products` em modo edição). Hook de revalidação automática via `visibilitychange` + `focus` na aba Pendências (invalida apenas as queries de listings e products do tenant — custo zero).
- `MeliListingCreator.tsx`: nova etapa `"attributes"` no array `STEPS`, posicionada após `"descriptions"`. A etapa chama `meli-resolve-attributes` (já existe, sem alteração) por listing, mostra o painel `MeliAttributesPanel` em modo "linha por produto" com resumo e atalhos, e persiste o array `attributes` em `meli_listings` antes do avanço.
- `meli-publish-listing`: nenhuma mudança estrutural; só garantir merge sem sobrescrever atributos já salvos pelo lojista.
- Página de Produtos (`/products`): suportar deep link `?edit={productId}` se ainda não suportar (verifico no início da implementação e, se faltar, adiciono).
- Correção dos 8 SKUs: feita via tela de Produtos (não via migração), respeitando trilhas de auditoria do cadastro.
