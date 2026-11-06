# FinanTrack

Aplicação de gestão financeira pessoal para portfólio e aprendizado full-stack. Dashboard responsivo, indicadores, gráficos, CRUD de receitas/despesas, pesquisa e filtros combinados.

## Etapa atual — Fase 4: PostgreSQL e Prisma

A API REST agora persiste as transações no PostgreSQL por meio do Prisma ORM. O contrato HTTP e o frontend das fases anteriores foram preservados. Reiniciar a API ou o banco não apaga os registros. O repositório em memória continua somente como ferramenta dos testes unitários HTTP; o servidor real exige PostgreSQL e não possui fallback em memória.

A aplicação continua destinada ao desenvolvimento local. Ainda não há autenticação: a API usa um único usuário local de desenvolvimento. Não publique esta etapa como serviço financeiro de produção.

### Tecnologias

- Frontend: React, TypeScript, Vite, React Router, Recharts e Lucide React.
- Backend: Node.js LTS, Express 5, TypeScript, Zod, CORS, dotenv e tsx.
- Banco: PostgreSQL 18 local, Prisma ORM 7.10.1, Prisma Migrate e driver pg.
- Qualidade: Vitest, Supertest, JSDOM, ESLint e Prettier.

## Executar no Windows

Requer Node.js 22.12+ ou 24 LTS, npm e PostgreSQL instalado. O script usa os executáveis de `C:\Program Files\PostgreSQL\18\bin`; não reinstala o PostgreSQL nem modifica os serviços existentes.

Na raiz do projeto, faça a preparação inicial:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run db:local:setup --prefix backend
npm run db:deploy --prefix backend
npm run db:seed --prefix backend
```

`setup` cria a instância exclusiva em `backend/.local-postgres/data`, inicia na porta **55432**, cria os bancos e grava conexões com senhas aleatórias em `backend/.env`. Os dados locais e credenciais estão ignorados pelo Git. O comando é reutilizável: não apaga dados nem sobrescreve variáveis de conexão existentes no `.env`.

Depois de reiniciar o computador, inicie o banco e os servidores:

```powershell
# Terminal 1, na raiz
npm run db:local:start --prefix backend
npm run dev --prefix backend
```

```powershell
# Terminal 2, na raiz
npm run dev --prefix frontend
```

- Interface: http://127.0.0.1:5173/transactions
- Saúde da API: http://127.0.0.1:3001/api/health
- PostgreSQL: `127.0.0.1:55432`

A porta do Vite é fixa. Mantenha os dois terminais dos servidores abertos. Ctrl+C encerra frontend/backend, mas não apaga o banco. Para parar o PostgreSQL após encerrar a API:

```powershell
npm run db:local:status --prefix backend
npm run db:local:stop --prefix backend
```

Para uma instalação PostgreSQL em outro local:

```powershell
cd backend
powershell -NoProfile -File scripts/database-local.ps1 -Action setup -PostgresBin 'D:\PostgreSQL\bin'
```

Não execute `initdb`, limpeza de diretórios ou reset sobre uma instalação que contenha seus dados. O script opera somente no diretório próprio do FinanTrack.

### Ambiente e bancos separados

| Configuração | Finalidade |
| --- | --- |
| `DATABASE_URL` | Banco da aplicação: `finantrack`. |
| `TEST_DATABASE_URL` | Banco separado: `finantrack_test`; os testes usam um schema aleatório por execução. |
| `SHADOW_DATABASE_URL` | Banco descartável `finantrack_shadow`, utilizado exclusivamente pelo Prisma Migrate no desenvolvimento. Nunca aponte para seu banco principal. |
| `PORT`, `HOST` | API local, padrões `3001` e `127.0.0.1`. |
| `FRONTEND_ORIGINS` | Origens CORS, padrões `http://127.0.0.1:5173,http://localhost:5173`. |
| `VITE_API_URL` | URL pública do cliente, padrão `/api`. |
| `API_PROXY_TARGET` | Destino do proxy Vite, padrão `http://127.0.0.1:3001`. |

O script gera as três conexões no `.env` do backend; não copie o `.env.example` por cima desse arquivo. As senhas não precisam ser coladas em conversas nem no frontend. A conta da aplicação não é superusuária nem recebe privilégio de criar bancos. A conta administrativa é exclusiva dessa instância e suas credenciais ficam no diretório local ignorado.

Para usar um PostgreSQL próprio, configure as conexões em `backend/.env`, consulte `backend/.env.example` e aplique as migrations em um banco de desenvolvimento separado. Caso use pool de conexões externo, utilize uma conexão direta para migrations. O banco local preparado aqui usa conexões diretas.

## Arquitetura

```text
Página/formulário React
  → useTransactions (estado e feedback)
  → transactionsApi (fetch)
  → proxy Vite no desenvolvimento
  → routes / controllers (HTTP e validação Zod)
  → services (regras e conversão monetária)
  → TransactionRepository
  → PrismaTransactionRepository
  → Prisma Client / driver pg
  → PostgreSQL
```

O frontend aguarda a confirmação HTTP para atualizar lista e dashboard. Em falhas, apresenta mensagens e permite nova tentativa. As rotas de transações são as mesmas da Fase 3; o servidor verifica a conexão e o usuário local antes de escutar a porta. O endpoint de saúde consulta o banco e retorna `503` se ele estiver indisponível.

### Modelo relacional

- **users**: nome, email único, datas e hash opcional. O seed cria apenas o usuário local, sem senha e sem possibilidade de login; não há senhas em texto puro. O cadastro e os hashes de contas autenticadas serão tratados na fase de autenticação.
- **categories**: nome, tipo, cor, ícone e proprietário. A combinação usuário/nome/tipo é única.
- **transactions**: descrição, valor, tipo, data, proprietário, categoria e timestamps. A chave estrangeira composta garante que a categoria pertença ao mesmo usuário e tipo da transação.
- **goals**: nome, valor desejado, acumulado, prazo e proprietário. Apenas a estrutura do banco foi preparada; não há endpoints nem interface funcional de metas nesta fase.

Há índices por usuário/data, por categoria e por usuário/prazo, além de restrições de valores positivos, nomes não vazios e integridade referencial. A proteção por proprietário no repository foi testada, mas não substitui autenticação: o servidor atual utiliza uma conta local fixa, compartilhada por quem acessa essa API local.

A API recebe e retorna `amount` como número em reais. O service mantém centavos inteiros, e o repository converte explicitamente para `Decimal(11,2)` no banco. Datas de transações usam `DATE`, evitando mudança de dia por fuso horário; timestamps de auditoria usam `TIMESTAMPTZ` e são retornados em ISO UTC.

Ao criar/editar uma transação, a categoria do usuário e tipo é criada ou reutilizada na mesma transação de banco. O nome continua aparecendo no contrato HTTP como antes. Excluir uma transação não apaga automaticamente a categoria.

## Prisma e migrations

```powershell
npm run db:generate --prefix backend
npm run db:validate --prefix backend
npm run db:deploy --prefix backend
npm run db:seed --prefix backend
npm run db:status --prefix backend
```

`schema.prisma` descreve os modelos. A migration SQL versionada cria as tabelas, índices e constraints. `db:deploy` aplica apenas migrations pendentes; `db:seed` é idempotente e não cria transações fictícias nem remove registros. `db:generate` gera o cliente TypeScript e também roda na instalação e no build.

Ao modificar o modelo em uma próxima etapa:

```powershell
cd backend
npm run db:migrate -- --name descricao_da_alteracao
```

Revise o SQL antes de aplicá-lo a dados importantes. O banco shadow é exclusivo para o trabalho do Prisma e seu conteúdo é descartável. Não use `migrate reset` para atualizar dados que deseja preservar.

A configuração segue o [guia oficial do Prisma para PostgreSQL](https://www.prisma.io/docs/v7/prisma-orm/add-to-existing-project/postgresql). O projeto mantém Prisma 7; a atualização para uma versão principal diferente não faz parte desta etapa.

## API REST e exemplos

| Método | Endpoint | Sucesso |
| --- | --- | --- |
| GET | `/api/health` | 200, `{ data: { status: "ok", storage: "postgresql" } }` |
| GET | `/api/transactions` | 200, `{ data: [...] }` |
| GET | `/api/transactions/:id` | 200, `{ data: {...} }` |
| POST | `/api/transactions` | 201 e cabeçalho Location |
| PUT | `/api/transactions/:id` | 200, substituição completa dos campos editáveis |
| DELETE | `/api/transactions/:id` | 204, sem corpo |

Entrada para POST/PUT:

```json
{
  "description": "Curso de TypeScript",
  "amount": 123.45,
  "type": "expense",
  "category": "Educação",
  "date": "2026-11-05"
}
```

A resposta acrescenta `id` UUID, `createdAt` e `updatedAt`, mantendo `category` como texto e `amount` em reais. O valor deve ser positivo, ter no máximo duas casas decimais e não exceder 999.999.999,99. A data deve existir no calendário e usar `AAAA-MM-DD`. Campos extras são rejeitados.

Falhas usam `{ error: { code, message, details? } }`, sem detalhes internos: `400` entrada inválida, `403` origem CORS recusada, `404` recurso inexistente, `413` corpo excessivo, `500` erro inesperado e `503` banco indisponível no endpoint de saúde.

Exemplo PowerShell com registro de teste:

```powershell
$api = 'http://127.0.0.1:3001/api'
Invoke-RestMethod "$api/health"
$body = @{ description='Curso de teste'; amount=123.45; type='expense'; category='Educação'; date='2026-11-05' } | ConvertTo-Json
$created = Invoke-RestMethod "$api/transactions" -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
$id = $created.data.id
Invoke-RestMethod "$api/transactions/$id"
# O registro permanece após encerrar e reiniciar o backend.
Invoke-RestMethod "$api/transactions/$id" -Method Put -ContentType 'application/json; charset=utf-8' -Body $body
Invoke-RestMethod "$api/transactions/$id" -Method Delete
```

### Preservação dos dados anteriores

A chave `finantrack.transactions.v1` da Fase 2 continua intacta no navegador. O aviso permite exportar um JSON, sem enviá-lo automaticamente ao banco. Não existe fallback local nem migração silenciosa. O armazenamento em memória da Fase 3 não era persistente; nenhum dado perdido por reinício foi recuperado ou inventado. Uma importação futura precisará de revisão explícita.

## Testes e verificações

```powershell
npm test --prefix backend
npm run test:db --prefix backend
npm run lint --prefix backend
npm run build --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

- Backend: **43 testes aprovados**, incluindo 7 testes com PostgreSQL real. Os testes reais validam CRUD, persistência entre clientes, reinício do processo da API, precisão, datas, categoria e proprietário.
- Frontend: **23 testes aprovados**.
- Lint e build dos dois projetos aprovados; schema Prisma válido, migration aplicada e consistência migration/schema conferida sem diferenças.
- API e proxy responderam saúde com `storage: postgresql`; interface recarregada e console da sessão nova sem erros ou avisos.

Os testes reais exigem `TEST_DATABASE_URL` apontando para um banco cujo nome contenha `test` e seja diferente do banco da aplicação. Cada execução cria e remove apenas seu schema aleatório `finantrack_test_*`, sem limpar o schema público nem os dados do aplicativo. Sem essa variável, `npm test` executa a suíte HTTP unitária e pula os testes de banco; `test:db` avisa e falha em vez de reportar um falso sucesso.

Os testes HTTP unitários continuam usando memória para rapidez e isolamento. A suíte real aplica a migration no schema descartável e verifica o repository Prisma. Nenhuma credencial foi adicionada aos arquivos versionáveis.

Permanecem o aviso de bundle do frontend acima de 500 kB e 7 avisos moderados nas ferramentas de desenvolvimento do ESLint. As correções compatíveis das dependências Prisma foram aplicadas; não foi utilizada atualização forçada de versão principal.

## Arquivos desta etapa

- `backend/prisma/schema.prisma`, `prisma.config.ts`, `prisma/seed.ts` e `prisma/migrations/`: modelo, geração, seed e migration inicial.
- `backend/src/database/client.ts`: criação do cliente Prisma e ID do usuário local.
- `backend/src/repositories/prismaTransactionRepository.ts`: persistência real e conversão monetária.
- `backend/scripts/database-local.ps1`: setup, start, stop e status da instância isolada.
- `backend/scripts/test-db.mjs`, `backend/tests/database.integration.test.ts`: execução explícita e testes reais do banco.
- Modificados: backend `app.ts`, `server.ts`, testes HTTP, dependências, scripts, ambiente e ignores; frontend apenas identificação da persistência no layout, dashboard e aviso de dados antigos.
- Histórico e capturas: `docs/phase2.md`, `docs/phase3.md`, `docs/screenshots/phase4.png`.

## Próximas etapas

A integração com a API já foi antecipada por solicitação explícita na Fase 3. Não foram acrescentados login, sessões, importação automática, endpoints de metas, integração bancária ou deploy. O próximo passo deve ser confirmado antes de avançar para a revisão da integração e, depois, autenticação.

![FinanTrack com PostgreSQL local](docs/screenshots/phase4.png)
