import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, addMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

// Gera lista de meses disponíveis (mês atual + próximos 5 meses)
const getAvailableMonths = () => {
  const now = new Date();
  const months = [];
  
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    // Para o mês atual, início é hoje
    const start = i === 0 ? startOfDay(now) : monthStart;
    
    months.push({
      value: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMMM", { locale: ptBR }),
      shortLabel: format(monthDate, "MMM", { locale: ptBR }),
      fullLabel: format(monthDate, "MMMM yyyy", { locale: ptBR }),
      start,
      end: monthEnd,
      isCurrent: i === 0,
    });
  }
  
  return months;
};

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(10, "Descreva o objetivo da campanha com pelo menos 10 caracteres"),
  selectedMonth: z.string().min(1, "Selecione um mês"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (campaign: MediaCampaign) => void;
}

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
  const { createCampaign } = useMediaCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableMonths = getAvailableMonths();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      prompt: "",
      selectedMonth: availableMonths[0]?.value || "",
    },
  });

  const selectedMonth = form.watch("selectedMonth");
  const selectedMonthData = availableMonths.find(m => m.value === selectedMonth);

  const onSubmit = async (values: FormValues) => {
    const monthData = availableMonths.find(m => m.value === values.selectedMonth);
    if (!monthData) return;

    setIsSubmitting(true);
    try {
      const result = await createCampaign.mutateAsync({
        name: values.name,
        prompt: values.prompt,
        start_date: format(monthData.start, "yyyy-MM-dd"),
        end_date: format(monthData.end, "yyyy-MM-dd"),
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        target_channel: "all",
      });
      form.reset({
        name: "",
        prompt: "",
        selectedMonth: availableMonths[0]?.value || "",
      });
      onOpenChange(false);
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset({
        name: "",
        prompt: "",
        selectedMonth: availableMonths[0]?.value || "",
      });
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Campanha de Conteúdo</DialogTitle>
          <DialogDescription>
            Defina o nome, objetivo e o mês da campanha. A IA vai gerar sugestões de conteúdo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da campanha</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Campanha de Janeiro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direcionamento da campanha</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Ex: Campanha de Natal com foco em presentes masculinos, tom premium, destacar produtos X e Y, CTA para WhatsApp..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    A IA vai usar as informações da sua loja (produtos, categorias, promoções) automaticamente. Aqui você define o direcionamento específico desta campanha.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selectedMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês da campanha</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {availableMonths.map((month) => (
                      <button
                        key={month.value}
                        type="button"
                        onClick={() => field.onChange(month.value)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all",
                          "hover:border-primary hover:bg-primary/5",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                          field.value === month.value && "border-primary bg-primary/10"
                        )}
                      >
                        {field.value === month.value && (
                          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                        <CalendarDays className={cn(
                          "h-5 w-5",
                          field.value === month.value ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "font-medium text-sm capitalize",
                          field.value === month.value && "text-primary"
                        )}>
                          {month.isCurrent ? "Este mês" : month.shortLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedMonthData && (
                    <FormDescription>
                      Período: {format(selectedMonthData.start, "dd/MM", { locale: ptBR })} até {format(selectedMonthData.end, "dd/MM/yyyy", { locale: ptBR })}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
