import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Construction, ExternalLink, ShoppingBag, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MARKETPLACES = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    description: "Venda seus produtos no maior marketplace da América Latina",
    logo: "🛒",
    status: "coming_soon" as const,
    url: "https://www.mercadolivre.com.br",
  },
  {
    id: "shopee",
    name: "Shopee",
    description: "Alcance milhões de clientes no marketplace que mais cresce",
    logo: "🧡",
    status: "coming_soon" as const,
    url: "https://shopee.com.br",
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Venda globalmente com a maior loja online do mundo",
    logo: "📦",
    status: "coming_soon" as const,
    url: "https://www.amazon.com.br",
  },
  {
    id: "magalu",
    name: "Magazine Luiza",
    description: "Integre sua loja ao marketplace Magalu",
    logo: "💙",
    status: "coming_soon" as const,
    url: "https://www.magazineluiza.com.br",
  },
  {
    id: "shein",
    name: "Shein",
    description: "Alcance o público jovem no marketplace de moda",
    logo: "👗",
    status: "coming_soon" as const,
    url: "https://br.shein.com",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    description: "Venda para o mundo todo com o AliExpress",
    logo: "🌍",
    status: "coming_soon" as const,
    url: "https://www.aliexpress.com",
  },
  {
    id: "americanas",
    name: "Americanas",
    description: "Marketplace tradicional com grande alcance nacional",
    logo: "🔴",
    status: "coming_soon" as const,
    url: "https://www.americanas.com.br",
  },
  {
    id: "casasbahia",
    name: "Casas Bahia",
    description: "Marketplace focado em eletrodomésticos e móveis",
    logo: "🏠",
    status: "coming_soon" as const,
    url: "https://www.casasbahia.com.br",
  },
];

export default function Marketplaces() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Marketplaces"
        description="Gerencie suas integrações com marketplaces"
      />

      <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
        <Construction className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Em construção:</strong> As integrações com marketplaces estão sendo desenvolvidas. 
          Em breve você poderá sincronizar seus produtos e pedidos automaticamente.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MARKETPLACES.map((marketplace) => (
          <Card key={marketplace.id} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                    {marketplace.logo}
                  </div>
                  <div>
                    <CardTitle className="text-base">{marketplace.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Em breve
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="mb-4 line-clamp-2">
                {marketplace.description}
              </CardDescription>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled 
                  className="flex-1"
                >
                  <Store className="h-4 w-4 mr-2" />
                  Conectar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  asChild
                >
                  <a href={marketplace.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Mais marketplaces em breve</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Estamos trabalhando para adicionar mais integrações. 
            Tem alguma sugestão? Entre em contato conosco!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
