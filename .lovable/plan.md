## Como funciona hoje
A tela de Anúncios do Mercado Livre lista tudo junto (rascunho, publicado, pausado, erro) e tem uma barra de "Ações em Massa" com 7 botões — vários duplicam etapas que já existem dentro do dialog de criação. A publicação no ML hoje é uma ação separada depois de criar o rascunho. Excluir apaga só do nosso sistema, não encerra o anúncio no Mercado Livre. Pausar e reativar já sincronizam.

## O que muda

### 1. Três abas de organização
Topo da lista:
- **Rascunhos** (aba padrão) — anúncios ainda não enviados ao ML (rascunho, pronto, aprovado). Quando vazia, mostra estado limpo com chamada para criar novo anúncio.
- **Publicados** — anúncios ativos no ML (publicado e pausado).
- **Pendências** — anúncios com erro ou em revisão. Badge com contador quando houver itens, para sinalizar atenção.

Mesma tabela, muda só o filtro. Contador visível em cada aba.

### 2. Barra de ações em massa simplificada
**Removidos da tela principal:** Enviar Todos, Gerar Títulos, Gerar Descrições, Auto-Categorizar, Enviar Selecionados. Essas funções continuam disponíveis dentro do dialog de criação/edição em lote — é o lugar natural delas.

**Mantidos na tela principal**, aparecendo só quando houver seleção:
- **Editar em Lote** (novo) — reabre o mesmo wizard de 7 etapas (categoria, marca, código de barras, garantia, frete, tipo, IA de título/descrição, revisão), já preenchido com os anúncios selecionados. Na **última etapa**, em vez de "Publicar", o botão final passa a ser **"Atualizar anúncios"** — atualiza no nosso sistema e propaga as alterações para os anúncios já vinculados no Mercado Livre.
- **Excluir Selecionados** — mantém.

Ações individuais por linha continuam iguais (editar, publicar, pausar, reativar, ver no ML, sincronizar, excluir).

### 3. Publicação movida para o final do dialog de criação
A última etapa do dialog "Novo Anúncio" passa a ter dois botões:
- **Salvar como rascunho** — comportamento atual.
- **Salvar e Publicar no Mercado Livre** — salva e já dispara a publicação.

Com isso, some qualquer botão de "enviar" da tela principal.

### 4. Sincronização real em todas as ações
- **Excluir (individual e em lote)** — para anúncios publicados ou pausados, **encerra no Mercado Livre de forma definitiva** (o anúncio sai do ar, o link público deixa de funcionar) e depois remove do nosso sistema. Para anúncios que nunca foram publicados, exclui só local. Aviso de confirmação deixa claro que é irreversível.
- **Pausar / Reativar** — já sincronizam, mantém.
- **Editar publicado (individual)** — já sincroniza, mantém.
- **Editar em Lote** — ao atualizar anúncios já publicados, envia as alterações para o ML automaticamente.
- **Sincronizar** — mantém.

Toda ação em lote mostra resumo final: sucessos, parciais (com quais falharam) e erros.

## Resultado final
- Tela abre em **Rascunhos**, limpa quando não há nada pendente.
- **Pendências** mostra rapidamente o que precisa de ajuste.
- **Publicados** concentra a operação do dia a dia.
- Barra de ações enxuta: só **Editar em Lote** e **Excluir Selecionados**.
- Publicar é a última etapa natural do dialog de criação.
- Editar em lote reabre o mesmo wizard e, na última etapa, atualiza os anúncios vinculados (em vez de publicar novos).
- Excluir, pausar, reativar e editar refletem automaticamente no Mercado Livre — exclusão é definitiva.

## Documentação ao final
Atualizar `docs/especificacoes/marketplaces/mercado-livre.md` (nova organização da tela, novo fluxo de publicação, edição em lote, exclusão definitiva) e `docs/especificacoes/transversais/mapa-ui.md` (abas e ações da tela de Anúncios do ML).
