import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CalendarDays,
  Clock3,
  ArrowUpRight,
  Pencil,
  X,
  Check,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { DateField, ErrorNotice, Loading } from '@/components/shared';
import {
  api,
  formatDate,
  refreshAppointments,
  availabilityOptions,
  type Appointment,
} from '@/lib/api';
import { dateSchema, editSchema } from '@/lib/schemas';
import { useAgendaDate } from '@/hooks/use-agenda-date';
export default function Reception() {
  const { date, setDate, meta } = useAgendaDate();
  const [status, setStatus] = useState('CONFIRMED');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const valid = dateSchema.safeParse(date).success;
  const appointments = useQuery({
    queryKey: ['private', 'appointments', date],
    queryFn: () => api<{ appointments: Appointment[] }>(`/appointments?date=${date}&status=ALL`),
    enabled: valid,
  });
  const all = appointments.data?.appointments || [];
  const displayed = all
    .filter(
      (a) =>
        (status === 'ALL' || a.status === status) &&
        a.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const confirmed = all.filter((a) => a.status === 'CONFIRMED');
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">AGENDA DA CLÍNICA</span>
          <h1>Agendamentos</h1>
          <p>Um olhar para o dia. Mais tempo para cuidar.</p>
        </div>
        <Button asChild>
          <Link to="/">
            <CalendarDays data-icon="inline-start" />
            Agendar consulta
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <div className="stat-grid">
        <article className="stat-card">
          <span>
            Consultas confirmadas
            <CalendarDays />
          </span>
          <strong>{appointments.isSuccess ? confirmed.length : '—'}</strong>
          <small>Na data selecionada</small>
        </article>
        <article className="stat-card">
          <span>
            Horários reservados
            <Clock3 />
          </span>
          <strong>{appointments.isSuccess ? `${confirmed.length}h` : '—'}</strong>
          <small>Atendimentos de uma hora</small>
        </article>
        <article className="stat-card">
          <span>
            Consultas canceladas
            <Users />
          </span>
          <strong>
            {appointments.isSuccess ? all.filter((a) => a.status === 'CANCELLED').length : '—'}
          </strong>
          <small>Histórico preservado</small>
        </article>
      </div>
      <section className="agenda-card">
        <div className="agenda-toolbar">
          <div>
            <h2>Sua agenda</h2>
            <p>
              {valid
                ? formatDate(date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Selecione uma data'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={appointments.isFetching || !valid}
            onClick={() => void appointments.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
        </div>
        <div className="filter-bar">
          <DateField id="agenda-date" value={date} onChange={setDate} label="Data" />
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <select
              className="native-select"
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="CONFIRMED">Confirmadas</option>
              <option value="CANCELLED">Canceladas</option>
              <option value="ALL">Todos os status</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="search-name">Buscar paciente</FieldLabel>
            <Input
              id="search-name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome do paciente"
            />
          </Field>
        </div>
        {date && !valid && (
          <p className="field-error" role="alert">
            Escolha uma data válida de 2026.
          </p>
        )}
        {meta.isError && <ErrorNotice error={meta.error} retry={() => void meta.refetch()} />}
        {valid && appointments.isPending && <Loading label="Carregando agendamentos…" />}
        {appointments.isError && (
          <ErrorNotice error={appointments.error} retry={() => void appointments.refetch()} />
        )}
        {appointments.isSuccess && displayed.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>Nenhuma consulta por aqui</EmptyTitle>
              <EmptyDescription>
                {search
                  ? 'Não encontramos pacientes com esse nome.'
                  : 'Não há consultas para a data e o status selecionados.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {appointments.isSuccess && displayed.length > 0 && (
          <div className="appointment-table">
            <div className="table-heading">
              <span>HORÁRIO</span>
              <span>PACIENTE</span>
              <span>STATUS</span>
              <span>AÇÕES</span>
            </div>
            {displayed.map((a) => (
              <article className="appointment-row" key={a.id}>
                <div className="appointment-time">
                  <strong>{a.time}</strong>
                  <small>até {a.endTime}</small>
                </div>
                <div className="patient-cell">
                  <span className="patient-avatar">{a.name.charAt(0).toUpperCase()}</span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>Atendimento clínico</small>
                  </span>
                </div>
                <div>
                  <Badge variant={a.status === 'CONFIRMED' ? 'secondary' : 'outline'}>
                    {a.status === 'CONFIRMED' ? <Check /> : <X />}
                    {a.status === 'CONFIRMED' ? 'Confirmada' : 'Cancelada'}
                  </Badge>
                </div>
                <div className="row-actions">
                  {a.status === 'CONFIRMED' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(a)}
                        aria-label={`Editar consulta de ${a.name}`}
                      >
                        <Pencil data-icon="inline-start" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCancelling(a)}
                        aria-label={`Cancelar consulta de ${a.name}`}
                      >
                        <X />
                      </Button>
                    </>
                  ) : (
                    <span className="muted">Sem ações</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="table-footer">
          <span>
            {displayed.length} {displayed.length === 1 ? 'consulta exibida' : 'consultas exibidas'}
          </span>
          <span>
            <Clock3 />
            Horário de Brasília
          </span>
        </div>
      </section>
      {editing && <EditDialog appointment={editing} onClose={() => setEditing(null)} />}{' '}
      {cancelling && <CancelDialog appointment={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
function EditDialog({
  appointment: a,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: a.name, date: a.date, time: a.time },
  });
  const date = form.watch('date');
  const time = form.watch('time');
  const valid = dateSchema.safeParse(date).success;
  const availability = useQuery({ ...availabilityOptions(date), enabled: valid });
  const options = availability.data?.slots.map((s) => s.start) || [];
  const times = Array.from(new Set([...(date === a.date ? [a.time] : []), ...options])).sort();
  const changedSchedule = date !== a.date || time !== a.time;
  const update = useMutation({
    mutationFn: (values: z.infer<typeof editSchema>) => {
      const patch = {
        version: a.version,
        name: values.name,
        ...(changedSchedule ? { date: values.date, time: values.time } : {}),
      };
      return api<Appointment>(`/appointments/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    onSuccess: async () => {
      await refreshAppointments();
      toast.success('Consulta atualizada.');
      onClose();
    },
    onError: () => {
      void refreshAppointments();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar consulta</DialogTitle>
          <DialogDescription>
            Atualize o nome ou escolha uma nova data e horário. A consulta atual será mantida se a
            alteração não puder ser concluída.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => update.mutate(values))}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="edit-name">Nome completo</FieldLabel>
              <Input
                id="edit-name"
                maxLength={120}
                aria-invalid={!!form.formState.errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.date}>
              <FieldLabel htmlFor="edit-date">Data da consulta</FieldLabel>
              <Input
                type="date"
                id="edit-date"
                min="2026-01-01"
                max="2026-12-31"
                aria-invalid={!!form.formState.errors.date}
                {...form.register('date', { onChange: () => form.setValue('time', '') })}
              />
              <FieldError errors={[form.formState.errors.date]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.time}>
              <FieldLabel htmlFor="edit-time">Horário</FieldLabel>
              <select
                className="native-select"
                id="edit-time"
                aria-invalid={!!form.formState.errors.time}
                {...form.register('time')}
              >
                <option value="">Selecione um horário</option>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {date === a.date && t === a.time ? ' · horário atual' : ''}
                  </option>
                ))}
              </select>
              <FieldError errors={[form.formState.errors.time]} />
            </Field>
            {availability.isFetching && (
              <p role="status" className="muted">
                Consultando disponibilidade…
              </p>
            )}
            {availability.isError && (
              <ErrorNotice error={availability.error} retry={() => void availability.refetch()} />
            )}{' '}
            {availability.data?.slots.length === 0 && date !== a.date && (
              <p className="muted">
                {availability.data.reason || 'Não há horários disponíveis nesta data.'}
              </p>
            )}
            {update.isError && <ErrorNotice error={update.error} />}
            <DialogFooter>
              <Button variant="outline" type="button" disabled={update.isPending} onClick={onClose}>
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={
                  update.isPending ||
                  (changedSchedule &&
                    (availability.isFetching || availability.isError || !options.includes(time)))
                }
              >
                {update.isPending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CancelDialog({
  appointment: a,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const cancel = useMutation({
    mutationFn: () =>
      api<Appointment>(`/appointments/${a.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ version: a.version }),
      }),
    onSuccess: async () => {
      await refreshAppointments();
      toast.success('Consulta cancelada.');
      onClose();
    },
    onError: () => void refreshAppointments(),
  });
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !cancel.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta consulta?</AlertDialogTitle>
          <AlertDialogDescription>
            A consulta de <strong>{a.name}</strong>, em {formatDate(a.date)} às {a.time}, será
            cancelada. O registro ficará no histórico e o horário será liberado na agenda.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cancel.isError && <ErrorNotice error={cancel.error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>Manter consulta</AlertDialogCancel>
          <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            {cancel.isPending ? 'Cancelando…' : 'Sim, cancelar consulta'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
