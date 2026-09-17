import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarOff, Plus, Trash2, Clock3, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { DateField, ErrorNotice, Loading } from '@/components/shared';
import { api, allTimes, formatDate, refreshAppointments, ApiError, type Block } from '@/lib/api';
import { blockSchema, dateSchema } from '@/lib/schemas';
import { useAgendaDate } from '@/hooks/use-agenda-date';
export default function Blocks() {
  const { date, setDate, meta } = useAgendaDate();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Block | null>(null);
  const valid = dateSchema.safeParse(date).success;
  const blocks = useQuery({
    queryKey: ['private', 'blocks', date],
    queryFn: () => api<{ blocks: Block[] }>(`/availability-blocks?date=${date}`),
    enabled: valid,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DISPONIBILIDADE</span>
          <h1>Bloqueios da agenda</h1>
          <p>Reserve pausas, reuniões ou um dia sem atendimentos.</p>
        </div>
        <Button disabled={!valid} onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Novo bloqueio
        </Button>
      </div>
      <Alert>
        <ShieldCheck />
        <AlertTitle>Sua agenda, com flexibilidade</AlertTitle>
        <AlertDescription>
          Bloqueios impedem novos agendamentos. Se já houver uma consulta confirmada, resolva o
          conflito antes de bloquear o período.
        </AlertDescription>
      </Alert>
      <section className="agenda-card blocks-card">
        <div className="agenda-toolbar">
          <div>
            <h2>Períodos bloqueados</h2>
            <p>O motivo é visível somente para a recepção.</p>
          </div>
          <div className="block-date-filter">
            <DateField label="Filtrar por data" value={date} onChange={setDate} />
          </div>
        </div>
        {meta.isError && <ErrorNotice error={meta.error} retry={() => void meta.refetch()} />}
        {date && !valid && (
          <p className="field-error" role="alert">
            Escolha uma data válida de 2026.
          </p>
        )}
        {valid && blocks.isPending && <Loading label="Carregando bloqueios…" />}
        {blocks.isError && (
          <ErrorNotice error={blocks.error} retry={() => void blocks.refetch()} />
        )}{' '}
        {blocks.isSuccess && blocks.data.blocks.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarOff />
              </EmptyMedia>
              <EmptyTitle>Um dia sem bloqueios</EmptyTitle>
              <EmptyDescription>
                Nenhum período bloqueado em {formatDate(date)}. Os horários seguem as regras de
                funcionamento da clínica.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {blocks.data?.blocks.map((block) => (
          <article className="block-row" key={block.id}>
            <span className="block-icon">
              <CalendarOff />
            </span>
            <div>
              <h3>
                {block.time
                  ? `${block.time} às ${String(Number(block.time.slice(0, 2)) + 1).padStart(2, '0')}:00`
                  : 'Dia inteiro'}
                <Badge variant="outline">Bloqueado</Badge>
              </h3>
              <p>{formatDate(block.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <small>{block.reason || 'Sem motivo informado'}</small>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoving(block)}
              aria-label={`Remover bloqueio de ${block.time || 'dia inteiro'}`}
            >
              <Trash2 data-icon="inline-start" />
              Remover
            </Button>
          </article>
        ))}
        <div className="table-footer">
          <span>{blocks.data?.blocks.length || 0} bloqueios nesta data</span>
          <span>
            <Clock3 />
            Horário de Brasília
          </span>
        </div>
      </section>
      {creating && <CreateBlock date={date} onClose={() => setCreating(false)} />}{' '}
      {removing && <RemoveBlock block={removing} onClose={() => setRemoving(null)} />}
    </>
  );
}
function CreateBlock({ date, onClose }: { date: string; onClose: () => void }) {
  const form = useForm<z.infer<typeof blockSchema>>({
    resolver: zodResolver(blockSchema),
    defaultValues: { date, time: '', reason: '' },
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof blockSchema>) =>
      api<Block>('/availability-blocks', {
        method: 'POST',
        body: JSON.stringify({ ...values, time: values.time || null }),
      }),
    onSuccess: async () => {
      await refreshAppointments();
      toast.success('Bloqueio criado.');
      onClose();
    },
  });
  const conflicts =
    create.error instanceof ApiError ? create.error.details?.appointments : undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo bloqueio</DialogTitle>
          <DialogDescription>Escolha um horário ou reserve o dia inteiro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.date}>
              <FieldLabel htmlFor="block-date">Data</FieldLabel>
              <Input
                id="block-date"
                type="date"
                min="2026-01-01"
                max="2026-12-31"
                aria-invalid={!!form.formState.errors.date}
                {...form.register('date')}
              />
              <FieldError errors={[form.formState.errors.date]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.time}>
              <FieldLabel htmlFor="block-time">Período</FieldLabel>
              <select
                id="block-time"
                className="native-select"
                aria-invalid={!!form.formState.errors.time}
                {...form.register('time')}
              >
                <option value="">Dia inteiro</option>
                {allTimes.map((time) => (
                  <option value={time} key={time}>
                    {time} · 1 hora
                  </option>
                ))}
              </select>
              <FieldError errors={[form.formState.errors.time]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.reason}>
              <FieldLabel htmlFor="block-reason">Motivo (opcional)</FieldLabel>
              <Input
                id="block-reason"
                maxLength={300}
                placeholder="Ex.: reunião da equipe"
                aria-invalid={!!form.formState.errors.reason}
                {...form.register('reason')}
              />
              <FieldError errors={[form.formState.errors.reason]} />
            </Field>
            {create.isError && <ErrorNotice error={create.error} />}{' '}
            {conflicts && conflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Consultas que precisam de atenção</AlertTitle>
                <AlertDescription>
                  <ul>
                    {conflicts.map((a) => (
                      <li key={a.id}>
                        {a.time} · {a.name}
                      </li>
                    ))}
                  </ul>
                  Nenhuma consulta foi alterada.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
                Voltar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Bloqueando…' : 'Criar bloqueio'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function RemoveBlock({ block, onClose }: { block: Block; onClose: () => void }) {
  const remove = useMutation({
    mutationFn: () => api<void>(`/availability-blocks/${block.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refreshAppointments();
      toast.success('Bloqueio removido.');
      onClose();
    },
  });
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover este bloqueio?</AlertDialogTitle>
          <AlertDialogDescription>
            O período de {block.time || 'dia inteiro'} em {formatDate(block.date)} voltará a seguir
            a disponibilidade normal da clínica.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && <ErrorNotice error={remove.error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Manter bloqueio</AlertDialogCancel>
          <Button disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Removendo…' : 'Remover bloqueio'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
