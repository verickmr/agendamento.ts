import { QueryClient } from '@tanstack/react-query';
export type Appointment = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  date: string;
  time: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED';
  version: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
};
export type Block = {
  id: string;
  date: string;
  time: string | null;
  reason: string | null;
  createdAt: string;
};
export type Availability = {
  date: string;
  timezone: string;
  isBusinessDay: boolean;
  reason: string | null;
  slots: { start: string; end: string }[];
  occupied: string[];
  blocked: string[];
  holidays: { date: string; localName: string }[];
};
export type User = { id: string; name: string; email: string };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { appointments?: Appointment[] },
  ) {
    super(message);
  }
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'Não foi possível conectar à clínica. Verifique sua conexão e tente novamente.',
    );
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      queryClient.removeQueries({ queryKey: ['private'] });
      queryClient.setQueryData(['session'], null);
    }
    throw new ApiError(
      response.status,
      payload?.error?.message || 'Não foi possível concluir. Tente novamente.',
      payload?.error?.details,
    );
  }
  return payload as T;
}
export async function refreshAppointments() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['private'] }),
    queryClient.invalidateQueries({ queryKey: ['available'] }),
  ]);
}
export const availabilityOptions = (date: string) => ({
  refetchInterval: 30_000,
  queryKey: ['available', date],
  queryFn: () => api<Availability>(`/available?date=${date}`),
  enabled: /^2026-\d{2}-\d{2}$/.test(date),
});
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long' },
) {
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`),
  );
}
export const allTimes = Array.from(
  { length: 10 },
  (_, i) => `${String(i + 8).padStart(2, '0')}:00`,
);
