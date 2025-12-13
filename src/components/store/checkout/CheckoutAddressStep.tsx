import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckoutData } from "@/pages/store/Checkout";
import { Truck } from "lucide-react";

interface CheckoutAddressStepProps {
  data: CheckoutData;
  onUpdate: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// Mock shipping options - will be replaced with real API
const shippingOptions = [
  { id: "pac", carrier: "Correios PAC", price: 25.90, days: 8 },
  { id: "sedex", carrier: "Correios SEDEX", price: 45.90, days: 3 },
  { id: "loggi", carrier: "Loggi Express", price: 35.50, days: 5 },
];

export function CheckoutAddressStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: CheckoutAddressStepProps) {
  const [selectedShipping, setSelectedShipping] = useState(
    data.shipping.method || ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateCustomer = (field: string, value: string) => {
    onUpdate({
      customer: { ...data.customer, [field]: value },
    });
  };

  const updateAddress = (field: string, value: string) => {
    onUpdate({
      address: { ...data.address, [field]: value },
    });
  };

  const selectShipping = (optionId: string) => {
    const option = shippingOptions.find((opt) => opt.id === optionId);
    if (option) {
      setSelectedShipping(optionId);
      onUpdate({
        shipping: {
          method: optionId,
          carrier: option.carrier,
          price: option.price,
          estimatedDays: option.days,
        },
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!data.customer.name) newErrors.name = "Nome é obrigatório";
    if (!data.customer.email) newErrors.email = "E-mail é obrigatório";
    if (!data.customer.phone) newErrors.phone = "Telefone é obrigatório";
    if (!data.address.postalCode) newErrors.postalCode = "CEP é obrigatório";
    if (!data.address.street) newErrors.street = "Rua é obrigatória";
    if (!data.address.number) newErrors.number = "Número é obrigatório";
    if (!data.address.neighborhood) newErrors.neighborhood = "Bairro é obrigatório";
    if (!data.address.city) newErrors.city = "Cidade é obrigatória";
    if (!data.address.state) newErrors.state = "Estado é obrigatório";
    if (!selectedShipping) newErrors.shipping = "Selecione uma opção de frete";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="space-y-4">
        <h3 className="font-medium">Dados Pessoais</h3>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={data.customer.name}
              onChange={(e) => updateCustomer("name", e.target.value)}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={data.customer.email}
              onChange={(e) => updateCustomer("email", e.target.value)}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={data.customer.phone}
              onChange={(e) => updateCustomer("phone", e.target.value)}
              placeholder="(11) 99999-9999"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={data.customer.cpf}
              onChange={(e) => updateCustomer("cpf", e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="font-medium">Endereço de Entrega</h3>
        
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postalCode">CEP *</Label>
            <Input
              id="postalCode"
              value={data.address.postalCode}
              onChange={(e) => updateAddress("postalCode", e.target.value)}
              placeholder="00000-000"
              className={errors.postalCode ? "border-destructive" : ""}
            />
            {errors.postalCode && (
              <p className="text-xs text-destructive">{errors.postalCode}</p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3 space-y-2">
            <Label htmlFor="street">Rua *</Label>
            <Input
              id="street"
              value={data.address.street}
              onChange={(e) => updateAddress("street", e.target.value)}
              className={errors.street ? "border-destructive" : ""}
            />
            {errors.street && (
              <p className="text-xs text-destructive">{errors.street}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="number">Número *</Label>
            <Input
              id="number"
              value={data.address.number}
              onChange={(e) => updateAddress("number", e.target.value)}
              className={errors.number ? "border-destructive" : ""}
            />
            {errors.number && (
              <p className="text-xs text-destructive">{errors.number}</p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={data.address.complement}
              onChange={(e) => updateAddress("complement", e.target.value)}
              placeholder="Apt, bloco, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro *</Label>
            <Input
              id="neighborhood"
              value={data.address.neighborhood}
              onChange={(e) => updateAddress("neighborhood", e.target.value)}
              className={errors.neighborhood ? "border-destructive" : ""}
            />
            {errors.neighborhood && (
              <p className="text-xs text-destructive">{errors.neighborhood}</p>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input
              id="city"
              value={data.address.city}
              onChange={(e) => updateAddress("city", e.target.value)}
              className={errors.city ? "border-destructive" : ""}
            />
            {errors.city && (
              <p className="text-xs text-destructive">{errors.city}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Estado *</Label>
            <Select
              value={data.address.state}
              onValueChange={(value) => updateAddress("state", value)}
            >
              <SelectTrigger className={errors.state ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {brazilianStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && (
              <p className="text-xs text-destructive">{errors.state}</p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Options */}
      <div className="space-y-4">
        <h3 className="font-medium">Opções de Frete</h3>
        
        <RadioGroup value={selectedShipping} onValueChange={selectShipping}>
          <div className="space-y-3">
            {shippingOptions.map((option) => (
              <label
                key={option.id}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedShipping === option.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={option.id} />
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{option.carrier}</p>
                    <p className="text-sm text-muted-foreground">
                      Entrega em até {option.days} dias úteis
                    </p>
                  </div>
                </div>
                <span className="font-medium">{formatPrice(option.price)}</span>
              </label>
            ))}
          </div>
        </RadioGroup>
        {errors.shipping && (
          <p className="text-sm text-destructive">{errors.shipping}</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleNext}>Continuar para Pagamento</Button>
      </div>
    </div>
  );
}
