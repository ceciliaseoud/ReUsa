# Operação, configuração e implantação

[Índice da documentação técnica](documentacao-tecnica.md) · [Arquitetura](arquitetura.md) · [Banco de dados](banco-de-dados.md) · [API](api.md) · [Regras de negócio](funcionalidades-e-regras.md) · [Segurança e testes](seguranca-e-testes.md)

**Projeto:** ReUsa+  
**Autor:** Marcus Vinicius Campos da Silva  
**Referência:** código da revisão `051a07c`, documentado em 19/11/2026.  
**Endereço publicado:** <https://reusa.up.railway.app>

Este guia descreve como preparar, executar e manter a implementação existente.
Os arquivos do repositório representam configurações possíveis; não comprovam
quais serviços estão ativos na Railway nem a habilitação de contas externas.
Todos os nomes, senhas e endereços de banco dos exemplos são fictícios.

## 1. Perfis de execução

| Perfil | Persistência | Serviços e condições |
| --- | --- | --- |
| Desenvolvimento local | SQLite por SQL.js, quando PostgreSQL não está configurado | API e interface; integrações são configuradas separadamente. Não definir `NODE_ENV=production` nesse perfil. |
| Avaliação local em um contêiner | SQLite e arquivos no volume de dados | Executa a aplicação principal; não inclui automaticamente broker, Redis, banco PostgreSQL ou APIs externas. |
| Ambiente distribuído com Compose | PostgreSQL | Seis serviços: `core`, `postgres`, `rabbitmq`, `redis`, `notifications` e `impact`. |
| Produção | PostgreSQL | `NODE_ENV=production`, `DATABASE_PROVIDER=postgres` e `POSTGRES_URL` ou `DATABASE_URL`; credenciais das integrações usadas e persistência dos arquivos. |

O modo PostgreSQL usa esse banco como fonte de verdade em execução; não replica
automaticamente seus registros para o SQLite. A mudança de banco não migra dados
por si só. Os scripts e limites de migração estão em [Banco de dados](banco-de-dados.md).

## 2. Preparação e execução local

Pré-requisitos: **Node.js 22**, npm e Git. Docker e Docker Compose são necessários
apenas para os perfis em contêineres. A versão do Node está declarada em
[`package.json`](../package.json), [`.nvmrc`](../.nvmrc) e no [Dockerfile](../Dockerfile).

```bash
git clone https://github.com/MarcusVinicius-BCC/ReUsa.git
cd ReUsa
npm ci
npm run build
npm start
```

A aplicação principal serve o frontend compilado em `dist/` e a API em
<http://localhost:3000>. Na primeira execução SQLite, cria o banco local e os
diretórios necessários. O segredo JWT não configurado é gerado temporariamente;
sessões deixam de ser válidas após reiniciar o processo nesse caso.

Para desenvolver a interface com atualização automática, use dois terminais:

```bash
# Terminal 1: API, por padrão na porta 3000
npm run dev
```

```bash
# Terminal 2: Vite, por padrão na porta 5173
npm run dev:ui
```

O [Vite](../vite.config.js) encaminha `/api` para `http://localhost:3000`.
O cliente web usa URLs relativas `/api`, sem chave secreta de serviço externo
embutida no frontend.

### 2.1 Carregamento das variáveis

O processo lê `process.env`. Embora `dotenv` esteja listado como dependência,
o código atual não chama `dotenv.config()` nem carrega `.env` automaticamente
em `npm start` ou `npm run dev`.

Configure as variáveis no ambiente do processo ou carregue explicitamente um
arquivo local com o recurso do Node 22:

```bash
node --env-file=.env backend.js

# Com recarga durante o desenvolvimento
node --env-file=.env --watch backend.js
```

Use [`.env.example`](../.env.example) como referência. Se optar por criar `.env`,
mantenha somente os serviços efetivamente configurados: os valores de exemplo de
Google não são credenciais válidas e, se carregados, fazem o sistema tentar usar
essa integração. O arquivo real `.env` está ignorado pelo Git.

## 3. Inventário das variáveis de ambiente

Os nomes desta seção vêm dos acessos a `process.env` no código. Os sinalizadores
booleanos são ativados pela string literal `true`; sua mera presença não basta.

### 3.1 Aplicação, banco e serviços internos

| Variável | Padrão/comportamento | Escopo e finalidade |
| --- | --- | --- |
| `NODE_ENV` | Não definido no código | `production` exige PostgreSQL e restringe configurações HTTP de integrações. `test` habilita cenários controlados dos testes. |
| `PORT` | Core `3000`; notificações `3001`; impacto `3002` | Porta HTTP de cada processo. É definida separadamente por serviço no Compose. |
| `JWT_SECRET` | Segredo aleatório por processo quando ausente | Core; configurar um valor forte e estável na implantação. Alterá-lo invalida os tokens existentes. |
| `APP_BASE_URL` | Vazio | Origem pública da aplicação; necessária à integração Stripe, recomendada para links e callbacks. Usar `https://reusa.up.railway.app`, sem caminho, credenciais, consulta ou fragmento. |
| `DATA_DIR` | Core: `RAILWAY_VOLUME_MOUNT_PATH` ou `./data`; workers: seus diretórios locais | Diretório de dados SQLite e arquivos locais. O core grava uploads em `DATA_DIR/uploads`. |
| `DATABASE_PROVIDER` | PostgreSQL só é selecionado com o valor `postgres` e URL válida | Core e workers; sem seleção/configuração, utilizam a alternativa SQLite. Em produção, o core recusa a inicialização sem PostgreSQL configurado. |
| `POSTGRES_URL` / `DATABASE_URL` | Sem padrão; `POSTGRES_URL` tem precedência | URL de conexão dos processos e scripts PostgreSQL. |
| `POSTGRES_POOL_SIZE` | `10` por pool | Core e workers PostgreSQL; limite de conexões do pool. Considerar a soma dos pools ao definir capacidade do banco. |
| `ADMIN_EMAILS` | Vazio | Lista de administradores separada por vírgula, ponto e vírgula ou espaços. A promoção na inicialização PostgreSQL exige e-mail verificado. |
| `ADMIN_EMAIL` | Vazio | Nome legado aceito para um administrador. |
| `AMQP_URL` | Core: vazio; workers: `amqp://rabbitmq:5672` | Endereço do RabbitMQ. Sem endereço no core, eventos permanecem na outbox. |
| `EVENT_EXCHANGE` | `reusa.events` | Mesmo exchange nos produtores e consumidores. |
| `INSTANCE_ID` | `core-` seguido de UUID | Core; identifica a instância que reserva lotes da outbox. Identificadores explícitos devem ser distintos entre réplicas. |
| `REDIS_URL` | Vazio | Core; controle compartilhado de requisições. Sem Redis, o limitador usa memória local por processo. |
| `NOTIFICATION_SERVICE_URL` | Vazio | Core; origem do serviço de notificações, por exemplo `http://notifications:3001` no Compose. |
| `IMPACT_SERVICE_URL` | Vazio | Core; origem do serviço de impacto, por exemplo `http://impact:3002` no Compose. |
| `SERVICE_AUTH_TOKEN` | Vazio | Mesmo token no core e nos workers. Protege chamadas internas e `/metrics` quando configurado; sua ausência desabilita essa verificação. |

### 3.2 Google, e-mail e rotas

| Variável | Padrão/comportamento | Finalidade |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Vazio | Identificador do cliente OAuth do tipo aplicação web. |
| `GOOGLE_CLIENT_SECRET` | Vazio | Segredo do cliente; permanece no backend. |
| `GOOGLE_REDIRECT_URI` | Derivada da origem quando ausente | Callback OAuth; deve corresponder exatamente ao endereço cadastrado no Google Cloud. |
| `SMTP_HOST` | Vazio | Host do serviço de e-mail. |
| `SMTP_PORT` | `587` | Porta SMTP; `465` ativa conexão segura desde o início no Nodemailer. |
| `SMTP_USER` | Vazio | Usuário de autenticação SMTP. |
| `SMTP_PASSWORD` | Vazio | Segredo SMTP; usar a credencial apropriada do provedor. |
| `EMAIL_FROM` | Valor de `SMTP_USER` | Remetente das mensagens de confirmação e recuperação de senha. |
| `ROUTING_BASE_URL` | `https://router.project-osrm.org` | Endpoint OSRM usado pelo backend. HTTPS é exigido fora da exceção HTTP local de desenvolvimento. |

Sem SMTP configurado, o desenvolvimento registra um aviso e retorna envio não
realizado; não imprime o token nem o link de confirmação. Para exercitar o
cadastro completo de um usuário novo, configure um serviço SMTP de teste.
Em produção, a tentativa de envio sem configuração falha. O cadastro pode já ter sido persistido
antes da falha de envio; use o fluxo de reenvio de confirmação após corrigir a
configuração, em vez de pressupor que a conta não foi criada.

### 3.3 Armazenamento compatível com S3

| Variável | Padrão/comportamento | Finalidade |
| --- | --- | --- |
| `S3_ENDPOINT` | Vazio | Endpoint autenticado da API S3. |
| `S3_BUCKET` | Vazio | Nome do bucket. |
| `S3_ACCESS_KEY_ID` | Vazio | Identificador da credencial de armazenamento. |
| `S3_SECRET_ACCESS_KEY` | Vazio | Segredo da credencial. |
| `S3_PUBLIC_BASE_URL` | Endpoint, exceto no R2 onde é obrigatório | Origem pública para exibir os objetos. Não usar o endpoint autenticado do R2. |
| `S3_REGION` | R2: `auto`; outros provedores: `us-east-1` | Região do cliente S3. |
| `S3_FORCE_PATH_STYLE` | Desativado | Ativar com `true` somente quando necessário para o provedor compatível. |

O armazenamento externo é criado quando bucket, endpoint e credenciais estão
presentes. No R2, configure o domínio `r2.dev` ou um domínio público próprio,
habilite o acesso aos objetos na Cloudflare e forneça `S3_PUBLIC_BASE_URL`.
O app verifica/cria o bucket quando necessário e permitido; não tenta aplicar
bucket policy S3 ao R2. Sem armazenamento externo configurado, os uploads ficam
no diretório local e precisam de persistência.

Os nomes `MINIO_*` em comentários de `.env.example` são exemplos de infraestrutura;
o cliente da aplicação utiliza `S3_*`. Não há serviço MinIO no Compose atual.

### 3.4 Stripe

| Variável | Comportamento | Finalidade |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Sem padrão | Chave secreta ou restrita do ambiente correto. |
| `STRIPE_WEBHOOK_SECRET` | Sem padrão | Assinatura do destino financeiro da conta da plataforma. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Sem padrão | Assinatura distinta do destino financeiro das contas conectadas. |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Sem padrão | Assinatura do destino thin das contas Accounts v2. |
| `STRIPE_CONNECT_ENABLED` | Desativado | Libera o cadastro de vendedores. |
| `STRIPE_DEMO_MODE` | Desativado | Demonstração com pagamento na conta de teste da plataforma; exige chave de teste. |
| `STRIPE_PIX_ENABLED` | Desativado | Exposição do fluxo Pix; não habilita o método na Stripe. |
| `STRIPE_ENABLE_LIVE` | Desativado | Gatilho adicional para novas operações financeiras reais. |
| `STRIPE_ALLOW_PENDING_TEST_SELLERS` | Desativado | Exceção restrita a tentativa de cartão em vendedor brasileiro de teste com requisitos pendentes. Não aprova identidade nem libera produção. |

O envio de cobranças reais também verifica Connect e os dois segredos financeiros
distintos. O terceiro segredo acompanha alterações de contas v2. Procedimentos,
eventos, limites e pré-requisitos estão nos guias de [teste](stripe-testing.md)
e [produção](stripe-production.md).

### 3.5 Variáveis da infraestrutura e da suíte

| Nome | Quem interpreta | Finalidade |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Docker Compose | Interpola a senha do serviço PostgreSQL e suas URLs internas. |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | Docker Compose | Credenciais do broker e interpolação de `AMQP_URL`. |
| `RAILWAY_VOLUME_MOUNT_PATH` | Core | Diretório de dados quando não há `DATA_DIR` explícito. |
| `RAILWAY_ENVIRONMENT_NAME` | Core | Sua presença ativa `trust proxy` para um salto de proxy. |
| `STRIPE_TEST_POSTGRES_URL` | Teste de workflow financeiro | Habilita execução contra um PostgreSQL descartável. Não é a conexão de produção do core. |

O Compose possui valores de fallback locais para algumas senhas e tokens.
Defina valores próprios antes de usar o ambiente fora de uma avaliação local.

## 4. Integrações externas

### 4.1 Google OAuth

1. Configure um cliente OAuth de aplicação web no Google Cloud.
2. Cadastre o callback exato do ambiente:
   `https://reusa.up.railway.app/api/auth/google/callback` em produção ou
   `http://localhost:3000/api/auth/google/callback` no backend local.
3. Defina `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e
   `APP_BASE_URL` coerentes com o domínio de uso.
4. Valide redirecionamento, retorno ao frontend e sessão de um usuário autorizado.

O backend troca o código com a Google e consulta o perfil. Não colocar o segredo
do cliente OAuth em variáveis de frontend ou em arquivos versionados.

### 4.2 E-mail e Cloudflare R2

Configure SMTP para confirmação de conta e recuperação de senha. Caso use Gmail,
use a senha de aplicativo aplicável à conta e suas políticas. Envie um e-mail de
teste pelo fluxo da aplicação e confira o domínio público dos links recebidos.

Para R2, valide upload de foto e vídeo e o acesso público à URL resultante em uma
sessão sem autenticação. Isso verifica condições que testes locais simulados
não comprovam: permissão do bucket, domínio público e credenciais reais.

### 4.3 Pagamentos

O fluxo atual usa Stripe, sem uso ativo de credenciais Mercado Pago. Existem
três destinos de eventos:

| Destino | Conteúdo | Endpoint |
| --- | --- | --- |
| Financeiro da plataforma | Snapshot | `/api/payments/stripe/webhook` |
| Financeiro das contas conectadas | Snapshot | `/api/payments/stripe/webhook` |
| Alterações de contas Accounts v2, escopo da plataforma | Thin/mínimo | `/api/payments/stripe/accounts-webhook` |

Cada destino usa seu segredo. A lista exata de eventos está em
[Stripe em produção](stripe-production.md). Não misture chaves, contas,
vendedores ou segredos de ambientes diferentes.

Na demonstração, mantenha chave de teste e `STRIPE_ENABLE_LIVE=false`.
Onboarding aberto não comprova aprovação da conta; retorno do Checkout não
comprova pagamento. Use o resultado consultado pelo backend e os eventos
assinados, seguindo [Stripe em teste](stripe-testing.md).

### 4.4 Demais serviços

ViaCEP é consultado diretamente pelo frontend. OpenStreetMap e Nominatim também
têm uso pelo navegador; BrasilAPI, Overpass e OSRM são consultados pelo backend.
As funções correspondentes exigem conectividade e disponibilidade dos provedores.
O app não contém cópias locais dessas APIs. Os mapas e rotas não representam
contratação de transporte nem rastreamento de entregador.

## 5. Execução com Docker

### 5.1 Aplicação em um contêiner

O Dockerfile usa `node:22-alpine`, instala dependências, compila o frontend,
remove dependências de desenvolvimento da árvore final e executa como usuário
`node`. A imagem atual não utiliza build em múltiplos estágios; arquivos de
camadas anteriores ainda participam do tamanho da imagem.

```bash
docker build -t reusa-plus .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=exemplo-local-substitua-por-um-segredo \
  -v reusa-plus-data:/app/data reusa-plus
```

Esse comando é para avaliação SQLite e não define `NODE_ENV=production`.
O volume preserva `reusa.sqlite` e uploads locais. `.env`, `.git`, dependências
locais, builds locais e diretórios de dados são excluídos pelo `.dockerignore`;
as dependências e o build da imagem são criados durante a construção.

### 5.2 Ambiente distribuído

```bash
docker compose config --services
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 core notifications impact
```

| Serviço | Processo/imagem | Porta no ambiente Compose | Persistência |
| --- | --- | --- | --- |
| `core` | `node backend.js` | Publicada `3000:3000` | `core-data:/data`; tabelas no PostgreSQL. |
| `postgres` | `postgres:16-alpine` | `5432` interna | `postgres-data:/var/lib/postgresql/data`. |
| `rabbitmq` | `rabbitmq:3.13-management` | AMQP `5672` interna | `rabbitmq-data:/var/lib/rabbitmq`. |
| `redis` | `redis:7-alpine`, AOF ativo | `6379` interna | `redis-data:/data`. |
| `notifications` | `node services/notification-service.js` | `3001` interna | Tabelas do serviço no PostgreSQL; `notification-data:/data` declarado. |
| `impact` | `node services/impact-service.js` | `3002` interna | Tabelas do serviço no PostgreSQL; `impact-data:/data` declarado. |

O backend usa `http://notifications:3001` e `http://impact:3002` na rede interna.
Todos usam o mesmo token interno. Os workers têm `PORT` próprios e filas próprias;
o repositório ainda os executa em contêineres separados.

Na primeira instalação ou ao reconstruir um broker sem suas filas, inicie os
consumidores antes de liberar as operações do core. As filas são declaradas pelos
workers, e a confirmação de publicação do produtor não comprova que já exista
uma fila ligada ao exchange. Para essa preparação, use a sequência:

```bash
docker compose up -d postgres rabbitmq redis
docker compose up --build -d notifications impact
docker compose logs --tail=50 notifications impact

# Após observar a conexão dos dois consumidores (mensagens "consuming")
docker compose up --build -d core
```

Filas duráveis já existentes são preservadas no volume do broker; não há uma
verificação automática dessas ligações no health check do core.

O Compose interpola `.env` nas variáveis declaradas no YAML. Ele não encaminha
automaticamente todo o arquivo ao processo. Google, SMTP e S3 não estão
declarados no `environment` atual do `core`: para usá-los nesse perfil, adicione
as variáveis ao serviço por um arquivo de override local ou configure seu
encaminhamento no ambiente de implantação. O mesmo cuidado vale para flags
adicionais não declaradas no YAML, como a exceção de vendedor pendente de teste.

### 5.3 Encerramento e entrega

Para interromper os serviços preservando os volumes declarados:

```bash
docker compose down
```

Não utilize remoção de volumes como procedimento de atualização. Para entregar
a imagem da aplicação em arquivo:

```bash
docker save reusa-plus -o reusa-plus.tar
docker load -i reusa-plus.tar
```

`docker save` contém imagens, não volumes. Não inclui o conteúdo do PostgreSQL,
os uploads persistentes, o bucket R2 ou serviços como Google e Stripe. O ambiente
completo também exige as imagens de PostgreSQL, RabbitMQ e Redis e as respectivas
configurações; exportar apenas `reusa-plus` não as adiciona automaticamente.

## 6. Implantação na Railway

O [`railway.toml`](../railway.toml) define Railpack, `npm run build`, `npm start`,
health check em `/api/health` com limite de 120 segundos e reinício `ON_FAILURE`
com até 10 tentativas. Esse arquivo configura o serviço principal; não cria
automaticamente os seis serviços do Docker Compose.

Sequência de preparação:

1. Conecte o repositório GitHub e selecione a branch de implantação.
2. Configure Node 22, PostgreSQL e as variáveis da aplicação. Defina
   `NODE_ENV=production`, `DATABASE_PROVIDER=postgres`, a URL de banco e
   `JWT_SECRET` estável.
3. Configure o domínio, `APP_BASE_URL`, SMTP e Google conforme os recursos usados.
4. Configure R2 ou um volume persistente para uploads locais. Em um volume,
   confira o caminho real e sua relação com `DATA_DIR`.
5. Para a configuração distribuída, implante RabbitMQ, Redis e os dois workers;
   use os comandos e as portas da seção Docker, com endereços internos reais da
   Railway e o token compartilhado. Não use hostnames do Compose fora daquela rede.
6. Configure Stripe conforme o ambiente escolhido e valide seus destinos de
   eventos no domínio público.
7. Execute os checks de aplicação e os fluxos de aceitação abaixo.

As migrações PostgreSQL são executadas antes de o core começar a escutar HTTP.
Preserve os arquivos de migração e valide previamente mudanças de esquema em um
banco isolado. O projeto não implementa rollback automático de migrações.

Uma alteração somente em `docker-compose.yml` não altera a configuração de
serviços já implantados na Railway. A quantidade efetiva de instâncias deve ser
consultada no projeto da Railway; o repositório não fornece esse inventário.

## 7. Verificação, rotinas e observabilidade

### 7.1 Saúde e diagnóstico

| Recurso | Interpretação e acesso |
| --- | --- |
| `GET /api/health` | Retorna `{ "ok": true }` quando o handler HTTP responde. É o check configurado na Railway. |
| `GET /api/health/live` | Processo principal respondendo; não valida todo o negócio. |
| `GET /api/health/ready` | Consulta PostgreSQL e verifica Redis/RabbitMQ quando configurados. Pode retornar `503` com dependência indisponível. Não verifica aprovação Stripe, SMTP ou entrega de mídia. |
| `GET /health` dos workers | Resposta do serviço e quantidade de eventos processados; não equivale a uma verificação completa de conectividade do broker. |
| `GET /api/distributed/overview` | Requer usuário autenticado; resume eventos e consultas de saúde dos serviços. |
| `GET /api/admin/payments/stripe` | Requer administrador; configuração financeira e pendências de processamento, sem expor segredos. |
| `GET /metrics` | Métricas de requisições; exige Bearer igual ao token interno quando configurado. |

Checks locais de leitura:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
docker compose ps
docker compose logs --tail=100 core notifications impact
```

### 7.2 Rotinas automáticas

| Rotina | Frequência/condição implementada |
| --- | --- |
| Publicação da outbox | Na inicialização e a cada 5 segundos quando `AMQP_URL` está configurado. No PostgreSQL, lotes de até 100 com lease e nova tentativa com espera crescente após falha. |
| Descoberta de itens e pedidos | Na inicialização e a cada minuto; verifica alertas e atendimento de pedidos. |
| Lembretes de entrega | Na inicialização e a cada minuto; aplica as janelas de 24 horas e 1 hora a entregas aceitas e futuras. |
| Conciliação Stripe | Na inicialização e a cada minuto, quando configurada; seleciona eventos e pagamentos elegíveis em lotes de até 25 de cada. |
| Reconexão dos consumidores | Após falhas, novas tentativas de conexão ao broker com intervalo de aproximadamente 3 segundos. |

As rotinas executam dentro dos processos, sem cron externo incluído. Lembretes
vencidos não são enviados retroativamente após o encontro. O fluxo financeiro
possui suas próprias datas de reconciliação; a varredura a cada minuto não
significa uma consulta por minuto a todos os pagamentos.

### 7.3 Logs e métricas

O core atribui `X-Correlation-Id` às requisições e o devolve na resposta; o cliente
inclui esse identificador nos erros apresentados ao usuário. Erros Stripe podem
incluir também `stripeRequestId`, permitindo localizar a chamada no provedor.
Use esses identificadores junto do horário, rota e ambiente para investigar.

Os contadores de `/metrics` incluem total de requisições, totais por status HTTP
e requisições com duração de pelo menos um segundo. São mantidos em memória por
processo e reiniciam com ele. Não há histórico central, painel ou alertas de
infraestrutura configurados pelo repositório.

## 8. Testes e validação de uma entrega

```bash
npm ci
npm test
npm run build
```

O workflow [GitHub Actions](../.github/workflows/stripe-checks.yml) também executa
auditoria das dependências de produção e testes de integração com PostgreSQL 16.
O arquivo descreve os checks; consultar sua execução remota é necessário para
saber se uma revisão específica passou no CI.

Para integrações PostgreSQL, use **exclusivamente um banco descartável de teste**:

```bash
NODE_ENV=test DATABASE_PROVIDER=postgres \
  POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_test \
  node --test test/postgres.integration.test.js

STRIPE_TEST_POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_test \
  node --test test/stripe-workflow.test.js
```

Não aponte a suíte a um banco da aplicação publicada. A documentação de
[Segurança e testes](seguranca-e-testes.md) detalha a cobertura e suas limitações.

Após implantação, confira cadastro/confirmação, login, upload, busca, conversa,
oferta, acordo, recebimento e visualização dos indicadores. Para pagamentos,
valide separadamente os cenários autorizados de teste do provedor, eventos,
conta de destino e reembolso. Testes com respostas simuladas não comprovam
aprovação de vendedor, repasse bancário nem chegada de eventos ao domínio.

## 9. Backup, restauração e continuidade

O repositório não agenda backups nem declara RPO, RTO ou disponibilidade medida.
A política de retenção, frequência, armazenamento e teste de restauração precisa
ser definida no ambiente de operação.

### 9.1 O que preservar

| Conjunto | Conteúdo |
| --- | --- |
| PostgreSQL | Dados do core, outbox, registros financeiros/auditoria e tabelas dos serviços. Incluir esquema e histórico de migrações. |
| RabbitMQ | Definições, filas e mensagens persistentes; o volume do broker participa da continuidade do processamento. |
| Redis | Estado do limitador e persistência AOF, quando utilizada. |
| Uploads locais / SQLite | Banco e arquivos em `DATA_DIR`, além dos diretórios próprios dos serviços no perfil SQLite. |
| Cloudflare R2 | Objetos e configuração do bucket/domínio, por procedimento próprio do provedor. |
| Configuração | Versão do código/imagens e cópia protegida das variáveis necessárias. Segredos não devem entrar no Git nem no pacote público. |

Para PostgreSQL, um exemplo de backup lógico, com URL disponibilizada
localmente em variável própria do operador, é:

```bash
pg_dump --format=custom --no-owner --no-acl \
  --file=reusa-backup.dump "$REUSA_BACKUP_URL"

# Confere o índice do arquivo sem restaurar nem alterar o banco
pg_restore --list reusa-backup.dump
```

`REUSA_BACKUP_URL` e `REUSA_RESTORE_URL` são variáveis de exemplo do procedimento,
não opções lidas pela aplicação. Use ferramenta PostgreSQL compatível com a versão
do servidor e proteja o arquivo resultante, pois contém dados de usuários.

### 9.2 Teste de restauração

1. Prepare um PostgreSQL **novo e isolado**, com versão compatível e sem processos
   da aplicação usando o banco. Confirme a URL de destino antes de prosseguir.
2. Restaure o backup nessa base vazia, sem executar limpeza do banco de origem:

   ```bash
   pg_restore --no-owner --no-acl \
     --dbname="$REUSA_RESTORE_URL" reusa-backup.dump
   ```

3. Compare tabelas, contagens, usuários, anúncios, eventos e histórico financeiro;
   verifique o registro de migrações e os dados pertencentes aos workers.
4. Restaure ou conecte uma cópia coerente dos uploads/objetos e da configuração.
5. Inicie a aplicação isolada e teste os fluxos. Mantenha integrações financeiras
   em ambiente de teste ou desabilitadas para evitar efeitos reais durante o ensaio.
6. Documente o resultado e o tempo de recuperação observado. Isso não é produzido
   automaticamente pelo código.

O script `npm run verify:postgres` faz verificações de estrutura e contagens de
um conjunto do núcleo; ele não é uma validação integral de backup, de todas as
tabelas atuais ou de objetos do R2. Para SQL.js, interrompa os processos antes de
copiar bancos e uploads para obter um conjunto consistente; não copie somente o
arquivo principal durante uma gravação.

A outbox não substitui backup do broker: um evento já marcado como publicado
pode ainda estar na fila, sem ter sido processado. Considere banco, filas,
deduplicação e arquivos em conjunto na recuperação. Não apague inboxes nem marque
eventos/pagamentos manualmente como concluídos para esconder pendências.

### 9.3 Atualizações e retorno à versão anterior

Antes de alterar aplicação ou esquema, registre a revisão implantada, valide os
testes e preserve backup recuperável. Publique a aplicação com as migrações
correspondentes e acompanhe saúde, logs e fluxos principais.

Retornar somente a imagem anterior não desfaz migrações já aplicadas. É necessário
avaliar a compatibilidade do código com o esquema e, se houver recuperação de
dados, seguir um procedimento de restauração validado. Não há migrations `down`
nem rollback financeiro automático no repositório.

## 10. Diagnóstico de ocorrências

| Sintoma | Verificação e ação operacional |
| --- | --- |
| Core não inicia em produção | Confirmar Node 22, `DATABASE_PROVIDER=postgres`, URL do banco, acesso de rede, permissões e erro da migração nos logs. Não remover migrações para contornar o problema. |
| `JWT_SECRET is not configured` | Definir segredo persistente no ambiente e reiniciar; tokens assinados com o segredo temporário precisarão ser renovados. |
| `.env` não produz efeito em `npm start` | Exportar variáveis para o processo ou usar explicitamente `node --env-file=.env backend.js`. No Compose, conferir a declaração das variáveis em `environment`/override. |
| Google retorna erro de callback | Comparar domínio, protocolo, porta e caminho de `GOOGLE_REDIRECT_URI` com o cadastro no Google Cloud; conferir ambiente e credenciais. |
| Cadastro existe, mas o e-mail não chega | Conferir SMTP, remetente, credenciais, bloqueios do provedor e logs de envio. Corrigir e reenviar confirmação. |
| Imagens ou vídeos não abrem no R2 | Conferir URL pública, domínio habilitado e acesso sem autenticação. A URL de API S3 não substitui o domínio público. |
| Falha de upload / acesso ao bucket | Conferir bucket, endpoint, credenciais, permissões e limites de mídia. `bucket access verified` é informativo, não um erro. |
| Aviso antigo sobre bucket policy no R2 | Confirmar que a revisão atual está implantada. O código atual identifica R2 e não envia `PutBucketPolicy` a esse provedor. |
| Stripe `403 forbidden` após trocar conta/sandbox | Conferir ambiente das chaves e vínculo do vendedor. A chave nova não acessa automaticamente contas antigas. Usar a recuperação de cadastro de teste somente nas condições do guia; preservar o histórico financeiro. |
| Vendedor aparece pendente ou em análise | Consultar os requisitos na Stripe e continuar o onboarding correspondente. Não marcar aprovação no banco; a Stripe decide a habilitação. |
| Checkout rejeita forma de pagamento | Conferir os métodos habilitados na conta que recebe a cobrança e a oferta aceita. O código atual usa formas dinâmicas e `allowed_payment_method_types` para novas tentativas; consultar os guias antes de repetir uma tentativa antiga. |
| Webhook financeiro não atualiza pagamento | Conferir URL, ambiente, escopo da conta, conteúdo snapshot/thin correto, assinatura e segredo do destino; consultar inbox, conciliação e `stripeRequestId`. O retorno do navegador não confirma pagamento. |
| Outbox cresce sem notificações distribuídas | Conferir `AMQP_URL`, exchange, credenciais, filas e consumidores; sem broker, o core mantém eventos pendentes. Não pressupor que o fallback local cubra todos os fluxos PostgreSQL. |
| Broker recebe evento, mas o serviço não atualiza | Conferir worker, URL interna, token, conexão ao banco e filas mortas. Erros de processamento são enviados à DLQ; não há replay automático dessas mensagens implementado. |
| Redis indisponível | Conferir conexão e readiness. Durante falhas do limitador há fallback local, com contadores por processo; isso não mantém um limite compartilhado entre réplicas. |
| Rota indisponível | Conferir conectividade OSRM e coordenadas. `NoRoute` pode significar ausência de rota, não falha geral do mapa. |
| Contador HTTP caiu após reinício | Métricas são locais ao processo e não persistem; usar coleta externa se precisar de histórico. |

Para investigação das filas no Compose, um comando de leitura é:

```bash
docker compose exec rabbitmq rabbitmqctl list_queues \
  name messages_ready messages_unacknowledged consumers
```

As filas de consumo são `reusa.notifications.v2` e `reusa.impact.v2`; cada uma
possui uma fila morta com sufixo `.dead`. Investigue a causa e a deduplicação antes
de qualquer reenvio operacional. O detalhamento está em [Arquitetura](arquitetura.md).

## 11. Fontes operacionais

- [README](../README.md), [package.json](../package.json) e [.env.example](../.env.example).
- [Dockerfile](../Dockerfile), [Docker Compose](../docker-compose.yml) e [Railway](../railway.toml).
- [Inicialização e rotinas do core](../backend.js).
- [Configuração do banco](../storage/database-config.js) e [pool PostgreSQL](../storage/postgres-repository.js).
- [Publicador de eventos](../distributed/event-publisher.js), [cliente AMQP](../distributed/amqp.js) e [métricas](../distributed/observability.js).
- [Serviço de notificações](../services/notification-service.js) e [serviço de impacto](../services/impact-service.js).
- [Guias Stripe de teste](stripe-testing.md) e [produção](stripe-production.md).
