## Investigação confirmada (sem mudanças)

### 1. Atualização automática para o Mercado Livre
**Não existe envio automático para o ML.** Existe apenas uma rotina diária às 8h que **lê** do ML para o nosso banco (status, preço, estoque). Nenhuma rotina envia updates ao ML — tudo é manual, disparado pelo usuário.

O ML, de fato, penaliza anúncios editados com muita frequência (perda de relevância na busca, reset de score de qualidade, queda em campanhas). Por isso a decisão de manter manual está correta e vai entrar como **regra escrita e anti-regressão** na documentação.

### 2. Campo "Linha" no cadastro
Hoje não existe. Precisa ser criado e usado na publicação ao ML.

### 3. Atributos cosméticos secundários (parabenos, orgânico, hipoalergênico, tipo de pele, dermatologicamente testado, etc.)
Hoje a IA só é consultada para atributos **obrigatórios**. Os secundários ficam em branco quando o cadastro não tem valor. Por isso só cruelty-free e vegano apareceram (esses estão no cadastro). Precisa ser corrigido.

### 4. Etapa de preços no wizard de envio
Não existe. O anúncio é publicado com o preço do cadastro, sem chance de ajuste.

---

## Plano aprovado para execução

### Parte A — Política manual-only de envio ao ML (documentação)
- Registrar formalmente na especificação do Mercado Livre e em memória anti-regressão: **proibido criar rotina automática que edite anúncios no ML**. Todo envio é manual.
- O cron diário existente (que só lê) continua.

### Parte B — Campo "Linha" no cadastro de produto
- Novo campo **Linha** (texto livre, opcional) no cadastro de produto, ao lado de Marca/Modelo.
- Usado na publicação ao ML com a seguinte ordem de prioridade para o atributo "Linha":
  1. Linha cadastrada no produto
  2. Sugestão da IA com base no contexto do produto (ex.: "Calvície Zero" para a linha da Respeite o Homem, "Pós-banho" para o Balm Pós-banho)
  3. "Não se aplica" se realmente não houver base
- A IA recebe o contexto da família/linha para gerar sugestões coerentes — sem inventar nomes aleatórios.

### Parte C — IA preenche TODOS os atributos cosméticos
- Para atributos cosméticos do tipo Sim/Não/Não se aplica (parabenos, crueldade, vegano, orgânico, hipoalergênico, dermatologicamente testado, com fragrância), quando o cadastro estiver vazio, a IA é sempre consultada — mesmo se o atributo for opcional.
- Regra obrigatória: **se a IA não tiver certeza, responde "Não"**, nunca em branco.
- Para atributos texto (tipo de pele, fragrância, etc.): IA propõe valor compatível com a lista oficial do ML; sem base, marca "Não se aplica".
- Resultado: seção "Características secundárias" sempre 100% preenchida, eliminando o aviso amarelo do ML.

### Parte D — Nova etapa de Preços no wizard de envio
Etapa nova, antes da revisão final:
- Lista dos produtos com o preço atual de cada um e campo editável por produto.
- Três botões de ajuste em massa:
  1. **Aplicar desconto %** (ex.: -10% em todos, recalculado individualmente)
  2. **Aplicar acréscimo %** (ex.: +15% para cobrir taxa do ML)
  3. **Restaurar preço do cadastro**
- O preço ajustado é o que vai para o ML. O preço do cadastro interno **não muda**.
- Bloqueio de envio se algum preço final ficar zero ou negativo.

### Parte E — Republicar o anúncio MLB7017325810 (validação)
Após as mudanças, atualizar o Balm Pós-banho:
- Modelo: Balm ✅
- Linha: "Calvície Zero" (ou conforme cadastro)
- Secundárias: todas preenchidas pela IA
- Confirmar qualidade 100/100

### Parte F — Documentação
- Especificação do ML: política manual-only, campo Linha, preenchimento total dos secundários, etapa de preços.
- Memória anti-regressão: "Sem push automático para o ML".
- Mapa de UI: campo Linha no cadastro + nova etapa Preços no wizard.

---

## Validação técnica obrigatória pós-entrega
- Consulta ao banco confirmando que o anúncio MLB7017325810 saiu atualizado com Linha e secundárias preenchidas.
- Teste com um produto sem cosméticos cadastrados, garantindo que a IA preencheu tudo com fallback "Não".
- Sem novos crons ou triggers de push para o ML.

Confirma que executo nessa ordem (A → B → C → D → E → F)?