import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ShoppingCart, MapPin, CreditCard, CheckCircle } from "lucide-react";
import { CheckoutCartStep } from "@/components/store/checkout/CheckoutCartStep";
import { CheckoutAddressStep } from "@/components/store/checkout/CheckoutAddressStep";
import { CheckoutPaymentStep } from "@/components/store/checkout/CheckoutPaymentStep";
import { CheckoutConfirmationStep } from "@/components/store/checkout/CheckoutConfirmationStep";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

export interface CheckoutData {
  items: CartItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
  shipping: {
    method: string;
    carrier: string;
    price: number;
    estimatedDays: number;
  };
  payment: {
    method: string;
  };
}

const steps = [
  { id: "cart", label: "Carrinho", icon: ShoppingCart },
  { id: "address", label: "Endereço", icon: MapPin },
  { id: "payment", label: "Pagamento", icon: CreditCard },
  { id: "confirmation", label: "Confirmação", icon: CheckCircle },
];

export default function Checkout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    items: [],
    customer: { name: "", email: "", phone: "", cpf: "" },
    address: {
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      postalCode: "",
    },
    shipping: { method: "", carrier: "", price: 0, estimatedDays: 0 },
    payment: { method: "" },
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!tenantSlug) return;

      const { data } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", tenantSlug)
        .single();

      if (data) {
        setTenantId(data.id);
      }
      setLoading(false);
    };

    fetchTenant();
  }, [tenantSlug]);

  useEffect(() => {
    const cartKey = `cart_${tenantSlug}`;
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        setCheckoutData((prev) => ({ ...prev, items: cart.items || [] }));
      } catch {
        // Cart empty or invalid
      }
    }
  }, [tenantSlug]);

  const updateCheckoutData = (data: Partial<CheckoutData>) => {
    setCheckoutData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const subtotal = checkoutData.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal + checkoutData.shipping.price;

  const progressValue = ((currentStep + 1) / steps.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (checkoutData.items.length === 0 && currentStep === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Carrinho vazio</h1>
            <p className="text-muted-foreground mb-4">
              Adicione produtos ao carrinho para continuar.
            </p>
            <Button onClick={() => navigate(`/store/${tenantSlug}`)}>
              Voltar para a loja
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                currentStep === 0
                  ? navigate(`/store/${tenantSlug}`)
                  : prevStep()
              }
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold ml-2">Checkout</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Progress */}
        <div className="mb-8">
          <Progress value={progressValue} className="h-2 mb-4" />
          <div className="flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-primary/60"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-primary/20"
                        : "bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs hidden sm:block">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{steps[currentStep].label}</CardTitle>
              </CardHeader>
              <CardContent>
                {currentStep === 0 && (
                  <CheckoutCartStep
                    items={checkoutData.items}
                    tenantSlug={tenantSlug!}
                    onUpdate={(items) => updateCheckoutData({ items })}
                    onNext={nextStep}
                  />
                )}
                {currentStep === 1 && (
                  <CheckoutAddressStep
                    data={checkoutData}
                    onUpdate={updateCheckoutData}
                    onNext={nextStep}
                    onBack={prevStep}
                  />
                )}
                {currentStep === 2 && (
                  <CheckoutPaymentStep
                    data={checkoutData}
                    onUpdate={updateCheckoutData}
                    onNext={nextStep}
                    onBack={prevStep}
                  />
                )}
                {currentStep === 3 && (
                  <CheckoutConfirmationStep
                    data={checkoutData}
                    tenantId={tenantId!}
                    tenantSlug={tenantSlug!}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  {checkoutData.items.slice(0, 3).map((item) => (
                    <div key={item.productId} className="flex justify-between">
                      <span className="truncate flex-1">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="ml-2">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {checkoutData.items.length > 3 && (
                    <p className="text-muted-foreground">
                      +{checkoutData.items.length - 3} itens
                    </p>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span>
                      {checkoutData.shipping.price > 0
                        ? new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(checkoutData.shipping.price)
                        : "A calcular"}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(total)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
