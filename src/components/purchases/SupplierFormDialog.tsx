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
import { TypeSelector } from "@/components/ui/type-selector";
import type { Supplier } from "@/hooks/useSuppliers";
import { useSupplierTypes } from "@/hooks/useSupplierTypes";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
  supplier_type_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSubmit,
  isLoading,
}: SupplierFormDialogProps) {
  const { supplierTypes, createSupplierType, deleteSupplierType } = useSupplierTypes();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      address: "",
      contact_person: "",
      notes: "",
      is_active: true,
      supplier_type_id: "",
    },
  });

  // Reset form when supplier changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: supplier?.name || "",
        cnpj: supplier?.cnpj || "",
        email: supplier?.email || "",
        phone: supplier?.phone || "",
        address: supplier?.address || "",
        contact_person: supplier?.contact_person || "",
        notes: supplier?.notes || "",
        is_active: supplier?.is_active ?? true,
        supplier_type_id: supplier?.supplier_type_id || "",
      });
    }
  }, [open, supplier, form]);

  const handleSubmit = (data: FormData) => {
    onSubmit({
      ...data,
      supplier_type_id: data.supplier_type_id || null,
    } as any);
    form.reset();
  };

  const handleCreateType = async (name: string) => {
    await createSupplierType.mutateAsync(name);
  };

  const handleDeleteType = async (id: string) => {
    await deleteSupplierType.mutateAsync(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do fornecedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Fornecedor</FormLabel>
                  <FormControl>
                    <TypeSelector
                      value={field.value}
                      onChange={field.onChange}
                      options={supplierTypes.map(t => ({ id: t.id, name: t.name }))}
                      onCreateNew={handleCreateType}
                      onDelete={handleDeleteType}
                      placeholder="Selecione o tipo de fornecedor..."
                      createPlaceholder="Ex: Matéria-prima, Serviços..."
                      isCreating={createSupplierType.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@fornecedor.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_person"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pessoa de Contato</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do contato" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Endereço completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotações sobre o fornecedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Fornecedor ativo</FormLabel>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
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
