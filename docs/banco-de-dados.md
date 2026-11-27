# Banco de dados e persistência

**Projeto:** ReUsa+ · **Autor:** Marcus Vinicius Campos da Silva  
**Referência do código:** `051a07c` · **Atualização:** 19 de novembro de 2026

[Documentação técnica](documentacao-tecnica.md) · [Arquitetura](arquitetura.md) ·
[API](api.md) · [Regras de negócio](funcionalidades-e-regras.md) ·
[Operação](operacao.md) · [Segurança e testes](seguranca-e-testes.md)

## 1. Estratégia de persistência

O ReUsa+ utiliza PostgreSQL em produção e oferece SQLite via SQL.js para
desenvolvimento e testes locais. A escolha é feita por
[`storage/database-config.js`](../storage/database-config.js): PostgreSQL só é
ativado com `DATABASE_PROVIDER=postgres` e uma conexão em `POSTGRES_URL` ou
`DATABASE_URL`. `POSTGRES_URL` tem precedência quando os dois estão definidos.

Com `NODE_ENV=production`, o backend exige essa configuração PostgreSQL. Nesse
modo, não mantém uma segunda cópia SQLite dos dados de execução. A seleção dos
serviços de notificações e impacto segue a mesma configuração de banco.

| Aspecto | PostgreSQL | SQLite local |
| --- | --- | --- |
| Acesso | `pg`, pool e consultas assíncronas | SQL.js, banco carregado em memória |
| Arquivo/servidor | Serviço PostgreSQL | `DATA_DIR/reusa.sqlite` no core |
| Evolução do esquema | Arquivos SQL e `schema_migrations` | Bootstrap e adição de colunas no backend |
| Concorrência | Transações e bloqueios de linhas | Transações locais e serialização em módulos compartilhados |
| Serviços auxiliares | Tabelas próprias no PostgreSQL | Arquivos `notifications.sqlite` e `impact.sqlite` nos diretórios dos serviços |
| Uso previsto | Implantação de produção e testes de integração | Desenvolvimento, avaliação local e testes |

Os dois modos implementam os mesmos fluxos principais, mas não possuem todas as
mesmas garantias de concorrência ou restrições do banco. O bootstrap SQLite não
habilita `PRAGMA foreign_keys=ON`; não se deve presumir a mesma imposição de
chaves estrangeiras existente no PostgreSQL.

## 2. Convenções do modelo

- **Identificadores:** predominantemente `TEXT`, gerados pela aplicação. Não são
  todos UUIDs: há identificadores com prefixo e identificadores vindos da Stripe.
- **Valores monetários:** inteiros em centavos (`amount_cents`,
  `proposal_amount_cents`, `refunded_amount_cents`). Pagamentos usam BRL.
- **Datas:** o esquema combina `TIMESTAMPTZ` e textos ISO. Campanhas, alertas,
  imprevistos e partes do histórico Stripe utilizam `TEXT`. Não há uniformidade
  de tipo temporal entre todas as tabelas.
- **JSON:** os campos com sufixo `_json` são `TEXT` contendo JSON serializado,
  não colunas nativas `JSONB`. Algumas consultas convertem esse texto para
  `jsonb`, como a busca por participantes de conversas.
- **Estado derivado:** contadores de curtidas, comentários e indicadores são
  armazenados ou calculados conforme o fluxo. Os indicadores do serviço de
  impacto são atualizados por eventos e têm consistência eventual.
- **Arquivos:** o banco guarda URLs e metadados. Os bytes das fotos e vídeos
  ficam no armazenamento local ou no R2, não nas tabelas de mídia.

## 3. Inventário completo de tabelas PostgreSQL

O esquema evolui por **22 migrações versionadas e contém 42 tabelas**, incluindo
a tabela de controle criada pelo runner e as seis tabelas dos serviços auxiliares.
O dicionário abaixo descreve os campos centrais; os arquivos de
[`migrations/`](../migrations/) são a referência para o DDL completo.

### 3.1. Contas e autenticação

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `users` | PK `id`; `name`, `email`, `password_hash`, `city`, endereço, tipo de conta, perfil e preferências | `email` único; `account_type` em `person/business`; `role` em `user/admin`; `suspended` booleano; contadores não negativos. |
| `auth_identities` | PK (`provider`, `provider_subject`); `user_id`, `email_at_linked`, `created_at` | FK para `users` com exclusão em cascata; único (`provider`, `user_id`). Vincula a identidade externa à conta local. |

`users` também concentra:

- `interests_json`, `achievements_json` e `notification_preferences_json`;
- `email_verified`, hash e validade do token de confirmação;
- hash e validade do token de redefinição de senha;
- `stripe_account_id` histórico, IDs separados de teste/produção, versão de API
  de cada vínculo, `stripe_status_json` e `stripe_checked_at`.

Os IDs Stripe de teste e produção têm índices únicos parciais para valores não
nulos. Esses IDs apontam para recursos externos: não são FKs para uma tabela
local de contas Stripe.

### 3.2. Anúncios, mídias e interações públicas

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `posts` | PK `id`; `author_id`, título, descrição, categoria, condição, objetivo, capa, localização, estado e datas | FK de autor para `users` com cascata; `reserved_by` e `completed_with` também referenciam `users`; limites de título/descrição e contadores não negativos. |
| `post_images` | PK `id`; `post_id`, `image_url`, `sort_order`, `created_at` | FK para `posts` com cascata; índice por anúncio e ordem. |
| `post_videos` | PK `id`; `post_id`, `video_url`, `mime_type`, `sort_order`, `created_at` | FK para `posts` com cascata; MIME restrito a `video/mp4` e `video/webm`. |
| `post_likes` | PK (`post_id`, `user_id`); `created_at` | FKs para anúncio e usuário com cascata; uma curtida por par. |
| `favorites` | PK (`user_id`, `post_id`); `created_at` | FKs com cascata; um favorito por par. |
| `post_views` | PK (`post_id`, `user_id`); `viewed_at` | FKs com cascata; registro de visualização por usuário e anúncio. |
| `comments` | PK `id`; `post_id`, `author_id`, `text`, `created_at` | FK de anúncio com cascata; FK de autor; texto limitado a 500 caracteres. |
| `post_questions` | PK `id`; `post_id`, `asker_id`, `question`, `answer`, datas | FKs de anúncio e autor da pergunta com cascata; a aplicação restringe a resposta ao anunciante. |
| `inspiration_products` | PK `id`; `creator_id`, título, material, preço em texto, cidade, imagem, descrição e data | FK para `users`; estrutura histórica da vitrine/inspirações. Sua existência não implica suporte uniforme de todas as rotas nos dois provedores de banco. |

`posts.transport_json` guarda medidas, peso, desmontagem, escadas, veículo e
cuidados com a retirada. `area_lat` e `area_lng` guardam coordenadas aproximadas.
As regras de obrigatoriedade e arredondamento são da aplicação, não uma coleção
de `CHECK`s para cada chave JSON. Os limites de quantidade e tamanho de mídias
também são aplicados pelo upload e pelas rotas.

### 3.3. Conversas e negociações

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `threads` | PK `id`; `post_id`, `participants_json`, `unread_count`, `last_message_at` | FK de anúncio com cascata. A lista JSON de participantes não cria FKs individuais para `users`. |
| `messages` | PK `id`; `thread_id`, `sender_id`, `text`, `sent_at`, `status` | FK de conversa com cascata; FK de remetente; texto limitado a 1.000 caracteres. |
| `message_clears` | PK (`user_id`, `thread_id`); `cleared_at` | FKs com cascata. Marca o limite de visibilidade da conversa para um usuário, sem representar exclusão física global das mensagens. |
| `negotiations` | PK `id`; anúncio, anunciante, interessado, conversa, estado e datas | FKs para `posts`, `users` e `threads`; único (`post_id`, `interested_id`). |

**Não existe tabela `negotiation_proposals` no esquema atual.** A migração
`005_negotiation_proposals.sql` adiciona à própria tabela `negotiations` os campos
`proposal_status`, `proposal_amount_cents`, `proposal_method` e
`proposal_created_at`. O reenvio atualiza essa proposta; não cria um histórico
relacional completo de versões de todas as ofertas.

### 3.4. Pagamentos e auditoria financeira

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `payments` | PK `id`; negociação, pagador, recebedor, valor, moeda, método, estado, chave de idempotência, referência e datas | FK de negociação com cascata e FKs de usuários; valor positivo; moeda BRL; único (`negotiation_id`, `idempotency_key`). |
| `payment_audit_events` | PK `id`; `payment_id`, estados anterior/novo, motivo, correlação e data | FK para `payments` com cascata; registra transições e seus motivos. |
| `stripe_webhook_events` | PK `id` do evento Stripe; conta, ambiente, tipo, payload, estado, tentativas e datas | Inbox durável deduplicada pela PK. Não possui FK para um pagamento: também recebe eventos de contas de vendedores. |
| `stripe_account_link_history` | PK `id`; usuário, conta anterior, versão, ambiente, conta substituta, motivo e data | `user_id` é referência lógica, sem FK declarada nessa migração. Preserva a troca de vínculo de teste autorizada pelo fluxo. |

Os campos adicionais de `payments` incluem:

- `checkout_url`, `provider_account_id`, `provider_payment_intent`,
  `provider_request_json` e `provider_livemode`;
- valor reembolsado, IDs/estados de reembolso e contestação;
- `reconciled_at`, `reconcile_after` e `reconcile_until` para conciliação.

`provider_request_json` preserva parâmetros da tentativa para recuperação
idempotente. A inbox Stripe persiste o subconjunto de dados necessário ao
processamento, não dados completos de cartão nem documentos do vendedor.
O banco mantém o método legado `boleto` no `CHECK` de `payments`, mas o fluxo
ativo de novas cobranças admite cartão e Pix conforme configuração. Preservar
o esquema histórico não reativa um método de pagamento.

### 3.5. Pontos de coleta, acordos e recebimento

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `collection_points` | PK `id`; nome, categorias JSON, horário, localização, estado, origem e coordenadas | Cadastro de pontos; latitude/longitude são campos numéricos, sem extensão PostGIS. |
| `collection_point_suggestions` | PK `id`; proponente, nome, categorias, endereço, coordenadas, estado e revisão | FKs de `user_id` e `reviewed_by` para `users`. |
| `collection_deliveries` | PK `id`; `negotiation_id`, modalidade, agenda, endereço, ponto, estado e datas | FK de negociação com cascata e `UNIQUE`; no máximo um registro de acordo por negociação; ponto referencia `collection_points`. |
| `delivery_reminders` | PK (`delivery_id`, `user_id`, `scheduled_for`, `kind`) | FKs de entrega e usuário com cascata; deduplicação por destinatário, agenda e janela de lembrete. |
| `delivery_incidents` | PK `id`; `delivery_id`, `reporter_id`, tipo, detalhe e data | FK de entrega com cascata e FK de usuário; índice de histórico por entrega/data. |

O acordo registra `proposed_by`, `accepted_by`, `accepted_at` e `received_at`.
Proponente e aceitante referenciam `users`. `payment_locked` e
`payment_attempt_key` coordenam o avanço para pagamento com o acordo aceito.

Os nomes legados `confirmation_token_hash`, `confirmation_token_expires_at` e
`qr_code_data_url` permanecem no esquema, mas não significam que o sistema atual
comprova recebimento pela posse de QR Code. O recebimento é confirmado pelo
destinatário autenticado; o campo de expiração participa da validade do acordo.

### 3.6. Comunidade e descoberta

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `campaigns` | PK `id`; organizador, título, descrição, beneficiário, material, meta, cidade, logística, prazo e estado | FK de organizador com cascata; meta positiva; estado `active/closed`. |
| `campaign_contributions` | PK `id`; campanha, doador, quantidade, mensagem, resposta e estado | FKs com cascata; quantidade positiva; estados `pledged/received/cancelled`. |
| `material_needs` | PK `id`; solicitante, título, descrição, cidade, prazo, estado e data | FK de usuário com cascata; estados de fluxo controlados pela aplicação. |
| `need_offers` | PK `id`; pedido, doador, anúncio, conversa, negociação e data | FKs para todas essas entidades com cascata; único (`need_id`, `post_id`). |
| `search_alerts` | PK `id`; usuário, palavra, cidade, categoria e data | FK para `users` com cascata; limite de alertas validado pela aplicação. |
| `search_alert_matches` | PK (`alert_id`, `post_id`) | FKs com cascata; impede repetir a notificação do mesmo anúncio para o mesmo alerta. |

A quantidade recebida de uma campanha é calculada a partir das contribuições
`received`; ofertas pendentes não são contabilizadas como entrega efetiva.
O atendimento dos pedidos é associado às negociações concluídas de `need_offers`.

### 3.7. Confiança, moderação e notificações locais

| Tabela | Chave e campos principais | Relações e restrições relevantes |
| --- | --- | --- |
| `reviews` | PK `id`; negociação, avaliador, avaliado, nota, comentário e data | FKs; nota de 1 a 5; único (`negotiation_id`, `reviewer_id`). |
| `reports` | PK `id`; denunciante, tipo/ID do alvo, motivo, detalhes, estado e revisão | FKs de denunciante/revisor; único (`reporter_id`, `target_type`, `target_id`). O alvo polimórfico não é FK. |
| `blocked_users` | PK (`blocker_id`, `blocked_id`); data | FKs de usuários com cascata; `CHECK` impede bloquear a si próprio. |
| `notifications` | PK `id`; usuário, tipo, título, texto, link, criação e leitura | FK de usuário com cascata. Armazena avisos locais do core e complementa os avisos do serviço distribuído. |

A limpeza de conversas atualiza a visibilidade e os avisos de mensagens do
usuário. Não representa apagamento de toda a conversa para os participantes.
Os detalhes de acesso e retenção são tratados em
[Segurança e testes](seguranca-e-testes.md).

### 3.8. Eventos, projeções e controle do esquema

| Tabela | Chave e campos principais | Responsabilidade |
| --- | --- | --- |
| `schema_migrations` | PK `version`; `applied_at` | Arquivos SQL já aplicados ao PostgreSQL. |
| `event_outbox` | PK `id`; tipo, payload JSON, correlação, criação, publicação, tentativas e lease | Publicação recuperável dos eventos do core. |
| `notification_service_processed_events` | PK `event_id`; `processed_at` | Deduplicação do consumidor de notificações. |
| `notification_service_notifications` | PK `id`; usuário, tipo, título, texto, link, criação/leitura e correlação | Projeção de notificações produzida por eventos. |
| `notification_service_migrations` | PK `name`; `applied_at` | Controle de ajustes próprios do serviço de notificações. |
| `impact_service_processed_events` | PK `event_id`; `processed_at` | Deduplicação do consumidor de impacto. |
| `impact_service_totals` | PK `id`, restrito a `1`; itens, doações e trocas | Linha agregadora dos totais de impacto. |
| `impact_service_beneficiaries` | PK `user_id` | Conjunto de beneficiários distintos para os indicadores. |

As tabelas dos serviços não declaram FKs para entidades do core: os IDs e
correlações são referências lógicas recebidas por eventos. O isolamento é de
responsabilidade e acesso no código; na configuração Compose atual todos usam
o mesmo servidor/banco PostgreSQL, não bancos físicos independentes por serviço.

No modo SQLite dos serviços, os nomes locais são `processed_events`,
`notifications`, `notification_migrations`, `totals` e `beneficiaries`, separados
pelos arquivos de cada serviço. Não devem ser confundidos com o esquema do core.

## 4. Relacionamentos principais

O diagrama representa um subconjunto das **FKs reais** do PostgreSQL. Relações
por JSON, IDs Stripe, `reports.target_id` e IDs das projeções não são desenhadas
como chaves estrangeiras.

```mermaid
erDiagram
    users ||--o{ posts : publica
    users ||--o{ auth_identities : vincula
    posts ||--o{ post_images : possui
    posts ||--o{ post_videos : possui
    posts ||--o{ threads : origina
    threads ||--o{ messages : recebe
    users ||--o{ messages : envia
    posts ||--o{ negotiations : recebe
    users ||--o{ negotiations : interessado
    negotiations ||--o{ payments : registra
    payments ||--o{ payment_audit_events : audita
    negotiations ||--o| collection_deliveries : combina
    collection_points o|--o{ collection_deliveries : encontro
    collection_deliveries ||--o{ delivery_reminders : lembra
    collection_deliveries ||--o{ delivery_incidents : registra
    negotiations ||--o{ reviews : permite
```

```mermaid
erDiagram
    users ||--o{ campaigns : organiza
    campaigns ||--o{ campaign_contributions : recebe
    users ||--o{ campaign_contributions : contribui
    users ||--o{ material_needs : solicita
    material_needs ||--o{ need_offers : recebe
    posts ||--o{ need_offers : oferece
    negotiations ||--o{ need_offers : acompanha
    users ||--o{ search_alerts : configura
    search_alerts ||--o{ search_alert_matches : encontra
    posts ||--o{ search_alert_matches : corresponde
```

`negotiations` tem duas FKs obrigatórias para usuários: anunciante (`owner_id`) e
interessado (`interested_id`). O primeiro diagrama mostra apenas a segunda para
manter a leitura. As demais FKs estão no dicionário e nas migrações.

## 5. Estados persistidos

| Entidade | Estados do fluxo atual | Onde são impostos |
| --- | --- | --- |
| Anúncio | `Disponível`, `Reservado`, `Doado`, `Trocado`, `Vendido`, `Encerrado` | `CHECK` e regras das rotas. |
| Negociação | `interested`, `reserved`, `completed`, `cancelled` | `CHECK` e aplicação. |
| Proposta na negociação | `none`, `pending`, `accepted`, `rejected`, `cancelled` | Aplicação; coluna sem enum SQL. |
| Pagamento | `processing`, `succeeded`, `failed`, `refunded` | `CHECK` e conciliação. Reembolso parcial/contestação usam campos adicionais. |
| Acordo de entrega | `scheduled`, `confirmed`, `in_transit`, `completed`, `cancelled` | `CHECK` e regras de consentimento/recebimento. |
| Campanha | `active`, `closed` | `CHECK`; prazo e meta também limitam novas ofertas. |
| Contribuição | `pledged`, `received`, `cancelled` | `CHECK` e aplicação. |
| Pedido de material | `open`, `closed`, `fulfilled` | Aplicação. |
| Inbox Stripe | `pending`, `processed` | Aplicação; falhas mantêm o evento pendente com nova tentativa. |

Não se deve inferir que a presença de um estado no banco autoriza qualquer
transição. As validações de participante, acordo, pagamento e disponibilidade
estão descritas nas [regras de negócio](funcionalidades-e-regras.md).

## 6. Índices, unicidade e concorrência

Os índices atendem principalmente à leitura do feed, navegação por autor,
histórico de conversas, pendências de negociações, notificações por usuário,
moderação, ordem das mídias e processamento das filas persistidas.

| Grupo | Exemplos de índices/garantias |
| --- | --- |
| Feed | `posts_feed_idx`, `posts_author_idx`, `posts_status_created_idx`, `posts_category_idx`. |
| Conversas | `messages_thread_idx`, `messages_sender_idx`, `threads_post_idx`, `message_clears_thread_idx`. |
| Negociação | Índices por anúncio/estado, interessado/estado, anunciante/estado e proposta. |
| Notificações e moderação | Índices por usuário/data, estado de denúncia e estado de sugestão. |
| Mídias e comunidade | Ordem das fotos/vídeos, contribuições por campanha, perguntas por anúncio. |
| Outbox | Índices parciais de eventos não publicados, disponibilidade e vencimento de lease. |
| Stripe | Índices por conta, PaymentIntent, referência, próxima conciliação e inbox pendente. |

Unicidades impedem duplicação de curtidas, favoritos, identidades, avaliações,
ofertas de um anúncio a um pedido, combinações de lembrete e correspondências de
alerta. Essas garantias não substituem autorização ou validação de conteúdo.

A reserva e o aceite de ofertas utilizam transações e `SELECT ... FOR UPDATE`
para coordenar anúncio e negociação. Alteração de transporte, oferta a pedido,
acordo e pagamentos também bloqueiam as linhas pertinentes no PostgreSQL.
Não há um índice único parcial que, sozinho, imponha toda a regra de uma única
reserva ativa: essa decisão passa pelas transações e validações das rotas.

A exclusão administrativa é transacional e possui verificações próprias;
usuários com pagamentos vinculados não são apagados por esse fluxo. Não se deve
executar `DELETE` manual supondo que toda dependência possui cascata: várias FKs
utilizam a ação padrão de restrição, e referências lógicas não têm cascata.

### 6.1. Outbox e consumidores

1. A operação do domínio e o evento são registrados na mesma transação.
2. O publicador seleciona até 100 eventos prontos com
   `FOR UPDATE SKIP LOCKED` e registra um lease de um minuto.
3. A confirmação do RabbitMQ permite preencher `published_at`.
4. Falhas liberam o lease e agendam nova tentativa com espera exponencial de
   até 256 segundos na fórmula atual (`2 ** min(attempts, 8)`, com teto externo de 300).
5. Os consumidores gravam `event_id` e a alteração de sua projeção na mesma
   transação; repetição do evento não repete o efeito.

O evento pode ser entregue mais de uma vez. Os registros de deduplicação, e não
uma promessa de entrega exatamente uma vez, protegem os efeitos locais.

### 6.2. Pagamentos e inbox Stripe

A tentativa de Checkout é persistida antes da chamada externa. Referência,
payload, chave e conta permitem retomar uma resposta perdida. O retorno do
navegador não muda sozinho o estado financeiro.

A inbox identifica eventos por sua PK Stripe e registra tentativas. O
processamento usa bloqueio de linha e `next_attempt_at`; pagamentos usam
`reconcile_until` como lease de dois minutos e `reconcile_after` para selecionar
novas consultas. Eventos e pagamentos pendentes são revistos pela rotina de
conciliação. As verificações com a API Stripe precedem a mudança financeira e
seus registros de auditoria.

Não há transação distribuída envolvendo PostgreSQL e Stripe. Falhas entre a
persistência local e a resposta externa são resolvidas por idempotência,
reconsulta e conciliação. Para tentativas de criação ainda incertas após 23 horas,
o código bloqueia a repetição automática e exige conciliação manual.

## 7. Migrações e evolução do esquema

[`scripts/run-postgres-migrations.js`](../scripts/run-postgres-migrations.js)
ordena os arquivos `.sql` pelo nome completo. Cada arquivo ainda não registrado
em `schema_migrations` é executado em uma transação própria; o registro da versão
é feito antes do `COMMIT`. Uma falha provoca `ROLLBACK` daquele arquivo.

Existem prefixos repetidos (`004` e `006`) e arquivos datados. A identificação da
migração é o **nome completo**, não apenas o número inicial. Não renomeie arquivos
já aplicados e não exclua migrações pelo nome parecer antigo.

| Ordem | Arquivo | Evolução |
| --- | --- | --- |
| 1 | `001_core_schema.sql` | Entidades centrais e primeiros índices. |
| 2 | `002_core_indexes.sql` | Índices adicionais de consulta. |
| 3 | `003_distributed_outbox.sql` | Lease e retentativas da outbox. |
| 4 | `004_service_owned_tables.sql` | Tabelas próprias dos consumidores. |
| 5 | `004_simulated_payments.sql` | Pagamentos e auditoria, preservados na integração atual. |
| 6 | `005_negotiation_proposals.sql` | Colunas de proposta em `negotiations`. |
| 7 | `006_collection_deliveries.sql` | Agenda e dados originais de retirada. |
| 8 | `006_email_verification.sql` | Confirmação de e-mail. |
| 9 | `007_user_message_clears.sql` | Limpeza de conversas por usuário. |
| 10 | `008_post_images.sql` | Múltiplas imagens. |
| 11 | `009_add_sold_post_status.sql` | Estado de anúncio vendido. |
| 12 | `010_mercado_pago_checkout.sql` | Coluna `payments.checkout_url`, ainda necessária à Stripe. |
| 13 | `012_community_campaigns.sql` | Campanhas e contribuições. |
| 14 | `013_delivery_agreement.sql` | Proponente, aceite, recebimento e bloqueio financeiro do acordo. |
| 15 | `014_negotiation_followup.sql` | Lembretes e imprevistos. |
| 16 | `015_community_tools.sql` | Transporte, região, alertas, perguntas e pedidos. |
| 17 | `016_password_reset.sql` | Recuperação de senha. |
| 18 | `017_post_videos.sql` | Vídeos de anúncios. |
| 19 | `20261109_stripe_connect_accounts.sql` | Identificador histórico de conta Stripe. |
| 20 | `20261109_stripe_production.sql` | Vínculos por ambiente, conciliação, reembolsos e inbox. |
| 21 | `20261109_stripe_v2_accounts.sql` | Versão da conta conectada por ambiente. |
| 22 | `20261110_stripe_account_link_history.sql` | Histórico de substituição de vínculo de teste. |

O início do backend aplica automaticamente as migrações PostgreSQL. Também há
execução manual com `npm run migrate:postgres:schema`, usando a conexão fornecida
pelo ambiente. Esse script isolado não carrega `.env` por conta própria: forneça
as variáveis ao processo.

Não há migrações reversas versionadas nem bloqueio global de migração por
advisory lock no runner. Em uma implantação com várias réplicas iniciando juntas,
coordene a aplicação do esquema para evitar corrida entre instâncias.

## 8. Migração de dados e verificação

[`scripts/migrate-sqlite-to-postgres.js`](../scripts/migrate-sqlite-to-postgres.js)
é uma ferramenta de migração inicial. Lê `DATA_DIR/reusa.sqlite`, aplica o esquema
PostgreSQL, percorre as tabelas SQLite e insere seus registros em uma transação,
com nomes de coluna do arquivo de origem e `ON CONFLICT DO NOTHING`.

Isso não implementa replicação, sincronização contínua nem mesclagem de duas
bases ativas. Registros conflitantes são ignorados; não são comparados ou
atualizados. Uma origem com colunas incompatíveis pode falhar, e referências
entre tabelas exigem uma base coerente. Teste a migração em uma cópia isolada
antes de adotá-la como procedimento para um banco já evoluído.

```bash
POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_destino \
  npm run migrate:postgres

POSTGRES_URL=postgres://usuario:senha@localhost:5432/reusa_destino \
  npm run verify:postgres
```

[`scripts/verify-postgres-migration.js`](../scripts/verify-postgres-migration.js)
confere a presença de 18 tabelas históricas, a existência de chaves primárias e
contagens de `users`, `posts`, `negotiations` e `event_outbox`. **Não verifica todas
as 42 tabelas, cada FK, equivalência campo a campo ou integridade dos arquivos
externos.** O resultado desse comando não comprova sozinho uma migração completa.

As rotas e testes PostgreSQL devem complementar essa avaliação. Credenciais e
dados usados nos exemplos são fictícios; o processo não deve ser apontado
acidentalmente a uma base de produção.

## 9. Limites e continuidade operacional

- Não há PostGIS nem busca espacial indexada: as coordenadas aproximadas são
  numéricas e a proximidade é calculada pela aplicação.
- O esquema contém estruturas históricas; uma tabela existente não comprova
  que todo recurso antigo está disponível em todas as configurações atuais.
- Não há retenção/purga automática geral documentada para auditorias, outbox,
  inboxes e todos os dados pessoais. Defina políticas operacionais adequadas ao
  contexto de uso.
- Um backup do PostgreSQL não inclui os arquivos do R2 ou os uploads locais,
  nem as filas/volumes do broker. A restauração precisa considerar esses
  componentes separadamente.
- O repositório não prova a habilitação real de contas Stripe ou a existência
  de backups executados na Railway. Os procedimentos de instalação, backup e
  recuperação estão em [Operação](operacao.md).

## 10. Fontes de implementação

- [DDL e migrações PostgreSQL](../migrations/).
- [Seleção do banco](../storage/database-config.js) e
  [repositório PostgreSQL](../storage/postgres-repository.js).
- [Rotas PostgreSQL](../storage/postgres-api.js) e [bootstrap local](../backend.js).
- [Persistência dos serviços auxiliares](../services/persistence.js).
- [Campanhas](../storage/campaign-api.js), [entrega](../storage/delivery-api.js),
  [comunidade](../storage/community-api.js) e [pagamentos](../storage/stripe-api.js).
- [Execução de migrações](../scripts/run-postgres-migrations.js),
  [importação SQLite](../scripts/migrate-sqlite-to-postgres.js) e
  [verificação](../scripts/verify-postgres-migration.js).
