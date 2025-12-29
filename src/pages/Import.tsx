import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ImportWizard } from '@/components/import';
import { useImportJobs } from '@/hooks/useImportJobs';
import { Upload, CheckCircle, XCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Import() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { jobs, isLoading, deleteJob } = useImportJobs();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500/10 text-green-600">Concluído</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      case 'processing': return <Badge className="bg-primary/10 text-primary">Processando</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getPlatformLabel = (platform: string) => {
    const labels: Record<string, string> = {
      shopify: 'Shopify',
      nuvemshop: 'Nuvemshop',
      tray: 'Tray',
      woocommerce: 'WooCommerce',
      bagy: 'Bagy',
      yampi: 'Yampi',
      loja_integrada: 'Loja Integrada',
      wix: 'Wix',
    };
    return labels[platform] || platform;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Dados"
        description="Migre seus dados de outras plataformas de e-commerce"
      >
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Nova Importação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <ImportWizard onComplete={() => setWizardOpen(false)} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma importação realizada</h3>
              <p className="text-muted-foreground text-center mb-4">
                Importe seus produtos, categorias, clientes e pedidos de outras plataformas.
              </p>
              <Button onClick={() => setWizardOpen(true)}>
                Iniciar Importação
              </Button>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    Importação de {getPlatformLabel(job.platform)}
                  </CardTitle>
                  <CardDescription>
                    {formatDistanceToNow(new Date(job.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(job.status)}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteJob.mutate(job.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {job.modules?.map((module: string) => (
                    <Badge key={module} variant="outline" className="capitalize">
                      {module === 'products' ? 'Produtos' :
                       module === 'categories' ? 'Categorias' :
                       module === 'customers' ? 'Clientes' :
                       module === 'orders' ? 'Pedidos' : module}
                      {job.stats?.[module] && (
                        <span className="ml-1 text-xs">
                          ({job.stats[module].imported || 0})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
