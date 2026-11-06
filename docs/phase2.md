# FinanTrack

Aplicação de gestão financeira pessoal para portfólio e aprendizado full-stack, desenvolvida por etapas. O objetivo é organizar receitas, despesas e metas em uma interface clara e profissional.

## Etapa atual: Fase 2 — Transações locais

A estrutura e o dashboard da Fase 1 foram preservados e conectados ao gerenciamento de transações. A aplicação utiliza React, TypeScript, Vite, React Router, Recharts e Lucide React, com CSS responsivo, ESLint, Prettier e Vitest.

### Funcionalidades

- Listagem de receitas e despesas com valores BRL, categorias, datas brasileiras e ações acessíveis de edição e exclusão.
- Formulário reutilizado para criar e editar, com campos obrigatórios, limites de tamanho, validação de datas e valores positivos com até duas casas decimais.
- Identificadores únicos criados com `crypto.randomUUID()`.
- Confirmação de exclusão em diálogo com foco inicial em Cancelar, suporte a Escape e isolamento de foco nativo do elemento `dialog`.
- Pesquisa por descrição, filtros combinados por tipo, categoria e mês, ordenação por data e opção de limpar os filtros.
- Estados vazios para lista sem dados e pesquisa sem resultados; mensagens de sucesso e falha de armazenamento.
- Atualização imediata da lista e do dashboard, sem recarregar a página.
- Persistência de transações no navegador, sem backend, autenticação ou APIs externas.

### Executar e verificar

Requer Node.js 22.12+ (ou 24 LTS) e npm.

```sh
cd frontend
npm install
npm run dev
```

Abra a URL informada pelo Vite e mantenha o terminal aberto. Use sempre o mesmo endereço: `http://127.0.0.1:5173` e `http://localhost:5173` possuem armazenamentos separados. Para encerrar o servidor, pressione Ctrl+C.

```sh
npm run test
npm run lint
npm run build
npm run preview
```

`test` executa Vitest uma vez. `lint` verifica o código; `build` verifica os tipos e gera `frontend/dist`; `preview` serve esse resultado. `npm run format` aplica Prettier. Nenhuma variável de ambiente ou banco é necessário. Nunca coloque segredos em variáveis `VITE_`, pois elas ficam disponíveis no navegador.

### Como o estado funciona

O `TransactionsProvider` fica acima das rotas. Ele guarda a lista em um único estado React; o hook `useTransactions` permite que a página de transações e o dashboard acessem a mesma lista. Ao salvar, editar ou excluir, a aplicação primeiro grava o próximo estado no armazenamento e então atualiza React. Se a gravação falhar, a alteração não é confirmada e a interface apresenta uma mensagem.

O formulário recebe uma transação opcional por **props**: sem transação, cria um registro; com transação, preenche os campos para edição e mantém o identificador. Os tipos de TypeScript definem os dados esperados, enquanto as validações executadas em tempo de execução conferem os valores reais.

### Persistência com localStorage

A chave `finantrack.transactions.v1` contém uma lista JSON, gravada com `JSON.stringify` e lida com `JSON.parse`. Os exemplos são usados somente quando essa chave não existe. Uma lista vazia é salva como `[]`: excluir tudo e atualizar a página mantém a lista vazia.

Os dados lidos são validados, incluindo identificadores duplicados. Dados corrompidos não são substituídos por exemplos nem sobrescritos automaticamente; a aplicação mostra um aviso. Falhas de acesso ou falta de espaço também são informadas.

Os registros ficam somente no navegador e na origem usados. Não há sincronização entre dispositivos, contas ou atualização em tempo real entre abas. Limpar os dados do site remove as transações. Não são armazenados tokens nem credenciais. Os registros iniciais são fictícios e podem ser editados ou excluídos.

### Regras do dashboard

- O mês selecionado controla receitas, despesas, economia, distribuição por categoria e as cinco transações mais recentes desse período.
- O saldo disponível soma receitas menos despesas de todos os meses até o mês selecionado, partindo de zero; movimentos de meses posteriores ficam de fora.
- O gráfico apresenta os seis meses encerrados no mês selecionado, calculados a partir das transações existentes. Meses sem registros têm valor zero.
- Economia do mês é receita menos despesa. A taxa de economia não divide por zero quando não há receita. A barra permanece entre 0% e 100%, mesmo em períodos com resultado negativo.
- Somas financeiras usam centavos inteiros e são convertidas para reais na apresentação, reduzindo erros de ponto flutuante. O banco futuro utilizará tipos decimais apropriados.

### Arquivos e arquitetura

| Arquivo em `frontend/src/` | Responsabilidade |
| --- | --- |
| `main.tsx` | Inicializa React e BrowserRouter. |
| `App.tsx` | Rotas e provider compartilhado entre as páginas. |
| `components/Layout.tsx` | Sidebar, cabeçalho, rodapé e identidade visual preservados. |
| `components/StatCard.tsx` | Card reutilizável de indicadores. |
| `components/TransactionForm.tsx` | Diálogo de criação e edição. |
| `components/DeleteTransactionDialog.tsx` | Confirmação de exclusão e tratamento de erro. |
| `pages/Transactions.tsx` | Lista, filtros, pesquisa e ações de gerenciamento. |
| `pages/Dashboard.tsx` | Indicadores, gráficos e período dinâmicos. |
| `hooks/useTransactions.tsx` | Contexto React, estado e operações de criação, edição e exclusão. |
| `services/transactionStorage.ts` | Leitura, validação e gravação no localStorage. |
| `utils/transactions.ts` | Validação, centavos, filtros e agregação financeira. |
| `utils/format.ts` | Formatação de valores e datas. |
| `types/finance.ts` | Tipo da transação. |
| `data/dashboard.ts` | Exemplos da primeira inicialização. |
| `styles/global.css` | Tema, formulários, diálogos e responsividade. |
| `utils/transactions.test.ts`, `services/transactionStorage.test.ts` e `hooks/useTransactions.test.tsx` | Testes das regras e da persistência. |

`backend/` continua reservado à Fase 3. Categorias, metas, relatórios e perfil mantêm as páginas de etapa futura. A lista de categorias do formulário é predefinida; gerenciamento personalizado pertence às próximas etapas.

### Verificações

- Vitest: 17 testes aprovados, cobrindo entradas inválidas, datas, precisão monetária, filtros combinados, ordenação, períodos, edição/exclusão nos cálculos, ausência de dados, primeira inicialização, persistência vazia e armazenamento inválido ou indisponível. A integração React também verifica CRUD, manutenção do ID, remontagem com lista vazia, falha de gravação, validação do formulário e confirmação/cancelamento de exclusão (JSDOM com as operações nativas do diálogo simuladas).
- ESLint: aprovado.
- TypeScript e build de produção: aprovados.
- Navegador: criação, edição, pesquisa e permanência após recarregar verificadas. O console consultado não apresentou erros ou avisos. A verificação do diálogo final de exclusão e do viewport móvel ficou pendente porque a confirmação nativa da versão intermediária bloqueou a sessão de automação; ela foi substituída por um diálogo HTML.
- O build mantém o aviso de pacote JavaScript acima de 500 kB, principalmente devido aos gráficos. A divisão de código será tratada na etapa de otimizações.
- A instalação ainda informa 7 avisos moderados na cadeia de desenvolvimento do ESLint, relacionados a `minimatch`, registrados na Fase 1. Não foi aplicado downgrade automático.

### Conferência manual sugerida

1. Abra Transações, crie uma receita e uma despesa e confira os valores no dashboard no mesmo mês.
2. Edite descrição, categoria, valor e mês; confira a atualização da lista e dos gráficos.
3. Combine pesquisa, tipo, categoria e mês; experimente as duas ordenações.
4. Abra a confirmação de exclusão, cancele e confira que o registro permanece; depois confirme a exclusão.
5. Atualize a página e confira os registros. Em um perfil de navegador de teste, exclua todos e atualize: os exemplos não devem reaparecer.
6. Confira a navegação por Tab, Escape nos diálogos e o layout em celular.

## Próximas etapas

3. API Node.js, Express, TypeScript e Zod.
4. PostgreSQL, Prisma, migrations e CRUD.
5. Integração frontend/API, carregamento e erros.
6. Autenticação e isolamento por usuário.
7. Dashboard integrado, filtros adicionais e relatórios CSV.
8. Testes de integração, segurança, acessibilidade e otimizações.
9. Deploy do frontend, backend e banco.

O deploy de SPA precisará redirecionar URLs de navegação para `index.html`. Banco, API, autenticação e deploy ainda não foram implementados. O desenvolvimento avança somente com confirmação ao término de cada fase.
