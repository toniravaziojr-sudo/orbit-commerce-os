import { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(10, "Descreva o objetivo da campanha com pelo menos 10 caracteres"),
  description: z.string().optional(),
  dateRange: z.object({
    from: z.date().nullable(),
    to: z.date().nullable(),
  }).refine((data) => data.from && data.to, {
    message: "Selecione o período da campanha",
  }),
  daysOfWeek: z.array(z.number()),
});

type FormValues = z.infer<typeof formSchema>;

const weekDays = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (campaign: MediaCampaign) => void;
}

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
  const { createCampaign } = useMediaCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      prompt: "",
      description: "",
      dateRange: {
        from: null,
        to: null,
      },
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Todos os dias por padrão
    },
  });

  // Watch dateRange to determine if we should show days of week selector
  const dateRange = useWatch({ control: form.control, name: "dateRange" });
  
  const showDaysOfWeek = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false;
    const diff = differenceInDays(dateRange.to, dateRange.from);
    return diff >= 7;
  }, [dateRange]);

  // Tomorrow's date (minimum selectable date)
  const tomorrow = addDays(new Date(), 1);
  
  // Shortcuts for quick date selection
  const setCurrentMonth = () => {
    const now = new Date();
    const endOfCurrentMonth = endOfMonth(now);
    // Start from tomorrow if we're in the current month
    const fromDate = tomorrow > endOfCurrentMonth ? startOfMonth(addMonths(now, 1)) : tomorrow;
    form.setValue("dateRange", {
      from: fromDate,
      to: endOfCurrentMonth > tomorrow ? endOfCurrentMonth : endOfMonth(addMonths(now, 1)),
    });
  };

  const setNextMonth = () => {
    const next = addMonths(new Date(), 1);
    form.setValue("dateRange", {
      from: startOfMonth(next),
      to: endOfMonth(next),
    });
  };

  const clearSelection = () => {
    form.setValue("dateRange", { from: null, to: null });
  };

  const onSubmit = async (values: FormValues) => {
    if (!values.dateRange.from || !values.dateRange.to) return;
    
    setIsSubmitting(true);
    try {
      // If range is less than 7 days, use all days of week
      const daysOfWeek = showDaysOfWeek ? values.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
      
      const result = await createCampaign.mutateAsync({
        name: values.name,
        prompt: values.prompt,
        description: values.description,
        start_date: format(values.dateRange.from, "yyyy-MM-dd"),
        end_date: format(values.dateRange.to, "yyyy-MM-dd"),
        days_of_week: daysOfWeek,
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Campanha de Conteúdo</DialogTitle>
          <DialogDescription>
            Defina o objetivo da sua campanha e o período. A IA vai gerar sugestões de conteúdo para cada dia.
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
                      placeholder="Ex: Campanha de Natal com foco em presentes masculinos, tom premium, vídeos curtos para Reels, destacar produtos X e Y, CTA para WhatsApp..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    A IA vai usar as informações da sua loja (produtos, categorias, promoções) automaticamente. Aqui você define apenas o direcionamento específico desta campanha.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Período da campanha</FormLabel>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={setCurrentMonth}
                    >
                      Mês atual
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={setNextMonth}
                    >
                      Próximo mês
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Limpar
                    </Button>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value?.from && "text-muted-foreground"
                          )}
                        >
                          {field.value?.from ? (
                            field.value.to ? (
                              <>
                                {format(field.value.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                                {format(field.value.to, "dd/MM/yyyy", { locale: ptBR })}
                              </>
                            ) : (
                              format(field.value.from, "dd/MM/yyyy", { locale: ptBR })
                            )
                          ) : (
                            <span>Selecione o período</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={field.value?.from || tomorrow}
                        selected={field.value?.from && field.value?.to ? { from: field.value.from, to: field.value.to } : undefined}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            field.onChange({ from: range.from, to: range.to });
                          } else if (range?.from) {
                            field.onChange({ from: range.from, to: null });
                          } else {
                            field.onChange({ from: null, to: null });
                          }
                        }}
                        numberOfMonths={2}
                        locale={ptBR}
                        disabled={(date) => date < tomorrow}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showDaysOfWeek && (
              <FormField
                control={form.control}
                name="daysOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias da semana</FormLabel>
                    <FormDescription>
                      Em quais dias você quer publicar conteúdo?
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {weekDays.map((day) => (
                        <label
                          key={day.value}
                          className={cn(
                            "flex items-center justify-center w-12 h-10 rounded-md border cursor-pointer transition-colors",
                            field.value.includes(day.value)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-input hover:bg-accent"
                          )}
                        >
                          <Checkbox
                            checked={field.value.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, day.value].sort());
                              } else {
                                field.onChange(field.value.filter((v) => v !== day.value));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{day.label}</span>
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
