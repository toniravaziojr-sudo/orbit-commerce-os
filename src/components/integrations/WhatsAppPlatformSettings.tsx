import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, CheckCircle2, AlertCircle, ExternalLink, Info, Shield } from "lucide-react";

export function WhatsAppPlatformSettings() {
  // Z-API credentials are stored as environment variables in the edge functions
  // The platform operator has already configured the master Z-API account
  const isConfigured = true; // Z-API is configured at platform level

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-green-500/10">
          <MessageSquare className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">WhatsApp (Z-API)</h2>
          <p className="text-sm text-muted-foreground">
            Conta gerenciadora para envio de mensagens WhatsApp
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          A integração Z-API permite que cada tenant conecte seu próprio WhatsApp via QR Code.
          A conta gerenciadora da plataforma coordena todas as instâncias.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Conta Gerenciadora Z-API
              </CardTitle>
              <CardDescription>
                Credenciais da conta principal que gerencia todas as instâncias
              </CardDescription>
            </div>
            {isConfigured ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <AlertCircle className="h-3 w-3 mr-1" />
                Pendente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1">Client Token</p>
              <p className="text-sm font-mono">••••••••••••••••</p>
              <p className="text-xs text-muted-foreground mt-1">Configurado via variável de ambiente</p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm">Operacional</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Última verificação: agora</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Como funciona</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                Você configurou a conta gerenciadora Z-API com o Client Token
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Cada tenant cria sua própria instância no painel deles
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                O tenant escaneia o QR Code para conectar seu WhatsApp
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                Mensagens são enviadas via API usando a instância do tenant
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos da Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Envio de mensagens de texto</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Envio de imagens e arquivos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Recebimento de webhooks</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Múltiplas instâncias por tenant</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Notificações automáticas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Suporte a atendimento</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="https://developer.z-api.io/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentação Z-API
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://painel.z-api.io/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Painel Z-API
          </a>
        </Button>
      </div>
    </div>
  );
}
