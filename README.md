# Serena · Agendamento para clínicas

Aplicação full stack para consultar horários e agendar consultas. O paciente agenda sem cadastro; a recepção autenticada pode editar, remarcar, cancelar e bloquear horários.

**Demonstração:** [agendamento-ts.vercel.app](https://agendamento-ts.vercel.app). As credenciais da recepção são fornecidas separadamente.

## Tecnologias

Monorepo com npm workspaces e Turborepo. Frontend em React, TypeScript e Vite, com shadcn/ui, Radix, React Hook Form, Zod, TanStack Query e Zustand. Backend em Express, com Prisma e PostgreSQL. Ambiente local e testes de integração em Docker.

## Executar com Docker

Requisitos: Docker com Compose v2, no Linux, WSL ou Docker Desktop.

```bash
cp .env.example .env
# Preencha as senhas e um SESSION_SECRET aleatório com pelo menos 32 caracteres.
docker compose up --build -d
docker compose exec backend npm run db:seed -w backend
```

Abra **http://localhost:5173**. Para entrar na recepção, use `SEED_EMAIL` e `SEED_PASSWORD` definidos em `.env`. O seed cria a conta inicial sem alterar uma conta existente. A API fica em **http://localhost:3001**.

O Compose aguarda o banco e aplica as migrações antes de iniciar a API. `docker compose down` encerra os serviços e preserva os dados no volume. Os arquivos `.env` são ignorados pelo Git e pelas imagens. Para `POSTGRES_PASSWORD`, use uma senha hexadecimal aleatória ou codifique caracteres reservados ao montar a URL.

## Desenvolvimento local

Requisitos adicionais: Node.js 24 e npm 10.

```bash
npm ci
cp .env.example .env
cp backend/.env.example backend/.env
# Preencha os arquivos; DATABASE_URL deve usar a mesma senha do Compose.
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

O PostgreSQL é exposto em `localhost:5433`. O frontend encaminha `/api/*` para o backend; credenciais do banco ficam somente no servidor.

## Organização e comandos

```text
frontend/               Interface React
backend/src/            Domínio, aplicação, infraestrutura e HTTP
backend/prisma/         Modelo, migrações e seed
backend/test/           Testes unitários, HTTP e de integração
docs/                   Arquitetura, API e validação
compose.yaml            Ambiente local
compose.test.yaml       PostgreSQL temporário e integração
```

| Comando                    | Finalidade                                                           |
| -------------------------- | -------------------------------------------------------------------- |
| `npm run dev`              | Iniciar frontend e backend                                           |
| `npm run build`            | Compilar as aplicações                                               |
| `npm run typecheck`        | Verificar tipos, testes e seed                                       |
| `npm test`                 | Executar testes unitários, HTTP e de interface                       |
| `npm run test:docker`      | Executar a integração completa no Docker                             |
| `npm run test:integration` | Executar integração com `TEST_DATABASE_URL` já configurada e migrada |
| `npm run db:migrate`       | Aplicar migrações                                                    |
| `npm run db:seed`          | Criar a conta inicial                                                |
| `npm run db:generate`      | Gerar Prisma Client manualmente                                      |
| `npm run format:check`     | Verificar formatação                                                 |

O Turbo gera o Prisma Client antes das tarefas que precisam dele. Build, tipos e testes unitários usam cache. Migrações, seed, integração e desenvolvimento sempre executam. Para uma aplicação específica: `npm run dev -- --filter=@serena/frontend`.

## Regras

- Atendimento de segunda a sexta, das 08:00 às 18:00, com consultas de uma hora. O último início é às 17:00.
- Agenda de 2026, no fuso `America/Sao_Paulo`. Reservas e remarcações exigem data e horário futuros; horários que já começaram hoje também são bloqueados pelo backend.
- Novas reservas exigem nome, e-mail válido e telefone com DDD. Os contatos ficam disponíveis apenas na confirmação da reserva e na recepção autenticada.
- Telefone com máscara para fixo/celular e suporte a colagem com `+55`. Zod valida nomes, e-mail, DDD e número no frontend e backend; o banco recebe o telefone sem pontuação.
- Feriados consultados no backend pela [API Nager.Date](https://date.nager.at/api/v3/PublicHolidays/2026/BR), sem cache e com timeout de oito segundos. Todas as datas retornadas são bloqueadas, inclusive itens regionais/opcionais.
- Falha na API impede novas reservas e remarcações. Edição de nome e cancelamento continuam disponíveis.
- Horários ocupados ou bloqueados não podem receber reservas. Transações e restrições no PostgreSQL protegem requisições simultâneas.
- Cancelamento preserva o registro e libera a vaga. Não há exclusão definitiva ou restauração de consultas canceladas.
- Bloqueios que atingem consultas confirmadas são recusados e mostram os conflitos à recepção.

## API

Rotas mínimas: `GET /available?date=2026-02-10`, `POST /appointments` e `GET /appointments`. A listagem exige sessão da recepção para proteger os dados dos pacientes.

```json
{
  "name": "Paciente de teste",
  "email": "paciente@example.com",
  "phone": "11999999999",
  "date": "2026-12-15",
  "time": "09:00"
}
```

Consulte o [contrato REST](docs/implementation-contract.md) para autenticação, edição, cancelamento, bloqueios e respostas. As decisões de arquitetura estão em [arquitetura](docs/architecture.md).

## Publicar

A configuração de [Vercel e Neon](docs/deployment.md) mantém frontend e API no mesmo domínio, com PostgreSQL hospedado. O Docker permanece disponível para desenvolvimento e integração locais. A publicação ainda depende de autenticação na Vercel e validação das migrações no ambiente hospedado.

## Testes

Para executar a integração sem instalar Node ou configurar banco no computador:

```bash
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from integration
```

Esse comando cria um PostgreSQL temporário sem porta pública, aplica as migrações e executa a suíte. O banco de teste não compartilha volume com o banco da aplicação. Para remover os containers depois:

```bash
docker compose -f compose.test.yaml down
```

A CI verifica formatação, tipos, testes unitários, build e inicialização da imagem do frontend. A integração roda uma vez, na imagem do backend com PostgreSQL temporário. Consulte os [resultados e pendências de validação](docs/verification.md).

## Limites da entrega

Há um único perfil de recepção. Não há recuperação de senha, múltiplos médicos, WhatsApp ou funcionalidade de IA. A aplicação ainda não foi publicada. Para demonstração, use nomes fictícios e apresente reserva, conflito de horário, remarcação, cancelamento e bloqueio de agenda.
