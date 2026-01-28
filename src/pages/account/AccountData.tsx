import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Building2, Phone, Mail, MapPin, Save, IdCard, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DocumentType = 'cpf' | 'cnpj';

interface AccountSettings {
  store_name?: string;
  store_description?: string;
  store_email?: string;
  store_phone?: string;
  store_address?: string;
  business_cnpj?: string;
  business_cpf?: string;
  business_legal_name?: string;
  document_type?: DocumentType;
}

// Formatters
function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numbers
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export default function AccountData() {
  const navigate = useNavigate();
  const { currentTenant, profile, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('cpf');
  const [formData, setFormData] = useState<AccountSettings>({});

  useEffect(() => {
    if (currentTenant?.id) {
      loadAccountSettings();
    }
  }, [currentTenant?.id]);

  const loadAccountSettings = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        // Determine document type based on which field has value
        const hasDocType: DocumentType = data.business_cnpj && data.business_cnpj.length > 0 ? 'cnpj' : 'cpf';
        setDocumentType(hasDocType);
        
        setFormData({
          store_name: data.store_name || "",
          store_description: data.store_description || "",
          store_email: data.contact_email || "",
          store_phone: data.contact_phone || "",
          store_address: data.contact_address || "",
          business_cnpj: data.business_cnpj || "",
          business_cpf: data.business_cpf || "",
          business_legal_name: data.business_legal_name || "",
        });
      }
    } catch (error) {
      console.error("Error loading account settings:", error);
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    
    // Validate required fields
    if (!formData.business_legal_name?.trim()) {
      toast.error("Nome/Razão Social é obrigatório");
      return;
    }
    
    const document = documentType === 'cpf' ? formData.business_cpf : formData.business_cnpj;
    if (!document?.trim()) {
      toast.error(`${documentType === 'cpf' ? 'CPF' : 'CNPJ'} é obrigatório`);
      return;
    }
    
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
          business_cnpj: documentType === 'cnpj' ? formData.business_cnpj : null,
          business_cpf: documentType === 'cpf' ? formData.business_cpf : null,
          business_legal_name: formData.business_legal_name,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id",
        });

      if (error) throw error;
      toast.success("Dados da conta atualizados!");
    } catch (error) {
      console.error("Error updating account settings:", error);
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    if (documentType === 'cpf') {
      setFormData({ ...formData, business_cpf: formatCPF(value) });
    } else {
      setFormData({ ...formData, business_cnpj: formatCNPJ(value) });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Dados da Conta"
          description="Informações pessoais ou empresariais da sua conta"
        />
      </div>

      {/* Personal/Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais (uso interno)
          </CardTitle>
          <CardDescription>
            Estas informações são de uso interno e não são visíveis para seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome do Usuário</Label>
              <Input
                id="full_name"
                value={profile?.full_name || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Altere em configurações de perfil.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="pl-9 bg-muted"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5" />
            Documentação
          </CardTitle>
          <CardDescription>
            Informações fiscais obrigatórias para emissão de notas e pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Tipo de Pessoa</Label>
            <RadioGroup
              value={documentType}
              onValueChange={(v) => setDocumentType(v as DocumentType)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cpf" id="doc-cpf" />
                <Label htmlFor="doc-cpf" className="cursor-pointer">Pessoa Física (CPF)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cnpj" id="doc-cnpj" />
                <Label htmlFor="doc-cnpj" className="cursor-pointer">Pessoa Jurídica (CNPJ)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal_name">
                {documentType === 'cpf' ? 'Nome Completo *' : 'Razão Social *'}
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="legal_name"
                  value={formData.business_legal_name || ""}
                  onChange={(e) => setFormData({ ...formData, business_legal_name: e.target.value })}
                  placeholder={documentType === 'cpf' ? 'Nome completo' : 'Razão social da empresa'}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">
                {documentType === 'cpf' ? 'CPF *' : 'CNPJ *'}
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="document"
                  value={documentType === 'cpf' ? (formData.business_cpf || "") : (formData.business_cnpj || "")}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business/Store Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações Públicas da Loja
          </CardTitle>
          <CardDescription>
            Estes dados ficam visíveis na sua loja e em documentos fiscais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store_name">Nome da Loja / Fantasia</Label>
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
                  onChange={(e) => setFormData({ ...formData, store_phone: formatPhone(e.target.value) })}
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
                  placeholder="Endereço completo"
                  className="pl-9 min-h-[80px]"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="store_description">Descrição da Loja</Label>
              <Textarea
                id="store_description"
                value={formData.store_description || ""}
                onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
                placeholder="Uma breve descrição sobre sua loja"
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
