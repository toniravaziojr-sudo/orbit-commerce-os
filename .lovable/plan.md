## Como funciona hoje

- Cliente é identificado pelo e-mail normalizado dentro do tenant — regra 100% validada.
- Quando um pedido é aprovado, o trigger `after_order_approved_sync` apenas garante a tag "Cliente", recalcula métricas e sincroniza listas. **Não** copia nenhum dado do pedido para o cadastro do cliente.
- A "Profile Enrichment Policy" mencionada nos docs nunca foi implementada de fato.
- Resultado: pedido #409 enviou CPF, data de nascimento e endereço completo, mas o cadastro do cliente continuou com esses campos em branco.
- Endereços do cliente: hoje não existe tabela separada de endereços vinculada a `customers` — o endereço vive em colunas próprias do cliente e nas colunas de envio do pedido (`shipping_*`).

## O problema

O cadastro do cliente fica desatualizado em relação ao último pedido aprovado. Não há mecanismo automático de propagação dos dados de um pedido novo para o cadastro mestre — nem dados pessoais (CPF, telefone, nome, nascimento), nem endereço completo.

## O que eu faria

### Regra de negócio (nova)

Toda vez que um pedido transita para pagamento aprovado, o cadastro do cliente vinculado é atualizado com os dados desse pedido — porque o pedido mais novo é a fonte de verdade mais recente do que o cliente declarou. E-mail nunca é tocado (é a chave de identidade).

**Campos pessoais enriquecidos:**
- Nome completo
- CPF
- CNPJ / Razão Social / IE (PJ)
- Telefone
- Data de nascimento
- Gênero

**Endereço enriquecido (bloco completo, tratado como conjunto coerente):**
- CEP
- Rua/Logradouro
- Número
- Complemento
- Bairro
- Cidade
- Estado (UF)

Endereço é tratado como **bloco atômico**: se o pedido tem endereço (CEP preenchido), substitui o endereço inteiro do cliente — não mistura CEP novo com rua antiga. Isso evita inconsistência (cliente mudou de cidade e o cadastro fica com CEP novo + bairro velho).

**Comportamento por campo pessoal:**
- Pedido tem valor preenchido e diferente → atualiza.
- Pedido tem valor vazio → não toca no cadastro (preserva dado existente).
- Igual → no-op.

**Comportamento do bloco endereço:**
- Pedido tem CEP válido → substitui o endereço inteiro pelo do pedido (CEP, rua, número, complemento, bairro, cidade, estado). Complemento vazio no pedido sobrescreve para vazio (faz parte do bloco).
- Pedido sem CEP → não toca no endereço.

**Quando dispara:**
- Apenas na transição para `payment_status = 'approved'` (mesmo gatilho que já existe). Nunca em updates subsequentes — sem sobrecarga.
- Apenas quando `customer_id` está vinculado ao pedido.

### Implementação técnica

1. **Migração: novas colunas em `public.customers`** para armazenar o endereço principal (não existem hoje):
   - `address_postal_code`, `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`.
   - Todas nullable, sem default. Apenas para refletir o último endereço aprovado do cliente. (Não substitui uma futura tabela de múltiplos endereços — é o "endereço principal" do cadastro.)

2. **Nova função SQL** `public.enrich_customer_from_order(p_tenant_id, p_customer_id, p_order_id)`:
   - SECURITY DEFINER, search_path=public.
   - Lê o pedido e faz UPDATE em `customers`:
     - Campos pessoais: `field = COALESCE(NULLIF(TRIM(order.field), ''), customers.field)`.
     - Bloco endereço: se `order.shipping_postal_code` não-vazio → sobrescreve os 7 campos de endereço inteiros. Se vazio → preserva tudo.
   - Atualiza `updated_at`.

3. **Extensão do trigger existente** `after_order_approved_sync`:
   - Mantém toda lógica atual.
   - Adiciona chamada a `enrich_customer_from_order(...)` no mesmo `IF` de transição para approved.
   - Wrap em `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING` — nunca derruba a aprovação.

4. **Padrão arquitetural**: Padrão 1 (Pure SQL Trigger). Apenas UPDATE em uma tabela, sem chamada externa. Latência zero, atômico.

5. **Backfill do pedido #409**: rodar a função uma vez para o pedido #409 do tenant respeiteohomem como validação técnica.

### Validação técnica obrigatória

- Confirmar antes/depois do backfill: cadastro do cliente do #409 com CPF, data de nascimento e endereço completo (CEP, rua, número, complemento, bairro, cidade, estado).
- Confirmar que o telefone/nome existentes não foram apagados se o pedido não trouxe valor diferente.
- Confirmar que pedidos antigos já aprovados não disparam (trigger só age na transição).
- Verificar logs de erro (sem warnings inesperados).

### Documentação a atualizar

- `docs/especificacoes/ecommerce/clientes.md` — nova seção "Enriquecimento automático pelo pedido aprovado" + novas colunas de endereço no schema documentado.
- `docs/especificacoes/storefront/checkout.md` — corrigir o texto atual sobre Profile Enrichment Policy (deixou de ser "só preenche quando nulo" — agora sobrescreve com valor não-vazio do pedido mais recente; endereço é bloco atômico).
- `docs/especificacoes/sistema/automacao-patterns.md` — entrada no histórico citando a extensão do trigger.
- `docs/especificacoes/transversais/mapa-ui.md` — nenhuma rota nova, mas a tela de detalhe do cliente passa a refletir o endereço principal: registrar isso se aplicável.
- Atualizar memória `mem://features/customers/profile-enrichment-policy-standard` (overwrite com fonte = pedido mais novo aprovado, e-mail intocado, endereço como bloco atômico).

### Fora do escopo (declarado)

- Histórico de endereços / múltiplos endereços por cliente (entidade futura).
- Pedidos não aprovados.
- Importação em massa (importer mantém merge próprio).
- Pedidos de marketplace (Mercado Livre/Shopee) — esta regra age sobre pedidos com `customer_id` vinculado e transição para `payment_status='approved'`, o que já cobre o checkout próprio. Marketplaces seguem fluxo próprio.

## Resultado final

Todo pedido novo aprovado mantém o cadastro do cliente sempre alinhado com a última informação declarada: dados pessoais (CPF, telefone, nome, nascimento, dados PJ, gênero) e endereço completo (CEP, rua, número, complemento, bairro, cidade, estado). Sem sobrecarga: uma única função SQL adicional dentro do trigger que já roda uma vez por aprovação. Sem risco de apagar dado existente (campos pessoais vazios são ignorados). Endereço tratado como bloco atômico para nunca ficar inconsistente. E-mail permanece como chave imutável.

É isso? Confirma que eu ajusto?
