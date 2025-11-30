import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  type CatalogStatusFilter,
  formatPriceBRL,
  parseTagsInput,
  statusLabel,
} from "@/lib/catalog";
import type { CatalogFile, CatalogItem, CatalogItemStatus, CatalogItemInput } from "@shared/schema";
import { catalogItemStatusValues } from "@shared/schema";
import { InstructionsPanel } from "@/components/InstructionsPanel";
import { AlertCircle, ExternalLink, FileText, Loader2, Paperclip, Pencil, Plus, RefreshCw, Tag, Trash2, UploadCloud } from "lucide-react";

const catalogFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item"),
  description: z.string().trim().min(5, "Descreva o item"),
  category: z.string().trim().min(2, "Informe a categoria"),
  manufacturer: z.string().trim().min(2, "Informe o fabricante"),
  price: z.coerce.number().nonnegative("Preço deve ser zero ou positivo"),
  status: z.enum(catalogItemStatusValues).default("ativo"),
  tagsText: z.string().optional(),
});

type CatalogFormValues = z.infer<typeof catalogFormSchema>;

type CatalogMutationPayload = CatalogItemInput;

function formatBytes(value: number | null | undefined): string {
  if (!value || value < 0) return "-";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function CatalogFilesDialog({
  item,
  open,
  onOpenChange,
}: {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
    }
  }, [open]);

  const filesQuery = useQuery({
    queryKey: ["catalog-files", item?.id],
    enabled: Boolean(item?.id) && open,
    queryFn: async () => {
      if (!item) throw new Error("Item não selecionado");

      const res = await fetch(`/api/catalog/${item.id}/files`, { credentials: "include" });
      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      return (await res.json()) as {
        files: CatalogFile[];
        limits?: { maxSizeBytes?: number; allowedMimeTypes?: string[] };
      };
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!item) throw new Error("Item não encontrado para upload");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/catalog/${item.id}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      return (await res.json()) as { file: CatalogFile };
    },
    onSuccess: () => {
      toast({
        title: "Arquivo enviado",
        description: "Upload concluído com sucesso.",
      });
      if (item?.id) {
        queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      }
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Não foi possível enviar o arquivo.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await fetch(`/api/catalog/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      return (await res.json()) as { deleted: boolean };
    },
    onSuccess: () => {
      if (item?.id) {
        queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      }
      toast({
        title: "Arquivo removido",
        description: "O arquivo foi excluído do catálogo.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover arquivo",
        description: error instanceof Error ? error.message : "Não foi possível remover o arquivo.",
      });
    },
  });

  const files = filesQuery.data?.files ?? [];
  const limits = filesQuery.data?.limits;

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Selecione um arquivo",
        description: "Escolha um arquivo para enviar para o item.",
      });
      return;
    }

    uploadMutation.mutate(selectedFile);
  };

  const acceptTypes = limits?.allowedMimeTypes?.join(",");
  const maxSizeLabel = limits?.maxSizeBytes ? `${(limits.maxSizeBytes / (1024 * 1024)).toFixed(1)}MB` : "10MB";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Arquivos do item</DialogTitle>
          <DialogDescription>
            Adicione arquivos de contexto para o item {item?.name}. Os uploads vão para o storage Vercel Blob.
          </DialogDescription>
        </DialogHeader>

        {!item && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Selecione um item para gerenciar arquivos.
          </div>
        )}

        {item && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Upload de arquivo</p>
                  <p className="text-xs text-muted-foreground">
                    Tipos permitidos: {limits?.allowedMimeTypes?.join(", ") ?? "pdf, txt, doc, docx, md"} | Limite {maxSizeLabel}
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Input
                    type="file"
                    accept={acceptTypes}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSelectedFile(file ?? null);
                    }}
                  />
                  <Button onClick={handleUpload} disabled={uploadMutation.isPending || !selectedFile}>
                    {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
              {selectedFile && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selecionado: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-medium">Arquivos enviados</p>
                {filesQuery.isFetching && (
                  <span className="text-xs text-muted-foreground">Atualizando...</span>
                )}
              </div>

              <div className="p-4">
                {filesQuery.isError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {filesQuery.error instanceof Error ? filesQuery.error.message : "Erro ao carregar arquivos."}
                  </div>
                )}

                {filesQuery.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando arquivos...
                  </div>
                )}

                {!filesQuery.isLoading && files.length === 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Nenhum arquivo enviado para este item.
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id} className="flex flex-col gap-3 rounded-md border px-3 py-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <FileText className="h-4 w-4" />
                            {file.originalName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.mimeType} · {formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString("pt-BR")}
                          </div>
                          {file.textPreview && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {file.textPreview}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={file.blobUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(file.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const statusFilters: { value: CatalogStatusFilter; label: string }[] = [
  { value: "ativo", label: "Ativos" },
  { value: "arquivado", label: "Arquivados" },
  { value: "all", label: "Todos" },
];

function CatalogFormDialog({
  mode,
  open,
  onOpenChange,
  initialItem,
  onSubmit,
  isSubmitting,
}: {
  mode: "create" | "edit";
  open: boolean;
  initialItem: CatalogItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CatalogMutationPayload) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      manufacturer: "",
      price: 0,
      status: "ativo",
      tagsText: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      return;
    }

    if (initialItem) {
      form.reset({
        name: initialItem.name,
        description: initialItem.description,
        category: initialItem.category,
        manufacturer: initialItem.manufacturer,
        price: initialItem.price,
        status: initialItem.status,
        tagsText: initialItem.tags.join(", "),
      });
    } else {
      form.reset({
        name: "",
        description: "",
        category: "",
        manufacturer: "",
        price: 0,
        status: "ativo",
        tagsText: "",
      });
    }
  }, [form, initialItem, open]);

  const handleSubmit = (values: CatalogFormValues) => {
    const payload: CatalogMutationPayload = {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      manufacturer: values.manufacturer.trim(),
      price: values.price,
      status: values.status as CatalogItemStatus,
      tags: parseTagsInput(values.tagsText),
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo item de catálogo" : "Editar item"}</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo. Todos os textos devem estar em português e refletir o que será exibido aos usuários.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Semente Premium Soja 64" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Sementes, Fertilizante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fabricante</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: AgroVale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0,00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Fale sobre características e diferenciais." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tagsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="Separadas por vírgula (ex: sementes, soja)" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Criar item" : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CatalogStatusFilter>("ativo");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [filesItem, setFilesItem] = useState<CatalogItem | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const catalogQuery = useQuery({
    queryKey: ["catalog", { search, status }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, { search: string; status: CatalogStatusFilter }];
      const query = new URLSearchParams();
      if (params.search.trim()) query.set("search", params.search.trim());
      if (params.status && params.status !== "ativo") query.set("status", params.status);

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiRequest("GET", `/api/catalog${suffix}`);
      const data = await response.json();
      return (data.items ?? []) as CatalogItem[];
    },
  });

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: CatalogMutationPayload) => {
      const response = await apiRequest("POST", "/api/catalog", payload);
      const data = await response.json();
      return data.item as CatalogItem;
    },
    onSuccess: () => {
      toast({
        title: "Item criado",
        description: "O item foi adicionado ao catálogo.",
      });
      invalidateCatalog();
      setFormOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar item",
        description: error instanceof Error ? error.message : "Não foi possível criar o item.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: CatalogMutationPayload }) => {
      const response = await apiRequest("PUT", `/api/catalog/${id}`, payload);
      const data = await response.json();
      return data.item as CatalogItem;
    },
    onSuccess: () => {
      toast({
        title: "Item atualizado",
        description: "As alterações foram salvas.",
      });
      invalidateCatalog();
      setFormOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar item",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o item.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: number; hard?: boolean }) => {
      const suffix = hard ? "?hard=true" : "";
      const response = await apiRequest("DELETE", `/api/catalog/${id}${suffix}`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data?.deleted ? "Item removido" : "Item arquivado",
        description: data?.deleted
          ? "O item foi removido do catálogo."
          : "O item foi arquivado e não aparecerá nas buscas.",
      });
      invalidateCatalog();
      setDeleteTarget(null);
      setHardDelete(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover item",
        description: error instanceof Error ? error.message : "Não foi possível remover o item.",
      });
    },
  });

  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const openCreate = () => {
    setFormMode("create");
    setEditingItem(null);
    setFormOpen(true);
  };

  const openFilesDialog = (item: CatalogItem) => {
    setFilesItem(item);
    setFilesDialogOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setFormMode("edit");
    setEditingItem(item);
    setFormOpen(true);
  };

  const onSubmitForm = (payload: CatalogMutationPayload) => {
    if (formMode === "create") {
      createMutation.mutate(payload);
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    }
  };

  const openDeleteDialog = (item: CatalogItem) => {
    setDeleteTarget(item);
    setHardDelete(false);
  };

  const handleFilesDialogChange = (open: boolean) => {
    setFilesDialogOpen(open);
    if (!open) {
      setFilesItem(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Listagem e CRUD completo dos itens. Todos os textos exibidos devem estar em português.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => catalogQuery.refetch()} disabled={catalogQuery.isFetching}>
            {catalogQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo item
          </Button>
        </div>
      </div>

      <InstructionsPanel
        scopes={["catalog"]}
        title="Instruções do catálogo"
        description="Revise o checklist de preenchimento antes de criar ou editar itens."
      />

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="Buscar por nome, categoria ou tag..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Limpar busca"
                disabled={!search}
                onClick={() => setSearch("")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select value={status} onValueChange={(value) => setStatus(value as CatalogStatusFilter)}>
                <SelectTrigger id="status-filter" className="w-[160px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilters.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} listado{items.length === 1 ? "" : "s"}
          </div>
        </div>

        {catalogQuery.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "Erro ao carregar o catálogo."}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando catálogo...
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!catalogQuery.isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      Nenhum item encontrado com os filtros atuais. Cadastre um novo item ou ajuste a busca.
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[260px] align-top">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">{item.manufacturer}</TableCell>
                  <TableCell className="align-top text-sm font-semibold">{formatPriceBRL(item.price)}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant={item.status === "ativo" ? "default" : "outline"}>
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.length === 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Sem tags
                        </Badge>
                      )}
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openFilesDialog(item)}>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Arquivos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CatalogFilesDialog item={filesItem} open={filesDialogOpen} onOpenChange={handleFilesDialogChange} />

      <CatalogFormDialog
        mode={formMode}
        open={formOpen}
        initialItem={editingItem}
        onOpenChange={setFormOpen}
        onSubmit={onSubmitForm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setHardDelete(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hardDelete ? "Remover permanentemente?" : "Arquivar item?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {hardDelete
                  ? "Esta ação remove o item do banco de dados. Não será possível recuperá-lo."
                  : "O item será marcado como arquivado e sairá das buscas. Você pode restaurá-lo editando o status."}
              </p>
              {deleteTarget && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                  {deleteTarget.name} — {deleteTarget.category}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center gap-2 rounded-md border p-3">
            <Switch id="hard-delete" checked={hardDelete} onCheckedChange={setHardDelete} />
            <div className="space-y-0">
              <Label htmlFor="hard-delete" className="text-sm font-medium">
                Remover definitivamente
              </Label>
              <p className="text-xs text-muted-foreground">
                Se desativado, o item apenas será arquivado.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ id: deleteTarget.id, hard: hardDelete });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hardDelete ? "Remover" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
