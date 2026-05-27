import { useState, useEffect } from 'react';
import { ArrowDownLeft, Loader2, Search, AlertTriangle, Package, RotateCcw, Truck, ArrowLeftRight, FileText } from 'lucide-react';
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
import { showErrorToast } from '@/lib/error-toast';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, differenceInHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SupplierAutocomplete, type SupplierContact } from '@/components/suppliers/SupplierAutocomplete';

interface OperationNature {
  id: string;
  nome: string;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;
  tipo_documento: number;
}

export type EntryInvoiceType = 'devolucao' | 'compra' | 'remessa' | 'transferencia' | 'outros';

interface EntryTypeOption {
  value: EntryInvoiceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  finalidade_emissao: number; // 1=Normal, 4=Devolução
  requiresReferenceNfe: boolean;
}

const ENTRY_TYPES: EntryTypeOption[] = [
  {
    value: 'devolucao',
    label: 'Devolução',
    description: 'Devolução de mercadoria recebida',
    icon: <RotateCcw className="h-4 w-4" />,
    finalidade_emissao: 4,
    requiresReferenceNfe: true,
  },
  {
    value: 'compra',
    label: 'Compra',
    description: 'Entrada de mercadoria por compra',
    icon: <Package className="h-4 w-4" />,
    finalidade_emissao: 1,
    requiresReferenceNfe: false,
  },
  {
    value: 'remessa',
    label: 'Remessa',
    description: 'Retorno de remessa, conserto ou demonstração',
    icon: <Truck className="h-4 w-4" />,
    finalidade_emissao: 1,
    requiresReferenceNfe: false,
  },
  {
    value: 'transferencia',
    label: 'Transferência',
    description: 'Transferência entre filiais ou depósitos',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    finalidade_emissao: 1,
    requiresReferenceNfe: false,
  },
  {
    value: 'outros',
    label: 'Outros',
    description: 'Outras operações de entrada',
    icon: <FileText className="h-4 w-4" />,
    finalidade_emissao: 1,
    requiresReferenceNfe: false,
  },
];

interface EntryInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialChaveAcesso?: string;
}

export function EntryInvoiceDialog({ open, onOpenChange, onSuccess, initialChaveAcesso }: EntryInvoiceDialogProps) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  const [entryType, setEntryType] = useState<EntryInvoiceType>(initialChaveAcesso ? 'devolucao' : 'compra');
  const [chaveAcesso, setChaveAcesso] = useState(initialChaveAcesso || '');
  const [searchingNfe, setSearchingNfe] = useState(false);
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [natures, setNatures] = useState<OperationNature[]>([]);
  const [selectedNature, setSelectedNature] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Supplier contact (search base + manual fallback + save to base)
  const [supplier, setSupplier] = useState<SupplierContact>({ id: null, name: '', document: '' });

  const selectedEntryType = ENTRY_TYPES.find(t => t.value === entryType)!;

  // Sync initialChaveAcesso when dialog opens
  useEffect(() => {
    if (open && initialChaveAcesso) {
      setChaveAcesso(initialChaveAcesso);
      setEntryType('devolucao');
    }
  }, [open, initialChaveAcesso]);

  // Auto-search when initialChaveAcesso is provided
  useEffect(() => {
    if (open && initialChaveAcesso && initialChaveAcesso.length === 44 && tenantId && !foundInvoice) {
      handleSearchByChave();
    }
  }, [open, initialChaveAcesso, tenantId]);

  // Load entry natures (tipo_documento = 0)
  useEffect(() => {
    if (open && tenantId) {
      loadNatures();
    }
  }, [open, tenantId]);

  // Auto-select nature based on entry type
  useEffect(() => {
    if (natures.length === 0) return;
    
    const typeKeywords: Record<EntryInvoiceType, string[]> = {
      devolucao: ['devolução', 'devolucao'],
      compra: ['compra', 'aquisição', 'aquisicao'],
      remessa: ['remessa', 'retorno', 'conserto', 'demonstração'],
      transferencia: ['transferência', 'transferencia'],
      outros: [],
    };

    const keywords = typeKeywords[entryType];
    const match = natures.find(n => 
      keywords.some(kw => n.nome.toLowerCase().includes(kw))
    );
    
    if (match) {
      setSelectedNature(match.id);
    } else if (natures.length > 0) {
      setSelectedNature(natures[0].id);
    }
  }, [entryType, natures]);

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
    }
  };

  const handleSearchByChave = async () => {
    if (chaveAcesso.replace(/\D/g, '').length !== 44) {
      toast.error('Chave de acesso deve ter 44 dígitos');
      return;
    }

    setSearchingNfe(true);
    try {
      const { data: localInvoice } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('chave_acesso', chaveAcesso.replace(/\D/g, ''))
        .eq('status', 'authorized')
        .maybeSingle();

      if (localInvoice) {
        const authorizedAt = localInvoice.authorized_at || localInvoice.created_at;
        const hoursSinceAuth = differenceInHours(new Date(), parseISO(authorizedAt));
        
        setFoundInvoice({
          ...localInvoice,
          isLocal: true,
          canCancel: hoursSinceAuth <= 24,
          hoursSinceAuth,
        });
      } else {
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
    if (!selectedNature) return;
    
    // For types that require reference, must have found invoice
    if (selectedEntryType.requiresReferenceNfe && !foundInvoice) return;
    // For types that don't require reference, must have supplier name
    if (!selectedEntryType.requiresReferenceNfe && !supplier.name.trim()) {
      toast.error('Informe o remetente/fornecedor');
      return;
    }

    const nature = natures.find(n => n.id === selectedNature);
    if (!nature) {
      toast.error('Selecione uma natureza de operação');
      return;
    }

    setIsLoading(true);
    try {
      // NF de Entrada SEMPRE nasce em modo 'nfe_manual' (aba Notas Fiscais),
      // NUNCA como Pedido de Venda. O destinatário precisa vir aninhado
      // (contrato da edge fiscal-create-manual).
      const buildEndereco = (src: any) => ({
        logradouro: src.dest_endereco_logradouro || src.logradouro || '',
        numero: src.dest_endereco_numero || src.numero || '',
        complemento: src.dest_endereco_complemento || src.complemento || '',
        bairro: src.dest_endereco_bairro || src.bairro || '',
        municipio: src.dest_endereco_municipio || src.cidade || '',
        uf: src.dest_endereco_uf || src.uf || '',
        cep: src.dest_endereco_cep || src.cep || '',
      });

      let destinatario: any;
      let itens: any[] = [];
      let nfeReferenciada: string | undefined;
      let obsFinal = observacoes;

      if (selectedEntryType.requiresReferenceNfe && foundInvoice) {
        // Devolução: copia destinatário e itens da NF original.
        destinatario = {
          nome: foundInvoice.dest_nome,
          cpf_cnpj: foundInvoice.dest_cpf_cnpj,
          inscricao_estadual: foundInvoice.dest_inscricao_estadual,
          endereco: buildEndereco(foundInvoice),
        };
        nfeReferenciada = foundInvoice.chave_acesso;
        obsFinal = observacoes || `Devolução referente à NF-e ${foundInvoice.chave_acesso}`;

        if (foundInvoice.isLocal) {
          const { data: items } = await supabase
            .from('fiscal_invoice_items')
            .select('*')
            .eq('invoice_id', foundInvoice.id);

          if (items) {
            itens = items.map((item: any, idx: number) => ({
              numero_item: idx + 1,
              codigo: item.codigo_produto,
              descricao: item.descricao,
              ncm: item.ncm,
              cfop: nature.cfop_intra,
              unidade: item.unidade,
              quantidade: item.quantidade,
              valor_unitario: item.valor_unitario,
              origem: item.origem,
              csosn: item.csosn,
            }));
          }
        }
      } else {
        // Compra, remessa, transferência, outros: remetente do contato.
        destinatario = {
          nome: supplier.name,
          cpf_cnpj: supplier.document || '',
          inscricao_estadual: supplier.ie || undefined,
          endereco: buildEndereco(supplier),
        };
        obsFinal = observacoes || `NF-e de Entrada - ${selectedEntryType.label}`;
        const chaveDigits = chaveAcesso.replace(/\D/g, '');
        if (chaveDigits.length === 44) nfeReferenciada = chaveDigits;
      }

      const entryData: any = {
        mode: 'nfe_manual',
        natureza_operacao_id: nature.id,
        natureza_operacao: nature.nome,
        destinatario,
        itens,
        observacoes: obsFinal,
      };
      if (nfeReferenciada) entryData.nfe_referenciada = nfeReferenciada;

      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: entryData,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar NF-e de entrada');

      // Fase D: NF de Compra vinculada a fornecedor cadastrado gera registro em Compras.
      if (entryType === 'compra' && supplier.id && data?.invoice?.id) {
        try {
          const orderNumber = `NF-${(data.invoice.numero ?? Date.now().toString().slice(-6))}`;
          const { error: purchaseErr } = await supabase.from('purchases').insert({
            tenant_id: data.invoice.tenant_id,
            supplier_id: supplier.id,
            order_number: orderNumber,
            status: 'pending',
            total_value: Number(data.invoice.valor_total ?? 0),
            entry_invoice_id: data.invoice.id,
            description: `Gerado automaticamente pela NF-e de Compra (${data.invoice.chave_acesso ?? data.invoice.id})`,
          } as any);
          if (purchaseErr) {
            console.warn('[EntryInvoiceDialog] purchase auto-create failed:', purchaseErr);
            toast.warning('NF criada. Compra não pôde ser gerada automaticamente — registre manualmente em Compras.');
          } else {
            toast.success('NF de Compra criada e registro adicionado ao módulo Compras.');
          }
        } catch (e) {
          console.warn('[EntryInvoiceDialog] purchase auto-create exception:', e);
        }
      } else {
        toast.success('NF-e de entrada criada como rascunho');
      }
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      showErrorToast(error, { module: 'fiscal', action: 'criar NF-e de entrada' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setChaveAcesso('');
    setFoundInvoice(null);
    setObservacoes('');
    setSupplier({ id: null, name: '', document: '' });
    if (!initialChaveAcesso) {
      setEntryType('compra');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const canSubmit = () => {
    if (!selectedNature) return false;
    if (selectedEntryType.requiresReferenceNfe) return !!foundInvoice;
    return !!supplier.name.trim();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-blue-500" />
            Nova NF-e de Entrada
          </DialogTitle>
          <DialogDescription>
            Selecione o tipo de operação e preencha os dados necessários
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entry Type Selection */}
          <div className="space-y-2">
            <Label>Tipo de Entrada</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ENTRY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setEntryType(type.value);
                    setFoundInvoice(null);
                    setChaveAcesso('');
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors hover:bg-accent ${
                    entryType === type.value 
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20' 
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {type.icon}
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedEntryType.description}
            </p>
          </div>

          {/* Reference NF-e (required for devolução, optional for others) */}
          {selectedEntryType.requiresReferenceNfe ? (
            <div className="space-y-2">
              <Label>Chave de Acesso da NF-e Original *</Label>
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
                Informe a chave de acesso da NF-e que originou a devolução
              </p>
            </div>
          ) : (
            <>
              {/* Remetente / Fornecedor (busca + manual + salvar na base) */}
              <SupplierAutocomplete
                value={supplier}
                onChange={setSupplier}
                label="Remetente / Fornecedor"
                required
              />

              {/* Optional reference key */}
              <div className="space-y-2">
                <Label>Chave de Acesso (opcional)</Label>
                <Input
                  value={chaveAcesso}
                  onChange={(e) => setChaveAcesso(e.target.value.replace(/\D/g, ''))}
                  placeholder="Chave da NF-e de referência, se houver"
                  maxLength={44}
                  className="font-mono text-sm"
                />
              </div>
            </>
          )}

          {/* Found invoice info (for devolução) */}
          {foundInvoice && selectedEntryType.requiresReferenceNfe && (
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

          {/* Nature selection - always visible when ready */}
          {(foundInvoice || !selectedEntryType.requiresReferenceNfe) && (
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
            disabled={!canSubmit() || isLoading}
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
