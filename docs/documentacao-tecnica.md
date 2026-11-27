# Documentação técnica — ReUsa+

<p align="center">
  <img src="../src/assets/reusa-logo.png" alt="Logo do ReUsa+" width="160">
</p>

<p align="center"><strong>Plataforma web de economia circular</strong><br>Doação, troca, venda e colaboração comunitária</p>

| Identificação | Informação |
| --- | --- |
| Autor e desenvolvedor | **Marcus Vinicius Campos da Silva** |
| Sistema publicado | [https://reusa.up.railway.app](https://reusa.up.railway.app) |
| Repositório | [MarcusVinicius-BCC/ReUsa](https://github.com/MarcusVinicius-BCC/ReUsa) |
| Versão declarada | `1.0.0`, conforme [package.json](../package.json) |
| Código-base analisado | [`051a07c`](https://github.com/MarcusVinicius-BCC/ReUsa/commit/051a07c65108fff389a77c48b7fa42d62cc52405) |
| Atualização desta documentação | 19 de novembro de 2026 |
| Idioma | Português do Brasil |

## 1. Apresentação

O ReUsa+ é uma plataforma web de economia circular para publicação e negociação
de itens destinados à doação, troca ou venda. Reúne usuários, anúncios, propostas,
conversas, iniciativas comunitárias, acordos de retirada e entrega, pagamentos e
acompanhamento do recebimento.

Esta documentação descreve a estrutura e o comportamento observados no código,
incluindo contratos de API, persistência, regras, serviços e procedimentos de
operação. Diferenças entre SQLite e PostgreSQL e dependências de configuração
externa são identificadas nos capítulos correspondentes.

A referência do código identifica a versão da aplicação analisada; este conjunto
de documentos foi acrescentado posteriormente. Os procedimentos descritos não
constituem uma consulta às variáveis privadas ou aos serviços efetivamente ativos
no projeto Railway.

## 2. Organização da documentação

| Capítulo | Conteúdo |
| --- | --- |
| [Arquitetura](arquitetura.md) | Componentes, módulos, estrutura do repositório, serviços distribuídos, eventos, integrações e diagramas de comunicação. |
| [Funcionalidades e regras](funcionalidades-e-regras.md) | Atores, requisitos funcionais, casos de uso, permissões, estados, limites e regras de negócio. |
| [Banco de dados](banco-de-dados.md) | Dicionário das tabelas, relacionamentos, diagramas ER, migrações, transações e persistência dos serviços. |
| [API](api.md) | Rotas públicas, autenticadas, administrativas e internas, formatos de entrada/saída, exemplos e diferenças por provedor. |
| [Instalação e operação](operacao.md) | Execução local, variáveis, Docker, Railway, integrações, monitoramento, backup, recuperação e diagnóstico. |
| [Segurança e testes](seguranca-e-testes.md) | Autenticação, autorização, proteção de entradas, integridade financeira, privacidade, cobertura de testes e limites conhecidos. |
| [Stripe em teste](stripe-testing.md) | Demonstração, cadastro de vendedores, sandbox e recuperação de vínculos. |
| [Stripe em produção](stripe-production.md) | Configuração do Connect, destinos de eventos, habilitação real e procedimentos financeiros. |

Para conhecer o produto, comece por **funcionalidades e regras**. Para executar
a aplicação, consulte **instalação e operação**. Para integração ou manutenção,
utilize os capítulos de **arquitetura**, **banco de dados** e **API**.

## 3. Objetivos e escopo

### 3.1. Objetivo geral

Facilitar o reaproveitamento de produtos e materiais, conectando pessoas e
organizando a interação entre anúncio, negociação e recebimento.

### 3.2. Objetivos específicos

- Permitir cadastro, autenticação e gerenciamento de perfis.
- Publicar e encontrar itens com imagens, vídeos e informações de retirada.
- Organizar mensagens, ofertas, reservas e acordos entre os participantes.
- Integrar pagamentos de vendas e acompanhar os resultados financeiros.
- Incentivar campanhas de arrecadação, pedidos comunitários e alertas de itens.
- Disponibilizar pontos de coleta, rotas e indicadores de reaproveitamento.
- Apoiar moderação e administração da comunidade.
- Separar responsabilidades de processamento e registrar eventos de negócio.

### 3.3. Atores

| Ator | Participação |
| --- | --- |
| Visitante | Consulta conteúdos públicos e inicia cadastro ou login. |
| Usuário | Publica anúncios, interage com a comunidade e gerencia seus recursos. |
| Anunciante/vendedor/doador | Oferece um item, seleciona interessados e participa do acordo. |
| Interessado/comprador/destinatário | Envia ofertas, combina a retirada e confirma o recebimento. |
| Organizador de campanha | Define metas e acompanha contribuições de materiais. |
| Administrador | Modera conteúdos e gerencia usuários, denúncias e pontos de coleta. |
| Serviços internos | Processam eventos e disponibilizam notificações e indicadores. |
| Serviços externos | Autenticam, enviam e-mails, processam pagamentos, armazenam mídias ou fornecem dados geográficos/cadastrais. |

Os papéis de anunciante e interessado dependem de cada negociação. Uma mesma
pessoa pode ocupar ambos em contextos diferentes.

## 4. Visão técnica resumida

| Camada | Implementação |
| --- | --- |
| Interface | React 18, React Router, Zustand, JavaScript, HTML e CSS. |
| Compilação | Vite; arquivos gerados em `dist/`. |
| Aplicação principal | Node.js 22 e Express; serve o frontend e as rotas REST. |
| Autenticação | JWT, senhas com `scrypt`, Google OAuth e links de e-mail. |
| Banco de produção | PostgreSQL, com migrações aplicadas ao iniciar. |
| Persistência local | SQLite via SQL.js, fora do modo de produção. |
| Eventos | Outbox transacional e RabbitMQ via AMQP. |
| Consumidores | Serviços de notificações e impacto ambiental. |
| Controle compartilhado | Redis nas rotas em que o limitador está aplicado. |
| Mídias | Multer, armazenamento local ou Cloudflare R2/S3. |
| Pagamentos | Stripe Checkout e Connect, com ambientes separados. |
| Mapas e consultas | Leaflet, OpenStreetMap, Nominatim, Overpass, OSRM, ViaCEP e BrasilAPI. |
| Operação | Docker, Docker Compose, Railway e GitHub Actions. |

O Compose define seis serviços: aplicação principal, PostgreSQL, RabbitMQ,
Redis, notificações e impacto. A quantidade efetivamente implantada em outro
ambiente deve ser consultada nesse ambiente; o Compose não ativa automaticamente
esses serviços na Railway.

### 4.1. Aspectos de sistemas distribuídos

O sistema possui comunicação HTTP entre cliente, aplicação e serviços, além de
mensageria assíncrona para parte dos eventos de negócio. A persistência da
operação e da outbox na mesma transação permite retomar publicações quando o
broker volta a responder.

Consumidores independentes registram os eventos processados para evitar aplicar
o mesmo efeito duas vezes. A confirmação ao RabbitMQ ocorre depois da
persistência do processamento. Notificações e indicadores derivados podem ser
atualizados depois da resposta da operação principal, caracterizando
consistência eventual.

As APIs externas possuem disponibilidade, permissões e estados próprios. Banco,
broker, objetos e Stripe não participam de uma única transação distribuída. O
tratamento de falhas depende de persistência, idempotência, consultas e
reconciliação, conforme [arquitetura](arquitetura.md).

## 5. Fluxos principais

| Fluxo | Resumo | Detalhamento |
| --- | --- | --- |
| Acesso | Cadastro ou Google, confirmação de e-mail quando aplicável e sessão JWT. | [Regras](funcionalidades-e-regras.md), [segurança](seguranca-e-testes.md). |
| Publicação | Dados do item, mídias e respostas obrigatórias de retirada. | [Regras](funcionalidades-e-regras.md), [API](api.md). |
| Negociação | Oferta, seleção do interessado e reserva do item. | [Regras](funcionalidades-e-regras.md). |
| Retirada/entrega | Proposta de local e horário por uma parte, aceite pela outra e recebimento confirmado pelo destinatário. | [Regras](funcionalidades-e-regras.md), [API](api.md). |
| Venda | Oferta aceita e acordo elegível, Checkout, confirmação financeira e recebimento. | [Stripe em produção](stripe-production.md). |
| Comunidade | Campanhas e pedidos conectam necessidades a contribuições e doações. | [Regras](funcionalidades-e-regras.md). |
| Eventos | Operação e outbox, publicação no broker, consumo e deduplicação. | [Arquitetura](arquitetura.md), [banco](banco-de-dados.md). |

Nas campanhas, somente contribuições efetivamente recebidas entram na meta.
Em vendas, o retorno do navegador não confirma pagamento. O acompanhamento da
entrega registra etapas e combinados; não acompanha entregadores por GPS.

## 6. Mapa dos artefatos e rastreabilidade

| Domínio/artefato | Implementação principal | Verificação ou referência |
| --- | --- | --- |
| Interface e navegação | [routes.jsx](../src/routes.jsx), [componentes](../src/components/), [store](../src/state/store.js). | Build Vite e roteiro de aceitação em [testes](seguranca-e-testes.md). |
| Conta e autenticação | [backend.js](../backend.js), [postgres-api.js](../storage/postgres-api.js). | [backend.test.js](../test/backend.test.js), [integração PostgreSQL](../test/postgres.integration.test.js). |
| Anúncios e mídias | [post-media.js](../storage/post-media.js), [post-media-upload.js](../storage/post-media-upload.js). | [post-media-flow.js](../test/post-media-flow.js), [post-media-upload.test.js](../test/post-media-upload.test.js). |
| Negociações e cancelamentos | [postgres-api.js](../storage/postgres-api.js), [backend.js](../backend.js), [delivery-api.js](../storage/delivery-api.js). | [acceptance-flow.js](../test/acceptance-flow.js), [offer-cancellation-flow.js](../test/offer-cancellation-flow.js). |
| Acordos e lembretes | [delivery-api.js](../storage/delivery-api.js). | [delivery-reminders.test.js](../test/delivery-reminders.test.js). |
| Campanhas | [campaign-api.js](../storage/campaign-api.js). | [backend.test.js](../test/backend.test.js), [integração PostgreSQL](../test/postgres.integration.test.js). |
| Pedidos, alertas e transporte | [community-api.js](../storage/community-api.js). | [community-flow.js](../test/community-flow.js), [community-discovery.test.js](../test/community-discovery.test.js), [transport-flow.js](../test/transport-flow.js). |
| Pagamentos | [stripe-api.js](../storage/stripe-api.js), [stripe-payments.js](../services/stripe-payments.js). | [stripe-payments.test.js](../test/stripe-payments.test.js), [stripe-workflow.test.js](../test/stripe-workflow.test.js). |
| Eventos e consumidores | [distributed/](../distributed/), [services/](../services/). | [Arquitetura](arquitetura.md), [banco](banco-de-dados.md), cenários de operação. |
| Evolução do banco | [migrations/](../migrations/), [scripts/](../scripts/). | [Banco de dados](banco-de-dados.md), testes PostgreSQL. |
| Build e entrega | [Dockerfile](../Dockerfile), [Compose](../docker-compose.yml), [Railway](../railway.toml), [workflow](../.github/workflows/stripe-checks.yml). | [Operação](operacao.md), [segurança e testes](seguranca-e-testes.md). |

Os auxiliares de fluxo são chamados pelas suítes; sua presença na tabela não
significa que cada um seja uma suíte autônoma. A matriz indica pontos de
verificação existentes, sem declarar cobertura integral de todas as ramificações.

## 7. Condições de execução e limites da versão

- Em produção, PostgreSQL precisa estar configurado; SQLite atende ao perfil
  local e de testes.
- E-mail, login Google, R2, Redis, RabbitMQ e Stripe dependem de variáveis e
  permissões próprias. Um arquivo `.env` não é carregado automaticamente por
  `npm start`; os métodos explícitos estão em [operação](operacao.md).
- Aprovação de cadastro, Pix, cobranças reais e repasses dependem da Stripe.
  Teste, demonstração e produção possuem controles distintos.
- A aplicação não oferece transporte contratado, custódia financeira, reembolso
  automático por não recebimento ou verificação institucional das campanhas.
- Alertas e lembretes são internos; notificações nativas precisam da aplicação
  aberta e da permissão do navegador.
- Há diferenças entre provedores nas avaliações, em rotas legadas e na aplicação
  do limitador de autenticação. Os contratos estão registrados em [API](api.md),
  [regras](funcionalidades-e-regras.md) e [segurança](seguranca-e-testes.md).
- Não existe busca visual por foto implementada. A função de sugestões legada
  utiliza regras e não um modelo de IA generativa.
- Não há SLA, benchmark de capacidade, política automática completa de retenção
  ou plano de recuperação com RPO/RTO medidos no repositório.

## 8. Manutenção da documentação

| Mudança no projeto | Documentos a revisar |
| --- | --- |
| Nova rota ou contrato | API e funcionalidades/regras. |
| Tabela, coluna, índice ou transação | Banco de dados e, quando afetado, API. |
| Estado ou permissão | Funcionalidades/regras, API e segurança/testes. |
| Serviço, evento ou integração | Arquitetura e operação. |
| Variável ou comando de implantação | Operação e `.env.example`. |
| Comportamento financeiro | Guias Stripe, API, regras e testes. |

O [README](../README.md) permanece como apresentação e ponto de início rápido.
Este índice e seus capítulos compõem a documentação técnica detalhada. Os
diagramas são escritos em Mermaid e podem ser visualizados diretamente no GitHub.

Não há arquivo de licença de software definido no repositório analisado.
`private: true` no `package.json` impede publicação acidental no npm, mas não
define uma licença de uso ou distribuição.
