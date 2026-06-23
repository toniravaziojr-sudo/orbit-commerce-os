
📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras do Sistema: lido
- Doc do Mercado Livre + doc oficial ML: lidos
- Fluxo: cadastro de produto + criação/edição em lote de anúncios no ML
- Fonte de verdade: cadastro do produto (passa a ser único ponto de entrada)
- Módulos impactados: Produtos, Marketplaces/ML, Importação, mapa de UI
- UI impactada: sim
- Situação: aprovado — pronto para execução

---

## 1. Cadastro de produto vira fonte única (sempre obrigatório)

**Campos que passam a ser obrigatórios no cadastro:**
- Marca
- Código de barras (GTIN/EAN)
- Modelo — com botão **"Marcar como Genérico"** para o lojista passar de forma consciente quando não houver modelo específico
- Peso líquido (g)
- Dimensões (altura, largura, comprimento)
- Condição (Novo / Usado / Recondicionado)
- Categoria universal
- Conteúdo líquido + unidade (ml/g) — obrigatório também para cosméticos, alimentos e perfumaria
- Garantia — opcional
- Atributos cosméticos tri-estado (dermatologicamente testado, hipoalergênico, vegano, cruelty-free, fragrância) — obrigatórios para produtos da categoria cosmético

**Bloqueios:**
- Não dá para salvar produto novo sem esses campos.
- Produto antigo incompleto: ao abrir para edição, banner amarelo lista o que falta e o salvar fica travado até preencher.
- Tela de Produtos ganha filtro **"Incompletos para Mercado Livre"** + contador no topo.
- Importação por planilha rejeita linhas incompletas e gera relatório de pendências.

**Migração dos produtos antigos:**
Antes de ligar o bloqueio para todos, vou gerar um relatório consolidado do passivo (quantos produtos estão incompletos, quais campos faltam por produto). Você revisa e me dá o ok para ativar o bloqueio geral. Enquanto isso, o filtro "Incompletos para Mercado Livre" já fica disponível para você atacar a lista.

---

## 2. Etapa de Características do anúncio — corrigir os 3 problemas

**a) Erro técnico em vermelho ("…trim is not a function"):**
Tolerância forte a formatos inesperados da IA. Falha em um campo nunca derruba o produto inteiro. Mensagem amigável + botão **Tentar de novo** apenas no produto afetado.

**b) IA delirando (marca de terceiros, repetição):**
Com o cadastro completo, marca/modelo/peso/GTIN vêm direto do produto — IA fica fora desses campos. Para os descritivos restantes: prompt mais rígido (só preencher com evidência real, proibido repetir a mesma palavra em campos diferentes, proibido sugerir marca de terceiros). Lista negra de marcas famosas como trava de segurança.

**c) Reprocessamento ao reabrir o dialog:**
Auditoria garante que reabrir carrega o que está salvo. Só recalcula em ação manual (botão Recalcular) ou se a categoria mudar.

---

## 3. Controle de processamento

- Máximo 3 produtos sendo processados em paralelo. Demais ficam em fila visível.
- Resultado salvo no anúncio assim que pronto → reabrir = zero novo gasto.
- Se a IA falhar, 1 retentativa automática; persistindo, entrega o que conseguiu sem travar o fluxo.

---

## 4. Etapa Preços

Auditoria dos 3 caminhos de entrada (Novo Anúncio, Editar em Lote, Continuar Rascunho) e validação no domínio publicado para garantir que a etapa Preços aparece em todos. Se o domínio estiver com versão antiga, faço o fechamento de publicação.

---

## 5. Checagem final antes de publicar no ML

Antes de mandar o anúncio para o Mercado Livre, validação silenciosa: se algum campo obrigatório voltou a ficar vazio (lojista apagou no cadastro depois), bloqueia com aviso e atalho direto para o cadastro.

---

## 6. Documentação e anti-regressão

- Especificação do Mercado Livre: nova seção "Cadastro como fonte única" + tabela de campos obrigatórios + política anti-alucinação + regra de concorrência.
- Especificação de Produtos: nova seção "Campos obrigatórios para Mercado Livre" + bloqueio em edição.
- Mapa de UI: atualizar tela de Produtos (banner, filtro, asteriscos), dialog de anúncios (fila, retry).
- Memória anti-regressão: (1) IA nunca inventa marca de terceiros; (2) cadastro é fonte única; (3) falha em 1 atributo nunca derruba o produto inteiro.

---

## 7. Ordem de execução

1. Cadastro do produto: novos campos obrigatórios + botão "Marcar como Genérico" + banner em produtos antigos + filtro "Incompletos para Mercado Livre".
2. Relatório do passivo (produtos antigos incompletos) — entregue antes de ativar o bloqueio universal.
3. Correção do dialog de Características (tolerância a erro, prompt rígido, lista negra de marcas, retry por produto, fila de 3).
4. Checagem final no publish.
5. Auditoria da etapa Preços nos 3 caminhos + domínio publicado.
6. Documentação + memória anti-regressão.
7. Validação técnica completa e relatório final para você aprovar o ligar do bloqueio universal.

---

## 8. Validação técnica antes de fechar

- Cadastrar produto novo sem os campos → bloqueio claro.
- Abrir produto antigo incompleto → banner + bloqueio até preencher.
- Importar planilha com produto incompleto → relatório de pendências.
- Rodar o assistente do ML com vários produtos completos → resolve direto pelo cadastro, IA fica fora dos campos críticos.
- Forçar falha da IA → produto continua salvo com o que dá, sem derrubar os demais.
- Reabrir o dialog → não recalcula, não gasta IA.
- Etapa Preços nos 3 caminhos + domínio publicado.

Pode implementar.
