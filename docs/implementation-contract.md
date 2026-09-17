# Contrato REST

A API recebe e retorna JSON. No navegador, o proxy acrescenta `/api` às rotas abaixo. Datas usam `AAAA-MM-DD`, horários `HH:mm` e instantes ISO 8601. O fuso da agenda é `America/Sao_Paulo`.

## Agendamentos

| Método e rota                    | Acesso   | Entrada e resposta                                        |
| -------------------------------- | -------- | --------------------------------------------------------- |
| `GET /available?date=2026-02-10` | Público  | Retorna disponibilidade do dia                            |
| `POST /appointments`             | Público  | `{name,email,phone,date,time}` → 201 e agendamento        |
| `GET /appointments`              | Recepção | Filtros opcionais `date` e `status` → `{appointments:[]}` |
| `PATCH /appointments/:id`        | Recepção | `{version,name?,date?,time?}` → agendamento atualizado    |
| `POST /appointments/:id/cancel`  | Recepção | `{version}` → agendamento cancelado                       |

`status` aceita `CONFIRMED`, `CANCELLED` ou `ALL`; o padrão é `CONFIRMED`. Sem filtro de data, a listagem é ordenada por data e horário. Apenas consultas confirmadas podem ser editadas. Alterações exigem a versão lida pelo cliente; uma versão desatualizada retorna 409.

O agendamento contém `id`, `name`, `email`, `phone`, `date`, `time`, `endTime`, `timezone`, `status`, `version`, `createdAt`, `updatedAt` e `cancelledAt`. O nome é obrigatório, com até 120 caracteres. Novas reservas exigem e-mail válido (até 254 caracteres, normalizado em minúsculas) e telefone brasileiro com DDD (10 ou 11 dígitos, opcionalmente com prefixo 55). A pontuação do telefone é removida. Contatos podem ser nulos em registros anteriores à migração.

Datas passadas retornam disponibilidade vazia. Em hoje, são excluídos horários que já começaram, usando o relógio do servidor no fuso `America/Sao_Paulo`. Tentativas de reservar ou remarcar para o passado retornam 422 com código `PAST_SLOT`. Edição apenas do nome e cancelamento de registros históricos continuam permitidos.

A disponibilidade contém `date`, `timezone`, `isBusinessDay`, `reason`, `slots`, `occupied`, `blocked` e `holidays`. Cada slot contém `start` e `end`. Horários ocupados e bloqueados são listas de `HH:mm`, sem nomes de pacientes ou motivos internos. Feriados contêm `date` e `localName`.

Um dia fechado retorna 200 com `slots:[]` na consulta e 422 na tentativa de reservar ou remarcar. `isBusinessDay` indica se o dia é útil; um dia útil lotado ou bloqueado continua com essa propriedade verdadeira.

## Bloqueios

| Método e rota                     | Entrada e resposta                                    |
| --------------------------------- | ----------------------------------------------------- |
| `GET /availability-blocks`        | Filtro opcional `date` → `{blocks:[]}`, apenas ativos |
| `POST /availability-blocks`       | `{date,time?,reason?}` → 201 e bloqueio               |
| `DELETE /availability-blocks/:id` | Desativa o bloqueio → 204                             |

Todas essas rotas exigem sessão da recepção. `time:null` ou omitido bloqueia o dia inteiro; `reason` é opcional, com até 300 caracteres. O bloqueio contém `id`, `date`, `time`, `reason` e `createdAt`.

Sobreposição de bloqueios ou conflito com consultas confirmadas retorna 409. Conflitos com consultas incluem `error.details.appointments`, para que a recepção resolva os agendamentos antes de bloquear. Nenhuma consulta é cancelada automaticamente.

## Autenticação e informações

| Método e rota       | Entrada e resposta                                               |
| ------------------- | ---------------------------------------------------------------- |
| `POST /auth/login`  | `{email,password}` → `{user:{id,name,email}}` e cookie de sessão |
| `GET /auth/me`      | Usuário da sessão ou 401                                         |
| `POST /auth/logout` | Encerra a sessão → 204                                           |
| `GET /meta`         | `{today,timezone,year,serverTime}`                               |
| `GET /health`       | Verifica o banco → `{status:"ok"}`                               |

Operações de autenticação e administração que alteram estado exigem `Origin` correspondente à origem configurada. Login, criação e edição exigem JSON; logout e remoção de bloqueio dispensam corpo. Clientes HTTP devem guardar o cookie retornado pelo login. Cinco tentativas de login por conta em 15 minutos esgotam o limite até a janela liberar novas tentativas.

## Erros

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Este horário não está mais disponível. Escolha outro."
  }
}
```

`details` é opcional. Códigos HTTP: 400 entrada inválida, 401 sem sessão, 403 origem recusada, 404 registro inexistente, 409 conflito, 413 corpo muito grande, 415 formato incorreto, 422 dia fechado, 429 limite de login e 503 falha na consulta de feriados.
