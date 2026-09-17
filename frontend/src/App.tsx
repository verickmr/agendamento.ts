import { lazy, Suspense } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  ArrowRight,
  Leaf,
  PanelTop,
  CalendarOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import { ErrorNotice, Loading } from '@/components/shared';
import { api, queryClient, type User } from '@/lib/api';
import { loginSchema } from '@/lib/schemas';
const Booking = lazy(() => import('@/pages/Booking'));
const Reception = lazy(() => import('@/pages/Reception'));
const Blocks = lazy(() => import('@/pages/Blocks'));
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Clínica Serena, início">
      <span className="brand-icon">+</span>
      <span>
        clínica <strong>serena</strong>
        <small>ESPAÇO DE CUIDADO</small>
      </span>
    </Link>
  );
}
function PublicLayout() {
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>
            Agendar consulta
          </NavLink>
          <NavLink to="/reception">
            <LockKeyhole />
            Recepção
          </NavLink>
        </nav>
      </header>
      <Suspense
        fallback={
          <main className="auth-loading">
            <Loading label="Preparando seu espaço…" />
          </main>
        }
      >
        <Outlet />
      </Suspense>
      <footer className="public-footer">
        <span>Clínica Serena</span>
        <span>Cuidado presente. Vida mais leve.</span>
      </footer>
    </>
  );
}
function Login() {
  const navigate = useNavigate();
  const form = useForm<{ email: string; password: string }>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.removeQueries({ queryKey: ['private'] });
      queryClient.setQueryData(['session'], data);
      navigate('/reception', { replace: true });
    },
  });
  return (
    <main className="login-page">
      <section className="login-story">
        <span className="eyebrow">CUIDAR COMEÇA NA RECEPÇÃO</span>
        <h1>
          Organização para
          <br />
          acolher melhor.
        </h1>
        <p>Um espaço simples para acompanhar consultas e preparar cada novo atendimento.</p>
        <div className="login-art" aria-hidden="true">
          <Leaf />
          <div />
          <span />
        </div>
        <div className="login-trust">
          <ShieldCheck />
          Acesso exclusivo à equipe da clínica
        </div>
      </section>
      <section className="login-form">
        <span className="login-symbol">
          <LockKeyhole />
        </span>
        <h2>Bem-vindo de volta</h2>
        <p>Entre com sua conta da recepção.</p>
        <form noValidate onSubmit={form.handleSubmit((data) => login.mutate(data))}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="voce@clinica.com.br"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.password}>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>
            {login.isError && <ErrorNotice error={login.error} />}
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Entrando…' : 'Entrar na recepção'}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </FieldGroup>
        </form>
        <p className="login-help">Precisa de acesso? Fale com a administração da clínica.</p>
      </section>
    </main>
  );
}
function ProtectedLayout() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ user: User } | null>('/auth/me'),
    retry: false,
  });
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['private'] });
      queryClient.setQueryData(['session'], null);
      navigate('/login', { replace: true });
    },
  });
  if (session.isPending)
    return (
      <main className="auth-loading">
        <Loading label="Verificando acesso…" />
      </main>
    );
  if (!session.data) {
    if (session.error && 'status' in session.error && session.error.status !== 401)
      return (
        <main className="auth-loading">
          <ErrorNotice error={session.error} retry={() => void session.refetch()} />
        </main>
      );
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="reception-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">ÁREA DA RECEPÇÃO</div>
        <nav aria-label="Recepção">
          <NavLink to="/reception" end>
            <CalendarDays />
            Agendamentos
          </NavLink>
          <NavLink to="/reception/blocks">
            <CalendarOff />
            Bloqueios da agenda
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf />
            <strong>Cada horário, um cuidado.</strong>
            <p>Uma agenda organizada faz espaço para o que importa.</p>
          </div>
          <Link to="/" className="public-back">
            <PanelTop />
            Página de agendamento
            <ArrowRight />
          </Link>
        </div>
      </aside>
      <div className="reception-body">
        <header className="reception-header">
          <span>
            <span className="live-dot" />
            Recepção · Clínica Serena
          </span>
          <div className="user-actions">
            <span className="avatar">{session.data.user.name.slice(0, 1).toUpperCase()}</span>
            <span className="user-name">
              {session.data.user.name}
              <small>Equipe da recepção</small>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair da recepção"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut />
            </Button>
          </div>
        </header>
        {logout.isError && <ErrorNotice error={logout.error} />}
        <main className="reception-content">
          <Suspense fallback={<Loading label="Carregando agenda…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Booking />} />
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/reception" element={<Reception />} />
        <Route path="/reception/blocks" element={<Blocks />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
