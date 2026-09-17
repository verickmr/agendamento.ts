import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Check,
  CalendarDays,
  Clock3,
  MapPin,
  Stethoscope,
  ShieldCheck,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, DateField, ErrorNotice, Loading } from '@/components/shared';
import {
  api,
  availabilityOptions,
  formatDate,
  allTimes,
  refreshAppointments,
  type Appointment,
} from '@/lib/api';
import { useBookingSelection } from '@/lib/booking-store';
import { bookingSchema, dateSchema } from '@/lib/schemas';
export default function Booking() {
  const { date, time, setDate, setTime, clear } = useBookingSelection();
  const initializedDate = useRef(Boolean(date));
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const meta = useQuery({
    refetchInterval: 30_000,
    queryKey: ['meta'],
    queryFn: () => api<{ today: string; year: number }>('/meta'),
  });
  useEffect(() => {
    if (!initializedDate.current && meta.data) {
      initializedDate.current = true;
      setDate(
        meta.data.today < '2026-01-01'
          ? '2026-01-01'
          : meta.data.today > '2026-12-31'
            ? '2026-12-31'
            : meta.data.today,
      );
    }
  }, [meta.data, setDate]);
  const minDate =
    meta.data?.today && meta.data.today > '2026-01-01' ? meta.data.today : '2026-01-01';
  const pastDate = Boolean(meta.data && date && date < minDate);
  const validDate = dateSchema.safeParse(date).success && !pastDate;
  const available = useQuery({ ...availabilityOptions(date), enabled: validDate });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string; email: string; phone: string }>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });
  useEffect(() => {
    if (time && available.data && !available.data.slots.some((s) => s.start === time)) clear();
  }, [available.data, time, clear]);
  const book = useMutation({
    mutationFn: (contact: { name: string; email: string; phone: string }) =>
      api<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...contact, date, time }),
      }),
    onSuccess: async (result) => {
      setConfirmed(result);
      clear();
      reset();
      await refreshAppointments();
    },
    onError: () => {
      void available.refetch();
      clear();
    },
  });
  const availableTimes = new Set(available.data?.slots.map((s) => s.start) || []);
  if (confirmed)
    return (
      <main className="confirmation-wrap">
        <div className="success-mark">
          <Check />
        </div>
        <span className="eyebrow">TUDO CERTO</span>
        <h1>Consulta agendada.</h1>
        <p>Seu próximo cuidado já tem dia e hora, {confirmed.name.split(' ')[0]}.</p>
        <div className="confirmation-ticket">
          <Stethoscope />
          <h2>Atendimento clínico</h2>
          <Separator />
          <div>
            <CalendarDays />
            <span>
              {formatDate(confirmed.date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div>
            <Clock3 />
            <span>
              {confirmed.time} às {confirmed.endTime} · Horário de Brasília
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>{confirmed.name}</span>
          </div>
          {confirmed.email && (
            <div>
              <Mail aria-hidden="true" />
              <span className="patient-contact">
                <strong>E-mail para contato</strong>
                <span>{confirmed.email}</span>
              </span>
            </div>
          )}
          {confirmed.phone && (
            <div>
              <Phone aria-hidden="true" />
              <span className="patient-contact">
                <strong>Telefone para contato</strong>
                <span>{confirmed.phone}</span>
              </span>
            </div>
          )}
          <Badge variant="secondary">Agendamento confirmado</Badge>
        </div>
        <p>A recepção poderá usar os contatos informados para falar com você sobre a consulta.</p>
        <p className="muted">Para alterar ou cancelar, entre em contato com a recepção.</p>
        <Button
          onClick={() => {
            setConfirmed(null);
            book.reset();
          }}
        >
          Agendar outra consulta <ArrowRight data-icon="inline-end" />
        </Button>
      </main>
    );
  return (
    <main className="public-main">
      <section className="hero">
        <span className="eyebrow">
          <span /> CUIDADO QUE ACOLHE
        </span>
        <h1>Seu cuidado começa aqui.</h1>
        <p>
          Escolha o melhor dia e horário.
          <br className="mobile-break" /> O resto, a gente cuida com você.
        </p>
      </section>
      {meta.isError && <ErrorNotice error={meta.error} retry={() => void meta.refetch()} />}
      <div className="booking-panel">
        <section className="booking-picker">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Escolha quando vir</h2>
              <p>Encontre um momento para cuidar de você.</p>
            </div>
          </div>
          <div className="picker-columns">
            <div>
              <DateField value={date} onChange={setDate} min={minDate} />
              {date && !validDate && (
                <p role="alert" className="field-error">
                  {pastDate
                    ? 'Escolha hoje ou uma data futura.'
                    : 'Escolha uma data válida de 2026.'}
                </p>
              )}
              {dateSchema.safeParse(date).success && (
                <Calendar key={date.slice(0, 7)} date={date} onSelect={setDate} min={minDate} />
              )}
            </div>
            <section className="time-section" aria-labelledby="times-label">
              <h3 id="times-label">Horários disponíveis</h3>
              <p>Consultas de 1 hora</p>
              {(!date || (validDate && available.isPending)) && (
                <Loading label="Consultando horários…" />
              )}
              {available.isError && (
                <ErrorNotice error={available.error} retry={() => void available.refetch()} />
              )}
              {available.data && validDate && !available.isError && (
                <>
                  <div className="time-grid" role="radiogroup" aria-label="Horário da consulta">
                    {allTimes.map((t) => (
                      <label
                        className="time-choice"
                        data-selected={time === t}
                        data-disabled={
                          !availableTimes.has(t) || available.isFetching || book.isPending
                        }
                        key={t}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="appointment-time"
                          aria-label={t}
                          checked={time === t}
                          disabled={
                            !availableTimes.has(t) || available.isFetching || book.isPending
                          }
                          onChange={() => {
                            setTime(t);
                            book.reset();
                          }}
                        />
                        {t}
                        {time === t && <Check aria-hidden="true" />}
                      </label>
                    ))}
                  </div>
                  <div className="slots-legend">
                    <span />
                    Disponível <span className="unavailable-dot" />
                    Indisponível
                  </div>
                  {available.data.slots.length === 0 && (
                    <Alert>
                      <AlertTitle>Sem horários disponíveis</AlertTitle>
                      <AlertDescription>
                        {available.data.reason ||
                          'Todos os horários deste dia estão ocupados. Escolha outra data.'}
                      </AlertDescription>
                    </Alert>
                  )}
                  {available.isFetching && (
                    <p role="status" className="muted">
                      Atualizando horários…
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </section>
        <aside className="booking-summary">
          <div className="section-heading">
            <span className="step-number">02</span>
            <div>
              <h2>Sua consulta</h2>
              <p>Um momento só seu.</p>
            </div>
          </div>
          <div className="summary-lines">
            <div>
              <Stethoscope />
              <span>Atendimento clínico</span>
            </div>
            <div>
              <CalendarDays />
              <span>
                {validDate
                  ? formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Escolha uma data'}
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                {time
                  ? `${time} às ${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`
                  : 'Escolha um horário'}
              </span>
            </div>
          </div>
          <Separator />
          <form
            onSubmit={handleSubmit((contact) => {
              if (meta.data && validDate && availableTimes.has(time) && !available.isFetching)
                book.mutate(contact);
            })}
          >
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="patient-name">Seu nome completo</FieldLabel>
                <Input
                  id="patient-name"
                  placeholder="Como podemos chamar você?"
                  autoComplete="name"
                  maxLength={120}
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="patient-email">E-mail</FieldLabel>
                <Input
                  id="patient-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  maxLength={254}
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="patient-phone">Telefone com DDD</FieldLabel>
                <Input
                  id="patient-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  maxLength={30}
                  aria-invalid={!!errors.phone}
                  {...register('phone')}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              {book.isError && <ErrorNotice error={book.error} />}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  !meta.data ||
                  !time ||
                  !validDate ||
                  available.isFetching ||
                  available.isError ||
                  book.isPending
                }
              >
                {book.isPending ? 'Confirmando…' : 'Confirmar agendamento'}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <p className="summary-footnote">
            <ShieldCheck />
            Usaremos seu e-mail e telefone para entrar em contato sobre seu atendimento.
          </p>
        </aside>
      </div>
      <div className="clinic-facts">
        <span>
          <CalendarDays />
          Segunda a sexta
        </span>
        <span>
          <Clock3 />
          08:00 às 18:00
        </span>
        <span>
          <MapPin />
          Horário de Brasília
        </span>
      </div>
      <p className="public-note">
        Datas e horários passados, feriados e finais de semana não estão disponíveis.
      </p>
    </main>
  );
}
