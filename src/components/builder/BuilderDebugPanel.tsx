// =============================================
// BUILDER DEBUG PANEL - Diagnóstico visual do estado do Builder
// Ativado por ?debug=1 na URL
// Inclui React Instance Guard status
// =============================================

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronUp, Bug, CheckCircle, XCircle, Loader2, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getReactGuardStatus, ReactGuardStatus } from '@/lib/reactInstanceGuard';

export interface DebugQueryState {
  name: string;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error?: string;
  dataCount?: number | string;
  dataPreview?: string;
}

interface SupabaseError {
  timestamp: Date;
  operation: string;
  table?: string;
  error: string;
}

// Global store for Supabase errors
const supabaseErrors: SupabaseError[] = [];

export function addSupabaseError(operation: string, table: string | undefined, error: string) {
  supabaseErrors.push({
    timestamp: new Date(),
    operation,
    table,
    error,
  });
  // Keep only last 10 errors
  if (supabaseErrors.length > 10) {
    supabaseErrors.shift();
  }
}

interface BuilderDebugPanelProps {
  pageType: string;
  queries: DebugQueryState[];
  extraInfo?: Record<string, string | number | boolean | null | undefined>;
  isSafeMode?: boolean;
}

export function BuilderDebugPanel({ pageType, queries, extraInfo, isSafeMode }: BuilderDebugPanelProps) {
  const [searchParams] = useSearchParams();
  const { user, currentTenant, isLoading: authLoading } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [errors, setErrors] = useState<SupabaseError[]>([]);
  const [reactGuard, setReactGuard] = useState<ReactGuardStatus | null>(null);

  const isDebugMode = searchParams.get('debug') === '1';

  // Check React Guard status on mount
  useEffect(() => {
    if (!isDebugMode) return;
    setReactGuard(getReactGuardStatus());
  }, [isDebugMode]);

  // Refresh errors periodically
  useEffect(() => {
    if (!isDebugMode) return;
    
    const interval = setInterval(() => {
      setErrors([...supabaseErrors]);
    }, 1000);

    return () => clearInterval(interval);
  }, [isDebugMode]);

  if (!isDebugMode) return null;

  const hasErrors = queries.some(q => q.isError) || errors.length > 0;
  const isAnyLoading = queries.some(q => q.isLoading);

  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg max-w-sm"
      style={{ maxHeight: isExpanded ? '70vh' : 'auto' }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-t-lg ${
          hasErrors ? 'bg-destructive/10 text-destructive' : 
          isAnyLoading ? 'bg-yellow-500/10 text-yellow-600' : 
          'bg-green-500/10 text-green-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4" />
          <span>Builder Debug</span>
          {hasErrors && <AlertTriangle className="h-4 w-4" />}
          {isAnyLoading && !hasErrors && <Loader2 className="h-4 w-4 animate-spin" />}
          {!hasErrors && !isAnyLoading && <CheckCircle className="h-4 w-4" />}
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 overflow-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
          {/* React Instance Guard */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">React Guard</h3>
            <div className={`rounded p-2 text-xs font-mono flex items-center gap-2 ${
              reactGuard?.ok ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
            }`}>
              {reactGuard?.ok ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              <span>{reactGuard?.message || 'Checking...'}</span>
            </div>
            {reactGuard && !reactGuard.ok && (
              <div className="bg-destructive/5 rounded p-2 mt-1 text-xs">
                <div className="font-semibold text-destructive">⚠️ Multiple React instances detected!</div>
                <div className="text-muted-foreground">This causes React error #300</div>
              </div>
            )}
          </section>

          {/* Safe Mode Status */}
          {isSafeMode && (
            <section>
              <div className="bg-yellow-500/10 text-yellow-600 rounded p-2 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Safe Mode ativo - Blocos simplificados</span>
              </div>
            </section>
          )}

          {/* Auth Info */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Auth</h3>
            <div className="bg-muted rounded p-2 text-xs font-mono space-y-1">
              <Row label="authLoading" value={authLoading} />
              <Row label="userId" value={user?.id?.slice(0, 8) + '...' || 'null'} />
              <Row label="tenantId" value={currentTenant?.id?.slice(0, 8) + '...' || 'null'} />
              <Row label="tenantSlug" value={currentTenant?.slug || 'null'} />
            </div>
          </section>

          {/* Page Type */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Page</h3>
            <div className="bg-muted rounded p-2 text-xs font-mono">
              <Row label="editPageType" value={pageType} />
              {extraInfo && Object.entries(extraInfo).map(([key, value]) => (
                <Row key={key} label={key} value={value} />
              ))}
            </div>
          </section>

          {/* Queries Status */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Queries</h3>
            <div className="space-y-1">
              {queries.map((query, i) => (
                <QueryStatus key={i} query={query} />
              ))}
            </div>
          </section>

          {/* Supabase Errors */}
          {errors.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-destructive uppercase mb-1">
                Supabase Errors ({errors.length})
              </h3>
              <div className="bg-destructive/10 rounded p-2 text-xs font-mono space-y-2 max-h-32 overflow-auto">
                {errors.slice(-5).map((err, i) => (
                  <div key={i} className="border-b border-destructive/20 pb-1 last:border-0">
                    <div className="text-destructive/70">
                      [{err.operation}] {err.table && `${err.table}: `}
                    </div>
                    <div className="text-destructive">{err.error}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const displayValue = value === null || value === undefined ? 'null' : 
    typeof value === 'boolean' ? (value ? 'true' : 'false') : 
    String(value);
  
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={value === null || value === undefined || value === false ? 'text-yellow-600' : ''}>
        {displayValue}
      </span>
    </div>
  );
}

function QueryStatus({ query }: { query: DebugQueryState }) {
  let statusIcon;
  let statusColor;

  if (query.isError) {
    statusIcon = <XCircle className="h-3 w-3" />;
    statusColor = 'text-destructive';
  } else if (query.isLoading || query.isFetching) {
    statusIcon = <Loader2 className="h-3 w-3 animate-spin" />;
    statusColor = 'text-yellow-600';
  } else {
    statusIcon = <CheckCircle className="h-3 w-3" />;
    statusColor = 'text-green-600';
  }

  return (
    <div className="bg-muted rounded p-2 text-xs font-mono">
      <div className={`flex items-center gap-2 ${statusColor}`}>
        {statusIcon}
        <span className="font-medium">{query.name}</span>
      </div>
      <div className="ml-5 text-muted-foreground space-y-0.5 mt-1">
        {query.isLoading && <div>isLoading: true</div>}
        {query.isFetching && <div>isFetching: true</div>}
        {query.isError && (
          <div className="text-destructive">error: {query.error}</div>
        )}
        {query.dataCount !== undefined && (
          <div>count: {query.dataCount}</div>
        )}
        {query.dataPreview && (
          <div className="truncate max-w-48" title={query.dataPreview}>
            data: {query.dataPreview}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuilderDebugPanel;
