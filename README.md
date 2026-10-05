# Kurio — Marketplace de NFTs

Solução do desafio frontend da Jungle Gaming: marketplace de NFTs em **React + TypeScript** com descoberta, compra e conta do colecionador, versões desktop e mobile, API REST e tempo real **totalmente simulados com MSW** (inclusive Socket.IO).

- **Aplicação publicada:** https://teste-tecnico-jungle-gaming.vercel.app/
- **Repositório:** https://github.com/DimitriLeibruk/Teste-tecnico-Jungle-Gaming
- **Decisões técnicas, contratos e limitações:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Enunciado original:** [docs/DESAFIO.md](./docs/DESAFIO.md)

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Roteamento | TanStack Router (rotas por arquivo, search params validados com Zod) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios (instância única com interceptors) |
| Contratos | Zod 4 (compartilhados entre cliente e mocks) |
| Tempo real | socket.io-client 4 |
| Estilização / componentes | Tailwind CSS 4 + shadcn/ui (Radix) adaptados à identidade Kurio |
| Formulários | react-hook-form + Zod |
| Valores em ETH | big.js (strings decimais, sem `number`) |
| Mocking | MSW 2 (REST via Service Worker + WebSocket com `@mswjs/socket.io-binding`) |
| Testes E2E / visuais | Playwright (+ axe-core) |
| Auditoria | Lighthouse 13 |

## Começando

Requisitos: **Node.js ≥ 20.19** (testado com Node 24) e npm.

```bash
npm install
npx playwright install chromium   # navegador dos testes e da auditoria
npm run dev                        # http://localhost:5173 (mocks ativos)
```

Não há backend: toda a API e o servidor Socket.IO são simulados no navegador pelo MSW. A aplicação roda a partir de um checkout limpo, sem serviços externos.

### Variáveis de ambiente

Já versionadas em `.env` (sem segredos). Copie para `.env.local` para sobrescrever.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_API_MOCKING` | `enabled` | Ativa a camada de mocks (MSW), inclusive no build de demonstração. |
| `VITE_API_BASE_URL` | `/api` | Base das rotas REST. |
| `VITE_SOCKET_URL` | `https://realtime.kurio.mock` | Servidor Socket.IO (interceptado pelo MSW). |

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks. |
| `npm run build` | Verificação de tipos + build de produção (com mocks, igual ao deploy). |
| `npm run preview` | Serve o build em http://localhost:4173. |
| `npm run typecheck` | Verificação de tipos. |
| `npm run lint` | ESLint (inclui regras do React Compiler/hooks). |
| `npm run check` | typecheck + lint. |
| `npm run test:e2e` | Todos os testes Playwright (gera o build e sobe o preview automaticamente). |
| `npm run test:e2e:functional` | Testes funcionais (sem regressão visual). |
| `npm run test:e2e:visual` | Só a regressão visual. |
| `npm run test:e2e:update` | Regenera as baselines visuais. |
| `npm run test:report` | Abre o relatório HTML do último run (traces das falhas incluídos). |
| `npm run lighthouse` | Auditoria Lighthouse (build + preview + 3 medições por página/perfil). |
| `npm run assets` | Reextrai as artes dos NFTs a partir dos PNGs do Figma (`figma/`). |

## Credenciais fictícias

Senha de todos: **`Kurio@2026`**

| E-mail | Perfil |
| --- | --- |
| `ana@kurio.dev` | Carteiras principal (Ethereum/MetaMask) e secundária (Polygon/Coinbase); 2 favoritos. |
| `bruno@kurio.dev` | Carteira principal (WalletConnect); 1 favorito. |
| `carla@kurio.dev` | Sem carteiras (exercita o cadastro de carteira e o bloqueio do checkout). |

Cupons: `KURIO10` (10%), `GENESIS5` (5%), `VERAO2025` (expirado). Qualquer outro código é inválido.

Senhas são guardadas no mock como `SHA-256(salt:senha)`; o cliente persiste apenas o token de sessão.

## Cenários do mock

O backend simulado mantém estado consistente (catálogo, favoritos, carrinho, perfil, carteiras, pedidos) em `localStorage` e oferece cenários **determinísticos e combináveis**.

**Como selecionar**

- Pela URL: `?scenario=slow` ou combinando: `?scenario=instant,favorites-fail` (o parâmetro é aplicado e removido da URL; a escolha persiste).
- Pelo painel **Mock Lab** (botão no canto inferior esquerdo): marque os cenários e clique em **Aplicar e recarregar**.
- Pelo console: `window.__KURIO_MOCK__.setScenario(['slow'])` e recarregue.

**Reset:** Mock Lab → **Resetar tudo**, ou `await window.__KURIO_MOCK__.reset()`. Restaura integralmente as fixtures, o cenário `default`, os contadores das regras e o estado do cliente (sessão, carrinho de visitante, rascunhos).

| Cenário | Efeito |
| --- | --- |
| `default` | Tudo funciona, latência variável curta (120–420 ms). |
| `instant` | Sem latência (usado nos testes e2e). |
| `slow` | Todas as respostas levam ~2,5 s (skeletons). |
| `variable` | Latência de 200 ms a 2,4 s, sequência determinística. |
| `out-of-order` | Buscas do catálogo alternam 1,2 s / 150 ms: respostas antigas chegam depois das novas. |
| `empty` | Catálogo vazio. |
| `catalog-error` | As 3 primeiras chamadas da listagem retornam 503 (falha transitória). |
| `server-error` | Todas as rotas REST retornam 500. |
| `offline` | Falha de rede em tudo e o socket recusa conexões. |
| `favorites-fail` | Incluir/remover favorito retorna 500 (rollback otimista). |
| `session-expired` | A primeira chamada autenticada de navegação/checkout retorna 401 `SESSION_EXPIRED`. |
| `payment-declined` | Pedidos são recusados após ficarem pendentes. |
| `order-timeout` | O 1º `POST /api/orders` cria o pedido mas a resposta não chega (timeout). |
| `price-change` | No 1º envio do pedido o preço de um item sobe (evento `nft.updated`) e o servidor responde 409. |
| `sold-out` | No 1º envio do pedido a edição de um item esgota (409). |
| `wallet-rejected` | A 1ª conexão de carteira é recusada. |
| `realtime-chaos` | Cada `nft.updated` chega duplicado e seguido de uma versão antiga. |

### Reproduzindo os fluxos de falha

Use `instant` junto para respostas rápidas, por exemplo: `http://localhost:5173/?scenario=instant,payment-declined`.

| Fluxo | Passos |
| --- | --- |
| Pagamento recusado | `?scenario=payment-declined` → login → adicione um NFT → Conectar e finalizar → Confirmar compra → Confirmar e pagar. O pedido fica pendente e depois é **recusado**; os itens continuam no carrinho. |
| Timeout com recuperação | `?scenario=order-timeout` → mesmo fluxo. O botão mostra o envio; após 8 s o cliente reenvia com a **mesma chave de idempotência** e recupera o **mesmo pedido** (veja em Conta → Atividade: um único pedido). |
| Preço muda na compra | `?scenario=price-change` → ao confirmar, o servidor rejeita a cotação (409) e a revisão mostra “Os valores do pedido mudaram”, exigindo nova confirmação. |
| Edição esgota na compra | `?scenario=sold-out` → ao confirmar, a revisão bloqueia o envio e indica o item esgotado. |
| Preço muda com o carrinho aberto | Adicione um NFT, abra o carrinho e, no Mock Lab, clique em **Subir preço +0.1**: aviso em tempo real, resumo atualizado e badge “Preço alterado”. Com a revisão do pagamento aberta, o botão de confirmar é bloqueado até **Atualizar revisão**. |
| Queda do tempo real com pedido pendente | Confirme uma compra e, ainda pendente, clique em **Queda de 5 s** no Mock Lab: banner de reconexão; ao voltar, os dados são reconciliados via REST e o recibo aparece. Recarregar a página do pedido também recupera o estado. |
| Eventos duplicados/antigos | `?scenario=realtime-chaos` ou os botões **Duplicar evento** / **Evento antigo**: o estado não regride nem os avisos se repetem. |
| Sessão expirada | Logado, clique em **Expirar sessão** no Mock Lab e navegue para uma área privada (ou use `?scenario=session-expired`): redireciona para o login com a mensagem e retorna ao ponto anterior; o rascunho do checkout é preservado. |
| Favorito com falha | `?scenario=favorites-fail` → favoritar: o coração muda na hora e volta ao estado anterior com aviso de erro. |
| Carregamento lento / erro transitório | `?scenario=slow` (skeletons) · `?scenario=catalog-error` (erro + “Tentar novamente”) · `?scenario=offline`. |
| Carteira recusa conexão | `?scenario=wallet-rejected` → Confirmar compra: mensagem de recusa; nova tentativa conecta. |
| Conflito de cadastro | Crie conta com `ana@kurio.dev` (e-mail em uso) ou usuário `bruno.lima`. |

## Testes (Playwright)

```bash
npm run test:e2e         # build + preview + todos os testes (desktop 1440 e mobile 390)
npm run test:report      # relatório HTML com traces das falhas
```

- 13 arquivos em `e2e/` cobrindo os 12 grupos pedidos, além de responsividade (sem overflow horizontal em 390/768/1440 px) e auditoria axe-core.
- Cada teste começa em um contexto limpo: o banco simulado é recriado a partir das fixtures.
- Ações de “servidor” (mudar preço, derrubar socket, expirar sessão) usam `window.__KURIO_MOCK__`; a UI recebe os efeitos **pelos caminhos reais** (REST via MSW e eventos via `socket.io-client`).
- Regressão visual de Início, Detalhe, Carrinho e Pagamento em desktop e mobile, com baselines em `e2e/__screenshots__/`. As baselines foram geradas em Windows; em outro sistema operacional rode `npm run test:e2e:update` para gerar as locais (a renderização de fontes varia entre SOs).

## Lighthouse

`npm run lighthouse` gera o build, sobe o preview e roda 3 medições por página (Início e Detalhe) e perfil (mobile e desktop). Configuração versionada em `lighthouse/lighthouse.config.mjs`; relatórios HTML/JSON em `lighthouse/reports/`; mediana, LCP/CLS/TBT, versões e ambiente em [`lighthouse/summary.md`](./lighthouse/summary.md).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 81 | 96 | 100 | 100 | 4,3 s | 0 | 110 ms |
| Início | desktop | 99 | 96 | 100 | 100 | 0,9 s | 0 | 0 ms |
| Detalhe | mobile | 82 | 95 | 100 | 100 | 4,2 s | 0 | 31 ms |
| Detalhe | desktop | 99 | 97 | 100 | 100 | 0,9 s | 0 | 0 ms |

A performance mobile fica abaixo da meta de 90; causas e medições em [ARCHITECTURE.md › Performance](./ARCHITECTURE.md#performance).

## Estrutura

```
src/
  api/            contratos (Zod), cliente Axios, endpoints tipados, erros, query keys
  app/            criação do app, QueryClient (cache/retries), router
  routes/         rotas TanStack Router (arquivo = rota; _auth = privadas)
  features/       domínio da UI: catalog, nft, cart, checkout, orders, account, session, realtime, home
  components/     layout (header, footer, nav mobile) e ui (shadcn adaptado)
  lib/            money (big.js), storage, hash, id, network-gate
  mocks/          backend simulado: db + fixtures, domínio, handlers REST, servidor Socket.IO, cenários, Mock Lab
e2e/              testes Playwright, fixtures e baselines visuais
lighthouse/       configuração, relatórios e resumo da auditoria
scripts/          extração de assets do Figma e auditoria Lighthouse
figma/            frames exportados do Figma (referência visual e fonte dos assets)
```

## Deploy

Configurado para **Vercel** (`vercel.json`): build `npm run build`, saída `dist`, rewrite SPA para que acesso direto e refresh funcionem em qualquer rota, e `mockServiceWorker.js` servido sem cache. O build publicado inclui a camada de mocks (`VITE_API_MOCKING=enabled`), então todos os fluxos e o tempo real funcionam na URL pública. Para Netlify/Cloudflare Pages há `public/_redirects`.

```bash
npm i -g vercel && vercel --prod   # ou importe o repositório no painel da Vercel
```
