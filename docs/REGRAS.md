# REGRAS — Comando Central

> **REGRA PRINCIPAL:** NUNCA INTERPRETAR AS REGRAS DESTE DOCS, SEMPRE SEGUIR ELAS A RISCA, SE TIVER DÚVIDAS SOBRE ALGUMA IMPLEMENTAÇÃO, CONSULTAR O USUÁRIO ANTES DE PROSSEGUIR.

## Propósito

Este documento é a **FONTE ÚNICA DE VERDADE** para todas as especificações funcionais, contratos de UI/UX, fluxos e regras de negócio do Comando Central.

---

## Como Usar Este Documento

> **OBRIGATÓRIO:** A Lovable deve **SEMPRE** ler este documento (`docs/REGRAS.md`) antes de iniciar qualquer implementação ou ajuste em qualquer módulo do sistema.

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar, reescrever ou "melhorar" este documento por conta própria. |
| **Alteração somente por comando explícito** | Este documento só pode ser alterado quando o usuário pedir explicitamente usando o formato: `ATUALIZAR REGRAS: [instruções exatas + onde inserir]`. |
| **Reporte de lacunas/conflitos** | Se a Lovable identificar inconsistência, lacuna ou melhoria necessária, ela deve apenas **REPORTAR** e propor um texto sugerido para o usuário aprovar — **SEM ALTERAR O ARQUIVO**. |

---

## Índice (TOC)

1. [Loja Virtual / Builder](#loja-virtual--builder)
   1. [Funções Padrões (globais, independentes de tema)](#funções-padrões-globais-independentes-de-tema)
   2. [Páginas Padrão](#páginas-padrão)
      - [Página Inicial](#página-inicial)
      - [Categoria](#categoria)
      - [Produto](#produto)
      - [Carrinho](#carrinho)
      - [Checkout](#checkout)
      - [Obrigado](#obrigado)
      - [Minha Conta](#minha-conta)
      - [Pedidos](#pedidos)
      - [Pedido](#pedido)
      - [Rastreio](#rastreio)
      - [Blog](#blog)

---

## Loja Virtual / Builder

### Funções Padrões (globais, independentes de tema)

> **NOTA OBRIGATÓRIA:** Estas regras valem para templates antigos, atuais e futuros. O template muda **apenas** o visual e o conteúdo inicial editável. **Nenhuma regra funcional pode variar por template.**

---

### Páginas Padrão

#### Página Inicial

**Estrutura básica:**

- Para loja iniciada do zero, não precisa ter nada, somente header e footer normal.
- Para templates precisa ter uma estrutura de blocos e seções estratégicas com visual, imagens e produtos fictícios para melhor visualização, mas todos 100% editáveis (ou seja, criado com os blocos do nosso builder).

**Funcionalidades:**

- Nenhuma.

---

#### Categoria

**Estrutura básica:**

- Para templates iniciado do zero, precisa ter apenas o slot visual vazio de onde fica o banner, slots visuais vazios de produtos "simulando" os produtos de uma categoria (se o cliente já tiver produtos cadastrados pode mostrar qualquer produto aleatoriamente somente para fins de preenchimento), filtros de busca avançada+listagem de produtos+ordenação(básico).
- Já para templates, pode ter banner e produtos fictícios para exemplificar o visual do template.

**Funcionalidades:**

- Ativar compra rápida (se ativo ao clicar no botão comprar agora(botão principal) vai direto para o checkout, quando desativado vai para a página do produto)
- Exibir ou ocultar banner (o banner é a primeira seção da página de categoria, e a imagem dele é configurado no menu categorias para cada categoria, se já tiver categorias configuradas com banners, pode mostrar qualquer uma aleatório somente para visualização)
- Exibir ou ocultar avaliações dos produtos (a média das estrelas das avaliações reais dos produtos do menu avaliações, deve aparecer logo abaixo do nome do produto na thumb)
- Exibir ou ocultar botão adicionar ao carrinho da thumb dos produtos (abre carrinho lateral/suspenso se estiver ativo, se não o botão some)
- Alterar nomeclatura do botão de "Comprar agora"(botão principal)
- Opção de mostrar selos ou não (os selos são criados no menu Aumentar ticket)
- Opção de ocultar ou não botão personalizado (texto, cor e link). O botão personalizado deve ficar sempre no meio.
  - Se "Adicionar ao carrinho" estiver ativo: 1º Adicionar ao carrinho, 2º Botão personalizado, 3º "Comprar agora" (sempre por último).
  - Se "Adicionar ao carrinho" estiver desativado: 1º Botão personalizado, 2º "Comprar agora" (sempre por último).

**Regra adicional:**

- Antes de implementar qualquer coisa relacionada a Home/Categoria, verifique o que já existe ou está "meia criado" e complete/reaproveite (não recriar do zero, não duplicar lógica).

---

#### Produto

**Estrutura básica:**

- Slot para imagem principal, slots menores para imagens secundárias até máximo 10 imagens, slots para selos, abaixo dele as 5 estrelas de referência das avaliações, abaixo das estrelas o nome do produto, abaixo do nome os valores, abaixo do valor destaque de pagamento ("bandeirinhas" com as formas de pagamento com destaque para pix com desconto), abaixo vem a descrição curta do produto, abaixo vem as opções de variações (se tiver ativa), depois botão para adicionar quantidade, ao lado o botão principal "Comprar agora", abaixo o botão de adicionar ao carrinho, abaixo o botão de comprar pelo whatsapp, abaixo a calculadora de frete, abaixo "bandeirinhas editáveis" para colocar informações de garantia, etc, abaixo vem o Compre junto (se estiver ativo), depois vem a parte da descrição completa, depois as avaliações do produto, depois os produtos relacionados.

**Observação:** As informações dos produtos são puxadas do cadastro dos produtos, se o cliente não tiver produtos no cadastro, no builder vamos apenas exemplificar com "exemple name" valor simbolico, etc, somente para uma visalização do cliente de como vai ficar a página dos produtos dele, se ele tiver produtos cadastrados o sistema busca um produto real do cliente aleatório para exemplificar. Mesma lógica da página de categoria.

**Funcionalidades:**

- Mostrar galeria (mostra ou esconde as imagens secundárias do cadastro do produto, a imagem principal nunca some)
- Mostrar descrição (mostra ou esconde a descrição curta dos produtos, nunca esconde a descrição completa, a descrição curta é puxada do cadastro dos produtos)
- Mostrar ou não as variantes (variações do produto, como cor, tamanho, etc, são puxadas do cadastro do produto)
- Mostrar ou não o estoque (puxado do cadastro do produto)
- Mostrar ou esconder produtos relacionados (grid de produtos relacionados também é cadastrada no cadastro dos produtos)
- Mostrar ou esconder Compre junto (Configurado no menu Aumentar ticket)
- Mostrar ou esconder avaliações (se desativada esconde todas as avaliações, inclusive o input para o cliente fazer uma avaliação)
- Ativar ou desativar função de carrinho suspenso na página do produto (ao ativada se o cliente clicar no botão adicionar ao carrinho abre o carrinho suspenso, quando desativada simplesmente adiciona o produto ao carrinho e permanece na página do produto e o botão Adicionar ao carrinho fica bloqueado e muda para "Adicionado")
- Ativar ou desativar Carrinho rápido (quando ativo funciona assim, se o cliente já tiver algum produto adicionado ao carrinho aparece um popup pequeno no canto inferior direito no formato do carrinho da loja e mostrando a quantidade de itens adicionados, se o cliente clicar ele vai para a página do carrinho com os produtos adicionados, quando a função está desativada não aparece esse popup)
- Mostrar ou esconder botão "Comprar pelo whatsapp"
- Mostrar ou esconder botão Adicionar ao carrinho
- Campo personalizado para editar o nome do botão principal "Comprar agora"

---

#### Carrinho

<!-- Placeholder - conteúdo a ser definido -->

---

#### Checkout

<!-- Placeholder - conteúdo a ser definido -->

---

#### Obrigado

<!-- Placeholder - conteúdo a ser definido -->

---

#### Minha Conta

<!-- Placeholder - conteúdo a ser definido -->

---

#### Pedidos

<!-- Placeholder - conteúdo a ser definido -->

---

#### Pedido

<!-- Placeholder - conteúdo a ser definido -->

---

#### Rastreio

<!-- Placeholder - conteúdo a ser definido -->

---

#### Blog

<!-- Placeholder - conteúdo a ser definido -->
