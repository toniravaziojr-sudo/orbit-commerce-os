import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface StoreHeroProps {
  storeName: string;
  storeDescription?: string | null;
  primaryColor?: string | null;
}

export function StoreHero({ storeName, storeDescription, primaryColor }: StoreHeroProps) {
  return (
    <section 
      className="relative overflow-hidden py-16 md:py-24"
      style={{
        background: `linear-gradient(135deg, ${primaryColor || '#6366f1'} 0%, ${primaryColor || '#6366f1'}cc 50%, ${primaryColor || '#6366f1'}99 100%)`,
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Bem-vindo à {storeName}
          </h1>
          {storeDescription && (
            <p className="text-lg md:text-xl text-white/90 mb-8">
              {storeDescription}
            </p>
          )}
          <Button 
            size="lg" 
            className="bg-white text-foreground hover:bg-white/90"
            onClick={() => {
              document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Ver Produtos
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
