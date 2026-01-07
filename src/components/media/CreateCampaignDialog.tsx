import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X, Newspaper, Instagram, Facebook, Globe } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

const CHANNELS = [
  { id: "all", label: "Todos os canais", icon: Globe, description: "Blog, Facebook e Instagram" },
  { id: "blog", label: "Blog", icon: Newspaper, description: "Artigos e posts para o blog" },
  { id: "facebook", label: "Facebook", icon: Facebook, description: "Posts para Facebook" },
  { id: "instagram", label: "Instagram", icon: Instagram, description: "Posts para Instagram" },
] as const;

type ChannelId = typeof CHANNELS[number]["id"];

const formSchema = z.object({
  target_channel: z.enum(["all", "blog", "facebook", "instagram"]),
  name: z.string().min(1, "Nome é obrigatório"),
  prompt: z.string().min(10, "Descreva o objetivo da campanha com pelo menos 10 caracteres"),
  description: z.string().optional(),
  selectedDates: z.array(z.date()).min(1, "Selecione pelo menos uma data"),
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
  const [step, setStep] = useState<"channel" | "details">("channel");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      target_channel: "all",
      name: "",
      prompt: "",
      description: "",
      selectedDates: [],
    },
  });

  const selectedChannel = form.watch("target_channel");

  // Today at start of day (for comparison)
  const today = startOfDay(new Date());
  
  // Shortcuts for quick date selection
  const setCurrentMonth = () => {
    const now = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfCurrentMonth = endOfMonth(now);
    
    if (tomorrow <= endOfCurrentMonth) {
      const dates = eachDayOfInterval({ start: tomorrow, end: endOfCurrentMonth });
      form.setValue("selectedDates", dates);
    } else {
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

  const handleChannelSelect = (channelId: ChannelId) => {
    form.setValue("target_channel", channelId);
    setStep("details");
  };

  const handleBack = () => {
    setStep("channel");
  };

  const onSubmit = async (values: FormValues) => {
    if (!values.selectedDates || values.selectedDates.length === 0) return;
    
    setIsSubmitting(true);
    try {
      const sortedDates = [...values.selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      
      const result = await createCampaign.mutateAsync({
        name: values.name,
        prompt: values.prompt,
        description: values.description,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        target_channel: values.target_channel,
      });
      form.reset();
      setStep("channel");
      onOpenChange(false);
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setStep("channel");
    }
    onOpenChange(open);
  };

  const getChannelInfo = (channelId: ChannelId) => {
    return CHANNELS.find(c => c.id === channelId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {step === "channel" ? (
          <>
            <DialogHeader>
              <DialogTitle>Nova Campanha de Conteúdo</DialogTitle>
              <DialogDescription>
                Primeiro, escolha para qual canal você quer criar a campanha.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleChannelSelect(channel.id)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all",
                      "hover:border-primary hover:bg-primary/5",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    )}
                  >
                    <Icon className="h-10 w-10 text-primary" />
                    <div className="text-center">
                      <p className="font-medium">{channel.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {channel.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => {
                  const info = getChannelInfo(selectedChannel);
                  if (info) {
                    const Icon = info.icon;
                    return (
                      <>
                        <Icon className="h-5 w-5" />
                        Nova Campanha - {info.label}
                      </>
                    );
                  }
                  return "Nova Campanha";
                })()}
              </DialogTitle>
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
                          placeholder={
                            selectedChannel === "blog"
                              ? "Ex: Série de artigos sobre cuidados masculinos, tom informativo e profissional, destacar benefícios dos produtos..."
                              : "Ex: Campanha de Natal com foco em presentes masculinos, tom premium, destacar produtos X e Y, CTA para WhatsApp..."
                          }
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

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Voltar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Criando..." : "Criar Campanha"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
