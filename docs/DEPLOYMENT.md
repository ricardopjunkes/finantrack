# Publicação do FinanTrack

O projeto está preparado para revisão e publicação manual. Nenhum deploy ou push foi executado. Endereços reais e credenciais dependem das suas contas. O funcionamento remoto de HTTPS, cookies e serviços hospedados só poderá ser confirmado depois da publicação autorizada.

## 1. Revisão local

```powershell
npm test --prefix backend
npm run lint --prefix backend
npm run build --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Confira `.gitignore` antes de criar o repositório remoto. `.env`, `.local-postgres`, dependências, cliente Prisma gerado e `.vercel` não devem ser enviados. O repositório ainda não foi inicializado automaticamente com Git.

## 2. PostgreSQL no Neon

Crie um projeto/banco de desenvolvimento dedicado na sua conta. Não use dados pessoais para experimentar migrations. Guarde as conexões apenas nos segredos do serviço:

- `DATABASE_URL`: conexão da aplicação, preferencialmente com pool.
- `DIRECT_DATABASE_URL`: conexão direta para o Prisma Migrate.
- Não configure `TEST_DATABASE_URL` com o banco da aplicação.
- `SHADOW_DATABASE_URL` é apenas para desenvolvimento de migrations; não é necessário para `migrate deploy`.

Use os parâmetros TLS fornecidos pelo provedor. O código não desabilita validação de certificados. Revise o SQL das três migrations antes de aplicar a um banco existente. Não use `migrate reset` em dados que deseja manter.

Não é necessário executar o seed de conta local em produção. O cadastro cria a conta e suas categorias iniciais, sem transações fictícias.

## 3. Backend no Render

O `render.yaml` prepara um Web Service Node, raiz `backend`, sem deploy automático. Pode ser importado como Blueprint depois da sua autorização.

- Build: `npm ci --include=dev && npm run build` (o compilador e a CLI Prisma são necessários mesmo com NODE_ENV=production).
- Start: `npm run db:deploy && npm start`.
- Saúde: `/api/health`.
- `NODE_ENV=production`, `HOST=0.0.0.0` e porta fornecida pelo Render.
- `TRUST_PROXY_HOPS=1` somente para a topologia com um proxy confiável do Render. Localmente permanece 0.
- `FRONTEND_ORIGINS`: a origem HTTPS exata da interface, sem barra final. Separe por vírgula apenas as origens realmente necessárias; não use wildcard com cookies.
- `COOKIE_CROSS_SITE=false` para a estratégia de proxy da Vercel descrita abaixo.
- Cadastre `DATABASE_URL` e `DIRECT_DATABASE_URL` como segredos.

A migration na inicialização permite utilizar o modelo sem pre-deploy pago. Para equipes, prefira executar migrations em um job de release controlado, após revisão/backup, antes de iniciar as instâncias. O Prisma coordena migrations por lock; não execute migrations de desenvolvimento durante o start.

O limiter é por IP e por processo, adequado ao serviço de uma instância deste template. Antes de escalar para múltiplas instâncias, use um armazenamento compartilhado de limites. Serviços que entram em suspensão podem levar mais que os 10 segundos do timeout do cliente para despertar; nesse caso a interface informa o timeout e permite tentar novamente.

## 4. Frontend na Vercel — mesma origem para a API

Use a pasta `frontend` como raiz do projeto, framework Vite e saída `dist`.

**Antes de publicar**, configure o proxy com a URL real do backend:

```powershell
cd frontend
node scripts/configure-vercel.mjs https://backend.example.invalid
```

`backend.example.invalid` é um exemplo reservado: substitua pela origem HTTPS real. O script valida a URL e altera `vercel.json`, colocando o proxy `/api/:path*` antes do fallback SPA. Ele não faz deploy nem acessa o serviço. Foi testado com arquivos temporários e URLs reservadas de exemplo, sem configurar um domínio real no repositório.

- Mantenha `VITE_API_URL=/api`.
- Revise e inclua o `vercel.json` gerado na versão que será publicada.
- No Render, configure `FRONTEND_ORIGINS` com a origem HTTPS da Vercel ou seu domínio próprio.
- Cookies são recebidos pela mesma origem da interface através do proxy; a API usa cookie `__Host-ft_session`, HttpOnly, Secure, Path=/ e SameSite=Lax, sem Domain.
- O proxy deve preservar Cookie, Set-Cookie, Origin e X-CSRF-Token. A validação final desses cabeçalhos no serviço hospedado faz parte do smoke test abaixo.

O arquivo `vercel.json` versionado contém o fallback SPA; o destino externo real só é inserido pelo comando acima. Não publique a configuração sem o proxy e suponha que o servidor de desenvolvimento do Vite também exista em produção.

### Alternativa cross-site

Se usar a API diretamente em outro domínio, configure `VITE_API_URL` para a URL HTTPS completa terminada em `/api`, `COOKIE_CROSS_SITE=true` no backend e CORS exato. Isso usa SameSite=None/Secure, credenciais e token CSRF. Navegadores podem bloquear cookies de terceiros mesmo com esses atributos; por isso o proxy de mesma origem é a opção recomendada. Não reduza as proteções para contornar bloqueios.

## 5. Smoke test após autorização e publicação

1. Abrir `/register`, criar uma conta de teste e verificar o cookie HttpOnly/Secure.
2. Recarregar e verificar que a sessão persiste; encerrar sessão e confirmar bloqueio.
3. Criar duas contas e verificar que nenhuma consulta/edição/exclusão cruza seus dados.
4. Criar categoria, receita, despesa, meta/contribuição e orçamento; recarregar.
5. Conferir filtros, quatro gráficos, orçamento e relatório no mesmo período.
6. Exportar CSV, inclusive uma descrição iniciada por `=`, e conferir a neutralização de fórmula.
7. Abrir `/transactions` diretamente para verificar o fallback SPA.
8. Conferir console, layout de celular e logs sem senhas/tokens.

Recuperação por email depende de uma integração de envio que não foi configurada. PDF usa a impressão nativa do navegador; não há um gerador de arquivos PDF no servidor.

Referências oficiais: [Blueprint Render](https://render.com/docs/blueprint-spec), [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [rewrites externos](https://vercel.com/docs/routing/rewrites) e [Prisma/PostgreSQL](https://www.prisma.io/docs/v7/prisma-orm/add-to-existing-project/postgresql).
