# Segurança, qualidade e testes

[← Documentação técnica](documentacao-tecnica.md)

**Projeto:** ReUsa+ · **Autor:** Marcus Vinicius Campos da Silva  
**Referência:** código-base `051a07c` · **Atualização:** 19/11/2026

## 1. Objetivo

Descrever os controles existentes, a cobertura dos testes e os critérios para
verificar a aplicação. As permissões e diferenças de comportamento entre os
provedores de banco também estão detalhadas em [API](api.md) e
[funcionalidades e regras](funcionalidades-e-regras.md).

## 2. Identidade, sessão e autorização

### 2.1. Senhas e tokens

| Item | Comportamento implementado |
| --- | --- |
| Senha | Hash com `crypto.scryptSync`, salt aleatório de 16 bytes e derivação de 64 bytes. O valor persistido inclui algoritmo, salt e hash. |
| Comparação | Utiliza `crypto.timingSafeEqual` para comparar os bytes calculados e armazenados. |
| Compatibilidade local | O backend SQLite ainda reconhece hashes antigos. O verificador PostgreSQL aceita o formato `scrypt`. |
| Sessão | JWT com `sub` contendo o identificador do usuário e expiração em 7 dias. |
| Transporte do token | Cabeçalho `Authorization: Bearer <token>`. |
| Navegador | O cliente guarda o token em `localStorage`, na chave `reusa_token`. |
| Validação da sessão | O servidor verifica a assinatura e consulta o usuário atual. Contas inexistentes ou suspensas são rejeitadas. |
| Confirmação de e-mail | Token aleatório de 32 bytes, com SHA-256 persistido e validade de 24 horas. |
| Redefinição de senha | Token aleatório com hash persistido, validade de 1 hora e limpeza do token após uso. |

Fontes: [backend](../backend.js), [rotas PostgreSQL](../storage/postgres-api.js)
e [cliente HTTP](../src/services/api.js).

O login por senha exige confirmação de e-mail. O cadastro, entretanto, já retorna
um JWT e o middleware de autenticação não aplica `email_verified` como bloqueio
universal. A confirmação de e-mail não deve ser descrita como pré-condição
implementada para todas as operações autenticadas.

Não existe fluxo de refresh token, lista de revogação individual de JWT ou
invalidade automática de todas as sessões após alteração da senha. Remover o token
do navegador encerra a sessão local; suspensão e exclusão são verificadas no
servidor a cada operação autenticada. Uma troca de `JWT_SECRET` invalida as
assinaturas anteriores e afeta todos os usuários.

### 2.2. Perfis e verificações de propriedade

| Ator | Escopo |
| --- | --- |
| Visitante | Consulta de conteúdos públicos, início de cadastro/login e consultas públicas permitidas. |
| Usuário autenticado | Perfil, anúncios próprios, conversas e negociações das quais participa, alertas e iniciativas comunitárias. |
| Anunciante | Edição do próprio anúncio, seleção de interessados e ações de vendedor previstas no fluxo. |
| Interessado/destinatário | Oferta própria, aceite de acordo proposto pela outra parte e confirmação do recebimento. |
| Administrador | Rotas administrativas, moderação, gestão de usuários e pontos de coleta. |
| Serviço interno | Rotas de notificações e impacto com o token interno, quando configurado. |
| Provedor de pagamento | Webhooks validados por assinatura, sem sessão de usuário. |

As permissões são verificadas nas rotas e transações, não apenas pela exibição de
botões no frontend. `owner_id`, `interested_id`, `author_id` e `role` são usados
conforme o recurso. Não há um serviço externo de autorização nem um catálogo
dinâmico de permissões.

`ADMIN_EMAILS` define e-mails administrativos; `ADMIN_EMAIL` é aceito por
compatibilidade. A configuração de administradores e a verificação do cadastro
devem seguir o comportamento do provedor de banco documentado em
[operação](operacao.md).

### 2.3. Google OAuth

O navegador inicia o fluxo na API própria. O backend redireciona ao Google,
troca o código por tokens e consulta o perfil com e-mail verificado. O estado
OAuth é assinado com JWT, possui propósito específico e validade de 10 minutos.
O retorno da aplicação é limitado a um caminho interno aceito por `safeReturnTo`.

O token da sessão do ReUsa+ retorna no fragmento da URL e é tratado pelo cliente.
O segredo OAuth permanece no backend. Esse fluxo não equivale ao fornecimento
das credenciais Google ao frontend.

## 3. Proteções HTTP e tratamento de entradas

### 3.1. Cabeçalhos e limites

O servidor desabilita `X-Powered-By` e define:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` com geolocalização para a própria origem;
- Content Security Policy com origens explícitas para fontes e consultas externas
  utilizadas pela interface, além de imagens HTTPS.

A CSP permite estilos inline e não transforma o armazenamento do JWT em
`localStorage` em armazenamento protegido contra execução de JavaScript na mesma
origem. O projeto não implementa sessão em cookie `HttpOnly`.

O parser JSON tem limite de `100kb`. O multipart de publicações utiliza limites
próprios. Requisições recebem um `X-Correlation-Id`, informado pelo cliente ou
gerado pelo servidor, limitado a 120 caracteres.

O middleware de limitação utiliza a combinação de IP e caminho. Quando há Redis,
os contadores são compartilhados; sem Redis ou diante de falha durante o uso do
limitador, há alternativa em memória local.

| Rotas com limitador explícito | Limite configurado |
| --- | --- |
| Autenticação nas rotas do backend SQLite | 30 requisições por 15 minutos. |
| Consulta pública de CNPJ | 60 requisições por 15 minutos. |
| Consulta de rota do mapa | 60 requisições por 15 minutos. |

**Diferença atual:** as rotas PostgreSQL de autenticação são registradas antes
das rotas SQLite e não recebem esse `authRateLimit`. Portanto, não existe um
limite global de autenticação comprovado para o modo PostgreSQL. O fallback em
memória também não mantém contagem compartilhada entre réplicas ou reinícios.

Na Railway, `trust proxy` é configurado para um salto quando a variável de
ambiente correspondente está presente. Não há middleware genérico de CORS;
o frontend servido pela aplicação usa a mesma origem e o Vite usa proxy local.

### 3.2. Validações de domínio

As rotas verificam campos obrigatórios, comprimentos, valores monetários,
permissões, estados das negociações e opções enumeradas. Consultas de dados
utilizam parâmetros SQL. As migrações são arquivos versionados executados pelo
servidor e não são recebidas como entrada do usuário.

A localização pública rejeita padrões prováveis de endereço residencial exato.
As coordenadas opcionais dos anúncios são arredondadas para a região e não são
retornadas como endereço exato público. O acordo de entrega possui controle de
participantes para leitura dos detalhes. Essas validações não certificam a
existência física de um endereço ou de um ponto de coleta.

## 4. Arquivos e armazenamento

Fontes: [upload de mídia](../storage/post-media-upload.js),
[regras de mídia](../storage/post-media.js) e
[armazenamento de objetos](../distributed/object-storage.js).

- Imagens: JPEG, PNG, GIF, WebP e AVIF; até 8 arquivos, com 5 MiB por arquivo.
- Vídeos: MP4 e WebM; até 2 arquivos, com 50 MiB por arquivo.
- O multipart aceita até 10 arquivos, com limites adicionais de campos e partes.
- Os nomes dos arquivos são gerados pelo servidor com UUID; o nome original não
  define o caminho de armazenamento.
- O lote é recebido em diretório temporário. A validação antecede a publicação
  das mídias e as falhas acionam limpeza dos arquivos não confirmados.
- Vídeos passam por leitura inicial do arquivo para verificar o cabeçalho básico
  de MP4 ou WebM. URLs remotas de vídeos não substituem o upload aceito.
- O envio ao armazenamento de objetos utiliza stream. A conclusão da transação
  controla a preservação das mídias associadas à publicação.

A validação não inclui antivírus, análise integral do conteúdo ou transcodificação
de vídeo. Os uploads públicos não devem ser usados como repositório privado de
documentos. Documentos de vendedores são coletados no ambiente hospedado da
Stripe, não por esse formulário de mídia.

O R2 exige um domínio público separado do endpoint autenticado S3. A política de
acesso público é administrada na Cloudflare. Credenciais S3 são mantidas no
ambiente do backend.

## 5. Segurança e integridade financeira

O fluxo de pagamentos contém:

1. Verificação da oferta aceita, valor em centavos, método e acordo de entrega.
2. Verificação da conta do vendedor e do ambiente utilizado.
3. Persistência da tentativa antes da chamada ao provedor.
4. Chave de idempotência e exclusão de tentativas concorrentes conflitantes.
5. Validação da assinatura do corpo original do webhook pelo SDK oficial.
6. Persistência do evento recebido e consulta do objeto atualizado na Stripe.
7. Comparação de conta, ambiente, referência, valor, moeda e estado financeiro.
8. Conciliação e reprocessamento de eventos pendentes.

Os segredos financeiros são distintos dos de contas conectadas e das notificações
Accounts v2. Eventos financeiros usam conteúdo snapshot; eventos de contas v2
usam conteúdo thin em endpoint separado. O retorno do navegador não confirma o
pagamento.

O sistema possui controles explícitos para demonstração, Pix, Connect e dinheiro
real. A permissão de uma tentativa de cartão em sandbox com vendedor pendente
não altera o resultado da verificação de identidade nem comprova recebimento
bancário. Não há custódia do valor ou garantia automática de entrega física.

Procedimentos completos: [Stripe em teste](stripe-testing.md) e
[Stripe em produção](stripe-production.md).

## 6. Dados pessoais, segredos e retenção

O banco contém dados de conta, endereços, mensagens, negociações e histórico
financeiro. O acesso varia conforme a finalidade e a participação no recurso.
Logs de diagnóstico de Stripe possuem tratamento para ocultar chaves, segredos,
tokens de URL e determinados dados pessoais.

O repositório exclui `.env`, dependências instaladas, builds, bancos locais e
uploads por meio do [.gitignore](../.gitignore). O
[.dockerignore](../.dockerignore) controla o contexto de build. Esses arquivos
não substituem o controle de quem pode acessar as variáveis ou os backups.

Limpar uma conversa registra um corte de visibilidade por usuário e atualiza
os contadores. Não representa a exclusão universal das mensagens da outra parte.
A exclusão de usuários envolve relações persistidas e operações administrativas;
não há política automatizada de retenção com prazo único para todos os domínios.

Não há evidência de criptografia de campos da aplicação em repouso, central de
consentimento ou certificação de conformidade legal. As condições de proteção
dos discos, backups e serviços contratados pertencem à configuração operacional.

## 7. Propriedades de qualidade e evidências

| Propriedade | Implementação/evidência | Limite observado |
| --- | --- | --- |
| Integridade das negociações | Transações, validação de estado e travas de linhas no PostgreSQL. | A paridade entre provedores deve ser avaliada por fluxo; existem diferenças documentadas. |
| Entrega de eventos | Outbox persistida, publicação com confirmação, consumidores com deduplicação. | Entrega pelo menos uma vez; não há transação global entre banco, RabbitMQ e serviços externos. |
| Recuperação financeira | Tentativas persistidas, idempotência, inbox e conciliação. | A confirmação final depende da API e dos eventos do provedor. |
| Escala | Processos e consumidores separados e infraestrutura compartilhada. | Não há benchmark versionado que estabeleça capacidade máxima de usuários. |
| Observabilidade | Health checks, logs com identificador e contadores HTTP. | Não há plataforma completa de tracing distribuído ou SLA medido no repositório. |
| Responsividade | Componentes React e CSS com layouts adaptáveis. | Não equivale a auditoria formal completa de acessibilidade. |
| Manutenção | Módulos por domínio, migrações SQL, testes e integração contínua. | O backend ainda contém rotas legadas e comportamentos distintos entre SQLite e PostgreSQL. |

Disponibilidade percentual, latência contratual, RPO e RTO não estão definidos
como metas medidas no código-base. O procedimento de backup e recuperação está
em [operação](operacao.md).

## 8. Estratégia de testes

O projeto utiliza o executor nativo `node:test` e `node:assert/strict`.
Os testes combinam funções isoladas, HTTP contra processo local, SQLite
temporário, PostgreSQL isolado e respostas externas simuladas.

| Arquivo de teste | Cobertura principal |
| --- | --- |
| [backend.test.js](../test/backend.test.js) | Saúde, autenticação, cadastro, permissões, anúncios, interação, campanhas, propostas, mensagens, coleta e formulários. |
| [postgres.integration.test.js](../test/postgres.integration.test.js) | Persistência e fluxos HTTP com PostgreSQL, incluindo auxiliares de negociação, comunidade e mídias. |
| [stripe-payments.test.js](../test/stripe-payments.test.js) | Contratos do cliente Stripe, assinatura, valores, ambientes, contas conectadas e diagnóstico. |
| [stripe-workflow.test.js](../test/stripe-workflow.test.js) | Fluxo financeiro HTTP, concorrência, inbox, reembolsos, contestações e recuperação, com Stripe simulada. |
| [stripe-connection-state.test.js](../test/stripe-connection-state.test.js) | Estados de conexão, pendências e atualização exibida ao vendedor. |
| [post-media-upload.test.js](../test/post-media-upload.test.js) | Ciclo de upload e limpeza sem apagar mídias confirmadas ou ainda em persistência. |
| [object-storage.test.js](../test/object-storage.test.js) | R2/S3, políticas suportadas, domínio público, remoção e envio real pelo SDK a servidor local de teste. |
| [delivery-reminders.test.js](../test/delivery-reminders.test.js) | Janelas de lembrete, persistência da deduplicação e exclusão de entregas inativas. |
| [community-discovery.test.js](../test/community-discovery.test.js) | Transporte, coordenadas aproximadas, alertas e pedidos atendidos. |

Os arquivos `*-flow.js` e `transport-flow.js` em [test/](../test/) são auxiliares
compartilhados pelas suítes. Os vídeos em `test/fixtures/` são entradas necessárias
para verificar mídia; não são resíduos de desenvolvimento.

### 8.1. Executar

```bash
npm ci
npm test
npm run build
```

Para PostgreSQL, utilize somente um banco isolado de testes e os comandos de
[operação](operacao.md). Sem as variáveis correspondentes, as integrações
PostgreSQL são ignoradas pelo executor; isso deve aparecer no resultado como
`skipped`, não como integração executada e aprovada.

Os testes de pagamentos não fazem uma cobrança real. Sucesso local não comprova
aprovação cadastral, repasse bancário, e-mail entregue ou chegada de webhook ao
domínio público. Essas verificações pertencem à validação do ambiente integrado.

### 8.2. Integração contínua

O [workflow](../.github/workflows/stripe-checks.yml) utiliza Node.js 22 e uma
instância PostgreSQL 16 de teste. As etapas são:

1. Checkout e instalação reproduzível com `npm ci`.
2. Auditoria de dependências de produção com `npm audit --omit=dev`.
3. Execução de `npm test`, com o fluxo Stripe PostgreSQL habilitado.
4. Execução explícita da integração principal PostgreSQL.
5. Compilação do frontend com Vite.

O workflow é disparado em pushes para as branches declaradas e em pull requests
que alterem os caminhos definidos no YAML. O resultado de uma execução deve ser
consultado no GitHub Actions; a existência do arquivo não certifica o último
deploy.

### 8.3. Roteiro de aceitação funcional

| Cenário | Resultado a verificar |
| --- | --- |
| Conta | Cadastrar, verificar e-mail, entrar, sair e redefinir senha conforme o ambiente. |
| Anúncio | Publicar com os três campos de transporte, anexar mídias válidas e rejeitar arquivos fora do limite. |
| Oferta | Enviar, cancelar e reenviar; aceitar e impedir alterações conflitantes após o avanço do fluxo. |
| Acordo | Propor local/horário com um usuário e aceitar com o outro. Confirmar privacidade dos detalhes. |
| Pagamento de teste | Abrir Checkout apenas para a oferta/acordo elegíveis e aguardar a confirmação pelo provedor. |
| Recebimento | Confirmar com o destinatário e verificar conclusão, anúncio e indicadores. |
| Comunicação | Receber mensagem, limpar conversa e verificar contadores sem afetar a outra pessoa. |
| Comunidade | Criar campanha/pedido/alerta e verificar contribuições confirmadas e avisos. |
| Administração | Confirmar bloqueio ao usuário comum e acesso às ações previstas para administrador. |
| Serviços distribuídos | Interromper o broker em ambiente isolado, observar eventos pendentes e acompanhar a recuperação após restabelecimento. |

Esse roteiro é uma orientação de validação, não um registro de execução de todos
os cenários no ambiente publicado.

## 9. Manutenção e limites conhecidos

As diferenças já observadas no código-base incluem:

- Aplicação do limitador de autenticação apenas no conjunto SQLite de rotas.
- Ausência de bloqueio universal por e-mail não verificado no middleware.
- Ausência de revogação individual de JWT e de encerramento global de sessões
  na redefinição da senha.
- Rotas antigas que continuam registradas no modo PostgreSQL, mas podem depender
  do banco SQLite não inicializado; ver [API](api.md).
- Avaliações com regras distintas entre os provedores; ver
  [funcionalidades e regras](funcionalidades-e-regras.md).
- Tratamento de erros não uniforme entre rotas legadas e módulos mais recentes.

A documentação descreve essas condições sem alterar as regras de execução.
Mudanças futuras devem atualizar os testes e os contratos correspondentes.
