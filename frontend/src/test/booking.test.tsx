import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Booking from '@/pages/Booking';
import { queryClient, api } from '@/lib/api';
import { useBookingSelection } from '@/lib/booking-store';
import { dateSchema, nameSchema } from '@/lib/schemas';
const availability = {
  date: '2026-09-15',
  timezone: 'America/Sao_Paulo',
  isBusinessDay: true,
  reason: null,
  slots: [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
  ],
  occupied: ['08:00'],
  blocked: ['11:00'],
  holidays: [],
};
function respond(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
beforeEach(() => {
  queryClient.clear();
  useBookingSelection.setState({ date: '2026-09-15', time: '' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});
describe('booking form', () => {
  it('disables past calendar dates and prevents a manually entered past booking', async () => {
    const fetcher = vi.fn(async (input: string) =>
      respond(input === '/api/meta' ? { today: '2026-09-15' } : availability),
    );
    vi.stubGlobal('fetch', fetcher);
    render(
      <QueryClientProvider client={queryClient}>
        <Booking />
      </QueryClientProvider>,
    );
    await screen.findByRole('radio', { name: '09:00' });
    expect(screen.getByLabelText('Data da consulta')).toHaveAttribute('min', '2026-09-15');
    expect(screen.getByRole('button', { name: '14 de setembro de 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Data da consulta'), {
      target: { value: '2026-09-14' },
    });
    expect(await screen.findByText('Escolha hoje ou uma data futura.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(fetcher.mock.calls.some(([url]) => url === '/api/available?date=2026-09-14')).toBe(
      false,
    );
  });
  it('prevents occupied slots and sends a validated booking only after a selection', async () => {
    const requests: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit = {}) => {
        if (input === '/api/meta') return respond({ today: '2026-09-15', year: 2026 });
        if (input.startsWith('/api/available')) return respond(availability);
        requests.push({ url: input, body: JSON.parse(String(options.body)) });
        return respond({
          id: 'a1',
          name: 'Ana Maria',
          date: '2026-09-15',
          time: '09:00',
          endTime: '10:00',
          status: 'CONFIRMED',
          version: 1,
        });
      }),
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <Booking />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('radio', { name: '08:00' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(await screen.findByText('Informe o nome completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefone com DDD')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);
    await user.type(screen.getByLabelText('Seu nome completo'), '  Ana Maria  ');
    await user.type(screen.getByLabelText('E-mail'), 'Ana@exemplo.com');
    await user.type(screen.getByLabelText('Telefone com DDD'), '(11) 99999-9999');
    await user.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    expect(await screen.findByRole('heading', { name: 'Consulta agendada.' })).toBeInTheDocument();
    expect(requests).toEqual([
      {
        url: '/api/appointments',
        body: {
          name: 'Ana Maria',
          email: 'ana@exemplo.com',
          phone: '11999999999',
          date: '2026-09-15',
          time: '09:00',
        },
      },
    ]);
    expect(useBookingSelection.getState().time).toBe('');
  });
  it('clears the selected time immediately when the user changes date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        respond(input === '/api/meta' ? { today: '2026-09-15' } : availability),
      ),
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <Booking />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('radio', { name: '09:00' }));
    expect(useBookingSelection.getState().time).toBe('09:00');
    fireEvent.change(screen.getByLabelText('Data da consulta'), {
      target: { value: '2026-09-16' },
    });
    expect(useBookingSelection.getState().time).toBe('');
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
  });
  it('keeps provider failures visible without inventing available slots', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input === '/api/meta'
          ? respond({ today: '2026-09-15' })
          : respond({ error: { message: 'Serviço de feriados indisponível.' } }, 503),
      ),
    );
    render(
      <QueryClientProvider client={queryClient}>
        <Booking />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Serviço de feriados indisponível.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
  });
});
describe('privacy and validation', () => {
  it('clears all private cached patient data after session expiration', async () => {
    queryClient.setQueryData(['private', 'appointments', '2026-09-15'], {
      appointments: [{ name: 'Private Patient' }],
    });
    queryClient.setQueryData(['session'], { user: { name: 'Reception' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respond({ error: { message: 'Sessão expirada.' } }, 401)),
    );
    await expect(api('/appointments')).rejects.toThrow('Sessão expirada.');
    await waitFor(() =>
      expect(queryClient.getQueryData(['private', 'appointments', '2026-09-15'])).toBeUndefined(),
    );
    expect(queryClient.getQueryData(['session'])).toBeNull();
  });
  it('rejects nonexistent or out-of-year dates and trims patient names', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateSchema.safeParse('2027-01-01').success).toBe(false);
    expect(dateSchema.safeParse('2026-12-31').success).toBe(true);
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.parse('  Ana  ')).toBe('Ana');
  });
});
