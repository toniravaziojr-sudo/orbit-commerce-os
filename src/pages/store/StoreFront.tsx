import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreHero } from "@/components/store/StoreHero";
import { StoreCategoryList } from "@/components/store/StoreCategoryList";
import { StoreProductGrid } from "@/components/store/StoreProductGrid";
import { StoreFooter } from "@/components/store/StoreFooter";
import { CartDrawer } from "@/components/store/CartDrawer";
import { Skeleton } from "@/components/ui/skeleton";

interface StoreSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  store_description: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  social_whatsapp: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  is_published: boolean | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function StoreFront() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!tenantSlug) {
        setError("Loja não encontrada");
        setLoading(false);
        return;
      }

      try {
        // Buscar tenant pelo slug
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("id, name, slug")
          .eq("slug", tenantSlug)
          .single();

        if (tenantError || !tenantData) {
          setError("Loja não encontrada");
          setLoading(false);
          return;
        }

        setTenant(tenantData);

        // Buscar configurações da loja (não exigir is_published para permitir preview)
        const { data: settingsData } = await supabase
          .from("store_settings")
          .select("*")
          .eq("tenant_id", tenantData.id)
          .maybeSingle();

        setSettings(settingsData);
      } catch (err) {
        console.error("Error fetching store data:", err);
        setError("Erro ao carregar a loja");
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [tenantSlug]);

  // Carregar contagem do carrinho do localStorage
  useEffect(() => {
    const cartKey = `cart_${tenantSlug}`;
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        setCartItemCount(cart.items?.length || 0);
      } catch {
        setCartItemCount(0);
      }
    }
  }, [tenantSlug]);

  const updateCartCount = (count: number) => {
    setCartItemCount(count);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 border-b">
          <Skeleton className="h-full w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="container mx-auto py-8 px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Loja não encontrada"}
          </h1>
          <p className="text-muted-foreground">
            Verifique o endereço e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const storeName = settings?.store_name || tenant.name;

  return (
    <div 
      className="min-h-screen bg-background flex flex-col"
      style={{
        "--store-primary": settings?.primary_color || "#6366f1",
        "--store-secondary": settings?.secondary_color || "#8b5cf6",
        "--store-accent": settings?.accent_color || "#f59e0b",
      } as React.CSSProperties}
    >
      <StoreHeader
        storeName={storeName}
        logoUrl={settings?.logo_url}
        cartItemCount={cartItemCount}
        onCartClick={() => setCartOpen(true)}
      />

      {/* Hero Banner */}
      <StoreHero
        storeName={storeName}
        storeDescription={settings?.store_description}
        primaryColor={settings?.primary_color}
      />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Categories */}
          <StoreCategoryList 
            tenantId={tenant.id} 
            tenantSlug={tenantSlug!} 
          />

          {/* Products Section */}
          <section id="products-section" className="py-8">
            <h2 className="text-2xl font-bold mb-6">Nossos Produtos</h2>
            <StoreProductGrid 
              tenantId={tenant.id} 
              tenantSlug={tenantSlug!}
              onAddToCart={updateCartCount}
            />
          </section>
        </div>
      </main>

      <StoreFooter
        storeName={storeName}
        whatsapp={settings?.social_whatsapp}
        instagram={settings?.social_instagram}
        facebook={settings?.social_facebook}
      />

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        tenantSlug={tenantSlug!}
        tenantId={tenant.id}
        onCartUpdate={updateCartCount}
      />
    </div>
  );
}
