
# Blindagem dos campos obrigatórios — NF, Declaração de Conteúdo e Remessa

## Diagnóstico em uma frase
Cada documento (NF, DC, Remessa) hoje tem sua **própria lista de checagens**, aplicadas no **momento errado** — no fim do fluxo, quando o operador clica em emitir/despachar. Para PV vindo de duplicação ou criação manual, o pedido nasce incompleto e o problema só aparece depois.

A correção é **unificar essas listas em um portão único** e **rodá-lo no início** — no momento em que o Pedido de Venda é salvo (qualquer origem).

---

## Como funciona hoje (resumo da auditoria)

- **Item do PV:** já bloqueia produto sem peso/NCM na hora de adicionar (regra antiga). ✅
- **Remessa:** o diálogo de edição/criação manual de rascunho **já valida** transportadora, serviço, peso, dimensões, nome, CPF/CNPJ, telefone com DDD, CEP e endereço completo. ✅ Mas essa validação **não roda quando o PV é salvo** — só quando o operador abre a remessa.
- **Declaração de Conteúdo:** valida peso por item e bloqueia se faltar; outros campos (telefone, endereço completo, doc) ficam por conta do PV.
- **NF:** valida na hora de "Criar Nota Fiscal" e marca como "Pendência" se faltar algo — usuário descobre depois de já ter o PV.
- **Emitente (loja):** só descobre que está incompleto quando a Receita ou os Correios rejeitam.

**Resultado prático:** PV duplicado/manual nasce com dados faltando, segue silenciosamente até o despacho, e quebra na ponta.

---

## O que eu vou fazer (decisões técnicas — sem mudar negócio nem UI)

### 1. Motor único de pré-flight (backend)
Criar um helper compartilhado que recebe um Pedido de Venda e devolve a lista de pendências em 3 escopos: **NF**, **DC**, **Remessa**. As regras são as mesmas que já estão espalhadas hoje — apenas consolidadas em um único lugar e versionadas em doc.

### 2. Aplicar o motor nos pontos de gravação (sem mudar UI ainda)
- **Salvar PV manual ou duplicado:** o backend roda o motor e, se faltar algo **estrutural** (CPF/CNPJ inválido, endereço incompleto, telefone sem DDD, item sem peso, item sem produto cadastrado), bloqueia com mensagem clara em português listando o que falta. Mantém o comportamento atual de "salvar como pendência" para campos que não são bloqueantes (ex.: GTIN ausente quando há "SEM GTIN" aceito).
- **Duplicação:** antes de aceitar a duplicação, o motor roda no PV de origem; se o original já tinha lacunas, devolve a lista para o operador corrigir no diálogo.
- **Automático (pedido pago):** continua como hoje. Se o pedido chegou com dados incompletos do cliente, o PV nasce em "Pendente" com a lista do motor registrada — em vez de quebrar na hora do despacho.
- **Antes de chamar os Correios:** o motor roda no escopo "Remessa". Se faltar algo, a remessa vai para a aba **Pendentes** com o motivo em português ("Telefone do destinatário sem DDD", "Peso do produto X não cadastrado") — sem mais erros crus vindos da API.

### 3. Reforço da cascata de peso e do vínculo de produto na duplicação
Garantir que o item duplicado sempre carregue o vínculo com o cadastro do produto (já é a regra). Se o original tinha o vínculo e o duplicado perdeu, recuperar pelo código do produto antes de salvar. Se o produto perdeu o peso desde então, o motor acusa.

### 4. Validação do emitente como dependência
O motor passa a checar também os dados da loja (razão social, CNPJ, IE, certificado, telefone, endereço completo). Se faltar algo, a emissão de NF, DC ou Remessa é bloqueada **com mensagem apontando para o que falta em Configurações Fiscais** — antes de qualquer chamada externa.

### 5. Anti-regressão
- Documentar o motor como **fonte única** dessas validações no doc de regras (Layer 2).
- Memória nova marcando que **nenhum módulo pode criar checagem isolada** dessas mesmas regras — todos consomem o motor.

---

## O que depende da sua aprovação (mudanças de UI/UX)

Não vou implementar nada nesta área sem você confirmar:

1. **Painel "Pendências fiscais e logísticas" no diálogo de Pedido de Venda** — mostraria a lista do motor em tempo real (vermelho = bloqueia salvar, amarelo = aviso). Hoje a tela só mostra erro depois do clique em salvar.
2. **Indicador de "Loja pronta para emitir / Configuração pendente"** na tela de Configurações Fiscais e no topo do módulo Fiscal quando há pendência do emitente.
3. **Mensagem na aba "Pendentes" de Remessas** com texto explicando exatamente o campo faltante, no lugar do erro técnico atual dos Correios.

Se você aprovar todos, faço junto. Se aprovar parcial, faço só os aprovados. Se reprovar, fica só o backend do item 2 (bloqueio na gravação) com mensagem no toast.

---

## Validação técnica (no fim da implementação)

1. **PV duplicado limpo:** duplica um PV completo → motor não acusa nada → emite DC ✅ → reenvia remessa ✅ chega aos Correios sem erro de campo.
2. **PV duplicado com lacuna:** zera telefone do destinatário → ao salvar duplicação, motor lista a pendência em português; nem chega à remessa.
3. **PV manual sem peso de item:** monta PV com produto sem peso → motor bloqueia DC e Remessa; permite salvar como pendência para o operador corrigir o cadastro.
4. **Emitente incompleto:** apaga telefone em Configurações Fiscais → tenta despachar → motor bloqueia ("Telefone da loja não cadastrado") sem chamar Correios.
5. **PV automático com cliente incompleto:** pedido chega com cliente sem telefone → PV nasce em "Pendente" com motivo registrado.
6. **Caso original do bug (PV 372):** duplica, emite DC, reenvia remessa — fluxo limpo do início ao fim.

---

## Atualização de docs (obrigatória no fechamento)

- **Novo doc** com a lista canônica única de campos obrigatórios (NF, DC, Remessa, Emitente).
- Atualizar os 3 docs existentes (NF/PV fiscal, Declaração de Conteúdo, Rascunhos Logísticos) apontando para o motor único.
- Atualizar o Doc de Regras do Sistema com a regra "Portão único de validação fiscal/logística".
- Registrar memória anti-regressão.
- Atualizar o mapa de UI **se** você aprovar as mudanças de tela.
