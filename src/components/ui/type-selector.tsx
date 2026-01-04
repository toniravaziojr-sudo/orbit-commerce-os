import { useState } from "react";
import { Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface TypeOption {
  id: string;
  name: string;
}

interface TypeSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: TypeOption[];
  onCreateNew: (name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  placeholder?: string;
  createPlaceholder?: string;
  isCreating?: boolean;
  disabled?: boolean;
}

export function TypeSelector({
  value,
  onChange,
  options,
  onCreateNew,
  onDelete,
  placeholder = "Selecione um tipo...",
  createPlaceholder = "Novo tipo...",
  isCreating,
  disabled,
}: TypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const selectedOption = options.find(opt => opt.id === value);

  const handleCreateNew = async () => {
    if (!newTypeName.trim()) return;
    await onCreateNew(newTypeName.trim());
    setNewTypeName("");
    setIsAddingNew(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDelete) {
      await onDelete(id);
      if (value === id) {
        onChange(undefined);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedOption?.name || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tipo..." />
          <CommandList>
            <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
            <CommandGroup>
              {/* Opção para limpar seleção */}
              <CommandItem
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="text-muted-foreground"
              >
                <span className="italic">Nenhum</span>
              </CommandItem>
              
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className="flex justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === option.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.name}
                  </div>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleDelete(e, option.id)}
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          
          {/* Seção para adicionar novo tipo */}
          <div className="border-t p-2">
            {isAddingNew ? (
              <div className="flex gap-2">
                <Input
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder={createPlaceholder}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateNew();
                    }
                    if (e.key === 'Escape') {
                      setIsAddingNew(false);
                      setNewTypeName("");
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleCreateNew}
                  disabled={!newTypeName.trim() || isCreating}
                >
                  {isCreating ? "..." : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewTypeName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setIsAddingNew(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar novo tipo
              </Button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
