# FinanTrack

Sistema de gestão financeira pessoal em desenvolvimento por fases para portfólio full-stack. O projeto combina uma interface React com uma API REST em Node.js e TypeScript.

## Etapa atual — Fase 3

A aplicação preserva o dashboard escuro, a navegação responsiva, os gráficos, as transações, os formulários de criação/edição, a confirmação de exclusão e os filtros combinados das fases anteriores. As operações agora utilizam exclusivamente a API, com estados de carregamento, salvamento, exclusão e tratamento de falhas.

**O backend é temporário, sem autenticação e destinado apenas ao desenvolvimento local. Não deve ser publicado como serviço financeiro de produção. Os registros em memória são perdidos a cada reinício do processo**, inclusive em reinícios automáticos do `tsx watch`. Atualizar a página do navegador não reinicia o backend.

### Tecnologias

- Frontend: React, TypeScript, Vite, React Router, Recharts, Lucide React e CSS responsivo.
- Backend: Node.js LTS, Express 5, TypeScript, tsx, Zod, CORS e dotenv.
- Qualidade: Vitest, Supertest, JSDOM, ESLint e Prettier.
- PostgreSQL, Prisma e autenticação ainda não foram implementados.

## Instalação e execução

Requer Node.js 22.12+ ou 24 LTS e npm. Execute a partir da raiz do repositório:

```powershell
npm install --prefix backend
npm install --prefix frontend
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Os arquivos `.env` são opcionais com os valores padrão. Copie-os apenas se ainda não existirem ou se desejar configurá-los; não sobrescreva configurações locais já personalizadas.

No primeiro terminal:

```powershell
cd backend
npm run dev
```

API: http://127.0.0.1:3001/api/health.

No segundo terminal:

```powershell
cd frontend
npm run dev
```

Interface: http://127.0.0.1:5173. Mantenha os dois terminais abertos; Ctrl+C encerra cada processo. A porta 5173 é fixa: se estiver ocupada, encerre o processo anterior em vez de iniciar uma segunda instância.

### Variáveis de ambiente

| Arquivo | Variável | Padrão e finalidade |
| --- | --- | --- |
| `backend/.env` | `PORT` | `3001`: porta HTTP da API. |
| `backend/.env` | `HOST` | `127.0.0.1`: acesso local; aceita também `localhost` ou `::1`. |
| `backend/.env` | `FRONTEND_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173`: origens CORS permitidas, separadas por vírgula, sem barra final. |
| `frontend/.env` | `VITE_API_URL` | `/api`: endereço público usado pelo cliente HTTP. |
| `frontend/.env` | `API_PROXY_TARGET` | `http://127.0.0.1:3001`: destino do proxy de desenvolvimento do Vite. |

O navegador acessa `/api`, e o Vite encaminha essa chamada ao backend. `API_PROXY_TARGET` é utilizado pelo servidor Vite; não é uma credencial. Reinicie o Vite após alterar o `.env`.

O proxy é de desenvolvimento. Para conferir o build com `npm run preview`, configure `VITE_API_URL=http://127.0.0.1:3001/api` antes de gerar o build e inclua a origem do preview (por exemplo, `http://127.0.0.1:4173`) em `FRONTEND_ORIGINS`. Nenhuma configuração de deploy foi adicionada. Nunca coloque segredos em variáveis `VITE_`.

## Dados da Fase 2: preservação sem migração silenciosa

A interface não utiliza mais o localStorage como fonte de transações e não possui fallback local quando a API falha. O backend inicia vazio, sem exemplos automáticos.

A chave antiga `finantrack.transactions.v1` permanece intacta. Quando ela existe, aparece um aviso com o botão **Exportar dados da Fase 2**, que baixa uma cópia local em JSON. Essa operação não envia os registros à API nem altera o conteúdo original.

Para preservar seus registros:

1. Abra o mesmo navegador e endereço usados na Fase 2. `localhost` e `127.0.0.1` possuem armazenamentos diferentes.
2. Use o botão de exportação e guarde o JSON antes de limpar os dados do navegador.
3. Uma futura importação deverá ser solicitada explicitamente, validada e apresentada para revisão antes do envio. Ela ainda não foi implementada. Para experimentar a API agora, cadastre transações fictícias pelo formulário.

A detecção funciona inclusive para uma lista vazia. Caso o conteúdo antigo esteja corrompido, o backup preserva o texto original para recuperação manual. Não há importação automática nem sincronização entre os dois armazenamentos.

## Arquitetura e fluxo HTTP

```text
React (páginas e formulários)
  → useTransactions (estado compartilhado e feedback)
  → transactionsApi (fetch e JSON)
  → proxy Vite /api (durante desenvolvimento)
  → routes (URL e método HTTP)
  → controller (validação Zod e resposta HTTP)
  → service (regras, UUID, timestamps e conversão monetária)
  → repository (Map em memória)
```

Exemplo: ao salvar uma despesa, o formulário aguarda um `POST /api/transactions`. A API valida os dados, converte reais em centavos, cria UUID/timestamps, armazena o registro e responde `201`. Só então React atualiza a lista compartilhada e o dashboard. Em caso de erro, o formulário permanece aberto e mostra a falha. Cliques repetidos são bloqueados durante o envio.

O dashboard mantém o mês selecionável: receitas, despesas, economia, categorias e transações recentes seguem esse mês; o saldo acumula os movimentos até o período escolhido. O gráfico calcula os seis meses até o mês selecionado. Os filtros de transações continuam combinando descrição, tipo, categoria, mês e ordenação por data no frontend.

### Arquivos criados nesta fase

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `backend/package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.env.example` | Dependências, scripts, tipos e ferramentas. |
| `backend/src/app.ts` | Monta a aplicação Express, CORS, JSON, saúde, rotas e erros; permite injetar um repositório para testes. |
| `backend/src/server.ts` | Lê e valida ambiente, inicia o servidor local e trata encerramento. |
| `backend/src/routes/transactions.ts` | Define os endpoints de transações. |
| `backend/src/controllers/transactionController.ts` | Valida entrada com Zod, chama os serviços e produz respostas. |
| `backend/src/services/transactionService.ts` | Cria identificadores e timestamps, aplica regras e converte valores. |
| `backend/src/repositories/transactionRepository.ts` | Interface assíncrona e implementação em memória com dados isolados por instância. |
| `backend/src/schemas/transactionSchema.ts` | Valida payload completo, UUID, datas e dinheiro. |
| `backend/src/types/transaction.ts` | Contrato público e tipo interno com centavos. |
| `backend/src/middlewares/errorHandler.ts` | Padroniza falhas sem expor stack ou detalhes internos. |
| `backend/src/utils/AppError.ts`, `money.ts` | Erros esperados e conversão explícita de dinheiro. |
| `backend/tests/transactions.test.ts` | Testes HTTP com Vitest e Supertest. |
| `frontend/src/services/transactionsApi.ts`, `transactionsApi.test.ts` | Cliente HTTP, timeout e testes do contrato. |
| `frontend/src/components/LegacyTransactionsNotice.tsx` | Aviso e exportação dos registros antigos. |
| `frontend/src/vite-env.d.ts`, `frontend/.env.example` | Tipagem e configuração do Vite. |
| `docs/phase2.md`, `docs/screenshots/phase3.png` | Documentação histórica da Fase 2 e captura da integração. |

### Arquivos modificados

- `frontend/src/hooks/useTransactions.tsx` e seu teste: CRUD assíncrono pela API, estado de carregamento e proteção contra respostas de leitura antigas.
- `frontend/src/components/TransactionForm.tsx`, `DeleteTransactionDialog.tsx`: aguardam HTTP, impedem duplicidade e mantêm os diálogos abertos em falhas.
- `frontend/src/pages/Transactions.tsx`, `Dashboard.tsx`, `App.tsx`: integração do estado, feedback e aviso de dados antigos.
- `frontend/src/components/Layout.tsx` e `styles/global.css`: identificação da API e estilos adicionais compatíveis com o tema.
- `frontend/src/services/transactionStorage.ts` e seu teste: substituídos por leitura somente para aviso e backup; nenhuma escrita ou fonte alternativa de transações.
- `frontend/src/types/finance.ts`, `utils/transactions.ts` e seu teste: contrato e validação monetária; timestamps opcionais no tipo de apresentação mantêm compatibilidade com os exemplos históricos, mas a API sempre os retorna.
- `frontend/vite.config.ts`: proxy local e porta fixa.
- `.env.example`, `.gitignore`, `README.md`, `backend/README.md`: configuração e documentação da nova etapa.

## Contrato da API

| Método | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/api/health` | `200`: status e indicação de armazenamento em memória. |
| GET | `/api/transactions` | `200`: lista completa ordenada por data decrescente. |
| GET | `/api/transactions/:id` | `200`: consulta por UUID. |
| POST | `/api/transactions` | `201`: cria recurso e inclui cabeçalho `Location`. |
| PUT | `/api/transactions/:id` | `200`: substitui todos os campos editáveis; não é atualização parcial. |
| DELETE | `/api/transactions/:id` | `204`: exclui, sem corpo de resposta. |

Payload de POST e PUT:

```json
{
  "description": "Curso de TypeScript",
  "amount": 123.45,
  "type": "expense",
  "category": "Educação",
  "date": "2026-11-05"
}
```

`amount` é um **número em reais**, com valor entre 0,01 e 999.999.999,99 e no máximo duas casas decimais. Não envie strings monetárias nem valores já multiplicados por 100. Internamente, o repositório armazena `amountCents: 12345`; esse campo não aparece na API.

Descrição e categoria são obrigatórias, recebem trim e possuem limites de 120 e 60 caracteres. `type` aceita `income` ou `expense`. A data deve existir no calendário e usar `AAAA-MM-DD` entre 1900 e 9999. O ID deve ser UUID. Campos extras, incluindo IDs ou timestamps enviados no corpo, são rejeitados.

Exemplo de resposta de criação:

```json
{
  "data": {
    "id": "6700c8e8-ae43-4860-9cb2-b3238d58aa6f",
    "description": "Curso de TypeScript",
    "amount": 123.45,
    "type": "expense",
    "category": "Educação",
    "date": "2026-11-05",
    "createdAt": "2026-11-05T18:00:00.000Z",
    "updatedAt": "2026-11-05T18:00:00.000Z"
  }
}
```

A listagem usa `{ "data": [] }` quando vazia. `createdAt` e `updatedAt` são instantes ISO em UTC; a data da transação é uma data civil sem horário.

Erros seguem o formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Confira os dados enviados.",
    "details": [{ "field": "amount", "message": "O valor deve ser de pelo menos R$ 0,01." }]
  }
}
```

`details` aparece nas falhas de validação. Respostas: `400` para entrada/JSON/URL inválidos, `404` para UUID inexistente ou rota desconhecida, `500` para erro inesperado. Também há `403` para origem CORS não permitida e `413` para corpo acima de 16 KB. Não são expostos stack traces, senhas ou detalhes de implementação.

### Testar manualmente com PowerShell

Com o backend ativo:

```powershell
$api = 'http://127.0.0.1:3001/api'
Invoke-RestMethod "$api/health"
Invoke-RestMethod "$api/transactions"
$body = @{
  description = 'Curso de TypeScript'
  amount = 123.45
  type = 'expense'
  category = 'Educação'
  date = '2026-11-05'
} | ConvertTo-Json
$created = Invoke-RestMethod "$api/transactions" -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
$id = $created.data.id
Invoke-RestMethod "$api/transactions/$id"
Invoke-RestMethod "$api/transactions/$id" -Method Put -ContentType 'application/json; charset=utf-8' -Body $body
Invoke-RestMethod "$api/transactions/$id" -Method Delete
```

O PUT requer o payload completo. O DELETE não retorna JSON; tentar consultar o mesmo ID depois deve responder 404. Os mesmos endpoints podem ser usados no Postman ou Insomnia.

## Testes, lint e build

Na raiz:

```powershell
npm test --prefix backend
npm run lint --prefix backend
npm run build --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

No backend, `npm start` executa o build em `dist/server.js`; ele requer `npm run build` antes. `app.ts` não abre portas por conta própria, facilitando testes com Supertest. Cada teste recebe uma nova aplicação e um novo repositório; não altera o servidor usado no navegador.

O frontend testa regras financeiras, cliente HTTP, preservação do backup antigo, estado compartilhado e diálogos. Os testes de React usam JSDOM e simulam a API; a integração com o backend real foi conferida separadamente no navegador e pelo proxy.

O frontend ainda informa um pacote de JavaScript acima de 500 kB devido principalmente aos gráficos. A instalação de ferramentas também informa 7 avisos moderados na cadeia de desenvolvimento do ESLint, já registrados na Fase 2. Não foi aplicado downgrade automático nem `audit fix --force`.

## Limites e Fase 4

Verificação realizada na entrega da Fase 3: 35 testes do backend e 23 testes do frontend aprovados; lint e build aprovados nos dois projetos. API de saúde e proxy Vite responderam HTTP 200. No navegador, foram conferidos criação, edição, recarga pela API, atualização do dashboard, cancelamento e confirmação de exclusão, estado vazio, aviso de dados antigos e layout em largura de 390 px. A sessão nova consultada não apresentou erros ou avisos no console. A transação fictícia usada na verificação foi excluída ao final; os dados antigos do navegador permaneceram intactos.

O repository mantém um `Map` no processo Node. Não há durabilidade, usuários, isolamento por conta, login, integração bancária, pagamentos ou publicação. CORS limita origens de navegador, mas não substitui autenticação. O servidor escuta somente no endereço local configurado.

Na Fase 4, a implementação `MemoryTransactionRepository` será substituída por uma implementação PostgreSQL/Prisma, com schema, migrations e índices. A interface assíncrona do repository, os controllers, as rotas e o cliente HTTP foram organizados para permitir essa troca sem refazer a interface. A representação monetária do banco será definida explicitamente, preservando a conversão nas bordas da API. Nenhuma parte dessa fase foi antecipada.

![Interface integrada à API local](docs/screenshots/phase3.png)

O desenvolvimento avança somente com confirmação ao término de cada fase.
