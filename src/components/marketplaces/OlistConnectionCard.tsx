import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Link2, 
  ExternalLink,
  Info,
  Key,
} from "lucide-react";
import { useOlistConnection } from "@/hooks/useOlistConnection";

// Olist Logo Component
export function OlistLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <rect width="48" height="48" rx="8" fill="#00C853" />
      <circle cx="24" cy="24" r="12" fill="white" />
      <circle cx="24" cy="24" r="6" fill="#00C853" />
    </svg>
  );
}

export function OlistConnectionCard() {
  const { 
    isConnected, 
    connection, 
    isLoading, 
    connect, 
    disconnect, 
    testConnection,
    isConnecting,
    isDisconnecting,
    isTesting,
  } = useOlistConnection();

  const [apiToken, setApiToken] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!apiToken.trim()) return;
    
    setTestResult(null);
    try {
      await testConnection({ apiToken, accountType: "marketplace" });
      setTestResult({ success: true, message: "Token válido! Pronto para conectar." });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : "Falha no teste" 
      });
    }
  };

  const handleConnect = async () => {
    if (!apiToken.trim()) return;
    connect({ apiToken, accountType: "marketplace" });
  };

  const handleDisconnect = () => {
    if (confirm("Tem certeza que deseja desconectar da Olist?")) {
      disconnect();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  if (isConnected && connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Conta Conectada
                <Badge variant="default" className="bg-green-600">Ativa</Badge>
              </CardTitle>
              <CardDescription>
                Olist Marketplace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta:</span>
              <span className="font-medium">{connection.externalUsername}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID:</span>
              <span className="font-mono text-xs">{connection.externalUserId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conectado em:</span>
              <span>{new Date(connection.connectedAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {connection.lastSyncAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última sincronização:</span>
                <span>{new Date(connection.lastSyncAt).toLocaleString("pt-BR")}</span>
              </div>
            )}
            {connection.lastError && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription className="text-xs">
                  {connection.lastError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection form
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Key className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Conectar com Olist</CardTitle>
            <CardDescription>
              Informe seu token de API para conectar
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Token Input */}
        <div className="space-y-2">
          <Label htmlFor="api-token">Token da API Olist</Label>
          <div className="flex gap-2">
            <Input
              id="api-token"
              type="password"
              placeholder="Cole seu token aqui..."
              value={apiToken}
              onChange={(e) => {
                setApiToken(e.target.value);
                setTestResult(null);
              }}
            />
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={!apiToken.trim() || isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Testar"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Acesse o painel Olist → Configurações → Integrações → Gerar Token
          </p>
        </div>

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Help Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Para gerar o token, acesse{" "}
            <a 
              href="https://olist.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              Olist <ExternalLink className="h-3 w-3" />
            </a>
            {" "}→ Configurações → Integrações → API
          </AlertDescription>
        </Alert>

        {/* Connect Button */}
        <Button 
          className="w-full" 
          onClick={handleConnect}
          disabled={!apiToken.trim() || isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              Conectar Olist
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
