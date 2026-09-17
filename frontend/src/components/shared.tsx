import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, CalendarDays, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/api';
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertTitle>Não foi possível concluir</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'}
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="animate-spin" aria-hidden="true" />
      {label}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
export function DateField({
  id = 'date',
  value,
  onChange,
  label = 'Data da consulta',
  min = '2026-01-01',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  min?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        type="date"
        id={id}
        min={min}
        max="2026-12-31"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </Field>
  );
}
export function Calendar({
  date,
  onSelect,
  min = '2026-01-01',
}: {
  date: string;
  onSelect: (date: string) => void;
  min?: string;
}) {
  const initial = date ? Number(date.slice(5, 7)) - 1 : 0;
  const [month, setMonth] = useState(initial);
  const start = new Date(Date.UTC(2026, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(2026, month + 1, 0)).getUTCDate();
  const monthDate = `2026-${String(month + 1).padStart(2, '0')}-01`;
  return (
    <section className="calendar" aria-label="Calendário de 2026">
      <div className="calendar-heading">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          disabled={month === 0 || monthDate <= min.slice(0, 7) + '-01'}
          onClick={() => setMonth(month - 1)}
        >
          <ChevronLeft />
        </Button>
        <strong>{formatDate(monthDate, { month: 'long', year: 'numeric' })}</strong>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          disabled={month === 11}
          onClick={() => setMonth(month + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="calendar-grid">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const value = `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const weekend = (start + i) % 7 === 0 || (start + i) % 7 === 6;
          return (
            <button
              type="button"
              key={value}
              className="calendar-day"
              aria-label={formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={date === value}
              disabled={weekend || value < min}
              onClick={() => onSelect(value)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="calendar-note">
        <CalendarDays aria-hidden="true" /> Agenda de 2026
      </p>
    </section>
  );
}
