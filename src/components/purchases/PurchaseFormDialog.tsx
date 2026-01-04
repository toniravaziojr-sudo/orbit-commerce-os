import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TypeSelector } from "@/components/ui/type-selector";
import { Check, ChevronsUpDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Purchase } from "@/hooks/usePurchases";
import type { Supplier } from "@/hooks/useSuppliers";
import { usePurchaseTypes } from "@/hooks/usePurchaseTypes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  supplier_id: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'in_transit', 'delivered', 'cancelled']),
  total_value: z.coerce.number().min(0, "Valor deve ser positivo"),
  expected_delivery_date: z.string().optional(),
  actual_delivery_date: z.string().optional(),
  notes: z.string().optional(),
  entry_invoice_id: z.string().optional(),
  purchase_type_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PurchaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: Purchase | null;
  suppliers: Supplier[];
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function PurchaseFormDialog({
  open,
  onOpenChange,
  purchase,
  suppliers,
  onSubmit,
  isLoading,
}: PurchaseFormDialogProps) {
  const { currentTenant } = useAuth();
  const { purchaseTypes, createPurchaseType, deletePurchaseType } = usePurchaseTypes();
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // Buscar NF-es de entrada (tipo entrada ou todas autorizadas para vincular)
  const { data: entryInvoices = [] } = useQuery({
    queryKey: ['entry-invoices', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('id, numero, dest_nome, valor_total, created_at')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'authorized')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: "",
      description: "",
      status: "pending",
      total_value: 0,
      expected_delivery_date: "",
      actual_delivery_date: "",
      notes: "",
      entry_invoice_id: "",
      purchase_type_id: "",
    },
  });

  // Reset form when purchase changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        supplier_id: purchase?.supplier_id || "",
        description: purchase?.description || "",
        status: purchase?.status || "pending",
        total_value: purchase?.total_value || 0,
        expected_delivery_date: purchase?.expected_delivery_date || "",
        actual_delivery_date: purchase?.actual_delivery_date || "",
        notes: purchase?.notes || "",
        entry_invoice_id: purchase?.entry_invoice_id || "",
        purchase_type_id: purchase?.purchase_type_id || "",
      });
    }
  }, [open, purchase, form]);

  const handleSubmit = (data: FormData) => {
    // Limpar campos vazios
    const cleanData = {
      ...data,
      supplier_id: data.supplier_id || null,
      entry_invoice_id: data.entry_invoice_id || null,
      purchase_type_id: data.purchase_type_id || null,
    };
    onSubmit(cleanData);
    form.reset();
  };

  const handleCreateType = async (name: string) => {
    await createPurchaseType.mutateAsync(name);
  };

  const handleDeleteType = async (id: string) => {
    await deletePurchaseType.mutateAsync(id);
  };

  const selectedInvoice = entryInvoices.find(inv => inv.id === form.watch('entry_invoice_id'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{purchase ? "Editar Pedido de Compra" : "Novo Pedido de Compra"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição da Compra *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Materiais de escritório, Estoque de produtos..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchase_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Compra</FormLabel>
                  <FormControl>
                    <TypeSelector
                      value={field.value}
                      onChange={field.onChange}
                      options={purchaseTypes.map(t => ({ id: t.id, name: t.name }))}
                      onCreateNew={handleCreateType}
                      onDelete={handleDeleteType}
                      placeholder="Selecione o tipo de compra..."
                      createPlaceholder="Ex: Matéria-prima, Serviços..."
                      isCreating={createPurchaseType.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="in_transit">Em Trânsito</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsão de Entrega</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actual_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Entrega Real</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="entry_invoice_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>NF de Entrada</FormLabel>
                  <Popover open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={invoiceOpen}
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedInvoice ? (
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              NF {selectedInvoice.numero} - {selectedInvoice.dest_nome}
                            </span>
                          ) : (
                            "Vincular NF de entrada..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar NF..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma NF encontrada.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                form.setValue('entry_invoice_id', '');
                                setInvoiceOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !field.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Nenhuma
                            </CommandItem>
                            {entryInvoices.map((invoice) => (
                              <CommandItem
                                key={invoice.id}
                                value={`${invoice.numero} ${invoice.dest_nome}`}
                                onSelect={() => {
                                  form.setValue('entry_invoice_id', invoice.id);
                                  setInvoiceOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === invoice.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>NF {invoice.numero} - {invoice.dest_nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    R$ {Number(invoice.valor_total || 0).toFixed(2)}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    <Textarea placeholder="Anotações sobre o pedido" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : purchase ? "Atualizar" : "Criar Pedido"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
