import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, AlertTriangle, FileText } from 'lucide-react';

interface ImportProgressProps {
  modules: string[];
  progress: Record<string, { current: number; total: number; status: string }>;
  stats: Record<string, { imported: number; skipped: number; failed: number }>;
  status: string;
  errors: any[];
  onViewReport?: (module: string) => void;
  hasReports?: boolean;
}

const moduleLabels: Record<string, string> = {
  categories: 'Categorias',
  products: 'Produtos',
  customers: 'Clientes',
  orders: 'Pedidos',
};

export function ImportProgress({ modules, progress, stats, status, errors, onViewReport, hasReports }: ImportProgressProps) {
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
        {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
        <h3 className="text-lg font-medium">
          {isProcessing && 'Importando dados...'}
          {isCompleted && 'Importação concluída!'}
          {isFailed && 'Falha na importação'}
        </h3>
      </div>

      <div className="grid gap-4">
        {modules.map((module) => {
          const moduleProgress = progress[module];
          const moduleStats = stats[module];
          const percentage = moduleProgress 
            ? Math.round((moduleProgress.current / moduleProgress.total) * 100)
            : 0;

          return (
            <Card key={module}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{moduleLabels[module] || module}</span>
                  {moduleProgress?.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {moduleProgress?.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {moduleProgress && (
                  <>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {moduleProgress.current} de {moduleProgress.total} ({percentage}%)
                    </p>
                  </>
                )}

                {moduleStats && (
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        {moduleStats.imported} importados
                      </Badge>
                      {moduleStats.skipped > 0 && (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                          {moduleStats.skipped} ignorados
                        </Badge>
                      )}
                      {moduleStats.failed > 0 && (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                          {moduleStats.failed} falhas
                        </Badge>
                      )}
                    </div>
                    {hasReports && onViewReport && moduleProgress?.status !== 'processing' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onViewReport(module)}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Ver Relatório
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Erros ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-auto text-sm">
              {errors.slice(0, 20).map((error, i) => (
                <p key={i} className="text-muted-foreground">
                  <span className="font-medium">{error.item}:</span> {error.error}
                </p>
              ))}
              {errors.length > 20 && (
                <p className="text-muted-foreground italic">
                  ... e mais {errors.length - 20} erros
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
