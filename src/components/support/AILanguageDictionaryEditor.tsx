import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { useAiLanguageDictionary, type AiLanguageDictionary } from "@/hooks/useAiLanguageDictionary";

type DictPair = { key: string; value: string };
const toPairs = (obj: Record<string, string> | undefined | null): DictPair[] =>
  Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
const fromPairs = (pairs: DictPair[]): Record<string, string> =>
  pairs.reduce((acc, { key, value }) => {
    if (key.trim()) acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);

interface PairListProps {
  label: string;
  description?: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
  pairs: DictPair[];
  onChange: (pairs: DictPair[]) => void;
}

function PairList({ label, description, keyPlaceholder, valuePlaceholder, pairs, onChange }: PairListProps) {
  const update = (i: number, patch: Partial<DictPair>) => {
    const next = [...pairs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const add = () => onChange([...pairs, { key: '', value: '' }]);

  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-2">
        {pairs.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhuma entrada cadastrada ainda.</p>
        )}
        {pairs.map((pair, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              placeholder={keyPlaceholder}
              value={pair.key}
              onChange={(e) => update(i, { key: e.target.value })}
            />
            <Input
              placeholder={valuePlaceholder}
              value={pair.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <Button variant="ghost" size="icon" onClick={() => remove(i)} type="button">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add} type="button">
        <Plus className="h-4 w-4 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

export function AILanguageDictionaryEditor() {
  const { dictionary, isLoading, upsert, regenerate } = useAiLanguageDictionary();
  const [tone, setTone] = useState('consultivo');
  const [pronoun, setPronoun] = useState('voce');
  const [useEmojis, setUseEmojis] = useState(true);
  const [emojiList, setEmojiList] = useState('');
  const [forbiddenTerms, setForbiddenTerms] = useState('');
  const [vocab, setVocab] = useState<DictPair[]>([]);
  const [aliases, setAliases] = useState<DictPair[]>([]);
  const [phrases, setPhrases] = useState<DictPair[]>([]);

  useEffect(() => {
    if (!dictionary) return;
    setTone(dictionary.tone_style || 'consultivo');
    setPronoun(dictionary.treatment_pronoun || 'voce');
    setUseEmojis(dictionary.use_emojis ?? true);
    setEmojiList((dictionary.emoji_whitelist || []).join(' '));
    setForbiddenTerms((dictionary.forbidden_terms || []).join(', '));
    setVocab(toPairs(dictionary.niche_vocabulary));
    setAliases(toPairs(dictionary.product_aliases));
    setPhrases(toPairs(dictionary.preferred_phrases));
  }, [dictionary]);

  const handleSave = () => {
    const updates: Partial<AiLanguageDictionary> = {
      tone_style: tone,
      treatment_pronoun: pronoun,
      use_emojis: useEmojis,
      emoji_whitelist: emojiList.split(/\s+/).filter(Boolean),
      forbidden_terms: forbiddenTerms.split(',').map(s => s.trim()).filter(Boolean),
      niche_vocabulary: fromPairs(vocab),
      product_aliases: fromPairs(aliases),
      preferred_phrases: fromPairs(phrases),
    };
    upsert.mutate(updates);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Dicionário de Linguagem</CardTitle>
              <CardDescription>
                Define como a IA fala com seus clientes — tom, vocabulário do nicho, apelidos e expressões preferidas.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {dictionary?.has_manual_overrides && (
                <Badge variant="secondary" className="text-xs">Editado manualmente</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {regenerate.isPending ? 'Gerando...' : 'Regenerar com IA'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Estilo do tom</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultivo">Consultivo</SelectItem>
                  <SelectItem value="amigavel">Amigável</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="descontraido">Descontraído</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tratamento do cliente</Label>
              <Select value={pronoun} onValueChange={setPronoun}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voce">Você</SelectItem>
                  <SelectItem value="senhor">Senhor / Senhora</SelectItem>
                  <SelectItem value="tu">Tu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={useEmojis} onCheckedChange={setUseEmojis} id="lang-use-emojis" />
            <Label htmlFor="lang-use-emojis">Usar emojis</Label>
          </div>

          {useEmojis && (
            <div className="space-y-2">
              <Label>Emojis permitidos</Label>
              <Input
                placeholder="😊 🙌 ✨ 🎉"
                value={emojiList}
                onChange={(e) => setEmojiList(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separados por espaço. Deixe em branco para liberar todos.</p>
            </div>
          )}

          <PairList
            label="Vocabulário do nicho"
            description="Termos específicos do seu mercado e o significado deles."
            keyPlaceholder="Ex: tutor"
            valuePlaceholder="Ex: dono do pet"
            pairs={vocab}
            onChange={setVocab}
          />

          <PairList
            label="Apelidos de produtos"
            description="Como os clientes chamam seus produtos no dia a dia."
            keyPlaceholder="Ex: creminho"
            valuePlaceholder="Ex: Creme Hidratante 200ml"
            pairs={aliases}
            onChange={setAliases}
          />

          <PairList
            label="Frases preferidas"
            description="Substituições obrigatórias — usar a expressão da direita em vez da esquerda."
            keyPlaceholder="Ex: preço"
            valuePlaceholder="Ex: investimento"
            pairs={phrases}
            onChange={setPhrases}
          />

          <div className="space-y-2">
            <Label>Termos proibidos</Label>
            <Input
              placeholder="política, religião, concorrentes"
              value={forbiddenTerms}
              onChange={(e) => setForbiddenTerms(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separados por vírgula. A IA nunca usará esses termos.</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar dicionário'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
