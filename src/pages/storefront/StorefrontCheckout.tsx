import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type CheckoutStep = 'identification' | 'address' | 'review' | 'confirmation';

interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

interface AddressData {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
}

export default function StorefrontCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { storeSettings } = usePublicStorefront(tenantSlug || '');
  const { items, subtotal, clearCart } = useCart(tenantSlug || '');
  const { toast } = useToast();

  const [step, setStep] = useState<CheckoutStep>('identification');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>({
    name: '',
    email: '',
    phone: '',
  });
  const [address, setAddress] = useState<AddressData>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
  });

  const baseUrl = `/store/${tenantSlug}`;
  const primaryColor = storeSettings?.primary_color || '#6366f1';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const steps: { key: CheckoutStep; label: string }[] = [
    { key: 'identification', label: 'Identificação' },
    { key: 'address', label: 'Endereço' },
    { key: 'review', label: 'Revisão' },
    { key: 'confirmation', label: 'Confirmação' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  const handleNextStep = () => {
    const stepIndex = steps.findIndex((s) => s.key === step);
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1].key);
    }
  };

  const handlePrevStep = () => {
    const stepIndex = steps.findIndex((s) => s.key === step);
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1].key);
    }
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);

    // Mock order submission - replace with real implementation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: 'Pedido realizado!',
      description: 'Seu pedido foi recebido e está sendo processado.',
    });

    clearCart();
    setStep('confirmation');
    setIsSubmitting(false);
  };

  if (items.length === 0 && step !== 'confirmation') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Carrinho vazio</h1>
        <p className="text-gray-600 mb-6">Adicione produtos antes de finalizar a compra.</p>
        <Link to={baseUrl}>
          <Button style={{ backgroundColor: primaryColor }} className="text-white">
            Ver Produtos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Progress */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div
              key={s.key}
              className="flex items-center"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                style={index <= currentStepIndex ? { backgroundColor: primaryColor } : {}}
              >
                {index < currentStepIndex ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:block ${
                  index <= currentStepIndex ? 'font-medium text-gray-900' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-0.5 mx-2 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-gray-200'
                  }`}
                  style={index < currentStepIndex ? { backgroundColor: primaryColor } : {}}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Identification Step */}
        {step === 'identification' && (
          <Card>
            <CardHeader>
              <CardTitle>Seus Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Digite seu nome"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="Digite seu e-mail"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Link to={`${baseUrl}/cart`}>
                  <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Carrinho
                  </Button>
                </Link>
                <Button
                  onClick={handleNextStep}
                  disabled={!customer.name || !customer.email}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Address Step */}
        {step === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle>Endereço de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="postal_code">CEP</Label>
                <Input
                  id="postal_code"
                  value={address.postal_code}
                  onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                    placeholder="Nome da rua"
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={address.number}
                    onChange={(e) => setAddress({ ...address, number: e.target.value })}
                    placeholder="123"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  placeholder="Apto, bloco, etc."
                />
              </div>
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                  placeholder="Nome do bairro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Nome da cidade"
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrevStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleNextStep}
                  disabled={!address.street || !address.city || !address.state}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <Card>
            <CardHeader>
              <CardTitle>Revise seu Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Dados do Cliente</h4>
                <p className="text-sm text-gray-600">{customer.name}</p>
                <p className="text-sm text-gray-600">{customer.email}</p>
                <p className="text-sm text-gray-600">{customer.phone}</p>
              </div>

              {/* Address */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Endereço de Entrega</h4>
                <p className="text-sm text-gray-600">
                  {address.street}, {address.number}
                  {address.complement && ` - ${address.complement}`}
                </p>
                <p className="text-sm text-gray-600">
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                <p className="text-sm text-gray-600">CEP: {address.postal_code}</p>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Produtos</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(subtotal)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={handlePrevStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Confirmar Pedido
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Step */}
        {step === 'confirmation' && (
          <Card className="text-center">
            <CardContent className="py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Check className="h-8 w-8" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Pedido Realizado!
              </h2>
              <p className="text-gray-600 mb-6">
                Obrigado por sua compra. Você receberá um e-mail de confirmação em breve.
              </p>
              <Link to={baseUrl}>
                <Button style={{ backgroundColor: primaryColor }} className="text-white">
                  Continuar Comprando
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
