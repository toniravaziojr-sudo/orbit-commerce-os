import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckoutData } from "@/pages/store/Checkout";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

interface CheckoutConfirmationStepProps {
  data: CheckoutData;
  tenantId: string;
  tenantSlug: string;
}

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  boleto: "Boleto Bancário",
  mercado_pago: "Mercado Pago",
};

export function CheckoutConfirmationStep({
  data,
  tenantId,
  tenantSlug,
}: CheckoutConfirmationStepProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const subtotal = data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal + data.shipping.price;

  const handleConfirmOrder = async () => {
    setLoading(true);

    try {
      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc("generate_order_number", { p_tenant_id: tenantId });

      if (orderNumberError) throw orderNumberError;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          tenant_id: tenantId,
          order_number: orderNumberData,
          customer_name: data.customer.name,
          customer_email: data.customer.email,
          customer_phone: data.customer.phone,
          shipping_street: data.address.street,
          shipping_number: data.address.number,
          shipping_complement: data.address.complement,
          shipping_neighborhood: data.address.neighborhood,
          shipping_city: data.address.city,
          shipping_state: data.address.state,
          shipping_postal_code: data.address.postalCode,
          shipping_carrier: data.shipping.carrier,
          shipping_total: data.shipping.price,
          payment_method: data.payment.method as any,
          subtotal: subtotal,
          total: total,
          status: "pending",
          payment_status: "pending",
          shipping_status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = data.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.name,
        product_image_url: item.image,
        sku: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      localStorage.removeItem(`cart_${tenantSlug}`);

      setOrderNumber(orderNumberData);
      setOrderCompleted(true);
      toast.success("Pedido realizado com sucesso!");
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Erro ao criar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (orderCompleted) {
    return (
      <div className="text-center py-8">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Pedido Confirmado!</h2>
        <p className="text-muted-foreground mb-4">
          Seu pedido <strong>{orderNumber}</strong> foi realizado com sucesso.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Enviamos os detalhes para <strong>{data.customer.email}</strong>
        </p>
        <Button onClick={() => navigate(`/store/${tenantSlug}`)}>
          Voltar para a Loja
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Order Items */}
      <div>
        <h3 className="font-medium mb-3">Itens do Pedido</h3>
        <div className="space-y-3">
          {data.items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Customer Info */}
      <div>
        <h3 className="font-medium mb-3">Dados do Cliente</h3>
        <div className="text-sm space-y-1">
          <p>{data.customer.name}</p>
          <p className="text-muted-foreground">{data.customer.email}</p>
          <p className="text-muted-foreground">{data.customer.phone}</p>
        </div>
      </div>

      <Separator />

      {/* Shipping Address */}
      <div>
        <h3 className="font-medium mb-3">Endereço de Entrega</h3>
        <div className="text-sm space-y-1">
          <p>
            {data.address.street}, {data.address.number}
            {data.address.complement && ` - ${data.address.complement}`}
          </p>
          <p className="text-muted-foreground">
            {data.address.neighborhood}, {data.address.city} -{" "}
            {data.address.state}
          </p>
          <p className="text-muted-foreground">CEP: {data.address.postalCode}</p>
        </div>
      </div>

      <Separator />

      {/* Shipping Method */}
      <div>
        <h3 className="font-medium mb-3">Frete</h3>
        <div className="flex justify-between text-sm">
          <span>{data.shipping.carrier}</span>
          <span>{formatPrice(data.shipping.price)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Entrega em até {data.shipping.estimatedDays} dias úteis
        </p>
      </div>

      <Separator />

      {/* Payment Method */}
      <div>
        <h3 className="font-medium mb-3">Forma de Pagamento</h3>
        <p className="text-sm">{paymentLabels[data.payment.method]}</p>
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Frete</span>
          <span>{formatPrice(data.shipping.price)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-2 border-t">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleConfirmOrder}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          "Confirmar Pedido"
        )}
      </Button>
    </div>
  );
}
