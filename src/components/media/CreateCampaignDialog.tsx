import { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInDays, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
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
  selectedDates: z.array(z.date()).min(1, "Selecione pelo menos uma data"),
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
      selectedDates: [],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Todos os dias por padrão
    },
  });

  // Watch selectedDates to determine if we should show days of week selector
  const selectedDates = useWatch({ control: form.control, name: "selectedDates" });
  
  const showDaysOfWeek = useMemo(() => {
    if (!selectedDates || selectedDates.length < 15) return false;
    // Check if dates span 15+ consecutive days
    const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const diff = differenceInDays(sorted[sorted.length - 1], sorted[0]);
    return diff >= 14; // 15 days = diff of 14
  }, [selectedDates]);

  // Today at start of day (for comparison)
  const today = startOfDay(new Date());
  
  // Shortcuts for quick date selection
  const setCurrentMonth = () => {
    const now = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfCurrentMonth = endOfMonth(now);
    
    // Get all days from tomorrow to end of month
    if (tomorrow <= endOfCurrentMonth) {
      const dates = eachDayOfInterval({ start: tomorrow, end: endOfCurrentMonth });
      form.setValue("selectedDates", dates);
    } else {
      // If today is the last day of month, select next month
      const next = addMonths(now, 1);
      const dates = eachDayOfInterval({ start: startOfMonth(next), end: endOfMonth(next) });
      form.setValue("selectedDates", dates);
    }
  };

  const setNextMonth = () => {
    const next = addMonths(new Date(), 1);
    const dates = eachDayOfInterval({ start: startOfMonth(next), end: endOfMonth(next) });
    form.setValue("selectedDates", dates);
  };

  const clearSelection = () => {
    form.setValue("selectedDates", []);
  };

  const removeDate = (dateToRemove: Date) => {
    const current = form.getValues("selectedDates");
    form.setValue(
      "selectedDates",
      current.filter((d) => d.getTime() !== dateToRemove.getTime())
    );
  };

  const onSubmit = async (values: FormValues) => {
    if (!values.selectedDates || values.selectedDates.length === 0) return;
    
    setIsSubmitting(true);
    try {
      // Sort dates and get start/end
      const sortedDates = [...values.selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      
      // If range is less than 7 days, use all days of week
      const daysOfWeek = showDaysOfWeek ? values.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
      
      const result = await createCampaign.mutateAsync({
        name: values.name,
        prompt: values.prompt,
        description: values.description,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
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
              name="selectedDates"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Datas da campanha</FormLabel>
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
                            "w-full pl-3 text-left font-normal min-h-[40px]",
                            field.value.length === 0 && "text-muted-foreground"
                          )}
                        >
                          {field.value.length > 0 ? (
                            <span>{field.value.length} data(s) selecionada(s)</span>
                          ) : (
                            <span>Clique para selecionar datas</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="multiple"
                        defaultMonth={new Date()}
                        selected={field.value}
                        onSelect={(dates) => {
                          field.onChange(dates || []);
                        }}
                        numberOfMonths={2}
                        locale={ptBR}
                        disabled={(date) => startOfDay(date) <= today}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {/* Show selected dates as chips */}
                  {field.value.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 max-h-[100px] overflow-y-auto">
                      {[...field.value]
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map((date) => (
                          <span
                            key={date.getTime()}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary"
                          >
                            {format(date, "dd/MM", { locale: ptBR })}
                            <button
                              type="button"
                              onClick={() => removeDate(date)}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
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
