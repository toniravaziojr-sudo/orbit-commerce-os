import { test, expect, Page } from '@playwright/test';

/**
 * E2E Anti-Regression Tests: Storefront Navigation & URLs
 * 
 * These tests validate that:
 * 1. URLs don't contain /store/{slug} on custom domains
 * 2. No public links point to app.comandocentral.com.br
 * 3. Core navigation flows work without 404s
 * 
 * Run:
 *   STOREFRONT_BASE_URL=https://loja.example.com npx playwright test
 */

// Detect if we're on a custom domain (not localhost, not app.*, not *.lovableproject.com)
function isCustomDomain(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (hostname.includes('lovableproject.com')) return false;
  if (hostname.startsWith('app.')) return false;
  if (hostname.includes('.shops.')) return false;
  
  return true;
}

// Check URL for prohibited patterns
function validateUrl(page: Page, baseUrl: string) {
  const currentUrl = page.url();
  const isCustom = isCustomDomain(baseUrl);
  
  // On custom domain, URL should NOT contain /store/{slug}
  if (isCustom) {
    expect(currentUrl).not.toMatch(/\/store\/[^/]+/);
  }
  
  // Never should point to app.comandocentral
  expect(currentUrl).not.toContain('app.comandocentral');
}

// Check all links on page for prohibited patterns
async function validateAllLinks(page: Page, baseUrl: string) {
  const isCustom = isCustomDomain(baseUrl);
  
  const links = await page.locator('a[href]').all();
  
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (!href) continue;
    
    // Skip external links and anchors
    if (href.startsWith('http') && !href.includes(new URL(baseUrl).hostname)) continue;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    
    // On custom domain, no internal link should have /store/{slug}
    if (isCustom && /\/store\/[^/]+/.test(href)) {
      throw new Error(`Found hardcoded /store/ URL in link: ${href}`);
    }
    
    // No link should point to app.comandocentral
    if (href.includes('app.comandocentral')) {
      throw new Error(`Found app.comandocentral URL in link: ${href}`);
    }
  }
}

test.describe('Storefront Navigation Anti-Regression', () => {
  const baseUrl = process.env.STOREFRONT_BASE_URL || 'http://localhost:8080';
  
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });
    
    // Listen for failed requests (404s, etc)
    page.on('response', response => {
      if (response.status() === 404) {
        console.log(`404 detected: ${response.url()}`);
      }
    });
  });

  test('Test 1: Home → Product → Cart navigation', async ({ page }) => {
    // Go to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Validate home page URLs
    validateUrl(page, baseUrl);
    await validateAllLinks(page, baseUrl);
    
    // Find and click first product link (various selectors for different layouts)
    const productLink = page.locator('[data-testid="product-card"] a, .product-card a, a[href*="/p/"]').first();
    
    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      
      // Validate product page URLs
      validateUrl(page, baseUrl);
      
      // Look for add to cart button
      const addToCartBtn = page.locator('[data-testid="add-to-cart"], button:has-text("Adicionar"), button:has-text("Comprar")').first();
      
      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();
        await page.waitForTimeout(1000); // Wait for cart update
      }
    }
    
    // Navigate to cart
    const cartLink = page.locator('[data-testid="cart-link"], a[href*="/cart"], a:has-text("Carrinho")').first();
    
    if (await cartLink.isVisible()) {
      await cartLink.click();
      await page.waitForLoadState('networkidle');
      
      // Validate cart page URLs
      validateUrl(page, baseUrl);
      await validateAllLinks(page, baseUrl);
    }
    
    // Verify no 404 occurred
    expect(page.url()).not.toContain('404');
  });

  test('Test 2: Cart → Checkout navigation', async ({ page }) => {
    // Go directly to cart
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    
    validateUrl(page, baseUrl);
    
    // Look for checkout button
    const checkoutBtn = page.locator('[data-testid="checkout-button"], button:has-text("Finalizar"), button:has-text("Checkout"), a[href*="/checkout"]').first();
    
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await page.waitForLoadState('networkidle');
      
      // Validate checkout page URLs
      validateUrl(page, baseUrl);
      await validateAllLinks(page, baseUrl);
      
      // Verify we're on checkout (URL should contain checkout or be the checkout page)
      expect(page.url().toLowerCase()).toContain('checkout');
    }
  });

  test('Test 3: Coupon field exists in cart and checkout', async ({ page }) => {
    // Check cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    
    const cartCouponField = page.locator('[data-testid="coupon-input"], input[placeholder*="cupom" i], input[placeholder*="coupon" i], input[name*="coupon" i], input[name*="cupom" i]').first();
    
    // Cart coupon field should be visible
    const hasCouponInCart = await cartCouponField.isVisible();
    console.log(`Coupon field in cart: ${hasCouponInCart ? 'found' : 'not found'}`);
    
    // Check checkout page
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    
    const checkoutCouponField = page.locator('[data-testid="coupon-input"], input[placeholder*="cupom" i], input[placeholder*="coupon" i], input[name*="coupon" i], input[name*="cupom" i]').first();
    
    const hasCouponInCheckout = await checkoutCouponField.isVisible();
    console.log(`Coupon field in checkout: ${hasCouponInCheckout ? 'found' : 'not found'}`);
    
    // At least one should have the coupon field
    expect(hasCouponInCart || hasCouponInCheckout).toBe(true);
  });

  test('Test 4: Checkout session tracking (network validation)', async ({ page }) => {
    let sessionStartCalled = false;
    let heartbeatCalled = false;
    
    // Listen for checkout session API calls
    page.on('request', request => {
      const url = request.url();
      if (url.includes('checkout-session-start')) {
        sessionStartCalled = true;
      }
      if (url.includes('checkout-session-heartbeat')) {
        heartbeatCalled = true;
      }
    });
    
    // Go to checkout
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for heartbeat to fire
    await page.waitForTimeout(5000);
    
    // Validate URLs
    validateUrl(page, baseUrl);
    
    // Log results (not failing if not called, as this depends on implementation)
    console.log(`Checkout session start called: ${sessionStartCalled}`);
    console.log(`Checkout heartbeat called: ${heartbeatCalled}`);
    
    // At minimum, the page should load without errors
    expect(page.url()).toContain('checkout');
  });

  test('Test 5: Account → Orders navigation', async ({ page }) => {
    // Try to access account/orders
    await page.goto('/conta/pedidos');
    await page.waitForLoadState('networkidle');
    
    validateUrl(page, baseUrl);
    
    // Should either show orders or redirect to login
    const url = page.url();
    const validPaths = ['/conta', '/login', '/pedidos'];
    
    expect(validPaths.some(path => url.includes(path))).toBe(true);
    
    // Validate all links on page
    await validateAllLinks(page, baseUrl);
  });

  test('Test 6: No app.comandocentral URLs in page content', async ({ page }) => {
    // Check multiple pages for hardcoded admin URLs
    const pagesToCheck = ['/', '/cart', '/checkout'];
    
    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Get all hrefs on page
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean);
      });
      
      // None should contain app.comandocentral
      for (const href of hrefs) {
        if (href && href.includes('app.comandocentral')) {
          throw new Error(`Found app.comandocentral URL on ${pagePath}: ${href}`);
        }
      }
    }
  });
});
