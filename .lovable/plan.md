📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras do Sistema lido: ✅
- Doc formal do tema lido: ✅ Pré-Flight Fiscal/Logístico, Checkout Data Persistence, Manual Order = Checkout Pipeline, PV Pedido Status Mirror
- Fluxo afetado identificado: ✅ Checkout do storefront → criação do pedido → criação do PV → emissão de DC/Remessa
- Fonte de verdade identificada: ✅ Pedido é a fonte; PV é espelho; nada pode "inventar" dado faltante
- Módulos impactados listados: ✅ Storefront (checkout), Admin (novo pedido), Link de Checkout, Marketplaces (entrada), Fiscal (PV), Logística (Remessa)
- Impacto cruzado mapeado: ✅ pré-flight, fila fiscal, fila de remessa, notificações
- UI impactada? Apenas exibição de pendência no PV (já existe via pré-flight). Mudança de UI no checkout só após auditoria + sua aprovação.
- Situação: Aguardando confirmação do plano final

📌 STATUS DA ENTREGA: Proposta

---

## Mudança de direção (confirmada com o usuário)

A entrega anterior criou 3 camadas que copiavam telefone/e-mail do pedido para o PV: (1) na criação automática, (2) na emissão da DC, (3) gatilho de banco. O usuário rejeitou a abordagem de "auto-cura" porque ela esconde problema real de checkout/pós-pagamento. Novo princípio:

**O sistema nunca preenche dado faltante do cliente automaticamente. Falta de dado obrigatório vira pendência visível ao usuário.**

---

## Parte 1 — Remover as camadas de auto-cura do PV

**O que fica:** a propagação na **origem**, ou seja, no momento da criação automática do PV a partir do pedido real. Esse é o ponto legítimo de transportar os dados do pedido para o PV — não é cura, é mapeamento canônico.

**O que sai:**

1. **Auto-cura na emissão da Declaração de Conteúdo.** Hoje, antes de chamar o emissor, o sistema buscava o pedido e copiava telefone/e-mail se estavam faltando no PV. Isso é removido. Se faltar, o pré-flight bloqueia com mensagem clara em português e a operação cai como pendência visível.

2. **Gatilho de banco que preenchia automaticamente.** Hoje, qualquer gravação no PV sem telefone/e-mail era "curada" pelo banco buscando no pedido. O gatilho e a função são removidos. Banco volta a ser passivo nesse ponto.

3. **Reforço do pré-flight.** Já existe e bloqueia. Só validar que a mensagem de pendência aparece de forma clara e útil para o operador (item rastreado na Parte 3).

**Backfill anterior do tenant Respeite o Homem fica como está** — foi correção pontual de 34 pedidos antigos já contaminados antes da nova regra; não vou reverter porque já está correto e refletia dados reais dos pedidos.

---

## Parte 2 — Auditoria completa do fluxo de pedido

Investigação ponta a ponta de todos os pontos por onde um pedido pode nascer, conferindo que **cada campo obrigatório** é exigido e validado **na origem**, sem brecha. Cinco frentes:

### Frente A — Checkout do storefront (cliente final)
Conferir que o formulário e o backend de criação de pedido exigem e validam, **antes** de gravar:
- Nome completo
- E-mail válido
- Telefone com DDD (10–13 dígitos)
- CPF válido (11 dígitos, dígitos verificadores)
- CEP (8 dígitos), logradouro, número, bairro, município, UF

Validar tanto na camada de UI quanto na camada de gravação. Se algum campo passa como opcional em algum ponto, isso é bug e entra no relatório.

### Frente B — Criação manual de pedido (admin)
Conferir que o formulário de "Novo Pedido" no admin exige os mesmos campos. A regra atual ("manual mirror checkout pipeline") diz que sim — confirmar na prática.

### Frente C — Link de Checkout
Conferir que pedidos vindos de link de checkout passam pelas mesmas validações do checkout normal.

### Frente D — Pedidos vindos de marketplace
Mercado Livre, Shopee e similares. Conferir que o adaptador de entrada preenche os campos obrigatórios e, quando a origem não traz, **marca o pedido com pendência visível** ao invés de gravar com campo vazio que vai estourar no fiscal/logístico depois.

### Frente E — Propagação Pedido → PV
Conferir, na criação automática do PV, que **todos** os campos obrigatórios do destinatário (nome, CPF, telefone, e-mail, endereço completo, peso dos itens) são copiados do pedido para o PV. Se algum não está sendo copiado hoje, isso é o buraco que gerou o problema original e precisa ser corrigido na origem.

---

## Parte 3 — Relatório de auditoria

Entrego, ao final da Parte 2:

- **Mapa de cada ponto de entrada** (checkout, admin, link, marketplace) com status de cada campo obrigatório: "exige e valida ✅" ou "falha ❌, motivo X".
- **Lista de buracos encontrados**, com proposta de correção para cada um.
- **Confirmação** das validações de backend (cliente nunca é a única barreira).
- **Mapa da propagação pedido → PV**, campo a campo, com status.

Você decide quais corrigir e em que ordem. **Correções que envolvam mudança de UI/UX no checkout do storefront ou em qualquer formulário do admin esperam sua aprovação explícita antes de mexer**, conforme a regra do projeto.

---

## Parte 4 — Documentação e anti-regressão

- Atualizar a regra "PV Herda Contato do Pedido" para refletir a nova política: propagação **só na origem**, sem auto-cura posterior, sem gatilho de banco.
- Atualizar o doc do Pré-Flight Fiscal/Logístico deixando explícito que pendência de dado obrigatório do destinatário é **bloqueio visível**, nunca correção silenciosa.
- Atualizar a regra de Checkout Data Persistence com a lista canônica de campos obrigatórios (se a auditoria revelar lacuna no doc).
- Registrar nova memória anti-regressão: "Sistema nunca preenche dado faltante do cliente automaticamente. Falta de dado obrigatório = pendência visível."

---

## Decisões técnicas que eu tomo (sem consulta)

- Remoção das camadas de auto-cura em uma única entrega (não faz sentido remover só uma).
- A auditoria roda em modo **leitura** primeiro — só proponho mudança depois do relatório, item por item.
- O relatório vem em linguagem de negócio, com bloco técnico opcional separado.
- Onde a validação de backend estiver fraca mas a de UI estiver forte, eu reforço o backend imediatamente (é correção técnica defensiva, não muda UX).

## O que NÃO faço sem sua aprovação

- Não adiciono nem removo campo no checkout do storefront.
- Não muda layout, texto ou ordem de campos em formulário de pedido (admin, link, checkout).
- Não mexo na lógica de adaptador de marketplace antes de te mostrar o que encontrei.
- Não rodo backfill em outros tenants.

---

## Validação final (antes de declarar entregue)

1. **Auto-cura removida:** simular um PV sem telefone artificialmente → tem que aparecer como pendência, **não** ser auto-curado na emissão da DC.
2. **Pedido completo passa:** criar pedido teste com todos os dados → PV nasce completo → DC emite normal.
3. **Pedido incompleto bloqueia:** tentar criar pedido sem campo obrigatório em cada um dos 4 pontos de entrada → tem que ser bloqueado.
4. **Relatório de auditoria entregue** com mapa de cada frente, lista de buracos e propostas.
5. **Docs atualizados** conforme Parte 4.

---

📝 DOCUMENTAÇÃO NECESSÁRIA
- Doc(s) impactado(s): Pré-Flight Fiscal/Logístico (Layer 2), Checkout Data Persistence (regra), constraint "PV Herda Contato do Pedido" (atualização), nova constraint "Sistema não preenche dado faltante automaticamente"
- Motivo: mudança de política (auto-cura proibida) + resultado da auditoria pode revelar lacunas a documentar
- Proposta de atualização: descrita na Parte 4
- Aguardando confirmação para implementar
