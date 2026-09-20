# Lotzy — gerador e analisador de jogos da Lotofácil

**Branch documentada:** `main`
**Commit analisado:** `96c8667` (`feat: expand filters and add weighted generation`)
**Versão dos manifests:** `3.0.0` no monorepo e no backend; `1.0.0` no frontend.
**Idioma da aplicação e desta documentação:** português brasileiro.

> **Uso responsável.** O Lotzy gera, organiza e analisa combinações. Ele não prevê sorteios, não torna uma dezena mais provável e não aumenta a probabilidade de premiação. Filtros, popularidade, diversificação e fechamentos descrevem ou reorganizam apostas; não mudam a probabilidade de uma combinação individual. Aposte apenas valores que possa perder e confira as regras nos canais oficiais.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Escopo implementado](#2-escopo-implementado)
3. [Arquitetura](#3-arquitetura)
4. [Estrutura do repositório](#4-estrutura-do-repositório)
5. [Tecnologias e dependências](#5-tecnologias-e-dependências)
6. [Pré-requisitos e configuração](#6-pré-requisitos-e-configuração)
7. [Instalação, execução e build](#7-instalação-execução-e-build)
8. [API HTTP](#8-api-http)
9. [Regras e algoritmos](#9-regras-e-algoritmos)
10. [Frontend](#10-frontend)
11. [Dados históricos](#11-dados-históricos)
12. [Testes e validação](#12-testes-e-validação)
13. [Limitações e riscos conhecidos](#13-limitações-e-riscos-conhecidos)
14. [Operação e solução de problemas](#14-operação-e-solução-de-problemas)
15. [Contribuição](#15-contribuição)
16. [Licença e referências](#16-licença-e-referências)

## 1. Visão geral

Lotzy é um monorepo TypeScript composto por uma API Express no diretório `backend/`, uma aplicação Next.js no diretório `frontend/` e uma base histórica local em `db/resultados.json`. A API não usa banco de dados, autenticação ou serviço externo obrigatório. O frontend faz chamadas HTTP diretamente ao backend e usa armazenamento do navegador para alguns recursos locais.

O fluxo local usual é:

1. iniciar a API na porta `3000`;
2. iniciar o frontend na porta `3001`;
3. gerar jogos aleatórios, ponderados ou filtrados;
4. validar e analisar o resultado;
5. consultar histórico e estatísticas, desdobrar jogos, conferir resultados ou simular retrospectivamente;
6. exportar ou imprimir os dados para uso pessoal.

A API inclui `X-Request-Id` em suas respostas. Se o cliente enviar esse cabeçalho, o mesmo valor é preservado; caso contrário, a aplicação gera um UUID.

## 2. Escopo implementado

### 2.1 Capacidades da API

| Área | Implementação efetiva |
|---|---|
| Geração | Jogos com 15 a 20 dezenas do universo de 1 a 25, usando `node:crypto`; geração aleatória, filtrada e ponderada. |
| Filtros | Pares, primos, Fibonacci, soma, moldura, maior sequência consecutiva, repetição do concurso anterior, score de popularidade e sobreposição. |
| Análise | Soma, pares, ímpares, primos, Fibonacci, moldura, miolo, maior sequência e popularidade. |
| Carteira | Geração de lotes com limite de sobreposição e popularidade, com métricas de diversidade. |
| Combinatória | Expansão de um conjunto de 15 a 20 dezenas em combinações de 15. |
| Fechamento | Catálogo pré-computado para `W(16,15,15)`, `W(17,15,15)` e `W(18,15,15)`. |
| Conferência | Conferência de jogos JSON ou texto contra 15 dezenas sorteadas. |
| Histórico | Consulta paginada, filtros por concurso/data e exportação CSV, TXT, JSON ou SQL. |
| Estatísticas | Atrasos, temperatura, composição, ciclos, sazonalidade e resumo do último concurso. |
| Ferramentas | Valor esperado, verificação de orçamento, simulação histórica, backtest e variações. |
| Operação | `/health`, `/ready`, `/metrics`, OpenAPI, Helmet, CORS, limite de corpo, rate limit, métricas Prometheus e autenticação administrativa. |
| Processamento pesado | `worker_threads` para desdobramento e simulação nas rotas `/api/jogos`. |

### 2.2 O que o projeto não implementa

Não há conta de usuário, autenticação, autorização, cobrança, registro de apostas, sincronização automática com fonte oficial, banco de dados, notificações push, colaboração multiusuário, painel administrativo, persistência de jogos no servidor ou garantia de atualização automática do arquivo histórico. A página de bolão, a página de notificações e a página de meus jogos são recursos locais ou informativos do frontend; não representam esses serviços.

## 3. Arquitetura

```text
Navegador
   │
   ▼
Next.js 15 / React 19 :3001
   │ fetch, SWR e armazenamento local
   ▼
Express 5 / Node.js :3000
   ├─ middlewares: request id, Helmet, CORS, JSON/text body limit e rate limit
   ├─ rotas HTTP
   ├─ serviços de domínio
   ├─ WorkerPool → worker_threads para desdobrar/simular
   ├─ tabela estática de preços
   └─ leitor de db/resultados.json
```

`backend/src/app.ts` monta os middlewares e routers. As regras matemáticas ficam em `backend/src/domain/games`. Os adaptadores HTTP, histórico, preços, cache e aleatoriedade ficam em `backend/src/infrastructure`. `backend/src/server.ts` cria o listener, trata falhas de bind e encerra o processo em `SIGINT`/`SIGTERM`.

A API é stateless quanto ao usuário. O arquivo histórico é lido em cada chamada por `loadResults()`. O `EstatisticaCache` mantém em memória dados derivados para estatísticas; o cache é reinicializado quando o processo reinicia. O rate limit também é local ao processo.

### 3.1 Processamento em workers

`/api/jogos/desdobrar` usa um pool com dois workers e timeout de 15 segundos. `/api/jogos/simular` usa outro pool com dois workers e timeout de 20 segundos. O `WorkerPool` executa a tarefa em `worker_threads`, resolve o resultado ou rejeita a requisição em caso de erro/timeout. Essas rotas são distintas das rotas legadas em `/api/v1/games`.

### 3.2 Contratos e erros

A validação de payloads usa Zod. O middleware de erros converte erros de validação e `AppError` para respostas Problem Details. A rota `/api/history` faz validação manual de query e retorna `400` para parâmetros inválidos. Os demais contratos inválidos normalmente retornam `422`. Entre os códigos usados pelo backend estão `VALIDATION_FAILED`, `FILTERS_TOO_RESTRICTIVE`, `WHEEL_NOT_AVAILABLE`, `INVALID_SUBSET_SIZE` e `NO_CONCURSOS_FOUND`.

## 4. Estrutura do repositório

```text
app-lotzy/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── db/
│   └── resultados.json
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── app.ts                         # composição do Express
│   │   ├── server.ts                      # listener e encerramento
│   │   ├── domain/games/                  # regras e serviços de domínio
│   │   ├── infrastructure/cache/          # cache de estatísticas
│   │   ├── infrastructure/data/            # leitura/escrita do histórico
│   │   ├── infrastructure/http/            # rotas, erros, OpenAPI e exportação
│   │   ├── infrastructure/pricing/         # tabela estática de preços
│   │   ├── infrastructure/random/          # fonte criptográfica de aleatoriedade
│   │   ├── scripts/update-results.ts       # atualização manual do histórico
│   │   ├── shared/config/                  # ambiente
│   │   ├── shared/errors/                  # erros de aplicação
│   │   └── workers/                        # pools e workers de CPU
│   └── test/                               # testes Vitest/Supertest
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── next.config.ts
    ├── tsconfig.json
    └── src/
        ├── app/                            # páginas App Router
        ├── components/                     # navegação e volante
        └── lib/api.ts                      # cliente HTTP, schemas e hooks
```

A pasta `plan/` foi removida desta branch para não manter uma segunda fonte de documentação.

## 5. Tecnologias e dependências

| Projeto | Tecnologias principais |
|---|---|
| Raiz | npm scripts, monorepo sem workspaces declarados, TypeScript nas aplicações. |
| Backend | Node.js `>=20`, TypeScript `5.9`, Express `5.1`, Zod `4.1`, Helmet, CORS, `express-rate-limit`, `pino-http`, `prom-client`, `tsx`, Vitest e Supertest. |
| Frontend | Next.js 15.5.25, React 19.1.0, SWR 2.5.1, Zod 4.1 e TypeScript 5.9. |

Os lockfiles de `backend/` e `frontend/` devem ser usados para instalações reprodutíveis.

## 6. Pré-requisitos e configuração

É necessário Node.js 20 ou superior e npm. Copie `.env.example` para o ambiente da API quando precisar alterar os valores padrão:

```bash
cp .env.example backend/.env
```

As variáveis reconhecidas pelo backend são:

| Variável | Padrão | Uso |
|---|---:|---|
| `NODE_ENV` | `development` | Aceita `development`, `test` ou `production`. |
| `PORT` | `3000` | Porta HTTP da API. |
| `CORS_ORIGINS` | vazio | Lista separada por vírgulas; em desenvolvimento vazio permite qualquer origem, em produção vazio desabilita a origem. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Janela do rate limit padrão em milissegundos. |
| `RATE_LIMIT_MAX` | `100` | Máximo de requisições por janela para rotas padrão. |
| `RESPONSIBLE_GAMBLING_URL` | URL do Ministério da Saúde | Link retornado nos contratos de geração. |
| `PRICE_TABLE_VERSION` | `2024-11-04` | Versão informada pela configuração; a tabela de preços no código também declara essa versão. |
| `WHEEL_CATALOG_VERSION` | `wheels-2026-09` | Versão configurável do catálogo; a resposta de wheel declara `wheels-2026-09`. |
| `POPULARITY_MODEL_VERSION` | `popularity-2026-09` | Versão do modelo heurístico de popularidade. |

`ADMIN_API_KEYS` aceita entradas no formato `chave:papel`, por exemplo `admin-secret:admin`. A rota administrativa exige `Authorization: Bearer <JWT>` assinado por `AUTH_JWT_SECRET` ou uma dessas chaves em `X-API-Key`; o RBAC aceita os papéis `user` e `admin`. Segredos não devem ser versionados.

`RATE_LIMIT_STORE=memory` é adequado somente para desenvolvimento/testes. Em produção, configure um armazenamento distribuído compatível com a infraestrutura antes de habilitar múltiplas instâncias; `REDIS_URL` já está reservado para essa integração. A persistência PostgreSQL/Prisma e o adaptador Redis distribuído permanecem fases futuras do plano.

O frontend usa `NEXT_PUBLIC_API_URL` em tempo de build. Se a variável não existir, usa `http://localhost:3000`. Se existir, remove um sufixo `/api` ou `/api/v1` antes de montar as URLs.

## 7. Instalação, execução e build

### 7.1 Instalação

```bash
npm ci --prefix backend
npm ci --prefix frontend
```

### 7.2 Desenvolvimento

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:frontend
```

A API fica em `http://localhost:3000` e o frontend em `http://localhost:3001`.

### 7.3 Scripts disponíveis

Na raiz:

```bash
npm run dev             # backend em modo watch
npm run dev:frontend    # frontend Next.js em modo dev
npm run build           # build da API e do frontend
npm test                # testes do backend
npm run typecheck       # typecheck do backend
```

No backend:

```bash
npm run dev
npm run dev:api
npm run build:api
npm run build:frontend
npm run build
npm start
npm test
npm run typecheck
npm run lint
npm run update:results
```

O script `lint` está declarado, mas o manifesto não declara ESLint nem uma configuração ESLint. Em uma instalação limpa, trate esse comando como indisponível até que essa dependência/configuração seja adicionada.

### 7.4 Build e smoke test

```bash
cd backend && npm run build:api && npm start
```

Em outro terminal:

```bash
cd frontend && npm run build && npm start
```

Com a API em execução:

```bash
curl -i http://localhost:3000/health
curl -s http://localhost:3000/api/v1/openapi.json
curl -X POST http://localhost:3000/api/v1/games/generate-random \
  -H 'Content-Type: application/json' \
  -d '{"quantity":2,"numbersPerGame":15}'
```

## 8. API HTTP

As rotas de negócio principais são montadas sob `/api/v1`. As rotas legadas de histórico, concursos e jogos também ficam disponíveis sob `/api`, enquanto `/api/v1` é aceito para os mesmos routers quando indicado abaixo. O OpenAPI mínimo está em `GET /api/v1/openapi.json`.

### 8.1 Operação

| Método | Endpoint | Resultado |
|---|---|---|
| `GET` | `/health` | `{ "status": "ok" }`. Liveness. |
| `GET` | `/ready` | Status e checks estáticos de tabela de preços e catálogo de wheels. Não testa o arquivo histórico. |
| `GET` | `/metrics` | Exporter Prometheus com métricas HTTP, duração, processo e falhas de readiness. |
| `POST` | `/api/v1/admin/sync` | Endpoint administrativo protegido; retorna `404` enquanto `FEATURE_DATA_SYNC=false`, mesmo com autenticação válida. |
| `GET` | `/api/v1/openapi.json` | Documento OpenAPI definido em `infrastructure/http/openapi`. |

### 8.2 Geração e análise de jogos

| Método | Endpoint | Payload/query e comportamento |
|---|---|---|
| `POST` | `/api/v1/games/generate-random` | `{ quantity: 1..500, numbersPerGame: 15..20, unique?: boolean }`. `unique` padrão `true`. |
| `POST` | `/api/v1/games/generate-filtered` | Quantidade `1..100`, tamanho `15..20`, `fixedNumbers`, `excludedNumbers`, `filters` e `budget`. Pode retornar `206` quando parcial. |
| `POST` | `/api/v1/games/generate/ponderado` | Quantidade `1..100`, tamanho `15..20`, fixas/excluídas, estratégia `quentes`, `frias` ou `overdue` e filtros. Usa histórico local para os pesos. |
| `GET` | `/api/v1/games/filters` | Catálogo de filtros, domínios, valores esperados e observações. |
| `GET` | `/api/v1/games/patterns` | Catálogo de padrões e modelo de popularidade. |
| `POST` | `/api/v1/games/validate` | `{ game: number[] }`, com 15 a 20 dezenas únicas. Retorna normalização, custo, métricas e avisos. |
| `POST` | `/api/v1/games/analyze` | `{ games: number[][], page?: number, pageSize?: number }`. Retorna métricas, agregados, diversidade e paginação. |
| `POST` | `/api/v1/games/generate/variations` | `{ game: number[], count: number }`. Gera variações do jogo. |

Nas rotas de geração que aceitam `format`, a query pode ser `csv`, `txt`, `json`, `ndjson` ou `sql`. A resposta é um anexo de texto no formato escolhido, não o envelope JSON normal.

Exemplo:

```bash
curl -X POST http://localhost:3000/api/v1/games/generate-filtered \
  -H 'Content-Type: application/json' \
  -d '{
    "quantity": 5,
    "numbersPerGame": 15,
    "fixedNumbers": [1, 2],
    "excludedNumbers": [24, 25],
    "filters": {
      "evens": {"min": 6, "max": 8},
      "sum": {"min": 170, "max": 220},
      "maxConsecutiveRun": 5,
      "maxPopularityScore": 0.7
    },
    "budget": {"maxAttemptsPerGame": 5000, "maxTotalMs": 1000}
  }'
```

### 8.3 Expansão, conferência e exportação

| Método | Endpoint | Payload/query e comportamento |
|---|---|---|
| `POST` | `/api/v1/games/expand` | Expande `numbers`/`game` de 16 a 20 dezenas em jogos de 15. Rate limit pesado; JSON e NDJSON têm limites próprios definidos na rota. |
| `POST` | `/api/v1/games/check` | Confere `drawnNumbers` e até 500 jogos, retornando acertos e faixas. |
| `POST` | `/api/v1/games/check/lote` | Recebe texto (`text/plain`, `text/csv` ou NDJSON) e `drawnNumbers` na query; limite de corpo de 2 MB. O tipo multipart aparece no limite do Express, mas não existe parser de upload multipart. |
| `POST` | `/api/jogos/desdobrar` ou `/api/v1/jogos/desdobrar` | `{ dezenas?: number[], numbers?: number[], regras?: { targetSize?: number, filters?: object, limit?: number }, format?: 'json' \| 'ndjson' }`. Executa em worker. |
| `POST` | `/api/jogos/simular` ou `/api/v1/jogos/simular` | Aceita cartões em `cartoes`, `jogos`, `games` ou `dezenas`; opcionalmente `concursoInicio`, `concursoFim` ou `historicDraws`. Executa em worker. |
| `GET` | `/api/history?...&format=` | Exporta o histórico em CSV, TXT, JSON ou SQL. |

Os exports SQL são apenas texto gerado pelo servidor e não são executados pela API. Revise nomes de tabela, esquema e encoding antes de importar.

### 8.4 Carteira e fechamento

| Método | Endpoint | Payload e resultado |
|---|---|---|
| `POST` | `/api/v1/games/portfolio` | `{ quantity: 1..200, numbersPerGame: 15..20, constraints?: { maxOverlap?: 5..20, maxPopularityScore?: 0..1 }, budget?: { maxIterations, maxTotalMs } }`. Pode retornar `206`. |
| `POST` | `/api/v1/games/wheel` | Aceita 16 a 22 dezenas, mas o catálogo só atende `W(16,15,15)`, `W(17,15,15)` e `W(18,15,15)`. A expansão é completa e pré-computada no sentido de catálogo, sem resolução de sistemas adicionais sob demanda. |

A garantia do wheel é condicional: se as 15 dezenas sorteadas estiverem dentro das dezenas escolhidas, um bilhete terá pelo menos 15 acertos. Isso não aumenta a chance de as dezenas escolhidas conterem o sorteio.

### 8.5 Ferramentas informacionais

| Método | Endpoint | Resultado |
|---|---|---|
| `POST` | `/api/v1/tools/expected-value` | Separa prêmios fixos e a parte condicional de 14/15 acertos conforme as premissas enviadas. |
| `POST` | `/api/v1/tools/bankroll-check` | Projeta apostas, gasto e perda esperada a partir de orçamento mensal e horizonte. |
| `POST` | `/api/v1/tools/simulate-historical` | Simula uma combinação contra os resultados do arquivo local. Não é previsão. |
| `POST` | `/api/v1/tools/backtest` | Executa backtest histórico conforme o payload da rota; é protegido pelo rate limit pesado. |
| `GET` | `/api/v1/tabela-precos` | Retorna a versão, custo e prêmios fixos informativos. |
| `GET` | `/api/v1/comparison` | Retorna comparação informativa com Mega-Sena; não gera jogos de outra modalidade. |

### 8.6 Histórico, concursos e estatísticas

| Método | Endpoint | Parâmetros |
|---|---|---|
| `GET` | `/api/history` ou `/api/v1/history` | `dataInicio`, `dataFim`, `concurso`, `concursoMin`, `concursoMax`, `page`, `limit`, `order` (`asc`/`desc`) e `format`. `limit` efetivo máximo: 500. |
| `GET` | `/api/concursos/latest` ou `/api/v1/concursos/latest` | Último concurso, análise, atrasos, ciclo e frequências a partir do cache estatístico. |
| `GET` | `/api/v1/stats/atrasos` | Atraso atual, médio e maior atraso por dezena. |
| `GET` | `/api/v1/stats/temperatura?janela=10\|20\|50` | Frequência por dezena na janela solicitada. |
| `GET` | `/api/v1/stats/composicao` | Médias e distribuições históricas de composição. |
| `GET` | `/api/v1/stats/ciclos` | Ciclo atual, dezenas faltantes e últimos ciclos completos. |
| `GET` | `/api/v1/stats/seasonal?month=1..12` | Frequência por dezena no mês solicitado. |
| `POST` | `/api/v1/stats/generate/ciclo` ou `/api/v1/games/generate/ciclo` | Gera jogos incluindo as dezenas faltantes do ciclo atual; quantidade `1..100`, tamanho `15..20`. |

### 8.7 Preço e unidades monetárias

A tabela estática declara preço de `350` centavos por aposta simples e prêmios fixos informativos de `700`, `1.400` e `3.500` centavos para 11, 12 e 13 acertos. O custo de um jogo com `k` dezenas é `C(k,15) × 350` centavos. As faixas de 14 e 15 dependem de rateio e não são um valor fixo na tabela.

### 8.8 Formato de erro

Um erro de validação segue o formato Problem Details, com campos como `type`, `title`, `status`, `detail`, `instance`, `requestId` e `invalidParams`. A resposta real deve ser considerada a fonte final do contrato, pois os detalhes variam por rota.

## 9. Regras e algoritmos

- **Universo:** dezenas inteiras de 1 a 25; cada jogo tem 15 a 20 dezenas únicas.
- **Aleatoriedade:** `CryptoRandomSource` usa `crypto.randomInt`; não há `Math.random()` na geração principal.
- **Pares e ímpares:** contagem por divisibilidade por 2.
- **Primos e Fibonacci:** conjuntos fixos no arquivo `constants.ts`; são classificações de composição.
- **Moldura e miolo:** contagens baseadas no volante 5×5.
- **Soma:** intervalo inclusivo aplicado à soma das dezenas.
- **Sequência:** maior corrida de inteiros consecutivos após ordenar o jogo.
- **Repetição:** interseção com `previousDraw` informado pelo cliente.
- **Popularidade:** score heurístico limitado a 0–1, com confiança declarada como heurística; não foi validado contra uma base de apostas reais.
- **Filtros combinados:** `FilterEngine.checkFeasibility` calcula envelopes simples. Ele não prova a viabilidade global de todas as combinações de filtros; por isso, uma requisição pode terminar parcial ou sem resultado dentro do orçamento.
- **Expansão:** para jogos de 15, `C(16,15)=16`, `C(17,15)=136`, `C(18,15)=816`, `C(19,15)=3.876` e `C(20,15)=15.504` combinações.
- **Diversidade:** mede overlap, Jaccard, cobertura de dezenas e Gini. Descreve o lote e não altera seu valor esperado.
- **Valor esperado:** prêmios fixos são separados dos prêmios condicionais. Sem premissas de rateio para 14/15, a parcela condicional não pode ser estimada pelo serviço.

## 10. Frontend

O frontend usa Next.js App Router, React client components onde há estado e o cliente central em `frontend/src/lib/api.ts`. `SWR` é usado no resumo do último concurso; desdobramento e simulação usam os hooks locais `useDesdobrar` e `useSimular`. Respostas principais de geração e histórico são validadas com Zod; várias operações avançadas ainda expõem tipos `unknown` ao cliente.

### 10.1 Páginas presentes

| Rota | Função efetiva |
|---|---|
| `/` | Geração aleatória, validação/análise do lote e armazenamento da sessão validada. |
| `/filtros` | Configuração de geração filtrada e catálogo de filtros. |
| `/analisar` | Análise de jogos guardados na sessão. |
| `/estatisticas` | Visualização de histórico, atrasos, temperatura, ciclos, composição e sazonalidade. |
| `/montar` | Montagem/desdobramento e simulação por meio das rotas de jogos. |
| `/meus-jogos` | Jogos guardados em `localStorage`; não há conta ou sincronização. |
| `/history` | Consulta paginada do histórico. |
| `/conferir` | Conferência de jogos e lotes contra dezenas informadas. |
| `/imprimir` | Impressão/PDF do lote guardado na sessão; não registra aposta. |
| `/ajuda` | Explicações de uso e jogo responsável. |
| `/bolao` | Página de interface local; não cria bolão colaborativo nem envia dados. |
| `/notificacoes` | Preferência local de lembrete; não envia push nem notificação real. |

A navegação principal mostra gerar, filtros, analisar, estatísticas, montar, meus jogos, histórico e ajuda. As páginas de conferir, imprimir, bolão e notificações existem no App Router, mas não são todas links da navegação principal.

### 10.2 Armazenamento no navegador

- `sessionStorage['lotzy:validated-games']`: lote validado, análise e disclaimer usados entre geração, análise, estatísticas e impressão.
- `localStorage['lotzy:meus-jogos']`: jogos salvos pelo usuário no dispositivo.
- `localStorage['lotzy:lembrete']` e `localStorage['lotzy:lembrete-hora']`: preferência e horário do lembrete local.

Não há sincronização, login, persistência no backend ou envio automático desses dados.

## 11. Dados históricos

`db/resultados.json` contém um objeto com a chave `Todos os Resultados`. O primeiro item é tratado como cabeçalho; cada linha seguinte deve conter concurso, data e 15 dezenas. O parser aceita datas `DD/MM/YYYY` e datas ISO, normalizando-as para `YYYY-MM-DD`.

Na cópia analisada, há **3.782 concursos**, do concurso `1` (`29/09/2003`) ao concurso `3782` (`17/09/2026`). Esses números descrevem o arquivo presente no commit analisado; o sistema não verifica automaticamente se ele é a fonte oficial mais recente.

`loadResults()` relê o arquivo em cada chamada. `appendResult()` impede concurso duplicado, ordena as linhas e grava por arquivo temporário seguido de rename. `backend/src/scripts/update-results.ts` é o mecanismo manual de atualização; não existe endpoint público para essa operação.

## 12. Testes e validação

A suíte backend usa Vitest e Supertest. Os arquivos cobrem:

- liveness, request id, geração aleatória, filtros e respostas de validação;
- geração ponderada e filtros inviáveis/parciais;
- normalização, paginação, intervalo e ordenação do histórico;
- propriedades de `GameGenerator`, `FilterEngine`, `PopularityScorer` e `CombinationExpander`;
- estatísticas, ciclos, simulação histórica, exportação e conferência textual;
- recursos da fase v6, incluindo desdobramento, simulação, wheels e carteiras.

Não há suíte automatizada de componentes do frontend, acessibilidade, navegador ou contrato frontend/backend completo. Antes de abrir uma alteração, execute:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run typecheck
npm test
npm run build
```

O resultado dos comandos deve ser revalidado no ambiente atual; esta documentação não fixa um resultado de pipeline que possa ficar obsoleto.

## 13. Limitações e riscos conhecidos

1. **Dados locais:** o histórico é um JSON versionado e não tem ingestão automática, checksum, revisão ou garantia de atualização.
2. **Escala:** leitura do arquivo, expansão combinatória, simulação e geração sob restrições podem consumir CPU, memória e tempo.
3. **Rate limit local:** limites não são compartilhados entre réplicas e não substituem autenticação.
4. **Autenticação ausente:** `API_KEYS` não é usada; quem alcança a porta pode chamar as rotas.
5. **Métricas mínimas:** `/metrics` retorna uma métrica estática, não contadores, histogramas ou métricas de negócio.
6. **Popularidade heurística:** o score é uma aproximação de comportamento de apostadores, não um modelo do sorteio.
7. **Prêmios:** valores de 14 e 15 acertos dependem de rateio e não podem ser determinados só pela tabela estática.
8. **Workers:** pools têm tamanho fixo de dois workers por operação; não há fila persistente nem distribuição entre processos.
9. **Frontend local:** meus jogos, lembretes, impressão e bolão não são serviços de conta, colaboração ou notificação.
10. **Lint:** o script existe, mas ESLint não está declarado/configurado no manifesto do backend.
11. **Contratos:** parte do cliente usa `unknown` e não há teste de contrato automático para todas as rotas.
12. **Upload:** `multipart/form-data` aparece entre os tipos aceitos pelo limite textual de `/games/check/lote`, mas não há fluxo de upload multipart implementado.
13. **Licença:** não há arquivo de licença na raiz.

## 14. Operação e solução de problemas

### API não inicia

Confirme Node.js 20+, a porta definida em `PORT`, a existência de `db/resultados.json` e a execução a partir da raiz ou de `backend/`. O processo encerra em erro de bind e registra o código no console.

### Frontend não acessa a API

Confirme a API em `localhost:3000`, o frontend em `localhost:3001` e `NEXT_PUBLIC_API_URL` no build do frontend. Em produção, defina `CORS_ORIGINS` explicitamente. Verifique o console do navegador e o `X-Request-Id` da resposta.

### Resposta `422` ao gerar com filtros

Leia `detail`, `invalidParams` e `violations`. Reduza restrições ou aumente `maxAttemptsPerGame`/`maxTotalMs` dentro dos limites aceitos. Um envelope matematicamente impossível é rejeitado antes da amostragem; um filtro possível pode ainda não produzir a quantidade solicitada dentro do orçamento.

### Resposta `206`

A API produziu pelo menos um jogo, mas não atingiu a quantidade dentro do orçamento. Use `meta.partial`, `attempts`, `acceptanceRate`, `rejectionsByConstraint` ou `targetMet` para diagnosticar.

### Histórico retorna `404`

O processo não encontrou `db/resultados.json` nos caminhos suportados. Confira o diretório de execução e a chave `Todos os Resultados` no JSON.

### Desdobramento ou simulação expira

As tarefas pesadas têm timeout de worker. Reduza a quantidade de combinações/cartões ou use `format: "ndjson"` quando a rota permitir. A expansão de 20 dezenas em jogos de 15 cria 15.504 combinações.

## 15. Contribuição

Mantenha mudanças de regras matemáticas acompanhadas de testes determinísticos. Alterações de endpoint devem atualizar o código de OpenAPI, os testes e esta documentação. Não documente filtros ou métricas como previsão ou aumento de probabilidade.

Checklist recomendado:

- [ ] typecheck, testes e build executados;
- [ ] limites de entrada e custo computacional revisados;
- [ ] contratos e exports atualizados;
- [ ] frontend e backend continuam usando as mesmas rotas;
- [ ] nenhum segredo ou arquivo `.env` foi versionado;
- [ ] dados históricos foram revisados antes de qualquer atualização manual;
- [ ] mensagens preservam o aviso de jogo responsável;
- [ ] README não duplica especificações removidas.

## 16. Licença e referências

Não há arquivo de licença na raiz desta branch. A licença, redistribuição e política de contribuição devem ser definidas pelo mantenedor antes de distribuir o projeto como software.

Referências técnicas usadas pelo código:

- [Node.js Crypto](https://nodejs.org/api/crypto.html)
- [Express](https://expressjs.com/)
- [Zod](https://zod.dev/)
- [Next.js](https://nextjs.org/docs)
- [Vitest](https://vitest.dev/guide/)
- [Mermaid](https://mermaid.js.org/intro/)
- [Ministério da Saúde — jogo patológico](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/j/jogo-patologico)

Este README é a fonte de documentação versionada da branch `feature/v6`; os detalhes devem ser confirmados no código e nos testes quando houver mudança de implementação.
