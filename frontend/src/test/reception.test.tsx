import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import Reception from '@/pages/Reception';
import Blocks from '@/pages/Blocks';
import { queryClient } from '@/lib/api';
const appointment = {
  id: 'appt-1',
  name: 'Ana Maria',
  date: '2026-09-15',
  time: '09:00',
  endTime: '10:00',
  status: 'CONFIRMED',
  version: 3,
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-09-15T12:00:00Z',
  updatedAt: '2026-09-15T12:00:00Z',
  cancelledAt: null,
};
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
beforeEach(() => queryClient.clear());
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});
function mount(component: React.ReactNode) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
}
it('offers email and telephone links for the clinic and identifies legacy records without contacts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) =>
      response(
        input === '/api/meta'
          ? { today: '2026-09-15' }
          : {
              appointments: [
                { ...appointment, email: 'ana@exemplo.com', phone: '11999999999' },
                { ...appointment, id: 'legacy', name: 'Paciente antigo', email: null, phone: null },
              ],
            },
      ),
    ),
  );
  mount(<Reception />);
  expect(await screen.findByRole('link', { name: 'E-mail: ana@exemplo.com' })).toHaveAttribute(
    'href',
    'mailto:ana@exemplo.com',
  );
  expect(screen.getByRole('link', { name: 'Telefone: (11) 99999-9999' })).toHaveAttribute(
    'href',
    'tel:11999999999',
  );
  expect(screen.getByText('Contato não informado neste agendamento.')).toBeInTheDocument();
});
it('cancels only after confirmation and includes the displayed version', async () => {
  const mutations: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit = {}) => {
      if (options.method === 'POST') {
        mutations.push({ url: input, body: JSON.parse(String(options.body)) });
        return response({ ...appointment, status: 'CANCELLED', version: 4 });
      }
      return response(
        input === '/api/meta' ? { today: '2026-09-15' } : { appointments: [appointment] },
      );
    }),
  );
  const user = userEvent.setup();
  mount(<Reception />);
  await user.click(await screen.findByRole('button', { name: 'Cancelar consulta de Ana Maria' }));
  expect(mutations).toHaveLength(0);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Sim, cancelar consulta' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(mutations).toEqual([{ url: '/api/appointments/appt-1/cancel', body: { version: 3 } }]);
});
it('shows conflicting appointments and keeps the block form open on 409', async () => {
  const mutations: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit = {}) => {
      if (options.method === 'POST') {
        mutations.push(input);
        return response(
          {
            error: {
              code: 'CONFLICT',
              message: 'Existem consultas confirmadas neste período.',
              details: { appointments: [appointment] },
            },
          },
          409,
        );
      }
      return response(input === '/api/meta' ? { today: '2026-09-15' } : { blocks: [] });
    }),
  );
  const user = userEvent.setup();
  mount(<Blocks />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Novo bloqueio' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Novo bloqueio' }));
  await user.click(screen.getByRole('button', { name: 'Criar bloqueio' }));
  expect(await screen.findByText('09:00 · Ana Maria')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Nenhuma consulta foi alterada.')).toBeInTheDocument();
  expect(mutations).toEqual(['/api/availability-blocks']);
});

it('saves name-only edits when the holiday provider is unavailable', async () => {
  const mutations: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit = {}) => {
      if (options.method === 'PATCH') {
        mutations.push(JSON.parse(String(options.body)));
        return response({ ...appointment, name: 'Ana Silva', version: 4 });
      }
      if (input.startsWith('/api/available'))
        return response({ error: { message: 'Serviço de feriados indisponível.' } }, 503);
      return response(
        input === '/api/meta' ? { today: '2026-09-15' } : { appointments: [appointment] },
      );
    }),
  );
  const user = userEvent.setup();
  mount(<Reception />);
  await user.click(await screen.findByRole('button', { name: 'Editar consulta de Ana Maria' }));
  expect(await screen.findByText('Serviço de feriados indisponível.')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Nome completo'));
  await user.type(screen.getByLabelText('Nome completo'), 'Ana Silva');
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mutations).toEqual([{ version: 3, name: 'Ana Silva' }]);
});
