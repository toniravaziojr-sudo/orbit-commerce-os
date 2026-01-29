// =============================================
// SIMPLE TRANSLATOR - Tradução via DOM sem quebrar React
// Solução temporária para gravação de vídeo
// =============================================

const translations: Record<string, string> = {
  // Menu lateral
  'Central de Comando': 'Command Center',
  'Loja Online': 'Online Store',
  'E-commerce': 'E-commerce',
  'Marketing': 'Marketing',
  'CRM': 'CRM',
  'Atendimento': 'Support',
  'ERP': 'ERP',
  'Parcerias': 'Partnerships',
  'Marketplaces': 'Marketplaces',
  'Sistema': 'System',
  'Blog': 'Blog',
  
  // Submenus
  'Configurações da Loja': 'Store Settings',
  'Editor Visual': 'Visual Builder',
  'Páginas': 'Pages',
  'Pedidos': 'Orders',
  'Produtos': 'Products',
  'Categorias': 'Categories',
  'Clientes': 'Customers',
  'Descontos': 'Discounts',
  'Importação': 'Import',
  'Checkouts Abandonados': 'Abandoned Checkouts',
  'Ofertas': 'Offers',
  'Avaliações': 'Reviews',
  'Mídias': 'Media',
  'Email Marketing': 'Email Marketing',
  'Campanhas': 'Campaigns',
  'Integrações de Marketing': 'Marketing Integrations',
  'Notificações': 'Notifications',
  'Suporte': 'Support',
  'Inbox': 'Inbox',
  'Fiscal': 'Fiscal',
  'Financeiro': 'Finance',
  'Compras': 'Purchases',
  'Logística': 'Logistics',
  'Afiliados': 'Affiliates',
  'Influencers': 'Influencers',
  'Fornecedores': 'Suppliers',
  'Mercado Livre': 'Mercado Livre',
  'Usuários': 'Users',
  'Integrações': 'Integrations',
  'Planos': 'Plans',
  'Domínios': 'Domains',
  'Emails do Sistema': 'System Emails',
  'Auxiliar de Comando': 'Command Assistant',
  'Posts': 'Posts',
  
  // Header
  'Minha Loja': 'My Store',
  'Plataforma': 'Platform',
  'Proprietário': 'Owner',
  'Administrador': 'Administrator',
  'Operador': 'Operator',
  'Dados da Conta': 'Account Data',
  'Planos e Faturamento': 'Plans & Billing',
  'Sair': 'Logout',
  
  // Ações comuns
  'Salvar': 'Save',
  'Cancelar': 'Cancel',
  'Editar': 'Edit',
  'Excluir': 'Delete',
  'Adicionar': 'Add',
  'Novo': 'New',
  'Nova': 'New',
  'Criar': 'Create',
  'Atualizar': 'Update',
  'Buscar': 'Search',
  'Filtrar': 'Filter',
  'Exportar': 'Export',
  'Importar': 'Import',
  'Voltar': 'Back',
  'Próximo': 'Next',
  'Anterior': 'Previous',
  'Confirmar': 'Confirm',
  'Fechar': 'Close',
  'Enviar': 'Send',
  'Copiar': 'Copy',
  'Carregar mais': 'Load more',
  'Ver mais': 'See more',
  'Ver menos': 'See less',
  'Ver todos': 'See all',
  'Ver detalhes': 'View details',
  'Ações': 'Actions',
  
  // Status
  'Ativo': 'Active',
  'Inativo': 'Inactive',
  'Pendente': 'Pending',
  'Aprovado': 'Approved',
  'Rejeitado': 'Rejected',
  'Concluído': 'Completed',
  'Em andamento': 'In Progress',
  'Aguardando': 'Waiting',
  'Processando': 'Processing',
  'Erro': 'Error',
  'Sucesso': 'Success',
  
  // Pedidos
  'Novo Pedido': 'New Order',
  'Pedido': 'Order',
  'Status do Pedido': 'Order Status',
  'Total': 'Total',
  'Subtotal': 'Subtotal',
  'Frete': 'Shipping',
  'Desconto': 'Discount',
  'Pagamento': 'Payment',
  'Entrega': 'Delivery',
  'Cliente': 'Customer',
  'Endereço': 'Address',
  'Itens': 'Items',
  'Quantidade': 'Quantity',
  'Preço': 'Price',
  'Valor': 'Value',
  
  // Produtos
  'Produto': 'Product',
  'Nome': 'Name',
  'Descrição': 'Description',
  'Preço de': 'Price from',
  'Preço por': 'Price for',
  'Estoque': 'Stock',
  'SKU': 'SKU',
  'Categoria': 'Category',
  'Imagem': 'Image',
  'Imagens': 'Images',
  'Variações': 'Variations',
  'Peso': 'Weight',
  'Dimensões': 'Dimensions',
  
  // Clientes
  'Email': 'Email',
  'Telefone': 'Phone',
  'CPF': 'CPF',
  'Data de Nascimento': 'Birth Date',
  'Último Pedido': 'Last Order',
  'Total Gasto': 'Total Spent',
  
  // Datas
  'Hoje': 'Today',
  'Ontem': 'Yesterday',
  'Esta semana': 'This week',
  'Este mês': 'This month',
  'Últimos 7 dias': 'Last 7 days',
  'Últimos 30 dias': 'Last 30 days',
  'Data': 'Date',
  'Hora': 'Time',
  'Criado em': 'Created at',
  'Atualizado em': 'Updated at',
  
  // Dashboard
  'Vendas': 'Sales',
  'Receita': 'Revenue',
  'Ticket Médio': 'Average Ticket',
  'Conversão': 'Conversion',
  'Visitantes': 'Visitors',
  'Taxa de Conversão': 'Conversion Rate',
  'Pedidos Hoje': 'Orders Today',
  'Receita Hoje': 'Revenue Today',
  
  // Integrações
  'Conectar': 'Connect',
  'Desconectar': 'Disconnect',
  'Conectado': 'Connected',
  'Desconectado': 'Disconnected',
  'Configurar': 'Configure',
  'Configurações': 'Settings',
  'Token': 'Token',
  'Chave': 'Key',
  'Webhook': 'Webhook',
  
  // Mensagens
  'Carregando...': 'Loading...',
  'Nenhum resultado encontrado': 'No results found',
  'Nenhum item': 'No items',
  'Sem dados': 'No data',
  'Operação realizada com sucesso': 'Operation completed successfully',
  'Erro ao realizar operação': 'Error performing operation',
  'Tem certeza?': 'Are you sure?',
  'Esta ação não pode ser desfeita': 'This action cannot be undone',
  
  // Extras
  'Todos': 'All',
  'Nenhum': 'None',
  'Sim': 'Yes',
  'Não': 'No',
  'ou': 'or',
  'e': 'and',
  'de': 'of',
  'para': 'to',
  'com': 'with',
  'sem': 'without',
};

let isTranslating = false;
let observer: MutationObserver | null = null;
let isProcessing = false; // Flag para evitar recursão

function translateTextNode(node: Text): void {
  const originalText = node.textContent?.trim();
  if (!originalText) return;
  
  // Traduz texto exato
  if (translations[originalText]) {
    node.textContent = node.textContent!.replace(originalText, translations[originalText]);
    return;
  }
  
  // Traduz partes do texto (apenas se houver match)
  let newText = node.textContent || '';
  let changed = false;
  for (const [pt, en] of Object.entries(translations)) {
    if (newText.includes(pt)) {
      newText = newText.split(pt).join(en); // Evita regex para performance
      changed = true;
    }
  }
  if (changed) {
    node.textContent = newText;
  }
}

function translateElement(element: Element): void {
  // Traduz placeholder e title
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const placeholder = element.placeholder;
    if (placeholder && translations[placeholder]) {
      element.placeholder = translations[placeholder];
    }
  }
  
  const title = element.getAttribute('title');
  if (title && translations[title]) {
    element.setAttribute('title', translations[title]);
  }
  
  // Traduz aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && translations[ariaLabel]) {
    element.setAttribute('aria-label', translations[ariaLabel]);
  }
}

function walkAndTranslate(root: Node): void {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElement(node as Element);
    }
  }
}

export function enableTranslation(): void {
  if (isTranslating) return;
  isTranslating = true;
  
  // Traduz conteúdo inicial
  walkAndTranslate(document.body);
  
  // Observa mudanças no DOM - SEM characterData para evitar loop
  observer = new MutationObserver((mutations) => {
    // Evita recursão
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              translateTextNode(node as Text);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              walkAndTranslate(node);
            }
          });
        }
        // REMOVIDO: characterData causa loop infinito
      }
    } finally {
      isProcessing = false;
    }
  });
  
  // Apenas childList, sem characterData
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('[SimpleTranslator] Translation enabled');
}

export function disableTranslation(): void {
  if (!isTranslating) return;
  isTranslating = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Recarrega a página para restaurar textos originais
  window.location.reload();
}

export function isTranslationEnabled(): boolean {
  return isTranslating;
}

export function toggleTranslation(): boolean {
  if (isTranslating) {
    disableTranslation();
    return false;
  } else {
    enableTranslation();
    return true;
  }
}
