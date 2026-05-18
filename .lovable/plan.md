## Contexto

No Pedido de Venda (modelo Bling) hoje:

- A aba **Transp.** mostra modalidade do frete, transportadora, peso e volumes — mas **não mostra o serviço que o cliente escolheu** no checkout (PAC, SEDEX, Mini Envios, Loggi Express, etc.). Essa informação já existe no pedido original.
- A aba **Dest.** (destinatário) permite editar livremente nome, CPF/CNPJ, endereço, telefone e e-mail — mas as alterações ficam só no pedido. O cadastro do cliente continua desatualizado e ninguém é avisado.

## O que vou fazer

### 1. Serviço da transportadora visível e travado ao pedido

Na aba **Transp.**, abaixo de "Nome/Razão Social da Transportadora", incluir um novo campo **Serviço contratado**:

- Preenchido automaticamente com o serviço escolhido pelo cliente no checkout (PAC, SEDEX, Mini Envios, Loggi Express, etc.), dentro da transportadora que o cliente selecionou.
- Funciona para qualquer transportadora (Correios, Frenet, Loggi, futuras), porque a informação vem direto do pedido original.
- Exibido também no card "Dados do Transporte" como uma linha clara: "Transportadora: Correios — SEDEX".
- Editável apenas em casos manuais (pedido criado sem cotação) ou se o usuário precisar trocar antes do despacho. Em pedido que veio do checkout, valor já chega preenchido.

Pedidos antigos sem essa informação salva mostram o campo vazio com aviso "Serviço não informado no checkout".

### 2. Edição do destinatário com aviso de sincronização com o cadastro

Quando o usuário alterar qualquer campo da aba **Dest.** (nome, CPF/CNPJ, endereço completo, telefone, e-mail) e clicar em **Salvar Pedido**, em vez de salvar direto, aparece um diálogo de confirmação:

```text
┌──────────────────────────────────────────────────┐
│ Você alterou dados que também estão no cadastro  │
│ do cliente.                                      │
│                                                  │
│ Campos alterados:                                │
│  • Endereço                                      │
│  • Telefone                                      │
│                                                  │
│ Como deseja salvar?                              │
│                                                  │
│  [ Salvar pedido e atualizar cadastro ] ← padrão │
│  [ Salvar somente neste pedido ]                 │
│  [ Cancelar ]                                    │
└──────────────────────────────────────────────────┘
```

Regras:

- **Salvar pedido e atualizar cadastro** (botão azul, opção padrão): salva o pedido e atualiza o cadastro do cliente com os mesmos dados. Use quando o cadastro estava errado de verdade.
- **Salvar somente neste pedido** (botão secundário): salva só este pedido. O cadastro permanece como está. Use quando é uma correção pontual (ex.: entregar em outro endereço só desta vez).
- **Cancelar**: volta para a edição.
- O diálogo só aparece se houver mudança em pelo menos um campo da aba Dest. Sem alteração → salva direto, sem perguntar nada.
- Se o pedido não tem cliente vinculado (avulso/manual), o diálogo não aparece — salva direto.

### 3. Documentação

Atualizar a documentação do módulo fiscal (Pedido de Venda / modelo Bling) descrevendo:
- Novo campo "Serviço contratado" na aba Transp. e de onde vem o dado.
- Fluxo de edição da aba Dest. com 3 opções de salvamento e o critério para o diálogo aparecer.

## Tela final (exemplo)

```text
Aba Transp. — Pedido de Venda nº 234
────────────────────────────────────
Modalidade do frete: Contratação por conta do Remetente (CIF)
Transportadora:      Correios
Serviço contratado:  SEDEX            ← NOVO
CNPJ:                ...
Peso bruto: 0,18 kg   Peso líquido: 0,18 kg
Volumes: 1            Espécie: Caixa
```

## Status

Pronto para implementar assim que você aprovar.
