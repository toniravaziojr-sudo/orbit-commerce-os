import { AlertTriangle, ArrowRight, Package, User, MapPin, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FiscalError {
  type: 'missing_ncm' | 'missing_ibge' | 'invalid_document' | 'missing_address' | 'missing_field' | 'unknown';
  message: string;
  productId?: string;
  productName?: string;
  invoiceId?: string;
  field?: string;
}

interface FiscalErrorResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: FiscalError[];
  orderId?: string;
  invoiceId?: string;
  onRetry?: () => void;
}

function parseErrorMessage(errorMessage: string): FiscalError[] {
  const errors: FiscalError[] = [];
  
  // Check for missing NCM
  if (errorMessage.includes('NCM') || errorMessage.includes('ncm')) {
    const match = errorMessage.match(/Produtos sem NCM[^:]*:\s*(.+?)(?:\.|$)/i);
    if (match) {
      const products = match[1].split(',').map(p => p.trim());
      products.forEach(productName => {
        errors.push({
          type: 'missing_ncm',
          message: `O produto "${productName}" não possui NCM cadastrado`,
          productName,
        });
      });
    } else {
      errors.push({
        type: 'missing_ncm',
        message: 'Um ou mais produtos não possuem NCM cadastrado',
      });
    }
  }
  
  // Check for IBGE code issues
  if (errorMessage.includes('IBGE') || errorMessage.includes('município')) {
    errors.push({
      type: 'missing_ibge',
      message: 'Código IBGE do município não encontrado. Verifique o endereço do destinatário.',
    });
  }
  
  // Check for document issues
  if (errorMessage.includes('CPF') || errorMessage.includes('CNPJ') || errorMessage.includes('documento')) {
    errors.push({
      type: 'invalid_document',
      message: 'CPF/CNPJ do destinatário inválido ou não informado',
    });
  }
  
  // Check for address issues
  if (errorMessage.includes('endereço') || errorMessage.includes('CEP') || errorMessage.includes('address')) {
    errors.push({
      type: 'missing_address',
      message: 'Endereço do destinatário incompleto ou inválido',
    });
  }
  
  // If no specific errors were found, add a generic one
  if (errors.length === 0) {
    errors.push({
      type: 'unknown',
      message: errorMessage || 'Ocorreu um erro desconhecido',
    });
  }
  
  return errors;
}

const ERROR_ICONS = {
  missing_ncm: Package,
  missing_ibge: MapPin,
  invalid_document: User,
  missing_address: MapPin,
  missing_field: FileText,
  unknown: AlertTriangle,
};

const ERROR_ACTIONS = {
  missing_ncm: {
    label: 'Configurar NCM',
    path: '/fiscal/products',
  },
  missing_ibge: {
    label: 'Editar Endereço',
    path: null, // Will open invoice editor
  },
  invalid_document: {
    label: 'Corrigir Documento',
    path: null, // Will open invoice editor
  },
  missing_address: {
    label: 'Completar Endereço',
    path: null,
  },
  missing_field: {
    label: 'Completar Dados',
    path: null,
  },
  unknown: {
    label: 'Ver Detalhes',
    path: null,
  },
};

export function FiscalErrorResolver({
  open,
  onOpenChange,
  errors,
  orderId,
  invoiceId,
  onRetry,
}: FiscalErrorResolverProps) {
  const navigate = useNavigate();

  const handleAction = (error: FiscalError) => {
    const action = ERROR_ACTIONS[error.type];
    
    if (action.path) {
      // Navigate to specific page
      const params = new URLSearchParams();
      if (error.productName) params.set('search', error.productName);
      if (error.productId) params.set('product', error.productId);
      navigate(`${action.path}?${params.toString()}`);
      onOpenChange(false);
    } else if (invoiceId) {
      // Open invoice editor
      navigate(`/fiscal?invoice=${invoiceId}&edit=true`);
      onOpenChange(false);
    } else if (orderId) {
      // Go to order detail
      navigate(`/orders/${orderId}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Erros ao Emitir NF-e
          </DialogTitle>
          <DialogDescription>
            Foram encontrados problemas que precisam ser corrigidos antes de emitir a NF-e.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {errors.map((error, index) => {
            const Icon = ERROR_ICONS[error.type];
            const action = ERROR_ACTIONS[error.type];
            
            return (
              <Card key={index} className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                      <Icon className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {error.type === 'missing_ncm' ? 'Produto' : 
                           error.type === 'missing_ibge' ? 'Endereço' :
                           error.type === 'invalid_document' ? 'Documento' :
                           error.type === 'missing_address' ? 'Endereço' :
                           'Erro'}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{error.message}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(error)}
                      className="shrink-0"
                    >
                      {action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onRetry && (
            <Button onClick={onRetry}>
              Tentar Novamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export the parse function for use in other components
export { parseErrorMessage };
