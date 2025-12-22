import { AlertTriangle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useViolationsStats } from '@/hooks/useRuntimeViolations';
import { useHealthCheckStats } from '@/hooks/useHealthChecks';

export function StorefrontHealthCard() {
  const violationStats = useViolationsStats();
  const healthStats = useHealthCheckStats();

  const hasViolations = violationStats.hasIssues;
  const hasHealthIssues = healthStats.failed > 0;
  const hasAnyIssues = hasViolations || hasHealthIssues;

  return (
    <Card className={hasAnyIssues ? 'border-destructive/50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {hasAnyIssues ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            Saúde do Storefront
          </CardTitle>
          <Link to="/health-monitor">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          Monitoramento automático de URLs e integrações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Violations summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Violações de URL (24h)</span>
          <Badge variant={violationStats.unresolved > 0 ? 'destructive' : 'secondary'}>
            {violationStats.unresolved}
          </Badge>
        </div>

        {/* Health check summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Uptime do Health Monitor</span>
          <Badge variant={healthStats.uptime >= 95 ? 'secondary' : 'destructive'}>
            {healthStats.uptime}%
          </Badge>
        </div>

        {/* Violation breakdown if any */}
        {hasViolations && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Detalhes:</p>
            {violationStats.byType.hardcoded_store_url > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <XCircle className="h-3 w-3 text-destructive" />
                <span>{violationStats.byType.hardcoded_store_url} URLs /store/ hardcoded</span>
              </div>
            )}
            {violationStats.byType.app_domain_link > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <XCircle className="h-3 w-3 text-destructive" />
                <span>{violationStats.byType.app_domain_link} links para app domain</span>
              </div>
            )}
            {violationStats.byType.preview_in_public > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <XCircle className="h-3 w-3 text-destructive" />
                <span>{violationStats.byType.preview_in_public} preview em URL pública</span>
              </div>
            )}
          </div>
        )}

        {/* All clear message */}
        {!hasAnyIssues && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Nenhuma violação detectada. Sistema funcionando normalmente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
