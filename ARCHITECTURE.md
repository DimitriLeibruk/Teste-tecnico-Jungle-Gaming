# Arquitetura — Kurio

Este documento registra contratos, fluxos de estado, decisões técnicas e de UX, desvios do Figma e limitações conhecidas.

## Visão geral

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  UI (React + shadcn/ui)                                            │
│    │ hooks de feature (useCart, useQuote, useCreateOrder…)         │
│  TanStack Query ── cache por chave (público / ['me', userId] / carrinho)
│    │                         ▲ patches versionados                 │
│  Axios (src/api) ──┐   RealtimeProvider ── socket.io-client        │
│   contratos Zod    │         │ (WebSocket, transports:['websocket'])│
│ ───────────────────┼─────────┼──────────────── network gate ────── │
│  MSW Service Worker│   MSW ws.link + @mswjs/socket.io-binding      │
│  handlers REST ────┴──► domínio simulado ◄── servidor Socket.IO    │
│                      (src/mocks: db + regras + cenários)           │
│                       persistência em localStorage                 │
└────────────────────────────────────────────────────────────────────┘
```

- **Contratos únicos** (`src/api/contracts`, Zod): o cliente valida toda resposta (`parse` em `src/api/http.ts`) e os handlers do mock validam toda requisição com os mesmos schemas. Divergência de contrato vira erro `INVALID_RESPONSE`, nunca dado malformado na UI.
- **Responsabilidades:** `api/` (transporte e contratos) → `features/*/hooks` (estado remoto e regras de UI) → `routes/` e componentes (apresentação). Componentes, hooks e o cliente Axios **não contêm dados fictícios** nem caminhos alternativos para o mock; tudo que é simulado vive em `src/mocks`.
- **Network gate** (`src/lib/network-gate.ts`): a UI renderiza imediatamente, mas Axios e Socket.IO aguardam a camada de mocks iniciar. Nenhuma requisição sai sem interceptação, e o MSW sai do caminho crítico de renderização.

## Rotas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/` | Início (destaques, catálogo, banners, diário) | público |
| `/mercado` | Catálogo completo com busca | público |
| `/nft/$nftId` | Detalhe do NFT | público |
| `/carrinho` | Carrinho | público (visitante ou usuário) |
| `/entrar`, `/cadastro` | Login e cadastro (página; no desktop também há o modal) | público |
| `/pagamento` | Pagamento | privado |
| `/pedidos/$orderId` | Pedido pendente/recusado e recibo | privado |
| `/conta/perfil`, `/conta/carteiras`, `/conta/favoritos`, `/conta/atividade` | Conta do colecionador | privado |
| `/em-breve?secao=` | Seções fora do escopo (comunica isso com clareza) | público |
| `*` | 404 | — |

As rotas privadas ficam sob o layout `_auth`, cujo `beforeLoad` aguarda a validação da sessão persistida e redireciona para `/entrar?redirect=<destino>`. O `redirect` só aceita caminhos internos (proteção contra open redirect).

**Estado na URL:** busca, filtros (`categories`, `networks` em lista separada por vírgula), faixa de preço, ordenação, aba e página ficam nos search params, validados com Zod (`src/features/catalog/search.ts`). Valores inválidos são descartados, nunca quebram a página. Cada mudança cria uma entrada no histórico; mudar filtro ou ordenação reinicia a paginação.

## Contratos REST

Base `/api`. Autenticação por `Authorization: Bearer <token>`. O carrinho do visitante é identificado por `X-Cart-Id` (UUID gerado no cliente).

### Formato de erro (todas as rotas)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fieldErrors": { "email": "…" }, "details": {} } }
```

| Status | Códigos |
| --- | --- |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` (pedido de outro usuário), `WALLET_REJECTED` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `ADDRESS_IN_USE`, `AVAILABILITY_CONFLICT`, `QUOTE_OUTDATED`, `QUOTE_EXPIRED`, `IDEMPOTENCY_CONFLICT` |
| 422 | `VALIDATION_ERROR`, `COUPON_INVALID`, `COUPON_EXPIRED` |
| 429 / 5xx | `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` (transitórios) |

No cliente, todos os erros são normalizados em `ApiError` (`src/api/errors.ts`), que adiciona `NETWORK_ERROR`, `TIMEOUT` e `INVALID_RESPONSE` e expõe `isTransient`.

### Endpoints

| Recurso | Método e rota | Corpo / parâmetros | Resposta |
| --- | --- | --- | --- |
| Sessão | `POST /auth/register` | `{ username, email, password }` | `201 { user, session }` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` · 422 |
| | `POST /auth/login` | `{ email, password }` | `{ user, session }` · 401 `INVALID_CREDENTIALS` |
| | `GET /auth/session` | — | `{ user, expiresAt }` · 401 `SESSION_EXPIRED` |
| | `POST /auth/logout` | — | `204` (idempotente) |
| NFTs | `GET /nfts` | `q, categories, networks, minPrice, maxPrice, sort, tab, page, pageSize` | `{ items, page, pageSize, total, totalPages, facets }` |
| | `GET /nfts/featured` | — | `{ hero[], spotlight }` |
| | `GET /nfts/:id` | — | `NftDetail` (com `editions[]` e `version`) · 404 |
| | `GET /nfts/:id/related` | — | `{ items }` |
| Favoritos | `GET /me/favorites` | — | `{ ids, items }` |
| | `PUT /me/favorites/:nftId` · `DELETE /me/favorites/:nftId` | — | `{ ids, items }` |
| Carrinho | `GET /cart` | — | `Cart` |
| | `POST /cart/items` | `{ nftId, editionId, quantity }` | `Cart` · 409 `AVAILABILITY_CONFLICT` |
| | `PATCH /cart/items/:id` | `{ quantity }` | `Cart` · 409 |
| | `DELETE /cart/items/:id` | — | `Cart` |
| | `PUT /cart/coupon` · `DELETE /cart/coupon` | `{ code }` | `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| | `POST /cart/acknowledge-prices` | — | `Cart` (aceita os preços atuais) |
| | `POST /cart/merge` | `{ guestCartId }` | `Cart` (mescla o carrinho do visitante no do usuário) |
| Cotação | `POST /quotes` | `{ network }` | `Quote { id, items, subtotal, discount, networkFee, total, coupon, issues[], valid, fingerprint, expiresAt }` |
| Pedidos | `POST /orders` + header `Idempotency-Key` | `{ quoteId, quoteFingerprint, walletId, connectionId, provider, network, buyer }` | `201 Order` (novo) · `200 Order` + `Idempotent-Replayed: true` (mesma chave e conteúdo) · 409 `IDEMPOTENCY_CONFLICT`/`QUOTE_OUTDATED`/`QUOTE_EXPIRED`/`AVAILABILITY_CONFLICT` (com `details.quote`) |
| | `GET /orders` · `GET /orders/:id` | — | `{ items }` · `Order` · 403/404 |
| Perfil | `GET /me/profile` · `PATCH /me/profile` | `{ displayName, username, email, ensName, ensSuffix, walletNickname }` | `User` · 409 conflito · 422 |
| | `PUT /me/avatar` (multipart `avatar`) · `DELETE /me/avatar` | PNG/JPG/WebP ≤ 2 MB | `User` · 422 |
| | `PUT /me/password` | `{ currentPassword, newPassword }` | `204` · 422 senha atual incorreta (revoga as demais sessões) |
| Carteiras | `GET /me/wallets` · `PUT /me/wallets/:slot` (`primary`/`secondary`) | campos do layout Carteiras | `{ primary, secondary }` · 409 `ADDRESS_IN_USE` · 422 |
| | `POST /wallet-connections` · `DELETE /wallet-connections/:id` | `{ walletId, provider, network }` | conexão simulada · 403 `WALLET_REJECTED` |

**Valores monetários:** todo valor em ETH trafega como **string decimal** (`"26.846"`), validado por regex no contrato e calculado com `big.js` (cliente e mock). A exibição usa de 2 a 6 casas decimais sem perder precisão. Quantidades são inteiras.

## Eventos Socket.IO

Envelope comum (`src/api/contracts/events.ts`):

```json
{
  "eventId": "evt_00000012",
  "type": "nft.updated",
  "resource": { "type": "nft", "id": "emerald-ape-042" },
  "version": 7,
  "occurredAt": "2026-10-02T21:00:00.000Z",
  "data": { "nftId": "…", "price": "1.29", "compareAtPrice": null, "soldOut": false, "editions": [{ "id": "1-50", "price": "1.29", "available": 12 }] }
}
```

| Evento | Destino | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | todas as conexões | Patch versionado no detalhe, nas listagens, destaques e favoritos; se o NFT estiver no carrinho: aviso visual + `aria-live`, e o carrinho e a cotação são refeitos no servidor. |
| `order.updated` | só as conexões do dono do pedido | Patch do pedido (`pending → confirmed/declined`), invalidação do pedido, da lista e (se confirmado) do carrinho; toast e anúncio acessível. |

**Garantias no cliente** (`src/features/realtime`):

- **Duplicatas:** `EventLedger` descarta `eventId` já processado (LRU de 500).
- **Eventos antigos:** descartados se `version` ≤ maior versão conhecida do recurso; além disso, cada patch só é aplicado se `event.version > versão em cache` (que também vem do REST). Um evento atrasado nunca regride um dado mais novo.
- **Sessões:** uma conexão por sessão (`epoch`), autenticada pelo token no pacote CONNECT. O servidor só envia `order.updated` ao dono; o cliente ainda confere `userId` e `epoch` (defesa em profundidade). No logout ou troca de usuário, listeners e socket são encerrados.
- **Reconexão:** ao reconectar, o cliente reconcilia via REST os recursos ativos (`nfts`, carrinho, cotação e pedidos). Pedidos pendentes também têm polling de segurança (10 s conectado, 3 s desconectado).

**Transporte no ambiente de mocks:** o `socket.io-client` conecta em `wss://realtime.kurio.mock` com `transports: ['websocket']`. O MSW intercepta o WebSocket (`ws.link`) e o `@mswjs/socket.io-binding` codifica e decodifica pacotes Engine.IO/Socket.IO. Limitações e cuidados:

- Sem long-polling (o binding só cobre WebSocket); sem namespaces, rooms ou acks.
- O binding não envia pings do Engine.IO; o servidor simulado envia heartbeat (`2`) a cada 20 s para o cliente não derrubar a conexão.
- O MSW 2.15 remove o prefixo `/socket.io/` do caminho antes do match; por isso o handler escuta a origem (`wss://realtime.kurio.mock/*`).
- O `engine.io-client` captura `globalThis.WebSocket` quando é avaliado; por isso o `socket.io-client` é importado dinamicamente depois do network gate.
- Cada aba roda seu próprio servidor simulado. O banco é sincronizado entre abas via evento `storage`, mas eventos emitidos em uma aba não chegam aos sockets de outra.

## Sessão

- **Login/cadastro** retornam `{ user, session: { token, expiresAt } }` (TTL de 60 min). O cliente persiste em `localStorage` só o token, a expiração e um snapshot público do usuário, **nunca senhas**.
- **Recuperação após refresh:** a sessão persistida é revalidada em `GET /auth/session` em paralelo ao primeiro render; as rotas privadas aguardam (`sessionReady`).
- **Expiração:** por relógio (timer em `expiresAt`) ou por resposta `401 SESSION_EXPIRED/UNAUTHENTICATED` (interceptor do Axios, que ignora respostas de requisições feitas com um token anterior). Efeitos: o cache privado é limpo, o socket é reaberto como visitante, e então:
  - em rota privada → redireciona para `/entrar?redirect=<rota>&motivo=expirada` e volta ao mesmo ponto após o login;
  - em rota pública → toast com ação “Entrar”, que abre o modal sem sair da página.
  - O rascunho do checkout fica em `sessionStorage` e é restaurado após o novo login.
- **Logout e troca de usuário:** `removeQueries` em `['me']`, `['cart']` e `['quote']`, limpeza do rascunho e da tentativa de checkout, nova `epoch` (descarta eventos da sessão anterior) e nova conexão Socket.IO.

## Carrinho

- O servidor é a fonte de verdade. Visitante: carrinho por `X-Cart-Id`; usuário: um carrinho por conta.
- **Login preserva os itens:** `POST /cart/merge` mescla o carrinho do visitante no do usuário respeitando a disponibilidade; depois o id de visitante é renovado. A mescla roda **antes** de a sessão mudar no cliente (com o token recém-emitido), evitando a corrida em que um `GET /cart` antigo sobrescreveria o carrinho mesclado. No logout, o carrinho do usuário fica no servidor e o visitante começa vazio.
- Cada item expõe `unitPrice` (atual), `addedUnitPrice` (no momento da inclusão), `available`, `maxQuantity` (disponibilidade × limite por pedido) e `status` (`ok`, `price-changed`, `insufficient`, `sold-out`).
- **Resumo:** subtotal, desconto, taxa de rede e total vêm da **cotação** do servidor (`POST /quotes`), cuja chave de cache inclui a versão do carrinho. Qualquer alteração (inclusive vinda de evento) gera uma nova cotação.
- **Cupom:** aplicado no carrinho (persistente); erros de inválido ou expirado aparecem no campo (`aria-describedby`). Cupom que expira depois de aplicado é removido e sinalizado na cotação.

## Checkout, idempotência e pedidos

1. O formulário (campos do layout) é pré-preenchido a partir da carteira cadastrada; “Usar outra carteira?” troca para a secundária.
2. **Confirmar compra** valida o formulário e **conecta a carteira** (simulação: `POST /wallet-connections`, que pode ser recusada). Trocar rede, carteira ou provedor invalida a conexão; há botão de desconectar.
3. **Revisão:** mostra um *snapshot* da cotação. Se chegar evento ou mudança, a confirmação fica bloqueada até “Atualizar revisão”.
4. **Confirmar e pagar:** revalida a cotação (`POST /quotes`). Se o `fingerprint` mudou, exige nova confirmação. Depois envia `POST /orders` com `Idempotency-Key`:
   - a chave é derivada da tentativa (hash do payload) e guardada em `sessionStorage` até a resposta chegar;
   - timeout, falha de rede ou 5xx → reenvio automático com a **mesma chave** (até 3 tentativas);
   - cliques repetidos são bloqueados por uma trava síncrona (`ref`) e pelo estado da mutation; mesmo que dois envios escapassem, a chave igual devolveria o mesmo pedido;
   - se a página recarregar no meio do envio, o checkout oferece **Retomar envio** com a mesma chave;
   - o servidor responde 409 com `details.quote` quando a cotação ficou desatualizada, e o cliente exibe os novos valores para nova confirmação.
5. O pedido nasce `pending` e reserva as unidades. A simulação liquida após ~2,5 s (1,5 s no `instant`) e emite `order.updated`. A liquidação também acontece de forma preguiçosa a cada requisição e ao iniciar o mock, então refresh e queda de conexão não perdem o resultado.
   - `confirmed`: grava a transação simulada e remove do carrinho **apenas** os itens e quantidades comprados;
   - `declined`: devolve a reserva e mantém os itens no carrinho. Estados finais são terminais.
6. O **recibo** só existe para pedido `confirmed` e renderiza exclusivamente o snapshot do pedido (itens, preços, taxas, total), imune a mudanças posteriores no catálogo.

## Estratégia de cache, retries e sincronização

| Aspecto | Política |
| --- | --- |
| Chaves | Públicas `['nfts', …]`; privadas `['me', userId, …]`; carrinho `['cart', 'user:<id>' \| 'guest:<id>']`; cotação `['quote', escopo, versãoDoCarrinho, rede]`. |
| `staleTime` | 30 s padrão; destaques, perfil e carteiras 60 s; carrinho 10 s; pedido 5 s. |
| Retries (queries) | Até 2, **só em falhas transitórias** (rede, timeout, 5xx, 429), backoff 0,5 s → 1 s (máx. 4 s). 4xx nunca é repetido. |
| Retries (mutations) | Nenhum automático, exceto a criação de pedido (idempotente por chave). |
| Respostas obsoletas | Cada combinação de parâmetros tem sua chave (uma resposta antiga nunca sobrescreve a atual); o `AbortSignal` do Query cancela requisições descartadas; `keepPreviousData` evita flicker. |
| Invalidação | Mutations de carrinho gravam o carrinho retornado e invalidam a cotação; perfil e carteiras gravam a resposta; pedido grava o pedido e invalida a lista; eventos fazem patch versionado ou invalidam. |
| Atualização otimista | **Favoritos**: o coração muda na hora, há rollback em erro com toast e `aria-live`, e a resposta só é aplicada se não houver outra mutation de favorito em andamento. |
| Foco/reconexão | `refetchOnWindowFocus` ativo; reconexão do socket reconcilia o que está ativo. |

## Mocking (MSW)

- **Banco simulado** (`src/mocks/db`): fixtures determinísticas (36 NFTs gerados de uma semente fixa, incluindo os nomes e preços do Figma; 3 usuários; cupons), persistidas em `localStorage` (`kurio.mock.db`). O reset recria tudo a partir das fixtures.
- **Domínio** (`src/mocks/domain`): catálogo (filtros, facetas, ordenação), carrinho, cotação, pedidos (idempotência, reserva, liquidação) e barramento de eventos. **Toda mudança passa pelo domínio**, que persiste e publica o evento; por isso REST e Socket.IO sempre concordam.
- **Handlers** (`src/mocks/handlers`): validam a entrada com os contratos e convertem regras em respostas HTTP.
- **Middleware de rede** (`src/mocks/network.ts`): primeiro handler de `/api/*`; aplica latência e falhas do cenário e, se nada se aplica, cai para o handler da rota.
- **Cenários** (`src/mocks/scenarios.ts`): presets combináveis; regras “uma vez” contam disparos em `localStorage` (reprodutíveis após refresh).
- **Controle** (`window.__KURIO_MOCK__`, `src/mocks/control.ts`) e painel **Mock Lab**: alteram o estado do *servidor*; a UI só enxerga o efeito via REST e socket.
- Ativação por `VITE_API_MOCKING=enabled`, inclusive no build de demonstração publicado.

## Acessibilidade

- Skip link, landmarks (`header`, `nav`, `main`, `footer`, `aside`), títulos de página por rota e foco movido para o conteúdo a cada navegação.
- Diálogos e drawers com Radix (foco preso, `Esc`, retorno de foco). Como o modal de login e o drawer de filtros são abertos por estado, há um hook que devolve o foco ao elemento de origem (`use-return-focus`).
- Campos com `label`, `aria-invalid` e `aria-describedby` apontando para a mensagem de erro (`Field`/`FieldControl`); o primeiro campo inválido recebe foco.
- Feedback de mutations e eventos em tempo real por regiões `aria-live` (polite/assertive) e toasts.
- Estados não dependem só de cor: badges de pedido têm ícone e texto; preço riscado tem texto para leitores; edição esgotada é desabilitada e anunciada.
- Seleção de edição como `radiogroup` com navegação por setas; abas do detalhe com `Tabs` do Radix; quantidade com botões rotulados e `output` anunciado.
- Contraste: a paleta do Figma foi verificada (texto muted `#cfb28c` e subtle `#b39463` sobre as superfícies ≥ 6:1; laranja `#d28a4c` sobre o fundo ≈ 6,8:1).
- `prefers-reduced-motion` desativa shimmer, transições e scroll suave. O carrossel do hero é manual (sem autoplay).
- Sem overflow horizontal em 390/768/1440 px (teste `responsive.spec.ts`); auditoria axe-core sem violações sérias em Início, Detalhe, Carrinho e Login.

**Ajustes em relação ao layout:** o asterisco de obrigatório ganhou texto “(obrigatório)” para leitores de tela; os botões de login social, fora do escopo, ficam marcados como indisponíveis (`aria-disabled` + explicação); o rótulo do campo opcional “ENS ou carteira secundária” existe para leitores de tela embora fique invisível no desktop (como no Figma).

## Performance

Medições (mediana de 3, build otimizado, cenário padrão dos mocks) em [`lighthouse/summary.md`](./lighthouse/summary.md):

| Página | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | **81** | 96 | 100 | 100 | 4,3 s | 0 | 110 ms |
| Início | desktop | 99 | 96 | 100 | 100 | 0,9 s | 0 | 0 ms |
| Detalhe | mobile | **82** | 95 | 100 | 100 | 4,2 s | 0 | 31 ms |
| Detalhe | desktop | 99 | 97 | 100 | 100 | 0,9 s | 0 | 0 ms |

**Otimizações aplicadas (com efeito medido):**

| Mudança | Efeito |
| --- | --- |
| Fonte variável auto-hospedada com nome estável + `preload` | CLS da home mobile de 0,127 → 0 |
| Skeleton do detalhe reservando abas e carrossel | CLS do detalhe desktop de 0,275 → 0 |
| Network gate (render imediato; só a rede espera o MSW) e `socket.io-client` sob demanda | O app deixa de esperar o MSW para renderizar |
| `modulepreload` do chunk de mocks (plugin no `vite.config.ts`) | MSW baixa em paralelo ao bundle principal |
| Stub do `tldts` (lista pública de sufixos usada só pelo cookie jar do MSW) | −185 KB de código no chunk de mocks |
| Menu da conta e modal de login sob demanda | Radix Menu e Floating UI fora do bundle inicial |
| Arte do hero estática + `preload` da imagem LCP; WebP; `width`/`height` em todas as imagens; app shell no HTML | Primeira pintura antes do JavaScript; imagem descoberta cedo |

**Por que o mobile fica abaixo de 90:** o perfil mobile do Lighthouse simula 4G lento (~1,6 Mbps, RTT 150 ms) e CPU 4× mais lenta. Nesse cenário, o LCP (primeiro card do catálogo / imagem do NFT) depende de:

1. baixar e executar o bundle da aplicação (~100 KB gzip; React DOM, TanStack Router/Query e Zod são a maior parte);
2. **baixar a camada de mocks (~57 KB gzip) e registrar e ativar o Service Worker do MSW** antes da primeira chamada à API;
3. a latência simulada do cenário padrão (120–420 ms por chamada).

O item 2 só existe porque a API é simulada no navegador. Com uma API real, ou uma página renderizada no servidor, ele desaparece. O requisito proíbe simplificações exclusivas para a pontuação (por exemplo, desativar mocks ou latência no audit), então mantivemos o cenário real. No desktop, as mesmas páginas ficam em 98–99, e CLS e TBT estão dentro das metas em todos os perfis.

## Decisões de UX e desvios do Figma

- **Login/Cadastro:** no desktop são um modal com abas “Entrar | Criar conta” (como no Figma), que mantém o usuário na página. Para redirecionamentos de rotas privadas há as páginas `/entrar` e `/cadastro`, no layout dos frames mobile.
- **Mercado:** o item “Mercado” do menu leva a `/mercado` (catálogo com busca); “Início” mantém hero, catálogo e conteúdo editorial.
- **Botão central da barra mobile** (ícone de “scan” no Figma) leva ao Mercado (explorar).
- **Comprar (detalhe):** adiciona ao carrinho e abre o carrinho. No mobile, o ícone de carrinho só adiciona.
- **Carteira e rede (Pagamento desktop):** o Figma mostra uma opção com os badges das três carteiras, MetaMask e Coinbase. Usamos as três opções explícitas (WalletConnect, MetaMask, Coinbase Wallet), alinhadas ao frame mobile.
- **Pagamento mobile:** o frame mobile não mostra o formulário. Ele existe como seção recolhível “Perfil do colecionador”, pré-preenchida pela carteira e aberta automaticamente se houver erros.
- **Endereço da carteira no pagamento** é somente leitura (vem da carteira cadastrada e conectada); a edição fica em Carteiras.
- **Rodapé** oculto no mobile em detalhe, carrinho e pagamento (os frames mobile não têm rodapé e usam barras fixas de ação).
- **Data do recibo** no formato do Figma (“29 Jul, 2026”), com meses em português.
- **Atividade** (sidebar da conta) mostra o histórico de pedidos. **Ofertas, Arquivos baixados, Suporte, Criadores, Aprenda, Diário da Cunhagem e Central de ajuda** levam a `/em-breve`, que informa claramente estar fora da demonstração. A newsletter valida o e-mail mas informa que não está disponível, e “Esqueceu a senha?” explica que a recuperação não faz parte do escopo. Nenhuma ação fora do escopo simula sucesso.
- **Links de exploração** (Etherscan/Polygonscan/Solscan) usam hashes simulados e trazem o aviso “transação simulada”.
- **Datas, contagens e facetas** vêm da API (as contagens do Figma eram ilustrativas).

## Assets

- As artes dos NFTs foram extraídas dos PNGs exportados do Figma (`figma/`) pelo script `npm run assets` (recorte por coordenadas → WebP, mais miniaturas de 160 px). O Figma tem 4 personagens; os 36 NFTs reutilizam essas artes com nomes, atributos e preços próprios. A resolução é limitada à dos frames (até 450 px). Exportar as imagens originais do Figma em 2× melhoraria a nitidez em telas de alta densidade.
- O ícone “Thank you” do recibo foi recortado do frame de confirmação.
- Ícones de interface: `lucide-react`. Logos de Google/Facebook e redes sociais: SVG inline.
- Fonte: Roboto Mono (identificada nos frames), versão variável do `@fontsource-variable/roboto-mono` (OFL), servida localmente.

## Limitações conhecidas

- Sem backend real: estado por navegador (localStorage). Duas abas compartilham o banco, mas eventos Socket.IO não cruzam abas.
- Baselines visuais geradas em Windows; em outro sistema operacional precisam ser regeneradas (`npm run test:e2e:update`).
- Avatar é armazenado como data URL (reduzido para 256 px WebP antes do envio) dentro do `localStorage` do mock.
- Login social e recuperação de senha são intencionalmente indisponíveis.
