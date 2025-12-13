import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckoutData } from "@/pages/store/Checkout";
import { CreditCard, QrCode, FileText, Wallet } from "lucide-react";

interface CheckoutPaymentStepProps {
  data: CheckoutData;
  onUpdate: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const paymentMethods = [
  {
    id: "pix",
    label: "PIX",
    description: "Pagamento instantâneo",
    icon: QrCode,
  },
  {
    id: "credit_card",
    label: "Cartão de Crédito",
    description: "Parcele em até 12x",
    icon: CreditCard,
  },
  {
    id: "boleto",
    label: "Boleto Bancário",
    description: "Vencimento em 3 dias úteis",
    icon: FileText,
  },
  {
    id: "mercado_pago",
    label: "Mercado Pago",
    description: "Pague com sua conta",
    icon: Wallet,
  },
];

export function CheckoutPaymentStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: CheckoutPaymentStepProps) {
  const [selectedMethod, setSelectedMethod] = useState(data.payment.method);
  const [error, setError] = useState("");

  const selectPayment = (methodId: string) => {
    setSelectedMethod(methodId);
    setError("");
    onUpdate({
      payment: { method: methodId },
    });
  };

  const handleNext = () => {
    if (!selectedMethod) {
      setError("Selecione uma forma de pagamento");
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-medium">Forma de Pagamento</h3>

        <RadioGroup value={selectedMethod} onValueChange={selectPayment}>
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedMethod === method.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={method.id} />
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      selectedMethod === method.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {method.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </RadioGroup>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {selectedMethod === "pix" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Após confirmar o pedido, você receberá um QR Code para pagamento
              via PIX. O pagamento é confirmado instantaneamente.
            </p>
          </div>
        )}

        {selectedMethod === "credit_card" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para um ambiente seguro para inserir os
              dados do seu cartão de crédito.
            </p>
          </div>
        )}

        {selectedMethod === "boleto" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              O boleto será gerado após a confirmação do pedido. O prazo de
              compensação é de até 3 dias úteis após o pagamento.
            </p>
          </div>
        )}

        {selectedMethod === "mercado_pago" && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para o Mercado Pago para finalizar o
              pagamento com sua conta ou outros métodos disponíveis.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleNext}>Revisar Pedido</Button>
      </div>
    </div>
  );
}
