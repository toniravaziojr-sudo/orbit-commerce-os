import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Phone, Mail, MapPin, Save, Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_email?: string;
  store_phone?: string;
  store_address?: string;
  store_cnpj?: string;
}

export default function CompanyData() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<StoreSettings>({});

  useEffect(() => {
    if (currentTenant?.id) {
      loadStoreSettings();
    }
  }, [currentTenant?.id]);

  const loadStoreSettings = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData({
          store_name: data.store_name || "",
          store_description: data.store_description || "",
          store_email: data.contact_email || "",
          store_phone: data.contact_phone || "",
          store_address: data.contact_address || "",
          store_cnpj: data.business_cnpj || "",
        });
      }
    } catch (error) {
      console.error("Error loading store settings:", error);
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("store_settings")
        .upsert({
          tenant_id: currentTenant.id,
          store_name: formData.store_name,
          store_description: formData.store_description,
          contact_email: formData.store_email,
          contact_phone: formData.store_phone,
          contact_address: formData.store_address,
          business_cnpj: formData.store_cnpj,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id",
        });

      if (error) throw error;
      toast.success("Dados da empresa atualizados!");
    } catch (error) {
      console.error("Error updating store settings:", error);
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Dados da Empresa"
          description="Informações visíveis para seus clientes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Estes dados ficam visíveis na sua loja e em documentos fiscais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store_name">Nome da Empresa / Loja</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="store_name"
                  value={formData.store_name || ""}
                  onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                  placeholder="Nome da sua loja"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_cnpj">CNPJ</Label>
              <Input
                id="store_cnpj"
                value={formData.store_cnpj || ""}
                onChange={(e) => setFormData({ ...formData, store_cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_email">Email de Contato</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="store_email"
                  type="email"
                  value={formData.store_email || ""}
                  onChange={(e) => setFormData({ ...formData, store_email: e.target.value })}
                  placeholder="contato@suaempresa.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="store_phone"
                  value={formData.store_phone || ""}
                  onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="store_address">Endereço</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="store_address"
                  value={formData.store_address || ""}
                  onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                  placeholder="Endereço completo da empresa"
                  className="pl-9 min-h-[80px]"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="store_description">Descrição da Empresa</Label>
              <Textarea
                id="store_description"
                value={formData.store_description || ""}
                onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
                placeholder="Uma breve descrição sobre sua empresa"
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
