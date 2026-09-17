# Validação

## Máscara, validação e layout compacto

Foram aprovados 77 testes locais (58 backend e 19 frontend), verificação de tipos, build e formatação. Os casos novos cobrem DDD, fixo/celular, prefixo internacional, e-mail inválido, nomes com acentos e pontuação, normalização e mensagens obrigatórias em português. A máscara foi exercitada com digitação, colagem, seleção/substituição, Backspace e Delete no meio do número. Os testes do formulário verificam erros ao sair do campo e sua remoção após a correção.

O desktop usa espaçamento compacto e campos de contato lado a lado; telas de menor altura recebem ajustes adicionais. No celular, os campos permanecem empilhados e a rolagem é preservada. Não foi aplicado `overflow: hidden` ao documento. A ausência de rolagem em cada viewport ainda depende da inspeção visual pendente.

## Contatos e bloqueio do passado

A atualização do formulário passou em 62 testes locais (53 backend e 9 frontend), tipos, build e formatação. Mais 21 testes de integração passaram em uma branch isolada do Neon antes da migração de produção. O relógio dos testes é fixo: os exemplos de 2026 não dependem do dia em que a suíte é executada.

Foram verificadas a virada do dia no fuso de São Paulo, a expiração exata de um horário, a revalidação após espera na transação, o bloqueio de reserva/remarcação no passado e a manutenção de correções de nome em registros históricos. Os testes de formulário verificam calendário e entrada manual de data passada, contatos obrigatórios e envio normalizado.

A versão atualizada na Vercel passou em 35 requisições HTTPS, incluindo persistência de e-mail e telefone, rejeição de contatos inválidos e resposta `PAST_SLOT` em reservas e remarcações antigas. A migração acrescenta colunas nulas aos registros antigos, sem apagar agendamentos. O build das mudanças de espaçamento, tipografia e responsividade passou; a inspeção visual continua pendente conforme a limitação registrada abaixo.

## Verificações locais

Após a separação de controllers, services e repositories, em 16/09/2026, foram aprovados:

- 45 testes do backend (20 de domínio/provedor, 18 HTTP, 4 de configuração e 3 da entrada Vercel) e 8 testes de interface.
- Verificação de tipos das duas aplicações, incluindo testes e seed.
- Build das duas aplicações pelo Turborepo, com 7 tarefas executadas sem cache.
- Formatação.
- Comparação dos corpos dos métodos dos repositórios antes e depois da separação: consultas, locks e transações preservados.

A limpeza anterior também passou pela checagem de símbolos não utilizados e pela simulação de instalação do lockfile para Linux. A simulação não substitui a execução em Linux ou Docker.

Os testes HTTP cobrem contratos de erro, validação de entrada, autenticação, origem, exigência de JSON, regeneração e encerramento da sessão, operações administrativas e ocultação de erros internos. A emissão de cookie seguro foi verificada com proxy simulado; isso não valida a configuração de uma hospedagem real. Os testes autenticados usam sessão em memória e serviços substitutos, sem exercitar a persistência no PostgreSQL.

Os testes de interface cobrem reserva, mudança de data, erros de API, confirmação de cancelamento, conflito de bloqueio e edição de nome quando a consulta de feriados falha.

Na repetição de 16/09/2026, o teste de cancelamento excedeu a espera padrão de um segundo para encontrar o botão durante a execução paralela com o build. Isoladamente, passou sem mudança na aplicação. A espera assíncrona da Testing Library foi ajustada para três segundos, mantendo as mesmas asserções. A execução completa seguinte passou: `npm run format:check` e `npx turbo run typecheck test build --force`, com 46 testes e sete tarefas sem cache.

A preparação para Vercel acrescentou sete testes, totalizando 53 aprovados. A entrada publicada foi exercitada localmente com Supertest em `/api/meta`, `/api/appointments` e uma rota inexistente; isso não substitui um teste no domínio público. A verificação de tipos também inclui `api/index.ts`.

Foi criado um projeto separado no Neon, com branches de demonstração e integração. O Prisma nativo do Windows falhou ao abrir TLS com o erro de credenciais do pacote de segurança `-2146893042`. A execução remota em Linux resolveu essa limitação sem desativar a validação TLS.

## CI e PostgreSQL

A [execução no GitHub Actions](https://github.com/verickmr/agendamento.ts/actions/runs/35169855518) passou nos jobs `verify` e `containers`. Foram validados o build e a inicialização HTTP do frontend em Docker, além dos 20 testes de integração com PostgreSQL descartável.

Os mesmos 20 testes passaram na branch isolada do Neon durante a preparação da publicação. Depois disso, migrações e seed foram aplicados no banco de demonstração. Os testes destrutivos usam `TEST_DATABASE_URL` e não acessam o banco da demonstração.

## HTTPS em produção

Foram aprovadas 30 requisições contra [agendamento-ts.vercel.app](https://agendamento-ts.vercel.app), cobrindo:

- Página inicial, acesso direto à recepção, favicon e respostas 404 para API e assets inexistentes.
- Saúde do banco, data do servidor e fuso America/Sao_Paulo.
- Consulta real à API Nager, bloqueio de feriados e finais de semana e rejeição de parâmetros inválidos.
- Login e sessão persistente; cookie com `Secure`, `HttpOnly` e `SameSite=Lax`.
- Criação, persistência, conflito de horário e remoção do horário ocupado da disponibilidade.
- Rejeição de alteração com origem não autorizada; edição, remarcação e cancelamento pela recepção.
- Criação e remoção de bloqueio, liberação do horário e invalidação da sessão após logout.

O agendamento de verificação foi cancelado e o bloqueio foi removido; nenhum horário de teste permanece ocupado.

## Pendências

- A interface ainda precisa de inspeção visual no navegador.

O ambiente local bloqueou o acesso ao WSL e ao navegador. A CI validou os containers, mas os testes HTTP e de componentes não substituem uma revisão visual.
