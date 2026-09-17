# Publicação na Vercel e Neon

## Estrutura

Importe a raiz do monorepo, onde ficam `package.json` e `vercel.json`, como um único projeto na Vercel. Use Node.js 24. O build passa pelo Turborepo, entrega `frontend/dist` e publica `api/index.ts` como uma função Node.js que monta o Express em `/api`.

O frontend mantém suas chamadas relativas a `/api`. As páginas React têm fallback para `index.html`; chamadas de API não recebem esse fallback. O servidor local e o Docker continuam usando `backend/src/server.ts`.

O cliente Prisma é reutilizado enquanto a instância da função permanecer ativa. Use uma conexão Neon com pooling e `connection_limit=3`; o pool das sessões também limita conexões e utiliza `attachDatabasePool` da Vercel. A confiança no proxy gerenciado é ativada apenas na entrada exclusiva da Vercel, quando `VERCEL=1`.

## Variáveis de ambiente

Cadastre os segredos no painel ou na CLI da Vercel. Nunca use prefixo `VITE_` para credenciais.

| Variável          | Uso                                                             |
| ----------------- | --------------------------------------------------------------- |
| `DATABASE_URL`    | Conexão PostgreSQL com pooling, TLS e limite de conexões        |
| `SESSION_SECRET`  | Segredo aleatório de pelo menos 32 caracteres                   |
| `NODE_ENV`        | `production`                                                    |
| `FRONTEND_ORIGIN` | Origem HTTPS exata, necessária ao usar domínio próprio          |
| `ALLOWED_ORIGINS` | Origens adicionais exatas, separadas por vírgula, se necessário |

Na Vercel, as origens de `VERCEL_URL` e `VERCEL_PROJECT_PRODUCTION_URL` também são permitidas. Não há curinga para domínios de terceiros. Em outros ambientes de produção, uma origem explícita é obrigatória.

Use bancos ou branches separados para demonstração e testes. Não associe previews não confiáveis ao banco da demonstração. Os testes de integração removem somente os registros do banco indicado explicitamente por `TEST_DATABASE_URL`.

## Migração e conta inicial

Antes de disponibilizar o site, execute as migrações com uma conexão **direta**, sem `-pooler` no hostname, através de `DATABASE_URL` no processo de migração:

```bash
# Configure DATABASE_URL no ambiente do terminal com a conexão direta.
npm run db:migrate
# Configure SEED_EMAIL, SEED_PASSWORD e SEED_NAME no mesmo ambiente.
npm run db:seed
```

Essas variáveis devem vir de um gerenciador de segredos ou arquivo local ignorado pelo Git. O seed é idempotente e não modifica senhas existentes. A função de atendimento não executa migrações nem seed durante requisições.

## Verificação após deploy

Confirme `/api/health`, `/api/meta`, disponibilidade em dia útil e bloqueio de fins de semana e feriados. Reserve um horário, confirme a persistência após nova requisição, tente duplicá-lo e valide login, remarcação e cancelamento. Verifique cookie `Secure`, `HttpOnly` e `SameSite=Lax` no endereço HTTPS real, incluindo logout. Abra `/reception` diretamente para conferir o fallback da SPA.

Os resultados efetivamente executados estão em [validação](verification.md). A presença desta configuração não significa que o deploy já foi concluído.

Referências: [Vite e funções na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [cabeçalhos do proxy](https://vercel.com/docs/headers/request-headers) e [pooling no Neon](https://neon.com/docs/connect/connection-pooling).
