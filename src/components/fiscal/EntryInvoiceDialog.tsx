import { useState, useEffect } from 'react';
import { ArrowDownLeft, Loader2, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, differenceInHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OperationNature {
  id: string;
  nome: string;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;
  tipo_documento: number;
}

interface EntryInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EntryInvoiceDialog({ open, onOpenChange, onSuccess }: EntryInvoiceDialogProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  const [chaveAcesso, setChaveAcesso] = useState('');
  const [searchingNfe, setSearchingNfe] = useState(false);
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [natures, setNatures] = useState<OperationNature[]>([]);
  const [selectedNature, setSelectedNature] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load entry natures (tipo_documento = 0)
  useEffect(() => {
    if (open && tenantId) {
      loadNatures();
    }
  }, [open, tenantId]);

  const loadNatures = async () => {
    const { data, error } = await supabase
      .from('fiscal_operation_natures')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('tipo_documento', 0)
      .eq('ativo', true)
      .order('nome');

    if (!error && data) {
      setNatures(data);
      // Auto-select "Devolução de Venda" if exists
      const devolucao = data.find(n => n.nome.toLowerCase().includes('devolução'));
      if (devolucao) {
        setSelectedNature(devolucao.id);
      } else if (data.length > 0) {
        setSelectedNature(data[0].id);
      }
    }
  };

  const handleSearchByChave = async () => {
    if (chaveAcesso.replace(/\D/g, '').length !== 44) {
      toast.error('Chave de acesso deve ter 44 dígitos');
      return;
    }

    setSearchingNfe(true);
    try {
      // First, search in our database
      const { data: localInvoice, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('chave_acesso', chaveAcesso.replace(/\D/g, ''))
        .eq('status', 'authorized')
        .maybeSingle();

      if (localInvoice) {
        // Check if can still cancel (within 24h)
        const authorizedAt = localInvoice.authorized_at || localInvoice.created_at;
        const hoursSinceAuth = differenceInHours(new Date(), parseISO(authorizedAt));
        
        setFoundInvoice({
          ...localInvoice,
          isLocal: true,
          canCancel: hoursSinceAuth <= 24,
          hoursSinceAuth,
        });
      } else {
        // NF-e not found locally - could search via SEFAZ/Focus NFe
        setFoundInvoice({
          chave_acesso: chaveAcesso.replace(/\D/g, ''),
          isLocal: false,
          dest_nome: 'NF-e não encontrada localmente',
        });
      }
    } catch (error) {
      console.error('Error searching invoice:', error);
      toast.error('Erro ao buscar NF-e');
    } finally {
      setSearchingNfe(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedNature || !foundInvoice) return;

    const nature = natures.find(n => n.id === selectedNature);
    if (!nature) {
      toast.error('Selecione uma natureza de operação');
      return;
    }

    setIsLoading(true);
    try {
      // Create entry invoice based on original
      const entryData = {
        natureza_operacao: nature.nome,
        tipo_documento: 0, // Entrada
        finalidade_emissao: 4, // Devolução
        nfe_referenciada: foundInvoice.chave_acesso,
        // Copy recipient data (which becomes the sender for entry)
        dest_nome: foundInvoice.dest_nome,
        dest_cpf_cnpj: foundInvoice.dest_cpf_cnpj,
        dest_inscricao_estadual: foundInvoice.dest_inscricao_estadual,
        dest_endereco_logradouro: foundInvoice.dest_endereco_logradouro,
        dest_endereco_numero: foundInvoice.dest_endereco_numero,
        dest_endereco_complemento: foundInvoice.dest_endereco_complemento,
        dest_endereco_bairro: foundInvoice.dest_endereco_bairro,
        dest_endereco_municipio: foundInvoice.dest_endereco_municipio,
        dest_endereco_uf: foundInvoice.dest_endereco_uf,
        dest_endereco_cep: foundInvoice.dest_endereco_cep,
        observacoes: observacoes || `Devolução referente à NF-e ${foundInvoice.chave_acesso}`,
        items: [], // Will need to fetch items from original
      };

      // If local invoice, fetch items
      if (foundInvoice.isLocal) {
        const { data: items } = await supabase
          .from('fiscal_invoice_items')
          .select('*')
          .eq('invoice_id', foundInvoice.id);

        if (items) {
          entryData.items = items.map((item: any) => ({
            codigo: item.codigo_produto,
            descricao: item.descricao,
            ncm: item.ncm,
            cfop: nature.cfop_intra, // Use entry CFOP
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            origem: item.origem,
            csosn: item.csosn,
          }));
        }
      }

      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: entryData,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar NF-e de entrada');

      toast.success('NF-e de entrada criada como rascunho');
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating entry invoice:', error);
      toast.error(error.message || 'Erro ao criar NF-e de entrada');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setChaveAcesso('');
    setFoundInvoice(null);
    setObservacoes('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-blue-500" />
            Nova NF-e de Entrada
          </DialogTitle>
          <DialogDescription>
            Crie uma NF-e de entrada para devolução ou outras operações
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search by access key */}
          <div className="space-y-2">
            <Label>Chave de Acesso da NF-e Original</Label>
            <div className="flex gap-2">
              <Input
                value={chaveAcesso}
                onChange={(e) => setChaveAcesso(e.target.value.replace(/\D/g, ''))}
                placeholder="44 dígitos da chave de acesso"
                maxLength={44}
                className="font-mono text-sm"
              />
              <Button 
                onClick={handleSearchByChave}
                disabled={searchingNfe || chaveAcesso.length !== 44}
              >
                {searchingNfe ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole a chave de acesso da NF-e original para criar a devolução
            </p>
          </div>

          {/* Found invoice info */}
          {foundInvoice && (
            <Card className={foundInvoice.isLocal ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{foundInvoice.dest_nome}</span>
                    {foundInvoice.isLocal && (
                      <Badge variant="outline" className="text-green-600">
                        NF-e Local
                      </Badge>
                    )}
                  </div>
                  {foundInvoice.isLocal && (
                    <>
                      <div className="text-sm text-muted-foreground">
                        NF-e {foundInvoice.serie}-{foundInvoice.numero} • {formatCurrency(foundInvoice.valor_total)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Emitida em {format(new Date(foundInvoice.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {foundInvoice.canCancel && (
                        <Alert className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Esta NF-e ainda pode ser cancelada (dentro de 24h). 
                            Considere cancelar ao invés de emitir devolução.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nature selection */}
          {foundInvoice && (
            <>
              <div className="space-y-2">
                <Label>Natureza da Operação</Label>
                <Select value={selectedNature} onValueChange={setSelectedNature}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a natureza" />
                  </SelectTrigger>
                  <SelectContent>
                    {natures.map((nature) => (
                      <SelectItem key={nature.id} value={nature.id}>
                        {nature.nome} (CFOP {nature.cfop_intra}/{nature.cfop_inter})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {natures.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Nenhuma natureza de entrada cadastrada. Cadastre em Configurações Fiscais.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais para a NF-e de entrada"
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateEntry} 
            disabled={!foundInvoice || !selectedNature || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar NF-e de Entrada'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
