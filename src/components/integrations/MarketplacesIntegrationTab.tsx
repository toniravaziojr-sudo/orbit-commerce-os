import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, ShoppingBag, Info, CheckCircle2 } from "lucide-react";
import { useMeliConnection } from "@/hooks/useMeliConnection";

// Mercado Livre Logo Component
function MercadoLivreLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#FFE600"/>
      <path d="M24 8C15.163 8 8 15.163 8 24s7.163 16 16 16 16-7.163 16-16S32.837 8 24 8zm0 28c-6.627 0-12-5.373-12-12S17.373 12 24 12s12 5.373 12 12-5.373 12-12 12z" fill="#2D3277"/>
      <path d="M24 14c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 16c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#2D3277"/>
    </svg>
  );
}

// Upcoming marketplaces
const UPCOMING_MARKETPLACES = [
  { id: "shopee", name: "Shopee", icon: "🟠", url: "https://shopee.com.br" },
  { id: "amazon", name: "Amazon", icon: "📦", url: "https://amazon.com.br" },
  { id: "magalu", name: "Magalu", icon: "🔵", url: "https://magazineluiza.com.br" },
];

export function MarketplacesIntegrationTab() {
  const { isConnected, isLoading, platformConfigured } = useMeliConnection();

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Conecte sua loja aos principais marketplaces para ampliar suas vendas. 
          Para configuração completa, acesse{" "}
          <Link to="/marketplaces" className="text-primary hover:underline font-medium">
            Marketplaces <ExternalLink className="h-3 w-3 inline" />
          </Link>
        </AlertDescription>
      </Alert>

      {/* Mercado Livre Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MercadoLivreLogo className="h-10 w-10" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Mercado Livre
                  {isConnected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  )}
                  {!isConnected && !isLoading && (
                    <Badge variant="secondary">Não conectado</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Venda no maior marketplace da América Latina
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!platformConfigured ? (
            <Alert variant="destructive">
              <AlertDescription>
                O Mercado Livre precisa ser configurado pelo administrador da plataforma primeiro.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Pedidos</Badge>
                <Badge variant="outline">Mensagens</Badge>
                <Badge variant="outline">Anúncios</Badge>
              </div>
              <Button asChild>
                <Link to="/marketplaces">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  {isConnected ? "Gerenciar" : "Conectar"}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Marketplaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em Breve</CardTitle>
          <CardDescription>Novos marketplaces serão adicionados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {UPCOMING_MARKETPLACES.map((mp) => (
              <div
                key={mp.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 opacity-60"
              >
                <span className="text-2xl">{mp.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{mp.name}</p>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
