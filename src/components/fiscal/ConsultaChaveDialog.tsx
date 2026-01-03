import { useState } from 'react';
import { Search, Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConsultaChaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConsultaResult {
  status: string;
  chave_acesso: string;
  numero?: number;
  serie?: number;
  data_emissao?: string;
  valor_total?: number;
  dest_nome?: string;
  protocolo?: string;
  motivo?: string;
  isLocal?: boolean;
  localId?: string;
}

export function ConsultaChaveDialog({ open, onOpenChange }: ConsultaChaveDialogProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  const [chaveAcesso, setChaveAcesso] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ConsultaResult | null>(null);

  const handleSearch = async () => {
    const cleanChave = chaveAcesso.replace(/\D/g, '');
    
    if (cleanChave.length !== 44) {
      toast.error('Chave de acesso deve ter 44 dígitos');
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      // First, search locally
      const { data: localInvoice, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('chave_acesso', cleanChave)
        .maybeSingle();

      if (localInvoice) {
        setResult({
          status: localInvoice.status,
          chave_acesso: cleanChave,
          numero: localInvoice.numero,
          serie: localInvoice.serie,
          data_emissao: localInvoice.created_at,
          valor_total: localInvoice.valor_total,
          dest_nome: localInvoice.dest_nome,
          protocolo: localInvoice.protocolo,
          motivo: localInvoice.status_motivo,
          isLocal: true,
          localId: localInvoice.id,
        });
      } else {
        // Could query Focus NFe API here
        // For now, show as not found locally
        setResult({
          status: 'not_found',
          chave_acesso: cleanChave,
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Erro ao consultar NF-e');
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: React.ElementType }> = {
      authorized: { label: 'Autorizada', variant: 'default', icon: CheckCircle },
      cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
      canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
      rejected: { label: 'Rejeitada', variant: 'destructive', icon: XCircle },
      pending: { label: 'Processando', variant: 'secondary', icon: Loader2 },
      draft: { label: 'Rascunho', variant: 'outline', icon: AlertTriangle },
      not_found: { label: 'Não Encontrada', variant: 'secondary', icon: AlertTriangle },
    };
    return configs[status] || { label: status, variant: 'outline' as const, icon: AlertTriangle };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatChave = (chave: string) => {
    // Format as: XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX
    return chave.match(/.{1,4}/g)?.join(' ') || chave;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Consultar NF-e por Chave
          </DialogTitle>
          <DialogDescription>
            Cole a chave de acesso de 44 dígitos para consultar o status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="chave">Chave de Acesso</Label>
            <div className="flex gap-2">
              <Input
                id="chave"
                value={chaveAcesso}
                onChange={(e) => setChaveAcesso(e.target.value.replace(/\D/g, ''))}
                placeholder="44 dígitos da chave de acesso"
                maxLength={44}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleSearch}
                disabled={isSearching || chaveAcesso.replace(/\D/g, '').length !== 44}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Caracteres: {chaveAcesso.length}/44
            </p>
          </div>

          {result && (
            <Card className={result.status === 'authorized' ? 'border-green-500/30' : 'border-muted'}>
              <CardContent className="p-4 space-y-3">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  {(() => {
                    const config = getStatusConfig(result.status);
                    const Icon = config.icon;
                    return (
                      <Badge variant={config.variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Chave */}
                <div>
                  <span className="text-xs text-muted-foreground">Chave de Acesso</span>
                  <p className="font-mono text-xs break-all">{formatChave(result.chave_acesso)}</p>
                </div>

                {result.status !== 'not_found' && (
                  <>
                    {/* NF-e Number */}
                    {result.numero && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">NF-e</span>
                        <span className="text-sm font-medium">{result.serie}-{result.numero}</span>
                      </div>
                    )}

                    {/* Recipient */}
                    {result.dest_nome && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Destinatário</span>
                        <span className="text-sm font-medium truncate max-w-[200px]">{result.dest_nome}</span>
                      </div>
                    )}

                    {/* Value */}
                    {result.valor_total && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Valor Total</span>
                        <span className="text-sm font-medium">{formatCurrency(result.valor_total)}</span>
                      </div>
                    )}

                    {/* Date */}
                    {result.data_emissao && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Data de Emissão</span>
                        <span className="text-sm">
                          {format(new Date(result.data_emissao), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {/* Protocol */}
                    {result.protocolo && (
                      <div>
                        <span className="text-xs text-muted-foreground">Protocolo</span>
                        <p className="font-mono text-xs">{result.protocolo}</p>
                      </div>
                    )}

                    {/* Reason (for rejected/cancelled) */}
                    {result.motivo && (
                      <div>
                        <span className="text-xs text-muted-foreground">Motivo</span>
                        <p className="text-sm text-destructive">{result.motivo}</p>
                      </div>
                    )}

                    {result.isLocal && (
                      <div className="pt-2 border-t">
                        <Badge variant="outline" className="text-xs">
                          NF-e encontrada no sistema
                        </Badge>
                      </div>
                    )}
                  </>
                )}

                {result.status === 'not_found' && (
                  <div className="text-center py-4">
                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      NF-e não encontrada no sistema local.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A NF-e pode existir em outro sistema ou ainda não foi sincronizada.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
