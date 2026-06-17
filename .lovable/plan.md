# Passo a passo guiado de aprovação de campanha

## Decisões confirmadas pelo lojista
1. **Etapa final publica direto** na Meta/Google/TikTok dentro do próprio dialog.
2. **Geração de criativo na etapa de anúncios é um a um** — cada anúncio escolhe entre **Gerar com IA**, **Subir do meu computador** ou **Escolher do Drive**.
3. **Edição da campanha aprovada só é possível antes da publicação.** Depois que entra na Meta, o ajuste é feito ou direto no painel da Meta, ou via chat com a IA (sem reabrir o dialog).
4. **Upload do PC obrigatoriamente salva no Drive da loja** seguindo a regra de armazenamento atual (sem upload "solto" fora do Drive).

## Como funciona hoje
Modal com menu lateral livre (Visão Geral / Campanha / Conjuntos / Anúncios). Lojista clica em **Aprovar** e a proposta vai direto para "gerar criativos", sem revisão guiada nem edição manual. Não há campo para subir criativo próprio nem visualização do prompt antes de gerar. Publicação acontece em telas separadas (gerar → revisão final → publicar).

## O problema
Aprovação cega, sem revisão por nível. Ajustes só por meio de um editor lateral separado. Sem upload de criativo do PC ou do Drive. Publicação fragmentada.

## O que eu faria

### Passo a passo único (5 etapas, mesmo dialog)
```text
[ 1. Visão geral ] → [ 2. Campanha ] → [ 3. Conjuntos ] → [ 4. Anúncios ] → [ 5. Publicar ]
```
- **Visão geral:** diagnóstico, objetivo, orçamento total, quantidade de conjuntos/anúncios.
- **Campanha:** edita inline nome, objetivo, orçamento, datas, estratégia de lance.
- **Conjuntos:** navega entre os conjuntos e edita público, idade, gênero, região, posicionamentos, exclusões, evento de conversão e orçamento. Cada conjunto precisa ser marcado como revisado.
- **Anúncios:** para cada anúncio — edita título/copy/descrição/CTA/formato, mostra o **prompt visual** (editável) e oferece três caminhos para o criativo:
  - **Gerar com IA** (consome créditos, com confirmação).
  - **Subir do meu computador** (arquivo é salvo no Drive da loja, na pasta padrão de mídias do mês).
  - **Escolher do Drive** (abre o seletor de arquivos do Drive já existente no sistema).
  Ao escolher upload ou Drive, a geração por IA fica desativada para esse anúncio (sem gasto de crédito).
- **Publicar:** resumo final + botão único **"Publicar na Meta"** (ou Google/TikTok). Confirmação explícita antes de enviar.

### Edição inline em cada etapa
Os campos passam a ser editáveis dentro do passo (sem abrir editor lateral). Salvar é local (rascunho) e só vai para a IA/Meta na publicação. O botão "Ajustar com a IA" continua disponível como atalho opcional.

### Estado, segurança e custo
- Avançar entre passos não consome IA.
- Cada passo só libera o próximo quando passa nas validações mínimas (gates de completude, compatibilidade e UTM já existentes).
- Voltar a qualquer passo sem perder o que foi editado.
- Após publicar, o dialog não reabre em modo edição — ajustes pós-publicação seguem por painel nativo da Meta ou por chat com a IA.

## Resultado final
Lojista percorre um único dialog guiado, do diagnóstico ao "publicar agora", revisando e editando cada nível. Vê o prompt antes de gerar criativo, pode subir um criativo próprio do PC (que vai parar no Drive da loja) ou escolher do Drive, e finaliza com um botão claro de publicação.

## Documentação que será atualizada
- `docs/especificacoes/marketing/gestor-trafego.md` — nova seção "Passo a passo guiado de aprovação".
- `docs/especificacoes/transversais/mapa-ui.md` — atualização da tela do Gestor de Tráfego IA.
- Memória `.lovable/memory/constraints/ads-proposal-modal-unified.md` — substituir a regra de "modal único com menu lateral" pela regra do passo a passo guiado, incluindo a obrigatoriedade do upload do PC ir para o Drive.

## Plano de execução em fases (para evitar retrabalho e gasto desnecessário)

**Fase 1 — Esqueleto do passo a passo (somente UI/navegação).**
Converter o menu lateral em estepador com Voltar/Avançar, sem mexer ainda em edição inline nem em criativo. Reaproveita as seções de leitura que já existem. Entrega: você consegue navegar pelos 5 passos no fluxo atual de proposta. Sem risco de quebrar lógica.

**Fase 2 — Edição inline da Campanha e dos Conjuntos.**
Transformar os campos das seções Campanha e Conjuntos em inputs editáveis salvando rascunho local. Validações em tempo real. Sem consumo de IA.

**Fase 3 — Etapa de Anúncios com prompt visível + 3 caminhos de criativo.**
Mostrar e editar o prompt visual; ligar os três botões: Gerar com IA / Subir do PC (com upload no Drive) / Escolher do Drive (usando o seletor de arquivos do Drive já existente). Desabilitar geração quando o lojista escolhe criativo próprio.

**Fase 4 — Etapa final de publicação direta.**
Resumo consolidado + botão "Publicar na Meta/Google/TikTok" dentro do dialog, com confirmação. Bloquear edição após publicar.

**Fase 5 — Documentação + memória de anti-regressão.**
Atualizar os 3 documentos acima, fechando o ciclo.

## Próximo passo
Começar pela **Fase 1** (esqueleto navegável). Quando estiver pronto e você validar a navegação, sigo para a Fase 2. Confirma esse fatiamento ou prefere que eu vá direto da Fase 1 até a Fase 3 antes de te chamar?
