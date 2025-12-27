import { useState, useEffect } from 'react';
import { 
  Send, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  MessageCircle, 
  Mail 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TestResult {
  channel: 'email' | 'whatsapp';
  success: boolean;
  message: string;
}

interface SmokeTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmokeTestDialog({ open, onOpenChange }: SmokeTestDialogProps) {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [testEmail, setTestEmail] = useState(true);
  const [testWhatsapp, setTestWhatsapp] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  // Fetch tenants
  useEffect(() => {
    const fetchTenants = async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      setTenants(data || []);
    };
    if (open) {
      fetchTenants();
      setResults([]);
    }
  }, [open]);

  const handleTest = async () => {
    if (!selectedTenantId) {
      toast({ title: 'Erro', description: 'Selecione um tenant', variant: 'destructive' });
      return;
    }

    if (testEmail && !email) {
      toast({ title: 'Erro', description: 'Informe o email de destino', variant: 'destructive' });
      return;
    }

    if (testWhatsapp && !phone) {
      toast({ title: 'Erro', description: 'Informe o telefone de destino', variant: 'destructive' });
      return;
    }

    setIsTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test Email
      if (testEmail) {
        try {
          const { data, error } = await supabase.functions.invoke('send-test-email', {
            body: {
              tenant_id: selectedTenantId,
              to: email,
              subject: '[Smoke Test] Teste de Pipeline de Notificações',
              body: '<h1>Teste de Pipeline</h1><p>Esta mensagem confirma que o envio de email está funcionando corretamente.</p><p>Timestamp: ' + new Date().toISOString() + '</p>',
            },
          });

          if (error) throw error;

          testResults.push({
            channel: 'email',
            success: true,
            message: 'Email enviado com sucesso',
          });
        } catch (err: any) {
          testResults.push({
            channel: 'email',
            success: false,
            message: err.message || 'Erro ao enviar email',
          });
        }
      }

      // Test WhatsApp
      if (testWhatsapp) {
        try {
          const { data, error } = await supabase.functions.invoke('whatsapp-send', {
            body: {
              tenant_id: selectedTenantId,
              phone: phone,
              message: '🧪 *Smoke Test*\n\nEste é um teste do pipeline de notificações.\n\nTimestamp: ' + new Date().toISOString(),
            },
          });

          if (error) throw error;
          
          if (data?.success) {
            testResults.push({
              channel: 'whatsapp',
              success: true,
              message: 'WhatsApp enviado com sucesso',
            });
          } else {
            testResults.push({
              channel: 'whatsapp',
              success: false,
              message: data?.error || 'Erro desconhecido',
            });
          }
        } catch (err: any) {
          testResults.push({
            channel: 'whatsapp',
            success: false,
            message: err.message || 'Erro ao enviar WhatsApp',
          });
        }
      }

      setResults(testResults);

      const allSuccess = testResults.every(r => r.success);
      toast({
        title: allSuccess ? 'Testes concluídos' : 'Testes com falhas',
        description: allSuccess 
          ? 'Todas as mensagens foram enviadas' 
          : 'Verifique os resultados abaixo',
        variant: allSuccess ? 'default' : 'destructive',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Smoke Test - Pipeline de Notificações
          </DialogTitle>
          <DialogDescription>
            Teste o envio de notificações por email e WhatsApp para validar o pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="text-sm">
              Este teste envia mensagens reais para os destinatários informados.
              Use com moderação (rate limit aplicado).
            </AlertDescription>
          </Alert>

          {/* Tenant selector */}
          <div className="space-y-2">
            <Label>Tenant</Label>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channels */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="test-email" 
                checked={testEmail} 
                onCheckedChange={(checked) => setTestEmail(!!checked)} 
              />
              <label htmlFor="test-email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" /> Testar Email
              </label>
            </div>

            {testEmail && (
              <Input
                placeholder="email@destino.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="test-whatsapp" 
                checked={testWhatsapp} 
                onCheckedChange={(checked) => setTestWhatsapp(!!checked)} 
              />
              <label htmlFor="test-whatsapp" className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Testar WhatsApp
              </label>
            </div>

            {testWhatsapp && (
              <Input
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Resultados</Label>
              {results.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    {result.channel === 'email' ? (
                      <Mail className="h-4 w-4 text-blue-600" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    )}
                    <span className="text-sm capitalize">{result.channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant={result.success ? 'secondary' : 'destructive'}>
                      {result.success ? 'OK' : 'Falha'}
                    </Badge>
                  </div>
                </div>
              ))}
              {results.some(r => !r.success) && (
                <div className="text-xs text-destructive space-y-1">
                  {results.filter(r => !r.success).map((r, idx) => (
                    <p key={idx}>{r.channel}: {r.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button 
            onClick={handleTest} 
            disabled={isTesting || (!testEmail && !testWhatsapp)}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Executar Testes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
