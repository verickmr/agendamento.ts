# Arquitetura e decisões

## Fluxo

O navegador chama `/api/*` na própria origem. O proxy encaminha ao Express. Middlewares verificam sessão e origem, controllers validam a entrada, services executam as operações e repositórios Prisma persistem no PostgreSQL. A API de feriados é acessada pelo backend através do contrato `HolidayProvider`.

## Responsabilidades

- Domínio: datas de 2026, grade horária e erros sem Express ou Prisma.
- Aplicação: disponibilidade e operações de agenda através de contratos explícitos.
- Infraestrutura: consultas Prisma, transações, locks, Nager.Date, senhas e sessões.
- HTTP: entrada Zod, autenticação, origem e tradução de erros.
- Frontend por funcionalidades: agendamento público, recepção e bloqueios.

```text
backend/src/
  app.ts                         Montagem e injeção das dependências
  http/
    app.ts                       Configuração do Express
    routes.ts                    Rotas e proteções de cada operação
    controllers/                 Entrada HTTP e respostas
    middleware/                  Sessão, origem, JSON e erros
    services.ts                  Contratos consumidos pelos controllers
    session.ts                   Ciclo da sessão e configuração do cookie
  application/
    auth-service.ts              Autenticação
    schedule-service.ts          Disponibilidade e operações da agenda
    repositories/                Contratos de persistência
    password-verifier.ts         Contrato de verificação de senha
  domain/                        Regras de calendário e tipos de domínio
  infrastructure/
    repositories/                Implementações Prisma e transações
    postgres-session-store.ts    Persistência das sessões
    nager.ts                     Cliente da API de feriados
    bcrypt-passwords.ts          Verificação de hashes
```

`src/app.ts` é o ponto de composição: conecta Prisma, sessões, serviços e HTTP. Os services recebem contratos por construtor e não importam Express ou Prisma. Os controllers recebem contratos restritos às operações que utilizam; a aplicação HTTP pode ser testada com serviços substitutos e sessão em memória. Em produção, as sessões continuam no PostgreSQL.

Agendamentos e bloqueios permanecem no mesmo service porque compartilham as regras de ocupação e o protocolo transacional. Não há repositório genérico, classe base ou contêiner de injeção: as dependências são explícitas e pequenas. Express foi mantido porque a organização necessária cabe nessas fronteiras, sem uma migração de framework.

TanStack Query guarda dados do servidor. Zustand contém apenas data/hora selecionados. React Hook Form controla os campos. Uma mutação não será repetida automaticamente; disponibilidade e listas são invalidadas após sucesso ou conflito.

## Concorrência é uma regra do banco

A restrição de unicidade é parcial: a combinação data/minuto só é única para consultas CONFIRMED. Cancelar mantém o registro, mas permite reutilizar a vaga. Uma restrição única comum impediria reservar novamente após cancelamento.

Verificar disponibilidade e inserir sem transação não é suficiente. Todas as mudanças de ocupação e bloqueios usam locks transacionais por data; remarcações bloqueiam as datas em ordem consistente. Após adquirir o lock, o estado é verificado novamente. A versão do agendamento evita que uma edição antiga sobrescreva uma nova.

Criar um bloqueio e reservar um horário participam do mesmo protocolo de locks. Assim, não há janela entre verificar consultas e bloquear. Uma remarcação inválida mantém a reserva original.

## Datas e feriados

Data de consulta é um dia de calendário, não um instante UTC. O domínio trabalha com AAAA-MM-DD e horário como minuto do dia; a conversão para DATE ocorre no repositório. Instantes de criação são UTC. A interface informa America/Sao_Paulo.

A agenda é limitada a 2026. Reservas e remarcações exigem horário futuro em `America/Sao_Paulo`, com verificação antes da consulta de feriados e novamente antes da escrita dentro da transação. O relógio é injetável para testes determinísticos. Correções de nome e cancelamentos de registros antigos continuam possíveis. Todas as datas retornadas pelo endpoint BR são bloqueadas, incluindo tipos opcionais e regionais. Sem API válida, não há reserva ou remarcação.

E-mail e telefone são obrigatórios em novas reservas e persistidos no PostgreSQL. A migração permite valores nulos nos registros antigos, sem inventar contatos. A disponibilidade pública não retorna esses dados.

## Autenticação

Não existem contas de pacientes nem múltiplos papéis. Toda pessoa autenticada pertence à recepção. O backend exige sessão para consultar ou administrar registros; proteção de rota no React não substitui autorização.

A sessão fica no PostgreSQL; o cookie contém somente seu identificador. Senhas são hashes, com seed idempotente de credenciais de ambiente. Login regenera sessão e logout invalida sessão e cache privado. O proxy mantém a origem única para cookies; origem é validada nas operações sensíveis.

## Decisões de escopo

IA, mensagens, recorrência de bloqueios, múltiplos médicos, exclusão definitiva e restauração de cancelados ficam fora da versão. A área de cancelados preserva os dados finais do agendamento; não é um registro completo de cada edição histórica.

O Docker Compose reúne frontend, backend e PostgreSQL para execução local. Um Compose separado usa banco temporário para os testes de integração. A aplicação ainda não foi publicada.
