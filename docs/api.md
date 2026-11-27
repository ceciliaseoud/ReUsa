# API e contratos HTTP

[← Documentação técnica](documentacao-tecnica.md)

**Projeto:** ReUsa+ · **Autor:** Marcus Vinicius Campos da Silva  
**Referência:** código da `main`, revisão `051a07c`, em 19/11/2026.

## 1. Escopo e endereços

Este documento descreve as rotas efetivamente registradas no código. A aplicação
principal reúne interface web e API Express; os serviços de notificações e impacto
têm interfaces HTTP internas próprias.

| Ambiente/componente | Endereço |
| --- | --- |
| Sistema publicado e API principal | `https://reusa.up.railway.app` |
| Aplicação principal local | `http://localhost:3000` |
| Interface em desenvolvimento | `http://localhost:5173`; proxy `/api` para a porta 3000 |
| Notificações no Compose | `http://notifications:3001` |
| Impacto no Compose | `http://impact:3002` |

As URLs de serviços internos são nomes de rede do Docker Compose; não são
endereços públicos da aplicação publicada. A configuração do Railway pode usar
outros endereços, definidos nas variáveis de ambiente.

O inventário contém **120 combinações literais de método e caminho no processo
principal**, incluindo `/`, `/metrics`, rotas de compatibilidade e rotas legadas.
Há mais **5 operações HTTP nos dois serviços internos**. Middleware de proteção
registrado no mesmo caminho não representa um endpoint adicional. Arquivos
estáticos e o fallback de navegação da interface são descritos separadamente.

## 2. Convenções do contrato

### Requisições e respostas

- Os exemplos de caminhos deste documento incluem `/api` quando aplicável.
- Corpos comuns usam `Content-Type: application/json`. O parser JSON aceita até
  **100 kb**. Também há parser de `application/x-www-form-urlencoded`.
- Uploads usam `multipart/form-data`; o cliente deve gerar o boundary, sem
  definir manualmente um cabeçalho incompleto.
- As respostas costumam envolver o recurso: `{ "post": ... }`,
  `{ "negotiations": [...] }`, `{ "payment": ... }` ou `{ "ok": true }`.
  Não existe um envelope único para todos os endpoints.
- IDs são strings opacas, frequentemente UUIDs com prefixos. `:id`, `:threadId`
  e `:contributionId` devem ser substituídos pelo identificador retornado pela API.
- Valores financeiros de contrato usam **centavos inteiros** em `amountCents`.
  Não envie um número decimal em reais nesse campo.
- Horários do acordo são enviados em ISO 8601, preferencialmente UTC com `Z`.
  Prazos de campanhas e pedidos usam `YYYY-MM-DD`.
- Existem respostas com campos em camelCase e outras com campos provenientes do
  banco em snake_case. Preserve os nomes mostrados por cada recurso.
- Não há versionamento público por `/v1`, OpenAPI gerado, GraphQL, WebSocket ou
  paginação universal. Busca e vários filtros da interface são aplicados no cliente.

### Autenticação e acesso

```http
Authorization: Bearer <token_jwt>
Content-Type: application/json
X-Correlation-Id: exemplo-documentacao-001
```

O token é obtido no cadastro/login, tem expiração de 7 dias e identifica o
usuário pelo `sub`. Rotas
autenticadas consultam a existência da conta e sua suspensão. O cadastro pode
retornar token antes da confirmação do e-mail; o login por senha exige e-mail
confirmado. Consulte as diferenças de implementação ao final deste documento.

Legenda usada no inventário:

| Acesso | Significado |
| --- | --- |
| Público | Não exige token. |
| Opcional | Público; token válido acrescenta informações do usuário. |
| Usuário | JWT obrigatório. |
| Participante | JWT e participação na conversa ou negociação. |
| Proprietário | JWT e propriedade do anúncio, pedido ou campanha. |
| Admin | JWT e papel administrativo. |
| Assinatura | Validação de assinatura Stripe; não usa o JWT do usuário. |
| Token interno | `SERVICE_AUTH_TOKEN`, quando configurado. |

Autorizações de negócio são verificadas no servidor. Não deduza permissão apenas
pela existência de um botão no frontend.

### Erros e correlação

A aplicação devolve `X-Correlation-Id` e aceita um valor informado pelo cliente,
limitado a 120 caracteres. Alguns erros também incluem `requestId`; falhas Stripe
podem acrescentar `stripeRequestId`.

```json
{
  "error": "Mensagem da falha",
  "requestId": "request-identificador"
}
```

| Status | Uso encontrado no código |
| --- | --- |
| `200` | Consulta ou alteração concluída; algumas repetições idempotentes. |
| `201` | Criação de recurso ou tentativa de pagamento. |
| `302` | Redirecionamentos OAuth, verificação de e-mail e navegação. |
| `400` | Corpo, formato, mídia, parâmetros ou transição inválidos. |
| `401` | Token ausente/inválido ou assinatura Stripe recusada. |
| `403` | Falta de permissão, conta suspensa ou verificação exigida no login. |
| `404` | Recurso não encontrado nas rotas que tratam esse caso. |
| `409` | Conflito de etapa, reserva, oferta atualizada ou operação já iniciada. |
| `429` | Limite de requisições excedido nas rotas com limitador. |
| `500` | Falha interna ou erro encaminhado ao tratamento global. |
| `502` / `503` | Falha/configuração indisponível de integração em rotas específicas. |

Mensagens podem estar em português ou inglês. O tratamento global não normaliza
todos os erros de domínio: alguns handlers PostgreSQL encaminham exceções para
ele e podem devolver `500` em situações nas quais outros módulos devolvem
`400`, `403`, `404` ou `409`. O consumidor deve tratar falhas pelo status e pela
operação, sem depender de um catálogo universal de textos. A verificação de e-mail
pode retornar texto e redirecionamento; webhooks podem responder somente o status.

## 3. Cadastro, autenticação e perfil

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Público | Cria conta; retorna `token`, `user`, `verificationRequired`. |
| POST | `/api/auth/login` | Público | `{email,password}` → `{token,user}`. |
| GET | `/api/auth/me` | Usuário | Retorna `{user}`. |
| POST | `/api/auth/forgot-password` | Público | `{email}`; resposta genérica para conta inexistente. |
| POST | `/api/auth/reset-password` | Público | `{token,password}`; token de recuperação válido → `{ok:true}`. |
| GET | `/api/auth/verify-email` | Público | Query `token`; confirma e redireciona para `/login#email_verified=1`. |
| POST | `/api/auth/resend-verification` | Usuário | Reenvia confirmação ou retorna `emailVerified:true`. |
| GET | `/api/auth/google` | Público | Query opcional `return_to`; inicia redirecionamento para Google OAuth. |
| GET | `/api/auth/google/callback` | Público | Processa `code`, `state` ou erro do Google e retorna ao frontend. |
| GET | `/api/profile` | Usuário | Retorna usuário, estatísticas, conquistas, reputação e anúncios próprios. |
| PUT | `/api/profile` | Usuário | Atualiza dados pessoais/empresariais e interesses. |
| DELETE | `/api/profile` | Usuário | `{confirmation:"EXCLUIR",password}`; bloqueado quando há registros financeiros. |
| POST | `/api/profile/avatar` | Usuário | Multipart com campo `avatar`; retorna `{user}`. |
| PUT | `/api/profile/preferences` | Usuário | `{preferences:[...]}` para categorias de notificações. |
| PUT | `/api/profile/password` | Usuário | `{currentPassword,newPassword}` → `{ok:true}`. |
| GET | `/api/profile/payment-items` | Usuário | Itens de negociações reservadas/concluídas para pagamento e recebimento. |

### Cadastro e retorno

```json
{
  "name": "Pessoa de Exemplo",
  "email": "pessoa@example.org",
  "password": "SenhaDeExemplo123!",
  "city": "Santarém, PA",
  "neighborhood": "Centro",
  "accountType": "person",
  "interests": ["Móveis", "Eletrônicos"]
}
```

Nome, e-mail, senha e cidade são os campos essenciais. A senha de cadastro tem
mínimo de 8 caracteres. Dados adicionais: `cep`, `address`, `businessName`, `cnpj`.
Os tipos da aplicação são `person` e `business`; o fluxo empresarial usa razão
social e CNPJ. As validações exatas do cadastro não são idênticas entre SQLite e
PostgreSQL; isso não autoriza ignorar as validações do formulário.

```json
{
  "token": "<JWT retornado pelo servidor>",
  "user": {"id":"user-...","name":"Pessoa de Exemplo","emailVerified":false},
  "verificationRequired": true
}
```

O exemplo mostra apenas parte do objeto `user`. Se o envio SMTP falhar depois de
persistir o cadastro, a resposta pode ser `503` **com a conta já criada**. Tente
recuperar/reencaminhar a confirmação em vez de assumir que nada foi gravado.
O token de recuperação de senha expira em 1 hora; uma recuperação concluída
limpa o token e marca o e-mail como verificado.

No Google OAuth, `state` é assinado com validade de 10 minutos e o retorno passa
pelo callback do backend. Falta de configuração ou recusa do Google também
redirecionam para a interface com um indicador de erro; não são respostas JSON
equivalentes ao login por senha.

O perfil aceita `name`, `city`, `neighborhood`, `cep`, `address`, `accountType`,
`businessName`, `cnpj` e `interests`. A lista de interesses é limitada a 20 na
implementação PostgreSQL. A troca de senha exige de 8 a 200 caracteres.
Preferências reconhecidas: `Curtidas`, `Comentários`, `Interesse`, `Mensagens`,
`Negociações`, `Avaliações` e `Sistema`.

O avatar aceita JPEG, PNG, GIF, WebP ou AVIF de até 5 MB no campo `avatar`.
Essa rota não usa os campos de mídia de anúncios.

## 4. Anúncios, mídias e interações públicas

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/feed` | Opcional | Retorna `{posts:[...]}`. No PostgreSQL exclui anúncios `Encerrado`. |
| GET | `/api/posts/:id` | Opcional | Retorna `{post}`; pode registrar visualização do usuário autenticado. |
| POST | `/api/posts` | Usuário | Cria anúncio com mídia e informações obrigatórias de retirada. |
| PUT | `/api/posts/:id` | Proprietário | Edita anúncio e ordenação de mídias, observando bloqueios de etapa. |
| DELETE | `/api/posts/:id` | Proprietário | Exclui anúncio quando permitido; histórico financeiro impede exclusão. |
| GET | `/api/favorites` | Usuário | Retorna `{posts:[...]}` dos itens salvos. |
| POST | `/api/posts/:id/favorite` | Usuário | Alterna favorito; retorna `{saved:boolean}`. |
| POST | `/api/posts/:id/like` | Usuário | Alterna curtida; retorna `{liked:boolean,likes:number}`. |
| GET | `/api/posts/:id/comments` | Público | Retorna comentários do anúncio. |
| POST | `/api/posts/:id/comments` | Usuário | `{text}`; publica comentário. |
| GET | `/api/posts/:id/questions` | Público | `{questions:[...]}`, até 100, com nome do interessado e resposta. |
| POST | `/api/posts/:id/questions` | Usuário | `{question}` com 10–500 caracteres; interessado diferente do autor. |
| POST | `/api/questions/:id/answer` | Proprietário | `{answer}` com 5–1000 caracteres; resposta do autor do anúncio. |
| PUT | `/api/posts/:id/transport` | Proprietário | Atualiza dados de transporte de anúncio disponível. |

### Publicação e transporte

Os campos textuais essenciais são `title`, `description`, `category` e as três
respostas de transporte. O contrato admite `goal` com `Doação`, `Troca` ou `Venda`,
`condition`, `location`, `chipLabel` e `chipIcon`. O backend usa alguns valores
padrão quando omitidos. Não informe endereço residencial exato em `location`;
essa informação pública deve representar cidade ou bairro.

| Campo | Valores/limites |
| --- | --- |
| `title` | Texto não vazio, até 140 caracteres. |
| `description` | Texto não vazio, até 3000 caracteres. |
| `category` | Texto não vazio, até 60 caracteres. |
| `disassembly` | Obrigatório: `yes` ou `no`. |
| `stairs` | Obrigatório: `yes` ou `no`. |
| `vehicle` | Obrigatório: `walking`, `car`, `van` ou `truck`. |
| `dimensions` | Opcional; até 120 caracteres. |
| `weightKg` | Opcional; número maior que 0 e até 100000. |
| `transportNotes` | Opcional; até 500 caracteres. |
| `areaLat`, `areaLng` | Opcionais em conjunto; coordenadas válidas, arredondadas a duas casas. |

São aceitas até **8 imagens de 5 MB** e **2 vídeos de 50 MB**. Imagens: JPEG,
PNG, GIF, WebP e AVIF. Vídeos: MP4 ou WebM, incluindo validação do cabeçalho do
arquivo. É necessário ao menos uma foto ou um vídeo. Fotos e vídeos usam campos
distintos: `images` e `videos`.

Exemplo de publicação multipart, com arquivos locais de exemplo:

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F 'title=Cadeira de madeira' \
  -F 'description=Cadeira conservada, com estrutura firme e pequenas marcas de uso.' \
  -F 'category=Móveis' \
  -F 'condition=Bom estado' \
  -F 'goal=Venda' \
  -F 'location=Santarém, PA' \
  -F 'disassembly=no' \
  -F 'stairs=no' \
  -F 'vehicle=car' \
  -F 'images=@./cadeira.jpg' \
  -F 'videos=@./cadeira.mp4'
```

Retorno: `201` com `{post}`. O objeto público inclui `id`, `author`, `title`,
`description`, `category`, `condition`, `goal`, `imageUrl`, `imageUrls`, `videos`,
`location`, `status`, contadores e `transport`. As coordenadas aproximadas não são
expostas diretamente; `hasApproximateLocation` informa sua disponibilidade.
Cada entrada de `videos` contém `url` e `mimeType`.

A criação também mantém compatibilidade com JSON contendo `imageUrl` HTTP(S) ou
`/uploads/...`. O caminho recomendado da interface é o upload. Vídeos remotos
por `videoUrl`, `videoUrls` ou `videos` no corpo JSON são rejeitados.

Na edição, `imageOrder` e `videoOrder` são arrays JSON, enviados como strings em
multipart. Cada item é `existing:<URL já pertencente ao anúncio>` ou `new:<índice
do arquivo enviado naquele campo>`. O primeiro item de imagem define a capa;
anúncios só com vídeo usam o placeholder da aplicação.

```json
{
  "imageOrder": ["existing:https://exemplo.org/uploads/foto.jpg", "new:0"],
  "videoOrder": []
}
```

Omissão da ordem preserva mídias existentes e acrescenta as novas. Lista vazia
remove as mídias daquele tipo, desde que ainda reste alguma mídia no anúncio.
URLs de outro anúncio, referências repetidas ou índices inválidos não são aceitos.

A edição de transporte usa os mesmos campos, sem upload. Atualizações parciais
preservam dados omitidos; informar `areaLat:""` e `areaLng:""` remove a região.
No anúncio legado sem respostas obrigatórias, forneça as três ao editar transporte.

## 5. Negociações, ofertas e entrega

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/negotiations` | Usuário | `{negotiations:[...]}` privadas do usuário, com etapa e próxima ação. |
| GET | `/api/posts/:id/interested` | Proprietário | Interessados, ofertas e permissões de ação do anúncio. |
| GET | `/api/posts/:id/negotiation` | Usuário | `{negotiation:objetoOuNull}` do usuário naquele anúncio; sem negociação própria, retorna `null`. |
| POST | `/api/negotiations/:id/proposal` | Interessado | `{amountCents,method}`; envia ou reenvia oferta permitida. |
| PATCH | `/api/negotiations/:id/proposal` | Proprietário | `{decision,expectedProposalCreatedAt}`; aceita ou recusa. |
| POST | `/api/posts/:id/reserve` | Proprietário | `{interestedId,expectedProposalCreatedAt?}`; reserva para interessado existente. |
| POST | `/api/negotiations/:id/cancel-offer` | Interessado | `{expectedProposalCreatedAt}`; cancela oferta pendente ainda sem avanço. |
| POST | `/api/negotiations/:id/cancel-acceptance` | Proprietário | Cancela aceite antes de qualquer registro de entrega ou pagamento. |
| POST | `/api/negotiations/:id/withdraw-purchase` | Interessado | Desiste da compra; devolve `cancelled` e `refundRequested`. |
| GET | `/api/negotiations/:id/collection` | Participante | `{collection:objetoOuNull}` do acordo e permissões. |
| POST | `/api/negotiations/:id/collection` | Participante | `{mode,scheduledFor,address?,collectionPointId?}`; propõe encontro. |
| POST | `/api/collection-deliveries/:id/accept` | Outro participante | Aceita proposta válida feita pela outra pessoa. |
| PATCH | `/api/collection-deliveries/:id/status` | Participante | `{status}`: `cancelled`, `in_transit` ou `completed`, conforme permissão. |
| POST | `/api/collection-deliveries/:id/confirm` | Destinatário | Confirma recebimento; conclui entrega e negociação. |
| POST | `/api/collection-deliveries/:id/incidents` | Participante | `{kind,detail}`; registra imprevisto da entrega ativa. |
| POST | `/api/negotiations/:id/problem` | Participante | `{reason,detail}`; encaminha problema da negociação à moderação. |
| POST | `/api/posts/:id/complete` | Usuário | Compatibilidade bloqueada: responde `409`; não permite conclusão unilateral. |

O interessado inicia a conversa pelo endpoint de mensagens com `postId`, criando
ou reutilizando a negociação. Ofertas monetárias são exclusivas de `Venda`.
`amountCents` deve ser inteiro entre 100 e 100000000; `method` é `card` ou `pix`,
com Pix condicionado à configuração. Há compatibilidade com `amount` em texto
monetário brasileiro, mas recomenda-se usar `amountCents`.

Estados expostos pelos recursos:

| Recurso | Estados principais |
| --- | --- |
| Anúncio | `Disponível`, `Reservado`, `Doado`, `Trocado`, `Vendido`, `Encerrado`. |
| Negociação | `interested`, `reserved`, `completed`, `cancelled`. |
| Proposta monetária | `none`, `pending`, `accepted`, `rejected`, `cancelled`. |
| Entrega | `scheduled`, `confirmed`, `in_transit`, `completed`, `cancelled`. |
| Pagamento | `processing`, `succeeded`, `failed`, `refunded`. |

Os estados de pagamento, reembolso e contestação são campos diferentes; uma
contestação não deve ser inferida apenas pelo `status` principal do pagamento.

`decision` aceita `accepted` ou `rejected`. Em vendas, copie
`expectedProposalCreatedAt` de `proposalCreatedAt` recebido na consulta. O
servidor compara essa versão antes de aceitar, reservar ou cancelar a oferta,
evitando agir sobre uma proposta que mudou. Aceitar uma oferta de venda também
reserva o anúncio; uma reserva de venda exige essa mesma versão da proposta.

```json
{
  "decision": "accepted",
  "expectedProposalCreatedAt": "2026-11-19T15:00:00.000Z"
}
```

Datas e IDs nos exemplos são ilustrativos e precisam ser substituídos pelos
valores atuais retornados pela API.

### Propor entrega

```json
{
  "mode": "pickup",
  "scheduledFor": "2026-11-20T18:00:00.000Z",
  "address": "Local de encontro combinado entre os participantes, com referência."
}
```

- `pickup`: retirada em endereço combinado, texto de 10–240 caracteres.
- `dropoff`: encontro em ponto de coleta; use `collectionPointId` válido e aberto.
- `scheduledFor`: entre 30 minutos e 90 dias no futuro no momento da requisição.
- O destinatário e o autor da proposta devem ser pessoas diferentes para o aceite.
- Para propor outro local/horário, cancele o acordo anterior quando permitido.
- O campo `:id` em `/collection-deliveries/:id/*` é o **ID da entrega**, não o ID
  da negociação. Use `collection.id` retornado na consulta/criação.

O objeto `collection` inclui `mode`, `scheduledFor`, `address`, `status`,
`proposedBy`, `acceptedBy`, `acceptedAt`, `receivedAt`, `expired`, `paymentLocked`,
`paymentReady`, `canAccept`, `canCancel`, `canDispatch`, `canReceive`, `incidents`
e `paymentStatus`. Use essas permissões para a interface e trate uma recusa no
servidor caso a etapa tenha mudado desde a leitura.

Na implementação atual, `expired` usa o prazo interno
`confirmation_token_expires_at`, gravado como horário do encontro mais 24 horas.
Não o interprete apenas como comparação direta com `scheduledFor`. A confirmação
de recebimento pelo destinatário pode registrar uma entrega realizada com atraso.

O imprevisto aceita `kind`: `delay`, `cannot_attend`, `location` ou `other`, e
`detail` de 10–500 caracteres. A mesma pessoa, tipo e mensagem em cinco minutos
não geram outro registro. A resposta de criação é `201 {ok:true}`.

Problemas de negociação usam `reason` com `Não compareceu`,
`Item diferente do anúncio`, `Não recebi o item` ou `Outro problema`; `detail`
tem 20–1500 caracteres. Só se aplicam a negociação reservada ou concluída e não
estornam dinheiro automaticamente.

O painel retorna etapas `decision`, `agreement`, `payment`, `delivery`, `receipt`,
`completed` ou `closed`, além de `needsYourAction`, `canCancelOffer`, valores,
contraparte, conversa e imprevisto mais recente. Não há filtros/paginação de
query nessa rota; a interface filtra a lista recebida.

## 6. Pagamentos e contas Stripe

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/payments/stripe/status` | Usuário | Situação da conta Stripe vinculada ao usuário e ao ambiente atual. |
| GET | `/api/payments/stripe/connect` | Usuário | Cria/retoma cadastro; `{authorizationUrl}`. |
| POST | `/api/payments/stripe/reconnect-test` | Usuário | `{expectedAccountId}`; substitui vínculo de teste inacessível, quando elegível. |
| GET | `/api/payments/stripe/refresh` | Estado assinado | Query `state`; renova redirecionamento do onboarding. |
| POST | `/api/payments/stripe/dashboard` | Usuário | `{url}` do painel da conta do vendedor. |
| GET | `/api/negotiations/:id/payment` | Participante | Consulta pagamento mais recente e tenta conciliação quando aplicável. |
| POST | `/api/negotiations/:id/payment` | Comprador | Cria ou recupera a tentativa com chave idempotente. |
| POST | `/api/negotiations/:id/refund` | Vendedor | Solicita reembolso integral elegível; retorna `{payment}`. |
| POST | `/api/negotiations/:id/switch-to-card` | Comprador | Reenvia antiga oferta Pix por cartão quando Pix está desabilitado. |
| POST | `/api/payments/stripe/webhook` | Assinatura | Eventos financeiros snapshot da plataforma e de contas conectadas. |
| POST | `/api/payments/stripe/accounts-webhook` | Assinatura | Eventos thin de contas Accounts v2. |
| GET | `/api/admin/payments/stripe` | Admin | Modo/configuração, pendências de conciliação e último evento processado. |

### Criar uma tentativa de pagamento

```json
{
  "amountCents": 3000,
  "currency": "BRL",
  "method": "card",
  "idempotencyKey": "checkout-exemplo-001"
}
```

Pré-condições: oferta aceita com os mesmos valor e método, anúncio reservado
para o comprador, acordo aceito pela outra pessoa e ainda válido, vendedor e
provedor elegíveis. O corpo é enviado ao endpoint da negociação, não diretamente
à Stripe pelo frontend.

`idempotencyKey` é um campo do corpo, de 16–128 caracteres no conjunto
`A-Z a-z 0-9 . _ : -`. Reutilize a chave ao recuperar **a mesma tentativa**.
Mesma chave com outros dados gera conflito. O backend também impede outra
cobrança enquanto há pagamento em processamento ou aprovado.

A primeira tentativa retorna `201`; uma repetição reconhecida retorna `200`:

```json
{
  "payment": {
    "id": "payment-...",
    "negotiationId": "negotiation-...",
    "amountCents": 3000,
    "currency": "BRL",
    "method": "card",
    "status": "processing",
    "checkoutUrl": "<URL hospedada retornada pela Stripe>",
    "provider": "stripe",
    "testMode": true
  },
  "idempotentReplay": false
}
```

O retorno é parcial e ilustrativo. `payment` também pode informar
`refundedAmountCents`, `refundStatus`, `disputeStatus`, datas e `failureCode`.
Uma sessão pode permanecer sem URL/sem confirmação enquanto a resposta externa
é conciliada. O retorno do navegador **não confirma** o pagamento.

Os webhooks exigem `Stripe-Signature` sobre o corpo original e verificam o
ambiente. Não envie JWT ou simule confirmação chamando essas rotas manualmente.
Eventos não utilizados são reconhecidos sem aplicar alterações. IDs de eventos
já persistidos não duplicam a transição financeira.

Consulte os contratos e eventos completos nos guias de
[teste](stripe-testing.md) e [produção](stripe-production.md). Eles descrevem
os três destinos, segredos separados, Pix, reembolsos, contestações e diferenças
entre demonstração, contas conectadas de teste e produção.

## 7. Mensagens e notificações

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| POST | `/api/messages/threads` | Usuário | `{postId}`; cria/reutiliza conversa e interesse no anúncio. |
| GET | `/api/messages/threads` | Usuário | `{threads:[...]}` com contraparte, resumo e `unreadCount`. |
| GET | `/api/messages/threads/:id` | Participante | `{thread,participants,messages}`. |
| POST | `/api/messages/threads/:id/messages` | Participante | `{text}` com 1–1000 caracteres; `201 {message}`. |
| DELETE | `/api/messages/threads/:id/messages` | Participante | Limpa histórico visível para o usuário; `{ok:true,clearedAt}`. |
| DELETE | `/api/messages/threads` | Usuário | Limpa todas as conversas do usuário; `{ok:true,clearedAt}`. |
| GET | `/api/notifications` | Usuário | `{notifications:[...],unreadCount}`. |
| POST | `/api/notifications/:id/read` | Usuário | Marca aviso próprio como lido; `{ok:true}`. |
| POST | `/api/notifications/read-thread/:threadId` | Participante | Marca avisos de mensagens daquela conversa como lidos. |

A limpeza usa um marco temporal por usuário/conversa e sincroniza seus avisos de
mensagens. Ela não exclui o histórico da outra pessoa. Mensagens posteriores ao
marco voltam a aparecer. Consultar uma conversa e marcar notificações são operações
distintas; o frontend usa as rotas apropriadas para atualizar os contadores.

No PostgreSQL, a listagem de notificações combina avisos locais e do serviço
distribuído, com limite dos **100 mais recentes**; `unreadCount` nessa resposta
conta os não lidos da lista retornada. Não é um contador ilimitado de todo o banco.

## 8. Campanhas, pedidos e descoberta de itens

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/campaigns` | Público | `{campaigns:[...]}`, até 100 campanhas recentes. |
| POST | `/api/campaigns` | Usuário | Cria campanha; `201 {id}`. |
| GET | `/api/campaigns/:id/contributions` | Usuário | Organizador vê todas; outra pessoa vê suas próprias contribuições. |
| POST | `/api/campaigns/:id/contributions` | Usuário | `{quantity,note}`; `201 {id}`. |
| PATCH | `/api/campaigns/:id/contributions/:contributionId` | Organizador/doador | `{status}`: `received` pelo organizador ou `cancelled` por ambos. |
| PATCH | `/api/campaigns/:id/contributions/:contributionId/reply` | Organizador | `{reply}` de 10–500 caracteres. |
| PATCH | `/api/campaigns/:id/close` | Organizador | Encerra novas ofertas; `{ok:true}`. |
| GET | `/api/needs` | Público | `{needs:[...]}` abertos e dentro do prazo. |
| POST | `/api/needs` | Usuário | `{title,description,city,deadline}`; `201 {id}`. |
| PATCH | `/api/needs/:id/close` | Proprietário | Encerra pedido; `{ok:true}`. |
| GET | `/api/needs/:id/offers` | Usuário | Autor vê todas; doador vê suas próprias ofertas. |
| POST | `/api/needs/:id/offers` | Usuário | `{postId}` próprio de doação disponível; `201 {threadId}`. |
| GET | `/api/search-alerts` | Usuário | `{alerts:[...]}` próprios. |
| POST | `/api/search-alerts` | Usuário | `{keyword,city?,category?}`; `201 {id}`. |
| DELETE | `/api/search-alerts/:id` | Usuário | Remove alerta próprio; `{ok:true}`. |
| GET | `/api/discovery/nearby` | Usuário | Query `lat,lng,radius`; `{items:[{id,distanceKm}],approximate:true}`. |

### Corpos e limites

Campanha:

```json
{
  "title": "Arrecadação de cadeiras",
  "description": "Campanha comunitária para reunir cadeiras em condições de uso.",
  "beneficiary": "Projeto comunitário de exemplo",
  "material": "Cadeiras",
  "target": 10,
  "city": "Santarém, PA",
  "logistics": "Combinar a entrega pelo contato privado da contribuição.",
  "deadline": "2026-12-01"
}
```

Campanhas exigem título 5–100, descrição 20–2000, beneficiário 3–120, material
2–80, cidade 3–100 e logística 10–500 caracteres. `target` e `quantity` são
**números inteiros JSON** de 1–100000; prazo válido a partir da data atual.
Na contribuição, `note` tem 10–500 caracteres. Só recebimentos confirmados entram
em `received`; ofertas pendentes entram em `pledged`. Repetir o mesmo status não
soma novamente. Ninguém contribui na própria campanha.

Pedidos exigem título 5–100, descrição 20–1500 e cidade 3–100 caracteres, sem
endereço exato. `deadline` é uma data válida atual ou futura. Oferecer anúncio
cria/reutiliza conversa e negociação; não confirma recebimento automaticamente.

Alertas exigem `keyword` de 3–80, `city` até 100 e `category` até 60 caracteres.
Há limite de 20 por usuário. O servidor verifica novos anúncios; não há endpoint
público para disparar a rotina nem promessa de envio por e-mail/SMS.

Na proximidade, `lat` está entre −90 e 90, `lng` entre −180 e 180 e `radius`
entre **1 e 100 km**, com padrão 10. A interface oferece opções a partir de 2 km.
O resultado contém IDs e distâncias aproximadas; use os dados do feed/detalhe para
montar os cards. A posição da consulta não é armazenada como endereço de entrega.

## 9. Avaliações, denúncias e bloqueios

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/users/:id/reviews` | Público | `{reviews:[...]}` no PostgreSQL; a versão SQLite também retorna o agregado `reputation`. |
| POST | `/api/negotiations/:id/reviews` | Participante | `{rating,comment}`; nota inteira de 1–5 e uma avaliação por pessoa/negociação. |
| POST | `/api/reports` | Usuário | `{targetType,targetId,reason,details}`; denúncia de anúncio ou usuário. |
| POST | `/api/users/:id/block` | Usuário | Registra bloqueio do usuário; retorna `{blocked:true}`. |

Relatos sobre entrega/pagamento usam o endpoint específico
`POST /api/negotiations/:id/problem`, que registra contexto da negociação.

Há uma diferença conhecida na rota de avaliação: SQLite exige negociação
concluída; PostgreSQL não faz a mesma checagem nessa implementação e rejeita o
anunciante por uma condição redundante. Não trate a presença da rota como
garantia de avaliação bilateral idêntica nos dois modos. O comportamento está
registrado também em [funcionalidades e regras](funcionalidades-e-regras.md).

## 10. Mapas, pontos de coleta e consultas externas

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/collection-points` | Público | `{collectionPoints:[...]}` cadastrados. |
| POST | `/api/collection-points/suggestions` | Usuário | Sugere ponto para análise administrativa. |
| GET | `/api/collection-points/nearby` | Público | Query `city`; combina pontos cadastrados e dados públicos quando disponíveis. |
| GET | `/api/map-route` | Público | Query `fromLat,fromLng,toLat,toLng`; rota calculada pelo OSRM. |
| GET | `/api/businesses/cnpj/:cnpj` | Público | Consulta CNPJ válido pela BrasilAPI; `{business,cached?}`. |
| GET | `/api/impact/community` | Público | `{impact}` do serviço separado ou cálculo disponível no núcleo. |

Sugestão de ponto utiliza `name`, `categories`, `hours`, `location` e, quando
informados, dados de endereço/coordenadas. Criação e edição administrativas usam
a mesma construção de endereço em `storage/collection-point-geocoding.js`.
São aceitos os campos estruturados `postalCode`, `street`, `number`,
`neighborhood`, `city`, `state`, `latitude` e `longitude`; confirme o corpo
com o formulário em `src/routes.jsx` ao integrar um cliente próprio.

As coordenadas das rotas são numéricas e obrigatórias. O endpoint devolve
`{route,cached}` com distância/duração/geometria sanitizada; uma rota inexistente
pode gerar `404`, resposta inválida do provedor `502` e indisponibilidade `503`.
A cache de rotas tem cinco minutos no processo principal. Consulta de pontos
próximos pode devolver apenas pontos cadastrados se os provedores externos
estiverem indisponíveis.

ViaCEP, tiles OpenStreetMap e algumas consultas Nominatim são chamadas diretamente
pelo frontend; não existem endpoints próprios de proxy ViaCEP. Veja a divisão
das integrações em [arquitetura](arquitetura.md).

## 11. Administração

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | Admin | Totais de usuários, anúncios, atividades e denúncias. |
| GET | `/api/admin/users` | Admin | Query `q` opcional para nome/e-mail; até 100 no PostgreSQL. |
| PATCH | `/api/admin/users/:id/suspension` | Admin | `{suspended:boolean}`; não suspende a própria conta. |
| DELETE | `/api/admin/users/:id` | Admin | Exclui usuário elegível; bloqueia autoexclusão e histórico financeiro. |
| GET | `/api/admin/posts` | Admin | `{posts:[...]}`, até 200 no PostgreSQL. |
| DELETE | `/api/admin/posts/:id` | Admin | Exclui anúncio elegível, com proteções de histórico financeiro. |
| GET | `/api/admin/reports` | Admin | `{reports:[...]}`, até 200 no PostgreSQL. |
| PATCH | `/api/admin/reports/:id` | Admin | `{status}`: `pending`, `reviewed`, `resolved` ou `dismissed`. |
| GET | `/api/admin/collection-points` | Admin | `{points,suggestions}`. |
| POST | `/api/admin/collection-points` | Admin | Cria ponto de coleta. |
| PUT | `/api/admin/collection-points/:id` | Admin | Atualiza ponto; esta variante está registrada no PostgreSQL. |
| PATCH | `/api/admin/collection-points/:id` | Admin | Atualiza ponto. |
| DELETE | `/api/admin/collection-points/:id` | Admin | Remove ponto conforme integridade e uso. |
| PATCH | `/api/admin/collection-point-suggestions/:id` | Admin | `{decision}`: `approved` ou `rejected`. |

A observabilidade financeira adicional está em `GET /api/admin/payments/stripe`,
descrita na seção de pagamentos. Ela informa configuração e filas de conciliação,
sem devolver chaves secretas.

## 12. Saúde, arquivos e navegação

| Método | Caminho | Acesso | Contrato principal |
| --- | --- | --- | --- |
| GET | `/api/health` | Público | `{ok:true}`; disponibilidade HTTP, sem comprovar todas as integrações. |
| GET | `/api/health/live` | Público | `{ok:true,status:"live"}`. |
| GET | `/api/health/ready` | Público | Prontidão de PostgreSQL, Redis e RabbitMQ quando configurados; pode retornar `503`. |
| GET | `/api/distributed/status` | Público | Broker configurado, entrega `at-least-once` e contagem da outbox. |
| GET | `/api/distributed/overview` | Usuário | Eventos pendentes/publicados e situação dos serviços de apoio. |
| GET | `/metrics` | Token interno | Texto com métricas HTTP; token exigido quando configurado. |
| GET | `/` | Público | Redireciona para `/splash`. |

`/uploads/*` serve arquivos do armazenamento local. Com frontend compilado,
arquivos de `dist/` são servidos e caminhos de navegação fora de `/api` e
`/uploads` retornam `index.html`. Esse fallback não representa uma nova API.

## 13. Serviços HTTP internos

O core utiliza `Authorization: Bearer <SERVICE_AUTH_TOKEN>` nas chamadas internas
quando configurado. Esses serviços não usam JWT de usuário. Sem token interno
configurado, seus handlers não impõem esse controle; mantenha-os na rede privada.

| Serviço | Método | Caminho | Acesso | Retorno |
| --- | --- | --- | --- | --- |
| Notificações, porta 3001 | GET | `/health` | Público interno | `{ok,service:"notifications",processedEvents}`. |
| Notificações, porta 3001 | GET | `/notifications/:id` | Token interno | `{notifications:[...]}` do ID de usuário. |
| Notificações, porta 3001 | POST | `/notifications/:user/:id/read` | Token interno | Marca aviso e devolve `{ok:true}`. |
| Impacto, porta 3002 | GET | `/health` | Público interno | `{ok,service:"impact",processedEvents}`. |
| Impacto, porta 3002 | GET | `/impact` | Token interno | Resumo agregado do `ImpactStore`. |

Os eventos chegam a esses serviços pelo RabbitMQ, não por um endpoint público
de publicação HTTP. Idempotência dos consumidores e sua persistência estão
descritas em [arquitetura](arquitetura.md) e [banco de dados](banco-de-dados.md).

## 14. Compatibilidade, limites e diferenças de modo

As rotas compartilhadas de comunidade, entrega, campanhas e Stripe recebem uma
camada de persistência PostgreSQL ou SQLite. As rotas de `storage/postgres-api.js`
são registradas antes das versões equivalentes no `backend.js` e respondem
primeiro no modo PostgreSQL. Não some essas implementações como APIs diferentes.

O inventário também preserva as rotas abaixo porque existem no código, mas não
as apresenta como fluxos produtivos consolidados:

| Método | Caminho | Acesso | Situação atual |
| --- | --- | --- | --- |
| GET | `/api/inspirations` | Público | Vitrine de produtos e exemplos; implementação usa SQLite. |
| POST | `/api/inspirations` | Usuário | `{title,material,price,description,imageUrl?}`; persistência SQLite. |
| POST | `/api/ai/ideas` | Usuário | `{material}` ou `{prompt}`, `quantity?`, `objective?`, `difficulty?`; resposta fixa por regras/palavras. |
| PATCH | `/api/posts/:id/status` | Proprietário | `{status:"Disponível"\|"Encerrado"}`; handler final usa SQLite, sem equivalente PostgreSQL. |
| POST | `/api/notifications/read` | Usuário | Leitura em lote; handler final usa SQLite, sem equivalente PostgreSQL. |

No PostgreSQL, os handlers legados que dependem diretamente de `get/all/run`
do SQLite não possuem implementação equivalente consolidada e podem falhar;
não há garantia de resposta `404` específica para eles. A rota de ideias não
utiliza modelo de IA, busca visual ou API de geração: seleciona sugestões
predefinidas e não deve ser descrita como IA generativa.

Outras diferenças relevantes para integrações:

- O feed PostgreSQL exclui `Encerrado`; a consulta SQLite não tem o mesmo filtro.
- O limite de login/cadastro/recuperação foi anexado às rotas de autenticação
  em `backend.js` (30 requisições por IP/caminho em 15 minutos); as versões
  PostgreSQL são registradas antes e não recebem esse mesmo middleware.
- Consultas CNPJ e rotas do mapa têm limitador de 60 por IP/caminho em 15 minutos.
  Redis compartilha os contadores quando disponível; o fallback é memória local.
- Não há paginação genérica: feed, negociações e mensagens não aceitam
  `page`, `offset` ou `cursor` como contrato implementado. Limites fixos de algumas
  listagens não são paginação.
- Comparações de dados financeiros/etapas e guarda de registros são específicas
  da operação. Uma resposta perdida não autoriza criar nova chave de pagamento.
- Algumas ações possuem proteção repetível específica (contribuição recebida,
  confirmação de recebimento e cancelamento da mesma versão de oferta), mas
  métodos POST em geral não recebem idempotência automaticamente.

## 15. Exemplos de consumo e fontes

Consultar o usuário da sessão e os anúncios:

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/feed

curl "http://localhost:3000/api/discovery/nearby?lat=-2.44&lng=-54.71&radius=10" \
  -H "Authorization: Bearer $TOKEN"
```

Leia os IDs e permissões da resposta antes de executar alterações. Os exemplos
são instruções de integração; não constituem confirmação de que contas Stripe
reais, chaves ou todos os serviços estão habilitados no domínio publicado.

Fontes do contrato:

- [Servidor e rotas comuns/SQLite](../backend.js).
- [Implementação PostgreSQL](../storage/postgres-api.js).
- [Comunidade e descoberta](../storage/community-api.js).
- [Campanhas](../storage/campaign-api.js).
- [Entrega e acompanhamento](../storage/delivery-api.js).
- [Stripe e conciliação](../storage/stripe-api.js).
- [Uploads](../storage/post-media-upload.js) e [ordenação de mídias](../storage/post-media.js).
- [Cliente HTTP do frontend](../src/services/api.js).
- [Serviço de notificações](../services/notification-service.js) e
  [serviço de impacto](../services/impact-service.js).

Para iniciar o ambiente, consulte [operação](operacao.md). Para autenticação,
tratamento de dados e evidências de validação, consulte
[segurança e testes](seguranca-e-testes.md).
