import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, MessageSquare, FileText, Globe, Truck, Bot, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { usePlatformSecretsStatus, type IntegrationStatus } from "@/hooks/usePlatformSecretsStatus";

interface PlatformIntegrationsDashboardProps {
  onNavigateToTab: (tab: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  Mail: Mail,
  MessageSquare: MessageSquare,
  FileText: FileText,
  Cloud: Globe,
  Truck: Truck,
  Flame: Bot,
  Bot: Bot,
};

export function PlatformIntegrationsDashboard({ onNavigateToTab }: PlatformIntegrationsDashboardProps) {
  const { data: integrations, isLoading, error } = usePlatformSecretsStatus();

  const tabMap: Record<string, string> = {
    sendgrid: 'emaildomains',
    focus_nfe: 'fiscal',
    cloudflare: 'emaildomains',
    loggi: 'logistics',
    firecrawl: 'ai',
    lovable_ai: 'ai',
    openai: 'ai',
    zapi: 'whatsapp',
    whatsapp_meta: 'whatsapp',
    meta_platform: 'meta',
    google_platform: 'google',
    tiktok_ads_platform: 'tiktok-ads',
    tiktok_shop_platform: 'tiktok-shop',
    shopee_platform: 'shopee',
    mercadolivre: 'mercadolivre',
    mercadopago_platform: 'mercadopago',
    nuvem_fiscal: 'fiscal',
    fal_ai: 'ai',
    gemini: 'ai',
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'configured':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Configurado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Parcial</Badge>;
      case 'system':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Sistema</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'configured':
      case 'system':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar status: {error instanceof Error ? error.message : 'Erro desconhecido'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use integrations from API (includes zapi now)
  const allIntegrations = integrations || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Status das Integrações</h2>
          <p className="text-sm text-muted-foreground">
            Visão geral de todas as integrações configuradas na plataforma
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allIntegrations.map((integration) => {
          const IconComponent = iconMap[integration.icon] || Bot;
          const targetTab = tabMap[integration.key];

          return (
            <Card 
              key={integration.key} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => targetTab && onNavigateToTab(targetTab)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {integration.configuredCount}/{integration.totalCount} credenciais
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusIcon(integration.status)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {integration.description}
                </p>
                <div className="flex items-center justify-between">
                  {getStatusBadge(integration.status)}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(integration.docs, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Docs
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
