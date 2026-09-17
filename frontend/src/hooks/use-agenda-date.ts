import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAgendaDate() {
  const [date, setDate] = useState('');
  const initializedDate = useRef(false);
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => api<{ today: string }>('/meta') });
  useEffect(() => {
    if (!initializedDate.current && meta.data) {
      initializedDate.current = true;
      setDate(meta.data.today.startsWith('2026-') ? meta.data.today : '2026-01-01');
    }
  }, [meta.data]);
  return { date, setDate, meta };
}
