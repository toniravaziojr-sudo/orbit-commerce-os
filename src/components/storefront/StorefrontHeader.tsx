import { Link, useParams } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useCart } from '@/hooks/useCart';
import type { MenuItem } from '@/hooks/useStorefront';

export function StorefrontHeader() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, headerMenu, categories } = usePublicStorefront(tenantSlug || '');
  const { totalItems } = useCart(tenantSlug || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const baseUrl = `/store/${tenantSlug}`;
  const menuItems = headerMenu?.items || [];

  const getMenuItemUrl = (item: MenuItem): string => {
    if (item.item_type === 'external' && item.url) {
      return item.url;
    }
    if (item.item_type === 'category' && item.ref_id) {
      const category = categories?.find(c => c.id === item.ref_id);
      return category ? `${baseUrl}/c/${category.slug}` : baseUrl;
    }
    if (item.item_type === 'page' && item.ref_id) {
      return `${baseUrl}/page/${item.ref_id}`;
    }
    return baseUrl;
  };

  const primaryColor = storeSettings?.primary_color || '#6366f1';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to={baseUrl} className="flex items-center gap-2">
            {storeSettings?.logo_url ? (
              <img
                src={storeSettings.logo_url}
                alt={storeSettings?.store_name || 'Loja'}
                className="h-10 max-w-[160px] object-contain"
              />
            ) : (
              <span
                className="text-xl font-bold"
                style={{ color: primaryColor }}
              >
                {storeSettings?.store_name || 'Loja'}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                to={getMenuItemUrl(item)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link to={`${baseUrl}/cart`}>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Buscar produtos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-2">
                    {menuItems.map((item) => (
                      <Link
                        key={item.id}
                        to={getMenuItemUrl(item)}
                        onClick={() => setMobileMenuOpen(false)}
                        className="py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
