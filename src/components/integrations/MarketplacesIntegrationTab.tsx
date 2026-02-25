import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, ShoppingBag, Info, CheckCircle2, Unplug, RefreshCw } from "lucide-react";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { useShopeeConnection } from "@/hooks/useShopeeConnection";
import { useOlistConnection } from "@/hooks/useOlistConnection";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

// Shopee Logo Component
function ShopeeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <rect width="48" height="48" rx="8" fill="#EE4D2D" />
      <path
        d="M24 10c-2.8 0-5.1 2.1-5.4 4.8h-2.1c-1.6 0-2.9 1.3-2.9 2.9v15.4c0 1.6 1.3 2.9 2.9 2.9h15c1.6 0 2.9-1.3 2.9-2.9V17.7c0-1.6-1.3-2.9-2.9-2.9h-2.1c-.3-2.7-2.6-4.8-5.4-4.8zm0 2.5c1.5 0 2.8 1.2 2.9 2.7h-5.8c.1-1.5 1.4-2.7 2.9-2.7zm0 8.3c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z"
        fill="white"
      />
    </svg>
  );
}

// Olist Logo Component
function OlistLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <rect width="48" height="48" rx="8" fill="#00C853" />
      <circle cx="24" cy="24" r="12" fill="white" />
      <circle cx="24" cy="24" r="6" fill="#00C853" />
    </svg>
  );
}

// Upcoming marketplaces (Olist and Shopee removed - now functional)
const UPCOMING_MARKETPLACES = [
  { id: "amazon", name: "Amazon", icon: "📦", url: "https://amazon.com.br" },
  { id: "magalu", name: "Magalu", icon: "🔵", url: "https://magazineluiza.com.br" },
];

export function MarketplacesIntegrationTab() {
  const { isConnected: meliConnected, isLoading: meliLoading, platformConfigured: meliConfigured, connect: meliConnect, disconnect: meliDisconnect, isConnecting: meliConnecting, isDisconnecting: meliDisconnecting, isExpired: meliExpired } = useMeliConnection();
  const { isConnected: shopeeConnected, isLoading: shopeeLoading, platformConfigured: shopeeConfigured } = useShopeeConnection();
  const { isConnected: olistConnected, isLoading: olistLoading, platformConfigured: olistConfigured } = useOlistConnection();

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
                  {meliConnected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  )}
                  {!meliConnected && !meliLoading && (
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
          {!meliConfigured ? (
            <Alert variant="destructive">
              <AlertDescription>
                O Mercado Livre precisa ser configurado pelo administrador da plataforma primeiro.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {!meliConnected && (
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Pedidos</Badge>
                    <Badge variant="outline">Mensagens</Badge>
                    <Badge variant="outline">Anúncios</Badge>
                  </div>
                  <Button
                    onClick={() => meliConnect()}
                    disabled={meliConnecting}
                  >
                    {meliConnecting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShoppingBag className="h-4 w-4 mr-2" />
                    )}
                    {meliConnecting ? "Conectando..." : "Conectar"}
                  </Button>
                </div>
              )}
              {meliConnected && (
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Pedidos</Badge>
                    <Badge variant="outline">Mensagens</Badge>
                    <Badge variant="outline">Anúncios</Badge>
                  </div>
                  <Button asChild>
                    <Link to="/marketplaces/mercadolivre">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Gerenciar
                    </Link>
                  </Button>
                </div>
              )}
              {meliConnected && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => meliConnect()}
                    disabled={meliConnecting}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${meliConnecting ? 'animate-spin' : ''}`} />
                    Reconectar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Unplug className="h-3.5 w-3.5 mr-1.5" />
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar Mercado Livre?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso irá remover a conexão com sua conta do Mercado Livre. Pedidos e anúncios não serão mais sincronizados. Você pode reconectar a qualquer momento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => meliDisconnect()}
                          disabled={meliDisconnecting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {meliDisconnecting ? "Desconectando..." : "Desconectar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              {meliExpired && !meliConnected && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <Alert className="border-yellow-500/30 bg-yellow-500/5 flex-1 mr-3">
                    <AlertDescription className="text-sm">
                      Token expirado. Reconecte para renovar o acesso.
                    </AlertDescription>
                  </Alert>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => meliConnect()}
                    disabled={meliConnecting}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${meliConnecting ? 'animate-spin' : ''}`} />
                    Reconectar
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shopee Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShopeeLogo className="h-10 w-10" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Shopee
                  {shopeeConnected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  )}
                  {!shopeeConnected && !shopeeLoading && (
                    <Badge variant="secondary">Não conectado</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Venda no marketplace que mais cresce no Brasil
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!shopeeConfigured ? (
            <Alert variant="destructive">
              <AlertDescription>
                A Shopee precisa ser configurada pelo administrador da plataforma primeiro.
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
                <Link to="/marketplaces/shopee">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  {shopeeConnected ? "Gerenciar" : "Conectar"}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Olist Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <OlistLogo className="h-10 w-10" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Olist
                  {olistConnected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  )}
                  {!olistConnected && !olistLoading && (
                    <Badge variant="secondary">Não conectado</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Integre com Olist ERP (Tiny) ou E-commerce (Vnda)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Pedidos</Badge>
              <Badge variant="outline">Nota Fiscal</Badge>
              <Badge variant="outline">Estoque</Badge>
            </div>
            <Button asChild>
              <Link to="/marketplaces/olist">
                <ShoppingBag className="h-4 w-4 mr-2" />
                {olistConnected ? "Gerenciar" : "Conectar"}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Marketplaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em Breve</CardTitle>
          <CardDescription>Novos marketplaces serão adicionados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
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
