import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TypeSelector } from "@/components/ui/type-selector";
import { usePurchaseSupplierTypes } from "@/hooks/usePurchaseSupplierTypes";
import type { Supplier, SupplierPersonType, SupplierContributorType } from "@/hooks/useSuppliers";

const BR_UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const schema = z.object({
  person_type: z.enum(["PF", "PJ"]),
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  trade_name: z.string().trim().max(200).optional().or(z.literal("")),
  cnpj: z.string().trim().optional().or(z.literal("")),
  cpf: z.string().trim().optional().or(z.literal("")),
  ie: z.string().trim().max(30).optional().or(z.literal("")),
  ie_isento: z.boolean().default(false),
  im: z.string().trim().max(30).optional().or(z.literal("")),
  contributor_type: z.enum(["contribuinte", "nao_contribuinte", "contribuinte_isento"]),
  is_foreign: z.boolean().default(false),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  phone_secondary: z.string().trim().max(30).optional().or(z.literal("")),
  cep: z.string().trim().max(20).optional().or(z.literal("")),
  logradouro: z.string().trim().max(200).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(100).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.string().trim().max(2).optional().or(z.literal("")),
  codigo_ibge: z.string().trim().max(10).optional().or(z.literal("")),
  pais: z.string().trim().max(60).default("Brasil"),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  fiscal_notes: z.string().trim().max(2000).optional().or(z.literal("")),
  supplier_type_id: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type SupplierFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSubmit: (data: SupplierFormData) => void;
  isLoading?: boolean;
}

export function SupplierFormDialog({ open, onOpenChange, supplier, onSubmit, isLoading }: Props) {
  const { supplierTypes, createSupplierType, deleteSupplierType } = usePurchaseSupplierTypes();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      person_type: "PJ",
      name: "",
      legal_name: "",
      trade_name: "",
      cnpj: "",
      cpf: "",
      ie: "",
      ie_isento: false,
      im: "",
      contributor_type: "nao_contribuinte",
      is_foreign: false,
      email: "",
      phone: "",
      phone_secondary: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      codigo_ibge: "",
      pais: "Brasil",
      contact_person: "",
      notes: "",
      fiscal_notes: "",
      supplier_type_id: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        person_type: (supplier?.person_type as SupplierPersonType) ?? "PJ",
        name: supplier?.name ?? "",
        legal_name: supplier?.legal_name ?? "",
        trade_name: supplier?.trade_name ?? "",
        cnpj: supplier?.cnpj ?? "",
        cpf: supplier?.cpf ?? "",
        ie: supplier?.ie ?? "",
        ie_isento: supplier?.ie_isento ?? false,
        im: supplier?.im ?? "",
        contributor_type: (supplier?.contributor_type as SupplierContributorType) ?? "nao_contribuinte",
        is_foreign: supplier?.is_foreign ?? false,
        email: supplier?.email ?? "",
        phone: supplier?.phone ?? "",
        phone_secondary: supplier?.phone_secondary ?? "",
        cep: supplier?.cep ?? "",
        logradouro: supplier?.logradouro ?? "",
        numero: supplier?.numero ?? "",
        complemento: supplier?.complemento ?? "",
        bairro: supplier?.bairro ?? "",
        cidade: supplier?.cidade ?? "",
        uf: supplier?.uf ?? "",
        codigo_ibge: supplier?.codigo_ibge ?? "",
        pais: supplier?.pais ?? "Brasil",
        contact_person: supplier?.contact_person ?? "",
        notes: supplier?.notes ?? "",
        fiscal_notes: supplier?.fiscal_notes ?? "",
        supplier_type_id: supplier?.supplier_type_id ?? "",
        is_active: supplier?.is_active ?? true,
      });
    }
  }, [open, supplier, form]);

  const personType = form.watch("person_type");
  const ieIsento = form.watch("ie_isento");

  const handleSubmit = (data: SupplierFormData) => {
    onSubmit({
      ...data,
      supplier_type_id: data.supplier_type_id || (null as any),
      // Quando isento, força IE vazia
      ie: data.ie_isento ? "" : data.ie,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs defaultValue="basico" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basico">Dados básicos</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                <TabsTrigger value="comercial">Comercial</TabsTrigger>
              </TabsList>

              {/* DADOS BÁSICOS */}
              <TabsContent value="basico" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="person_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de pessoa *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                          <SelectItem value="PF">Pessoa física</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="is_foreign" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="mb-0">Fornecedor estrangeiro</FormLabel>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{personType === "PJ" ? "Nome do fornecedor *" : "Nome completo *"}</FormLabel>
                    <FormControl><Input placeholder="Como será exibido nas telas" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {personType === "PJ" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="legal_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão social</FormLabel>
                        <FormControl><Input placeholder="Razão social oficial" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="trade_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome fantasia</FormLabel>
                        <FormControl><Input placeholder="Nome fantasia" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {personType === "PJ" ? (
                    <FormField control={form.control} name="cnpj" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={form.control} name="cpf" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input type="email" placeholder="email@fornecedor.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone_secondary" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone secundário</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="!mt-0">Fornecedor ativo</FormLabel>
                  </FormItem>
                )} />
              </TabsContent>

              {/* ENDEREÇO */}
              <TabsContent value="endereco" className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="cep" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {BR_UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-[2fr_1fr] gap-4">
                  <FormField control={form.control} name="logradouro" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl><Input placeholder="Rua / Avenida" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="numero" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="bairro" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="complemento" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="codigo_ibge" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código IBGE do município</FormLabel>
                      <FormControl><Input placeholder="Preenchido automaticamente pelo CEP quando possível" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pais" render={({ field }) => (
                    <FormItem>
                      <FormLabel>País</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              {/* FISCAL */}
              <TabsContent value="fiscal" className="space-y-4 pt-4">
                <FormField control={form.control} name="contributor_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de contribuinte *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="contribuinte">Contribuinte de ICMS</SelectItem>
                        <SelectItem value="contribuinte_isento">Contribuinte isento</SelectItem>
                        <SelectItem value="nao_contribuinte">Não contribuinte</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ie" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual</FormLabel>
                      <FormControl><Input disabled={ieIsento} placeholder={ieIsento ? "Isento" : "IE"} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ie_isento" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="mb-0">Isento de IE</FormLabel>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="im" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inscrição Municipal</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="fiscal_notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações fiscais</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Regimes especiais, observações para emissão de NF, etc." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              {/* COMERCIAL */}
              <TabsContent value="comercial" className="space-y-4 pt-4">
                <FormField control={form.control} name="supplier_type_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de fornecedor</FormLabel>
                    <FormControl>
                      <TypeSelector
                        value={field.value || undefined}
                        onChange={field.onChange}
                        options={supplierTypes.map((t) => ({ id: t.id, name: t.name }))}
                        onCreateNew={async (name) => { await createSupplierType.mutateAsync(name); }}
                        onDelete={async (id) => { await deleteSupplierType.mutateAsync(id); }}
                        placeholder="Selecione ou crie um tipo"
                        createPlaceholder="Ex: Matéria-prima, Serviços..."
                        isCreating={createSupplierType.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contact_person" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pessoa de contato</FormLabel>
                    <FormControl><Input placeholder="Nome do contato" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações comerciais</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Anotações internas sobre o fornecedor" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : supplier ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
