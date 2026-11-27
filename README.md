<p align="center">
  <img src="src/assets/reusa-logo.png" alt="Logo do ReUsa+" width="180">
</p>

<h1 align="center">ReUsa+</h1>

<p align="center">
  <strong>Uma nova vida para os objetos. Novas possibilidades para a comunidade.</strong><br>
  Plataforma web de economia circular para doação, troca e venda de produtos.
</p>

<p align="center">
  <a href="https://reusa.up.railway.app">
    <img src="https://img.shields.io/badge/Acessar_o_sistema-ReUsa%2B-078653?style=for-the-badge&amp;logo=railway&amp;logoColor=white" alt="Acessar o ReUsa+ na Railway">
  </a>
  <a href="https://github.com/MarcusVinicius-BCC/ReUsa/actions/workflows/stripe-checks.yml">
    <img src="https://github.com/MarcusVinicius-BCC/ReUsa/actions/workflows/stripe-checks.yml/badge.svg" alt="Status da integração contínua">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&amp;logo=javascript&amp;logoColor=20232A" alt="JavaScript">
  <img src="https://img.shields.io/badge/React-18-149ECA?style=for-the-badge&amp;logo=react&amp;logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&amp;logo=vite&amp;logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 22">
  <img src="https://img.shields.io/badge/Express-20232A?style=for-the-badge&amp;logo=express&amp;logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&amp;logo=postgresql&amp;logoColor=white" alt="PostgreSQL">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&amp;logo=rabbitmq&amp;logoColor=white" alt="RabbitMQ">
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&amp;logo=redis&amp;logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Cloudflare_R2-F38020?style=for-the-badge&amp;logo=cloudflare&amp;logoColor=white" alt="Cloudflare R2">
  <img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&amp;logo=stripe&amp;logoColor=white" alt="Stripe">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&amp;logo=docker&amp;logoColor=white" alt="Docker">
</p>

<p align="center">
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#executar-localmente">Executar</a> ·
  <a href="#documentação">Documentação</a> ·
  <a href="#autor">Autor</a>
</p>

<p align="center">Desenvolvido por <strong>Marcus Vinicius Campos da Silva</strong>.</p>

---

## Sobre o projeto

O **ReUsa+** conecta pessoas que querem dar um novo destino a produtos e materiais.
A plataforma reúne publicação de anúncios, iniciativas comunitárias, conversas,
negociações e acompanhamento da retirada ou entrega em um único lugar.

O projeto foi desenvolvido para incentivar o reaproveitamento, aproximar doadores
e beneficiários e facilitar o consumo consciente, com uma interface responsiva
para computadores e dispositivos móveis.

**Sistema publicado:** [https://reusa.up.railway.app](https://reusa.up.railway.app)

**Documentação técnica completa:** [arquitetura, requisitos, banco de dados, API, operação e testes](docs/documentacao-tecnica.md).

## Funcionalidades

| Área | O que a plataforma oferece |
| --- | --- |
| **Conta e acesso** | Cadastro de pessoas e empresas, login com senha ou Google, verificação de e-mail, recuperação de senha e edição do perfil. |
| **Anúncios** | Doação, troca e venda; publicação, edição e exclusão; fotos, vídeos, escolha de capa e controle de disponibilidade. |
| **Descoberta de itens** | Busca, categorias, filtros por cidade/bairro e proximidade, favoritos e alertas de novos anúncios. |
| **Interações** | Curtidas, comentários, perguntas públicas ao anunciante, mensagens privadas, avaliações e bloqueio de usuários. |
| **Negociações** | Envio, aceite, recusa e cancelamento de ofertas; reserva de produtos; desistência conforme a etapa; painel de pendências. |
| **Retirada e entrega** | Proposta de local e horário, aceite do acordo, informações de transporte, lembretes, imprevistos e confirmação de recebimento. |
| **Pagamentos** | Stripe Checkout e Connect, cadastro de vendedores, consulta de pendências, acompanhamento financeiro, reembolsos e contestações. |
| **Comunidade** | Campanhas de arrecadação com metas e contribuições, pedidos de itens e acompanhamento dos materiais recebidos. |
| **Mapa e impacto** | Pontos de coleta, sugestões da comunidade, consulta de rotas e indicadores de reaproveitamento. |
| **Administração** | Gestão de usuários, suspensão e exclusão administrativa, moderação de anúncios e denúncias e gestão de pontos de coleta. |

### Fotos, vídeos e informações de retirada

- Até **8 fotos de 5 MB** e **2 vídeos MP4 ou WebM de 50 MB** por anúncio.
- Prévia da foto única sem recorte, escolha da capa e reprodução dos vídeos na galeria.
- Publicação com fotos, vídeos ou ambos, incluindo edição e remoção das mídias.
- Informação obrigatória sobre **desmontagem, escadas e transporte recomendado**.
- Medidas, peso, cuidados com a retirada e região aproximada são opcionais.

### Da oferta ao recebimento

1. O interessado envia uma oferta e o anunciante aceita, reservando o item.
2. Uma pessoa propõe local, data e horário; a outra aceita o acordo.
3. Nas vendas, o comprador pode iniciar o pagamento após o aceite do acordo.
4. Os participantes acompanham a entrega ou retirada e comunicam imprevistos.
5. O destinatário confirma o recebimento, concluindo a negociação.

O painel **Minhas negociações** reúne ofertas enviadas e recebidas, filtros por
etapa e destaque para as ações que dependem do usuário. Os endereços combinados
ficam restritos aos participantes.

<details>
<summary><strong>Regras de campanhas, alertas e negociações</strong></summary>

- **Campanhas:** possuem material, beneficiário, meta, cidade e prazo. Apenas
  contribuições com recebimento confirmado entram na meta. Campanhas encerradas,
  vencidas ou com meta atingida deixam de receber novas ofertas.
- **Pedidos da comunidade:** um usuário informa o que precisa; outro oferece um
  anúncio próprio disponível para doação. O atendimento segue o fluxo de acordo
  e recebimento, sem concluir a doação automaticamente.
- **Alertas:** até 20 buscas por usuário, com palavra, cidade/bairro e categoria.
  A verificação ocorre ao iniciar e a cada minuto, sem repetir o aviso de um mesmo
  anúncio para o mesmo alerta. As notificações são internas ao aplicativo.
- **Proximidade:** utiliza a região aproximada de anúncios cadastrados e permite
  busca em raios de 2 a 100 km, mediante autorização de localização do usuário.
- **Cancelar aceite:** permitido ao anunciante antes de qualquer proposta de
  entrega ou registro de pagamento. O anúncio é liberado e o comprador é avisado.
- **Acordo:** ninguém aceita a própria proposta. O agendamento deve ficar entre
  30 minutos e 90 dias no futuro; acordos vencidos não liberam novos pagamentos.
- **Lembretes:** entregas aceitas e ativas geram avisos internos nas janelas de
  24 horas e 1 hora antes do encontro, com controle para evitar duplicidade.
- **Imprevistos:** atrasos, ausências e problemas com o local ficam registrados
  no acordo e são comunicados à outra pessoa.
- **Problemas de negociação:** relatos de não recebimento, item diferente ou
  outras ocorrências são encaminhados à moderação com o contexto da negociação.

Um ponto de coleta é um local proposto para encontro; sua disponibilidade precisa
ser confirmada pelos participantes. O ReUsa+ não contrata transporte nem mantém
custódia dos valores. O acompanhamento registra etapas, sem rastreamento de
entregadores por GPS ou reembolso automático por não recebimento.

</details>

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| **Interface** | React 18, React Router, Zustand, Vite, JavaScript, HTML e CSS |
| **Backend** | Node.js 22, Express, APIs REST, HTTP e JSON |
| **Autenticação** | JWT, senhas com `scrypt` e Google OAuth 2.0 |
| **E-mails** | Nodemailer e SMTP |
| **Persistência** | PostgreSQL em produção; SQLite via SQL.js em ambiente local e testes |
| **Eventos** | RabbitMQ, AMQP e Transactional Outbox |
| **Controle de requisições** | Redis para limites compartilhados entre instâncias |
| **Mídias** | Multer, Cloudflare R2 e SDK compatível com Amazon S3 |
| **Pagamentos** | Stripe Checkout, Stripe Connect Accounts v2 e SDK oficial |
| **Mapas** | Leaflet, React Leaflet, OpenStreetMap, Nominatim, Overpass e OSRM |
| **Entrega e versionamento** | Docker, Docker Compose, Railway, Git, GitHub e GitHub Actions |

## Arquitetura

```mermaid
flowchart TB
    WEB["Interface web"] -->|"API REST"| BACK["Backend"]
    BACK --> DB[("Banco de dados")]
    BACK --> ARQUIVOS["Armazenamento de arquivos"]
    BACK --> GOOGLE["API Google"]
    BACK <-->|"Pagamentos e webhooks"| STRIPE["API de pagamentos"]
    BACK --> CNPJ["API de CNPJ"]
    BACK --> EMAIL["Serviço de e-mail"]
    WEB --> CEP["API de CEP"]
    WEB --> MAPAS["Serviços de mapas"]
    BACK --> MAPAS
    BACK --> REDIS["Controle de requisições"]
    BACK -->|"Eventos via outbox"| FILA["Fila de mensagens"]
    FILA --> NOTIFICACOES["Serviço de notificações"]
    FILA --> IMPACTO["Serviço de impacto"]
```

O frontend e a API ficam no mesmo repositório. A aplicação principal serve a
interface compilada e expõe as rotas `/api/*`. No modo PostgreSQL, o banco é a
fonte de verdade dos dados em execução.

Na configuração distribuída, os eventos são registrados na mesma transação da
operação de negócio, publicados no RabbitMQ e processados pelos serviços de
notificações e impacto. O fluxo utiliza confirmação de publicação, retentativas
e processamento idempotente, com entrega **pelo menos uma vez** e consistência
eventual dos resultados derivados.

Redis, RabbitMQ e os serviços separados dependem da configuração do ambiente.
O [Docker Compose](docker-compose.yml) define **6 serviços**: aplicação principal,
PostgreSQL, Redis, RabbitMQ, notificações e impacto.

<details>
<summary><strong>Integrações externas e responsabilidades</strong></summary>

| Integração | Responsabilidade | Quem consulta |
| --- | --- | --- |
| Google OAuth | Login social | Backend, com redirecionamento do navegador |
| Stripe | Cadastro de vendedores, Checkout e eventos financeiros | Backend |
| Cloudflare R2 | Armazenamento de fotos e vídeos | Backend para uploads; navegador para exibição pública |
| ViaCEP | Preenchimento de endereços por CEP | Frontend |
| BrasilAPI | Consulta de empresas por CNPJ | Backend |
| OpenStreetMap | Exibição do mapa | Frontend |
| Nominatim | Busca de endereços e coordenadas | Frontend e backend |
| Overpass | Consulta de pontos públicos de coleta | Backend |
| OSRM | Cálculo de rotas | Backend |
| SMTP | Confirmação de e-mail e recuperação de senha | Backend |

As notificações do navegador exigem permissão e a aplicação aberta. Lembretes e
alertas de itens são avisos internos; não há envio desses lembretes por SMS ou
e-mail. Google Fonts fornece as fontes e os ícones da interface.

</details>

## Executar localmente

**Pré-requisitos:** Node.js **22**, npm e Git. Docker é necessário apenas para
os modos de execução em contêineres.

```bash
git clone https://github.com/MarcusVinicius-BCC/ReUsa.git
cd ReUsa
npm ci
npm run build
npm start
```

Acesse [http://localhost:3000](http://localhost:3000).

Sem configuração de PostgreSQL e fora de `NODE_ENV=production`, a aplicação usa
SQLite em `data/reusa.sqlite` e armazenamento local. As integrações externas
precisam de suas respectivas configurações. O arquivo [.env.example](.env.example)
documenta as variáveis disponíveis; preencha apenas as que utilizar.

O comando `npm start` não carrega `.env` automaticamente. Para usar esse arquivo,
execute `node --env-file=.env backend.js` ou exporte as variáveis no terminal.
Os procedimentos estão no [guia de instalação e operação](docs/operacao.md).

### Desenvolvimento

Execute em dois terminais:

```bash
# Terminal 1: backend
npm run dev
```

```bash
# Terminal 2: frontend
npm run dev:ui
```

Acesse [http://localhost:5173](http://localhost:5173). O Vite encaminha as chamadas
de `/api` para o backend na porta `3000`.

### Docker Compose

```bash
docker compose up --build
```

O ambiente completo utiliza PostgreSQL e inicia os seis serviços definidos no
[docker-compose.yml](docker-compose.yml). A interface fica disponível na porta
`3000`; notificações e impacto usam as portas internas `3001` e `3002`.

Antes de uma implantação, configure os segredos de sessão, banco, broker e
comunicação interna. Para integrações como Google, SMTP e R2, as variáveis também
precisam ser encaminhadas ao serviço `core` no Compose; o arquivo `.env` sozinho
não adiciona variáveis que não estão declaradas no YAML.

Para encerrar, preservando os volumes:

```bash
docker compose down
```

<details>
<summary><strong>Avaliação local em um contêiner e exportação da imagem</strong></summary>

Para avaliar a aplicação com SQLite e armazenamento local, sem definir
`NODE_ENV=production`:

```bash
docker build -t reusa-plus .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=chave-local-de-avaliacao \
  -v reusa-plus-data:/app/data reusa-plus
```

Esse modo permite avaliar os recursos locais. Pagamentos, login Google, e-mails
e serviços distribuídos exigem configuração adicional.

Para exportar e importar a imagem:

```bash
docker save reusa-plus -o reusa-plus.tar
docker load -i reusa-plus.tar
```

A exportação contém a imagem da aplicação. Os volumes do banco e as mídias do
R2 são dados separados, assim como as credenciais dos serviços externos.

</details>

## Configuração e produção

Em produção, configure **PostgreSQL**, um `JWT_SECRET` estável e as integrações
utilizadas. `NODE_ENV=production` exige `DATABASE_PROVIDER=postgres` e uma conexão
válida em `POSTGRES_URL` ou `DATABASE_URL`. As migrações são aplicadas ao iniciar.

<details>
<summary><strong>Variáveis de ambiente</strong></summary>

| Grupo | Variáveis | Uso |
| --- | --- | --- |
| Aplicação | `PORT`, `APP_BASE_URL`, `DATA_DIR` | Porta, domínio público e diretório de dados locais. |
| Sessão e administração | `JWT_SECRET`, `ADMIN_EMAILS` | Assinatura dos tokens e definição de administradores. |
| PostgreSQL | `DATABASE_PROVIDER`, `POSTGRES_URL` ou `DATABASE_URL` | Persistência de produção. |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Login pelo Google. |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Verificação de conta e recuperação de senha. |
| Redis | `REDIS_URL` | Controle compartilhado de requisições. |
| RabbitMQ | `AMQP_URL`, `EVENT_EXCHANGE` | Publicação e consumo de eventos. |
| Serviços internos | `SERVICE_AUTH_TOKEN`, `NOTIFICATION_SERVICE_URL`, `IMPACT_SERVICE_URL` | Comunicação com notificações e impacto. |
| Armazenamento | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_REGION` | Fotos e vídeos no R2 ou em serviço compatível com S3. |
| Rotas | `ROUTING_BASE_URL` | Endereço do serviço OSRM. |
| Pagamentos | `STRIPE_*` | Segredos, ambientes, Connect, webhooks e habilitação dos meios de pagamento. |

No R2, `S3_PUBLIC_BASE_URL` deve apontar para o domínio público do bucket, como
`https://pub-xxxx.r2.dev`, e `S3_REGION` pode usar `auto`. A disponibilidade pública
dos objetos é configurada na Cloudflare; o app não aplica bucket policy ao R2.
Sem armazenamento externo, os uploads locais precisam de um volume persistente.

Para login Google no domínio publicado, cadastre o callback:

```text
https://reusa.up.railway.app/api/auth/google/callback
```

Defina `APP_BASE_URL=https://reusa.up.railway.app`. Credenciais ficam nas variáveis
do ambiente; [.env.example](.env.example) contém somente exemplos de configuração.

</details>

### Pagamentos e vendedores

A integração ativa utiliza **Stripe Checkout e Stripe Connect Accounts v2**.
Nos novos cadastros, os vendedores brasileiros concluem o onboarding hospedado
pela Stripe e usam o painel completo. Fora da demonstração, as cobranças são
criadas diretamente na conta conectada do vendedor.

O backend valida a conta, o valor e o acordo antes do pagamento, verifica a
assinatura dos webhooks e faz conciliação periódica. A integração inclui
idempotência, recuperação de respostas perdidas, reembolsos e acompanhamento
de contestações.

**Pix e pagamentos reais dependem de habilitação na Stripe e de configuração
explícita no sistema.** Teste e produção mantêm vínculos separados. Uma conta
criada ou um Checkout aberto não equivalem a cadastro aprovado ou pagamento
confirmado.

- [Guia de testes e cadastro de vendedores](docs/stripe-testing.md)
- [Guia de produção, credenciais e webhooks](docs/stripe-production.md)

O guia de produção descreve os **três destinos de eventos**: dois de pagamentos
com conteúdo snapshot e um de contas Accounts v2 com conteúdo thin.

### Railway

O [railway.toml](railway.toml) configura build com `npm run build`, inicialização
com `npm start` e health check em `/api/health`.

Para implantar, conecte o repositório à Railway, adicione PostgreSQL e configure
as variáveis de produção e o domínio público. Serviços de notificações, impacto,
Redis e RabbitMQ precisam ser implantados/configurados quando utilizados; o
Docker Compose não é aplicado automaticamente pela Railway.

## Testes e comandos

```bash
npm test
npm run build
```

Os testes cobrem autenticação, anúncios e mídias, permissões, campanhas, alertas,
mensagens, ofertas, entrega, armazenamento e pagamentos. Os testes financeiros
simulam respostas da Stripe; a validação real do provedor depende do ambiente
e das contas autorizadas.

O [GitHub Actions](.github/workflows/stripe-checks.yml) executa instalação,
auditoria de dependências, testes, integração PostgreSQL e build do frontend.

| Comando | Finalidade |
| --- | --- |
| `npm start` | Inicia a aplicação principal. |
| `npm run dev` | Executa o backend com recarga. |
| `npm run dev:ui` | Inicia o Vite. |
| `npm run build` | Gera a interface em `dist/`. |
| `npm test` | Executa a suíte de testes. |
| `npm run migrate:postgres:schema` | Aplica manualmente as migrações PostgreSQL. |
| `npm run migrate:postgres` | Migra dados do SQLite para PostgreSQL. |
| `npm run verify:postgres` | Verifica a migração dos dados. |

<details>
<summary><strong>Integração PostgreSQL e diagnóstico</strong></summary>

Use um banco de testes isolado para executar as integrações:

```bash
NODE_ENV=test DATABASE_PROVIDER=postgres \
  POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_test \
  node --test test/postgres.integration.test.js

STRIPE_TEST_POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_test \
  node --test test/stripe-workflow.test.js
```

Endpoints de diagnóstico:

| Endpoint | Finalidade |
| --- | --- |
| `/api/health` | Disponibilidade HTTP. |
| `/api/health/live` | Estado do processo principal. |
| `/api/health/ready` | Prontidão das dependências configuradas. |
| `/api/distributed/overview` | Visão autenticada dos eventos e serviços. |
| `/metrics` | Métricas HTTP; protegido quando há token interno configurado. |

Rotas protegidas usam `Authorization: Bearer <token>`. Operações administrativas
também exigem permissão de administrador.

</details>

## Documentação

| Artefato | Localização |
| --- | --- |
| Documentação técnica completa | [Índice, escopo e rastreabilidade](docs/documentacao-tecnica.md) |
| Arquitetura e regras | [Componentes e eventos](docs/arquitetura.md), [funcionalidades e regras](docs/funcionalidades-e-regras.md) |
| Dados e contratos | [Banco de dados](docs/banco-de-dados.md), [API](docs/api.md) |
| Operação e qualidade | [Instalação e operação](docs/operacao.md), [segurança e testes](docs/seguranca-e-testes.md) |
| API principal e regras de negócio | [backend.js](backend.js), [storage/](storage/) |
| Cliente da API e telas | [src/services/api.js](src/services/api.js), [src/routes.jsx](src/routes.jsx) |
| Persistência e evolução do banco | [migrations/](migrations/), [scripts/](scripts/) |
| Publicação de eventos e integrações | [distributed/](distributed/) |
| Serviços de notificações e impacto | [services/](services/) |
| Stripe em teste | [docs/stripe-testing.md](docs/stripe-testing.md) |
| Stripe em produção | [docs/stripe-production.md](docs/stripe-production.md) |
| Testes automatizados | [test/](test/) |
| Configuração de ambiente | [.env.example](.env.example) |
| Contêineres e implantação | [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml), [railway.toml](railway.toml) |

As migrações históricas são mantidas para preservar a evolução do banco,
inclusive quando o nome do arquivo se refere a uma integração anterior.
Dependências, builds, bancos locais, uploads e segredos são excluídos do
versionamento pelo [.gitignore](.gitignore).

## Autor

**Marcus Vinicius Campos da Silva**

Desenvolvimento e autoria do **ReUsa+**.

[GitHub](https://github.com/MarcusVinicius-BCC) ·
[Repositório](https://github.com/MarcusVinicius-BCC/ReUsa) ·
[Sistema publicado](https://reusa.up.railway.app)
