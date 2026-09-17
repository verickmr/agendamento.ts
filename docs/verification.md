# Validação

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

Foi criado um projeto separado no Neon, com branches de demonstração e integração. Uma conexão TLS com `pg` executou `SELECT 1` na branch de teste. O Prisma nativo do Windows falhou ao abrir TLS com o erro de credenciais do pacote de segurança `-2146893042`; as migrações e os 20 testes de integração permanecem pendentes. A validação TLS não foi desativada.

## Pendências

- Os 20 testes de integração com PostgreSQL ainda não foram executados.
- Build e inicialização dos containers ainda precisam de validação real com Docker.
- A interface ainda precisa de inspeção visual no navegador.
- Não houve publicação nem validação dos cookies seguros atrás do proxy de hospedagem.

O ambiente usado no desenvolvimento bloqueou o acesso ao WSL e ao navegador. Há comandos reproduzíveis no README e uma pipeline de CI preparada; isso não equivale a resultados aprovados para essas etapas.
