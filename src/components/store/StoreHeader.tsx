import { ShoppingCart, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

interface StoreHeaderProps {
  storeName: string;
  logoUrl?: string | null;
  cartItemCount: number;
  onCartClick: () => void;
}

export function StoreHeader({
  storeName,
  logoUrl,
  cartItemCount,
  onCartClick,
}: StoreHeaderProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-background border-b shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo / Nome da Loja */}
          <Link to={`/store/${tenantSlug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <h1 className="text-xl font-bold text-foreground">{storeName}</h1>
            )}
          </Link>

          {/* Busca - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Link Carrinho */}
            <Link to={`/store/${tenantSlug}/cart`}>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex"
              >
                Ver Carrinho
              </Button>
            </Link>

            {/* Botão Carrinho */}
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={onCartClick}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  variant="destructive"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Busca mobile */}
        <div className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
