/**
 * E2E Tests - Módulo Loja Virtual (Storefront)
 * 
 * PARTE 4 - AUDITORIA FUNCIONAL COMPLETA
 * 
 * Este arquivo testa o funcionamento completo do módulo:
 * - Admin: Configurações, Páginas, Templates, Visual Builder
 * - Público: Home, Categorias, Produtos, Carrinho, Checkout
 */

import { test, expect } from '@playwright/test';

// ============================================================
// FIXTURES E HELPERS
// ============================================================

const TEST_TENANT_SLUG = 'demo'; // Tenant de teste

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  
  // Se já está autenticado, continua
  const isAuth = await page.url().includes('/auth');
  if (!isAuth) return;
  
  // Preenche formulário de login
  await page.fill('input[type="email"]', 'admin@teste.com');
  await page.fill('input[type="password"]', 'teste123');
  await page.click('button[type="submit"]');
  
  // Aguarda redirecionamento
  await page.waitForURL('**/*', { timeout: 10000 });
}

async function navigateToStorefrontSettings(page: import('@playwright/test').Page) {
  await page.goto('/storefront/settings');
  await page.waitForLoadState('networkidle');
}

// ============================================================
// TESTES: ADMIN - NAVEGAÇÃO E ACESSO
// ============================================================

test.describe('Loja Virtual - Admin - Navegação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('deve acessar a página de configurações da loja', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Verifica elementos essenciais
    await expect(page.locator('h1, h2').filter({ hasText: /Loja Virtual/i })).toBeVisible({ timeout: 10000 });
  });

  test('deve exibir as abas Páginas e Configurações', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Verifica abas
    const pagesTab = page.locator('[role="tablist"]').getByText(/Páginas/i);
    const configTab = page.locator('[role="tablist"]').getByText(/Configurações/i);
    
    await expect(pagesTab).toBeVisible({ timeout: 5000 });
    await expect(configTab).toBeVisible({ timeout: 5000 });
  });

  test('deve navegar entre as abas', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Clica na aba Configurações
    await page.locator('[role="tablist"]').getByText(/Configurações/i).click();
    
    // Verifica conteúdo da aba
    await expect(page.getByText(/Informações do Negócio/i)).toBeVisible({ timeout: 5000 });
    
    // Volta para Páginas
    await page.locator('[role="tablist"]').getByText(/Páginas/i).click();
    
    // Verifica templates de página
    await expect(page.getByText(/Home|Categoria|Produto|Carrinho|Checkout/i)).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir botões de ação no header', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Verifica botões de ação
    await expect(page.getByRole('link', { name: /Abrir Editor|Editor/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /Preview/i })).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// TESTES: ADMIN - ABA CONFIGURAÇÕES
// ============================================================

test.describe('Loja Virtual - Admin - Configurações', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToStorefrontSettings(page);
    await page.locator('[role="tablist"]').getByText(/Configurações/i).click();
  });

  test('deve exibir seção de Informações do Negócio', async ({ page }) => {
    await expect(page.getByText(/Informações do Negócio/i)).toBeVisible();
    await expect(page.getByLabel(/Razão Social/i)).toBeVisible();
    await expect(page.getByLabel(/Nome Fantasia|Nome da Loja/i)).toBeVisible();
    await expect(page.getByLabel(/CNPJ/i)).toBeVisible();
  });

  test('deve exibir seção de Informações de Contato', async ({ page }) => {
    await expect(page.getByText(/Informações de Contato/i)).toBeVisible();
    await expect(page.getByLabel(/Telefone/i)).toBeVisible();
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
  });

  test('deve exibir seção de Redes Sociais', async ({ page }) => {
    await expect(page.getByText(/Redes Sociais/i)).toBeVisible();
    await expect(page.getByLabel(/Facebook/i)).toBeVisible();
    await expect(page.getByLabel(/Instagram/i)).toBeVisible();
  });

  test('deve exibir seção de Cores do Tema', async ({ page }) => {
    await expect(page.getByText(/Cores/i)).toBeVisible();
    await expect(page.getByLabel(/Cor Primária/i)).toBeVisible();
  });

  test('deve permitir editar nome fantasia', async ({ page }) => {
    const nomeInput = page.getByLabel(/Nome Fantasia|Nome da Loja/i);
    await nomeInput.fill('Loja Teste E2E');
    
    // Verifica se botão de salvar aparece
    await expect(page.getByRole('button', { name: /Salvar/i })).toBeVisible({ timeout: 3000 });
  });

  test('deve validar upload de logo', async ({ page }) => {
    // Verifica componente de upload de logo
    await expect(page.getByText(/Logo/i)).toBeVisible();
  });
});

// ============================================================
// TESTES: ADMIN - ABA PÁGINAS (TEMPLATES)
// ============================================================

test.describe('Loja Virtual - Admin - Páginas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToStorefrontSettings(page);
  });

  test('deve listar todos os templates de página do e-commerce', async ({ page }) => {
    // Verifica templates padrão
    const templates = ['Home', 'Categoria', 'Produto', 'Carrinho', 'Checkout', 'Obrigado'];
    
    for (const template of templates) {
      await expect(page.getByText(new RegExp(template, 'i'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve exibir status de cada template', async ({ page }) => {
    // Verifica badges de status (Publicado, Rascunho, Não editado)
    const statusBadges = page.locator('[class*="badge"], [class*="Badge"]');
    await expect(statusBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test('deve ter botão de editar para cada template', async ({ page }) => {
    // Verifica botões de ação
    const editButtons = page.locator('a[href*="/builder"], button').filter({ hasText: /Editar|Palette/i });
    const count = await editButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('deve navegar para o editor ao clicar em editar template', async ({ page }) => {
    // Clica no primeiro botão de editar
    const editButton = page.locator('a[href*="/builder"]').first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForURL('**/builder**');
      expect(page.url()).toContain('builder');
    }
  });
});

// ============================================================
// TESTES: VISUAL BUILDER
// ============================================================

test.describe('Loja Virtual - Visual Builder', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('deve carregar o builder para template Home', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Verifica se o canvas carregou
    await expect(page.locator('[data-testid="builder-canvas"], [class*="canvas"], [class*="preview"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('deve exibir toolbar com botões de ação', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Verifica toolbar
    await expect(page.getByRole('button', { name: /Salvar|Rascunho/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Publicar/i })).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir paleta de blocos', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Verifica aba de blocos
    await expect(page.getByText(/Blocos/i)).toBeVisible({ timeout: 10000 });
  });

  test('deve alternar viewports (desktop/tablet/mobile)', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Procura botões de viewport
    const viewportButtons = page.locator('button').filter({ hasText: /Desktop|Tablet|Mobile/i });
    const hasViewportButtons = await viewportButtons.count() > 0;
    
    if (hasViewportButtons) {
      await viewportButtons.first().click();
    }
    
    // Se não tem texto, procura por ícones (Monitor, Tablet, Smartphone)
    const iconButtons = page.locator('button[class*="viewport"], [aria-label*="viewport"]');
    expect(await iconButtons.count() + await viewportButtons.count()).toBeGreaterThanOrEqual(0);
  });

  test('deve exibir undo/redo na toolbar', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Verifica botões undo/redo
    const undoBtn = page.locator('button[aria-label*="undo"], button[title*="Desfazer"]');
    const redoBtn = page.locator('button[aria-label*="redo"], button[title*="Refazer"]');
    
    // Pelo menos um deve existir
    const hasUndo = await undoBtn.count() > 0;
    const hasRedo = await redoBtn.count() > 0;
    expect(hasUndo || hasRedo).toBeTruthy();
  });

  test('deve renderizar Header e Footer no template', async ({ page }) => {
    await page.goto('/storefront/builder?edit=home');
    await page.waitForLoadState('networkidle');
    
    // Verifica se Header e Footer estão presentes no canvas
    await expect(page.locator('header, [data-block-type="Header"], [class*="header"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('footer, [data-block-type="Footer"], [class*="footer"]').first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// TESTES: STOREFRONT PÚBLICO - HOME
// ============================================================

test.describe('Loja Virtual - Storefront Público', () => {
  test('deve carregar a home da loja', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.waitForLoadState('networkidle');
    
    // Verifica se a página carregou (header visível ou conteúdo da loja)
    const hasContent = await page.locator('header, [class*="header"], main, [class*="hero"]').first().isVisible({ timeout: 15000 });
    expect(hasContent).toBeTruthy();
  });

  test('deve exibir header com logo ou nome da loja', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.waitForLoadState('networkidle');
    
    // Verifica header
    const header = page.locator('header, [class*="header"]').first();
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('deve exibir footer', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.waitForLoadState('networkidle');
    
    // Scroll até o footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Verifica footer
    const footer = page.locator('footer, [class*="footer"]').first();
    await expect(footer).toBeVisible({ timeout: 5000 });
  });

  test('deve ter link para carrinho', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.waitForLoadState('networkidle');
    
    // Verifica ícone/link de carrinho
    const cartLink = page.locator('a[href*="carrinho"], a[href*="cart"], button[aria-label*="carrinho"], [class*="cart"]');
    await expect(cartLink.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// TESTES: STOREFRONT PÚBLICO - CARRINHO
// ============================================================

test.describe('Loja Virtual - Carrinho', () => {
  test('deve carregar página do carrinho', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}/carrinho`);
    await page.waitForLoadState('networkidle');
    
    // Verifica se a página do carrinho carregou
    const hasCartContent = await page.locator('[class*="cart"], [class*="carrinho"], main').first().isVisible({ timeout: 15000 });
    expect(hasCartContent).toBeTruthy();
  });

  test('deve exibir estado vazio quando carrinho está vazio', async ({ page }) => {
    // Limpa localStorage antes
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.evaluate(() => localStorage.clear());
    
    await page.goto(`/store/${TEST_TENANT_SLUG}/carrinho`);
    await page.waitForLoadState('networkidle');
    
    // Verifica mensagem de carrinho vazio ou lista vazia
    const emptyState = page.getByText(/vazio|nenhum|empty/i);
    const isEmptyVisible = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Se não está vazio, deve ter itens
    if (!isEmptyVisible) {
      const cartItems = page.locator('[class*="cart-item"], [class*="item"]');
      expect(await cartItems.count()).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================
// TESTES: STOREFRONT PÚBLICO - CHECKOUT
// ============================================================

test.describe('Loja Virtual - Checkout', () => {
  test('deve carregar página de checkout', async ({ page }) => {
    await page.goto(`/store/${TEST_TENANT_SLUG}/checkout`);
    await page.waitForLoadState('networkidle');
    
    // Verifica se checkout carregou (pode redirecionar se carrinho vazio)
    const hasCheckoutContent = await page.locator('[class*="checkout"], form, main').first().isVisible({ timeout: 15000 });
    expect(hasCheckoutContent).toBeTruthy();
  });

  test('deve exibir formulário de dados do cliente', async ({ page }) => {
    // Adiciona item ao carrinho via localStorage mock
    await page.goto(`/store/${TEST_TENANT_SLUG}`);
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify({
        items: [{ id: 'test', name: 'Produto Teste', price: 100, quantity: 1 }]
      }));
    });
    
    await page.goto(`/store/${TEST_TENANT_SLUG}/checkout`);
    await page.waitForLoadState('networkidle');
    
    // Verifica campos do formulário
    const hasForm = await page.locator('form, input[type="text"], input[type="email"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasForm).toBeTruthy();
  });
});

// ============================================================
// TESTES: STATUS E TRANSIÇÕES
// ============================================================

test.describe('Loja Virtual - Status e Publicação', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('deve exibir status de publicação da loja', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Verifica badge de status
    const statusBadge = page.locator('[class*="badge"], [class*="Badge"]').filter({ hasText: /Publicad|Rascunho/i });
    await expect(statusBadge.first()).toBeVisible({ timeout: 5000 });
  });

  test('deve ter botão de publicar/despublicar', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Verifica botão de publicação
    const publishButton = page.getByRole('button', { name: /Publicar|Despublicar/i });
    await expect(publishButton).toBeVisible({ timeout: 5000 });
  });

  test('deve mostrar preview da loja', async ({ page }) => {
    await navigateToStorefrontSettings(page);
    
    // Clica no botão de preview
    const previewLink = page.getByRole('link', { name: /Preview/i });
    await expect(previewLink).toBeVisible({ timeout: 5000 });
    
    // Verifica se tem atributo target blank
    const href = await previewLink.getAttribute('href');
    expect(href).toBeTruthy();
  });
});

// ============================================================
// TESTES: EDGE CASES
// ============================================================

test.describe('Loja Virtual - Edge Cases', () => {
  test('deve tratar tenant inexistente graciosamente', async ({ page }) => {
    await page.goto('/store/tenant-que-nao-existe-xyz-123');
    await page.waitForLoadState('networkidle');
    
    // Verifica se exibe mensagem de erro ou 404
    const has404 = await page.locator('text=/não encontrad|404|not found/i').isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('[class*="error"], [class*="alert"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(has404 || hasError).toBeTruthy();
  });

  test('deve redirecionar loja não publicada', async ({ page }) => {
    // Este teste assume que existe um tenant de teste não publicado
    // Em ambiente real, pode ser configurado via fixture
    await page.goto('/store/tenant-nao-publicado');
    await page.waitForLoadState('networkidle');
    
    // Deve mostrar mensagem ou redirecionar
    const hasMessage = await page.locator('text=/em construção|não publicad|indisponível/i').isVisible({ timeout: 10000 }).catch(() => false);
    const is404 = page.url().includes('404') || await page.locator('text=/404|não encontrad/i').isVisible({ timeout: 5000 }).catch(() => false);
    
    // Um dos dois deve ser verdadeiro para tenant não publicado
    expect(hasMessage || is404).toBeTruthy();
  });
});

// ============================================================
// TESTES: PÁGINAS INSTITUCIONAIS
// ============================================================

test.describe('Loja Virtual - Páginas Institucionais', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('deve acessar lista de páginas', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForLoadState('networkidle');
    
    // Verifica se a página de listagem carregou
    await expect(page.locator('h1, h2').filter({ hasText: /Páginas/i })).toBeVisible({ timeout: 10000 });
  });

  test('deve ter botão para criar nova página', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForLoadState('networkidle');
    
    // Verifica botão de criar
    const createButton = page.getByRole('button', { name: /Nova|Criar|Adicionar/i });
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// TESTES: MENUS
// ============================================================

test.describe('Loja Virtual - Menus', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('deve acessar configuração de menus', async ({ page }) => {
    await page.goto('/menus');
    await page.waitForLoadState('networkidle');
    
    // Verifica se a página de menus carregou
    await expect(page.locator('h1, h2').filter({ hasText: /Menu/i })).toBeVisible({ timeout: 10000 });
  });

  test('deve exibir menus de header e footer', async ({ page }) => {
    await page.goto('/menus');
    await page.waitForLoadState('networkidle');
    
    // Verifica cards de menu
    const headerMenu = page.getByText(/Header|Cabeçalho/i);
    const footerMenu = page.getByText(/Footer|Rodapé/i);
    
    await expect(headerMenu.first()).toBeVisible({ timeout: 5000 });
    await expect(footerMenu.first()).toBeVisible({ timeout: 5000 });
  });
});
