import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function AddPaymentMethod() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { subscription, refetch } = useSubscriptionStatus();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentTenant?.id) {
      toast.error('Tenant não encontrado');
      return;
    }

    // Validações básicas
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      toast.error('Número do cartão inválido');
      return;
    }

    if (cardHolder.length < 3) {
      toast.error('Nome do titular inválido');
      return;
    }

    if (!expiryMonth || !expiryYear || cvv.length < 3) {
      toast.error('Preencha todos os campos do cartão');
      return;
    }

    setLoading(true);

    try {
      // Chamar edge function para processar cartão
      const response = await supabase.functions.invoke('billing-add-payment-method', {
        body: {
          tenant_id: currentTenant.id,
          card_data: {
            number: cleanCardNumber,
            holder_name: cardHolder,
            exp_month: expiryMonth,
            exp_year: expiryYear,
            cvv: cvv,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao processar cartão');
      }

      setSuccess(true);
      toast.success('Cartão cadastrado com sucesso!');
      
      // Refetch subscription status
      await refetch();
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      toast.error(error.message || 'Erro ao cadastrar cartão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Se já tem método de pagamento
  if (subscription?.hasPaymentMethod && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle>Você já tem um cartão cadastrado</CardTitle>
              <CardDescription>
                {subscription.cardBrand} terminado em {subscription.cardLastFour}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => navigate('/')} className="w-full">
                Voltar para o painel
              </Button>
              <Button variant="outline" onClick={() => {/* TODO: trocar cartão */}} className="w-full">
                Trocar cartão
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <CardTitle className="text-center mb-2">Cartão cadastrado!</CardTitle>
                <CardDescription className="text-center mb-4">
                  Agora você pode publicar sua loja e usar todas as funcionalidades.
                </CardDescription>
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground mt-2">Redirecionando...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Cadastrar cartão de crédito</CardTitle>
            <CardDescription>
              {subscription?.isBasicPlan 
                ? 'Necessário para publicar sua loja e receber cobranças da taxa sobre vendas.'
                : 'Cadastre seu cartão para ativar sua assinatura.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Número do cartão</Label>
                <Input
                  id="cardNumber"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardHolder">Nome no cartão</Label>
                <Input
                  id="cardHolder"
                  placeholder="Como está escrito no cartão"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expiryMonth">Mês</Label>
                  <Input
                    id="expiryMonth"
                    placeholder="MM"
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    maxLength={2}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryYear">Ano</Label>
                  <Input
                    id="expiryYear"
                    placeholder="AA"
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    maxLength={2}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="000"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    type="password"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Cadastrar cartão
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Dados criptografados e processados pelo Mercado Pago</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ao cadastrar seu cartão, você concorda com os{' '}
          <a href="/termos" className="underline">termos de serviço</a> e{' '}
          <a href="/privacidade" className="underline">política de privacidade</a>.
        </p>
      </div>
    </div>
  );
}
