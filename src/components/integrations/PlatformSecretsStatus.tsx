import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, Mail, Cloud, Truck, Flame, Bot, 
  CheckCircle2, AlertCircle, Clock, ExternalLink, Info,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecretStatus {
  [key: string]: boolean;
}

interface Integration {
  key: string;
  name: string;
  description: string;
  icon: string;
  docs: string;
  isSystem?: boolean;
  secrets: SecretStatus;
  status: 'configured' | 'partial' | 'pending' | 'system';
  configuredCount: number;
  totalCount: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Mail,
  Cloud,
  Truck,
  Flame,
  Bot,
};

export function PlatformSecretsStatus() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('platform-secrets-check');
      
      if (fnError) throw fnError;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao verificar status');
      }
      
      setIntegrations(data.integrations);
    } catch (err: any) {
      console.error('Error fetching platform secrets status:', err);
      setError(err.message || 'Erro ao carregar status das integrações');
      toast.error('Erro ao carregar status das integrações');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (integration: Integration) => {
    if (integration.status === 'system') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Sistema
        </Badge>
      );
    }
    if (integration.status === 'configured') {
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Configurado
        </Badge>
      );
    }
    if (integration.status === 'partial') {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-600">
          <AlertCircle className="h-3 w-3" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Pendente
      </Badge>
    );
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || FileText;
    return IconComponent;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-24 mb-3" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Estas são as credenciais globais que você configurou como integrador para fornecer serviços a todos os tenants.
            Os valores dos secrets nunca são expostos - apenas o status de configuração.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = getIcon(integration.icon);
          
          return (
            <Card key={integration.key} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                  </div>
                  {getStatusBadge(integration)}
                </div>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Secrets ({integration.configuredCount}/{integration.totalCount})
                  </p>
                  <div className="space-y-1">
                    {Object.entries(integration.secrets).map(([secretName, isConfigured]) => (
                      <div key={secretName} className="flex items-center gap-2 text-sm">
                        {isConfigured ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {secretName}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <a href={integration.docs} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Documentação
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
