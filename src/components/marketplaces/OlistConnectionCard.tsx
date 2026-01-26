import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Link2, 
  ExternalLink,
  Info,
  Key,
  Building2,
  ShoppingCart,
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
  const [accountType, setAccountType] = useState<"erp" | "ecommerce">("erp");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!apiToken.trim()) return;
    
    setTestResult(null);
    try {
      await testConnection({ apiToken, accountType });
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
    connect({ apiToken, accountType });
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
                {connection.accountType === "erp" ? "Olist ERP (Tiny)" : "Olist E-commerce (Vnda)"}
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
        {/* Account Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tipo de Conta</Label>
          <RadioGroup 
            value={accountType} 
            onValueChange={(v) => setAccountType(v as "erp" | "ecommerce")}
            className="grid grid-cols-2 gap-3"
          >
            <Label 
              htmlFor="erp" 
              className={`
                flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                ${accountType === "erp" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground/30"
                }
              `}
            >
              <RadioGroupItem value="erp" id="erp" />
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Olist ERP</p>
                  <p className="text-xs text-muted-foreground">Tiny ERP</p>
                </div>
              </div>
            </Label>
            <Label 
              htmlFor="ecommerce" 
              className={`
                flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                ${accountType === "ecommerce" 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-muted-foreground/30"
                }
              `}
            >
              <RadioGroupItem value="ecommerce" id="ecommerce" />
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Olist E-commerce</p>
                  <p className="text-xs text-muted-foreground">Vnda</p>
                </div>
              </div>
            </Label>
          </RadioGroup>
        </div>

        {/* API Token Input */}
        <div className="space-y-2">
          <Label htmlFor="api-token">
            {accountType === "erp" ? "Token da API Tiny" : "Token da API Vnda"}
          </Label>
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
          {accountType === "erp" ? (
            <p className="text-xs text-muted-foreground">
              Acesse o painel do Tiny → Configurações → Integrações → Gerar Token
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Acesse o painel Vnda → Configurações → API → Chaves de API
            </p>
          )}
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
            {accountType === "erp" ? (
              <span>
                Para gerar o token, acesse{" "}
                <a 
                  href="https://tiny.com.br" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Tiny ERP <ExternalLink className="h-3 w-3" />
                </a>
                {" "}→ Configurações → Integrações → API
              </span>
            ) : (
              <span>
                Para gerar o token, acesse{" "}
                <a 
                  href="https://vnda.com.br" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Vnda <ExternalLink className="h-3 w-3" />
                </a>
                {" "}→ Configurações → API → Chaves de API
              </span>
            )}
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
              Conectar {accountType === "erp" ? "Olist ERP" : "Olist E-commerce"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
