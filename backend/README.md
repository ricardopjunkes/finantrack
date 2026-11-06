# Backend FinanTrack

API Express/TypeScript com autenticação por sessões PostgreSQL e persistência Prisma. O README principal descreve instalação, ambiente, segurança, API e testes; docs/DEPLOYMENT.md descreve a preparação Vercel/Render/Neon, ainda sem publicação.

## Executar

```powershell
npm ci
npm run db:local:setup
npm run db:deploy
npm run dev
```

Em execuções posteriores, db:local:start inicia a instância isolada. Ela usa 127.0.0.1:55432 e não altera serviços PostgreSQL existentes. Credenciais aleatórias ficam em .env/.local-postgres, ignoradas pelo Git.

## Funcionalidades

- Cadastro/login/logout/perfil/senha com hash bcrypt, CSRF, cookies HttpOnly e limiter.
- CRUD de transações e categorias, vinculados à sessão.
- Metas com contribuições atômicas e histórico.
- Orçamentos únicos por categoria/mês/ano e gastos reais.
- Dashboard/relatórios por intervalo e CSV seguro para planilhas.
- Saúde pública com verificação de banco e erros centralizados.

## Migrations

Prisma schema: users, sessions, categories, transactions, goals, contributions, budgets. Três migrations aditivas preservam dados anteriores. DATABASE_URL é a conexão da aplicação; DIRECT_DATABASE_URL opcional é usada pela CLI para migrations; TEST_DATABASE_URL e SHADOW_DATABASE_URL são bancos separados.

```powershell
npm run db:generate
npm run db:validate
npm run db:deploy
npm run db:status
npm run db:migrate -- --name descricao
```

Não usar reset em registros que deseja preservar. O seed antigo de usuário local não é necessário para cadastro e não dá acesso automático aos dados anteriores.

## Qualidade

```powershell
npm test
npm run test:db
npm run lint
npm run build
npm start
```

Build gera o cliente Prisma e compila src em dist; start requer build prévio. O servidor real sempre fornece o cliente PostgreSQL à aplicação. Repository em memória é somente para testes unitários e não serve de fallback em produção.

Testes reais são executados em schema aleatório no banco de testes, com limpeza apenas desse schema. Eles verificam autenticação, isolamento, CRUD, reinício real da API, contribuições concorrentes, orçamentos e CSV. Os dados da aplicação não são usados como fixtures.

Para detalhes das rotas e das regras de exclusão, valores e datas, consulte o README principal. Publicação e verificação HTTPS/cookies hospedados ainda dependem das contas e autorização do usuário.
