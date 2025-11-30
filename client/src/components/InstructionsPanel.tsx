import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InstructionScope, SystemInstruction } from "@shared/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, NotebookPen } from "lucide-react";

const scopeLabels: Record<InstructionScope, string> = {
  chat: "Chat",
  catalog: "Catálogo",
  global: "Global",
};

type InstructionsPanelProps = {
  scopes: InstructionScope[];
  title?: string;
  description?: string;
};

export function InstructionsPanel({
  scopes,
  title = "Instruções do sistema",
  description = "Visualize e atualize instruções que afetam este contexto.",
}: InstructionsPanelProps) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const instructionsQuery = useQuery<SystemInstruction[]>({
    queryKey: ["instructions"],
    queryFn: async () => {
      const response = await fetch("/api/instructions", { credentials: "include" });
      if (!response.ok) {
        const message = (await response.text()) || response.statusText;
        throw new Error(message);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.instructions ?? [];
    },
  });

  useEffect(() => {
    const data = instructionsQuery.data;
    if (!data || data.length === 0) return;

    setDrafts((current) => {
      const next: Record<string, string> = {};
      data.forEach((instruction) => {
        next[instruction.slug] = current[instruction.slug] ?? instruction.content;
      });
      return next;
    });
  }, [instructionsQuery.data]);

  const effectiveScopes = useMemo(() => {
    const unique = new Set<InstructionScope>(["global", ...scopes]);
    return Array.from(unique);
  }, [scopes]);

  const filteredInstructions = useMemo(() => {
    const ready = instructionsQuery.data ?? [];
    return ready.filter((instruction) => effectiveScopes.includes(instruction.scope));
  }, [instructionsQuery.data, effectiveScopes]);

  const updateMutation = useMutation({
    mutationFn: async ({ slug, content }: { slug: string; content: string }) => {
      const response = await apiRequest("PUT", `/api/instructions/${slug}`, { content });
      const data = await response.json();
      return data.instruction as SystemInstruction;
    },
    onSuccess: (instruction) => {
      toast({
        title: "Instrução salva",
        description: `${instruction.title} atualizada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["instructions"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível atualizar instrução.",
      });
    },
  });

  const handleChange = (slug: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [slug]: value,
    }));
  };

  const handleReset = (instruction: SystemInstruction) => {
    setDrafts((current) => ({
      ...current,
      [instruction.slug]: instruction.content,
    }));
  };

  const isLoading = instructionsQuery.isLoading;
  const isError = instructionsQuery.isError;

  return (
    <Card className="border-dashed">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <NotebookPen className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {instructionsQuery.error instanceof Error
                ? instructionsQuery.error.message
                : "Erro ao carregar instruções."}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && filteredInstructions.length === 0 && (
          <Alert>
            <AlertDescription>Nenhuma instrução disponível para este contexto.</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && filteredInstructions.length > 0 && (
          <Accordion type="multiple" className="space-y-3">
            {filteredInstructions.map((instruction) => {
              const draft = drafts[instruction.slug] ?? instruction.content;
              const isDirty = draft.trim() !== instruction.content.trim();
              const isSaving = updateMutation.isPending && updateMutation.variables?.slug === instruction.slug;
              const updatedAt = new Date(instruction.updatedAt).toLocaleString("pt-BR");

              return (
                <AccordionItem key={instruction.slug} value={instruction.slug} className="rounded-md border">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex w-full flex-col gap-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{instruction.title}</span>
                        <Badge variant="secondary">{scopeLabels[instruction.scope]}</Badge>
                      </div>
                      {instruction.description && (
                        <p className="text-xs text-muted-foreground">{instruction.description}</p>
                      )}
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Atualizado em {updatedAt}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Textarea
                      value={draft}
                      onChange={(event) => handleChange(instruction.slug, event.target.value)}
                      className="min-h-[140px] resize-y"
                    />
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Alterações são aplicadas imediatamente após salvar.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!isDirty || isSaving}
                          onClick={() => handleReset(instruction)}
                        >
                          Descartar
                        </Button>
                        <Button
                          type="button"
                          disabled={!isDirty || isSaving}
                          onClick={() => updateMutation.mutate({ slug: instruction.slug, content: draft })}
                        >
                          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
