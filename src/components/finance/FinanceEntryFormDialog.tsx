import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceEntry } from "@/hooks/useFinanceEntries";
import { FINANCE_CATEGORIES } from "@/hooks/useFinanceEntries";

const formSchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  category: z.string().optional(),
  entry_date: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FinanceEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FinanceEntry | null;
  defaultType?: 'income' | 'expense';
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function FinanceEntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultType = 'expense',
  onSubmit,
  isLoading,
}: FinanceEntryFormDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: defaultType,
      description: "",
      amount: 0,
      category: "",
      entry_date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  // Reset form when dialog opens or entry changes
  useEffect(() => {
    if (open) {
      form.reset({
        type: entry?.type || defaultType,
        description: entry?.description || "",
        amount: entry?.amount || 0,
        category: entry?.category || "",
        entry_date: entry?.entry_date || new Date().toISOString().split('T')[0],
        notes: entry?.notes || "",
      });
    }
  }, [open, entry, defaultType, form]);

  const watchType = form.watch('type');
  const categories = FINANCE_CATEGORIES[watchType];

  const handleSubmit = (data: FormData) => {
    onSubmit({ ...data, source: 'manual' } as any);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar Lançamento" : `Nova ${watchType === 'income' ? 'Entrada' : 'Saída'}`}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição do lançamento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Textarea placeholder="Anotações sobre o lançamento" {...field} />
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
                {isLoading ? "Salvando..." : entry ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
