# Lotzy — gerador e analisador de jogos da Lotofácil

[![Backend](https://img.shields.io/badge/backend-Node.js%2020%2B-339933?logo=node.js&logoColor=white)](./backend)
[![API](https://img.shields.io/badge/API-Express%205-000000?logo=express&logoColor=white)](./backend)
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2015-000000?logo=next.js&logoColor=white)](./frontend)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Testes](https://img.shields.io/badge/testes-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

O **Lotzy** é uma aplicação web para geração, validação, análise, desdobramento, conferência e estudo informacional de jogos da Lotofácil. O projeto é organizado como um monorepo simples, com uma API HTTP stateless em Node.js/TypeScript e uma interface web em Next.js/React.

A aplicação foi desenhada para **organizar combinações e apresentar seus custos e limitações com transparência**. Ela não prevê resultados, não identifica dezenas “mais prováveis” e não aumenta a probabilidade de premiação.

> **Jogo responsável:** todas as combinações válidas de 15 dezenas possuem a mesma probabilidade matemática. Filtros, diversificação, score de popularidade e fechamentos alteram a composição dos jogos ou a forma de apresentar o risco; não alteram a probabilidade de cada combinação. Aposte somente o que puder perder e consulte [informações de jogo responsável](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/j/jogo-patologico).

## Sumário

- [Visão geral](#visão-geral)
- [O que existe hoje](#o-que-existe-hoje)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Instalação e execução](#instalação-e-execução)
- [API HTTP](#api-http)
- [Banco de dados e histórico](#banco-de-dados-e-histórico)
- [Frontend](#frontend)
- [Regras matemáticas e de produto](#regras-matemáticas-e-de-produto)
- [Qualidade, segurança e limites](#qualidade-segurança-e-limites)
- [Solução de problemas](#solução-de-problemas)
- [Como contribuir](#como-contribuir)
- [Licença](#licença)
- [Contato](#contato)

## Visão geral

O projeto possui três partes principais:

1. **Backend:** API Express que gera combinações usando uma fonte criptograficamente segura de aleatoriedade, valida entradas, calcula métricas, aplica filtros, expande combinações e oferece ferramentas informacionais.
2. **Frontend:** aplicação Next.js com React 19 que consome a API, exibe jogos, permite validação e análise e apresenta uma interface visual baseada em um volante 5×5.
3. **Dados históricos:** arquivo JSON versionado em `db/resultados.json`, contendo resultados históricos em formato tabular. O arquivo está disponível para uso futuro, mas **não é carregado automaticamente pela API atual**, que permanece stateless e recebe resultados históricos por requisição.

O projeto não usa atualmente PostgreSQL, MySQL, MongoDB ou outro banco de dados servidor. Portanto, não há migração, conexão, usuário de banco ou serviço externo obrigatório para executar a versão atual.

## O que existe hoje

### Funcionalidades da API

- Geração de jogos aleatórios com 15 a 20 dezenas.
- Geração filtrada com dezenas fixas, dezenas excluídas e limites de composição.
- Pré-checagem de viabilidade de filtros antes de iniciar tentativas aleatórias.
- Validação e normalização de um jogo.
- Análise de jogos individuais e de lotes.
- Métricas de pares, primos, Fibonacci, moldura, miolo, soma e sequência consecutiva.
- Score heurístico de padrões potencialmente populares entre apostadores.
- Análise de diversidade, sobreposição e cobertura de uma carteira.
- Desdobramento de 16 a 20 dezenas em apostas simples de 15 dezenas.
- Conferência de jogos contra um resultado informado pelo cliente.
- Consulta de um sistema de fechamento pré-computado `W(16,15,15)`.
- Cálculo informacional de valor esperado e projeção de orçamento.
- Backtest stateless de uma estratégia contra resultados fornecidos na requisição.
- Endpoints operacionais `/health`, `/ready`, `/metrics` e OpenAPI em `/api/v1/openapi.json`.

### Funcionalidades do frontend

A aplicação Next.js possui as seguintes rotas:

| Rota | Finalidade |
|---|---|
| `/` | Gerar jogos aleatórios e exibir o lote, o custo e o aviso de transparência. |
| `/filtros` | Consultar o catálogo de filtros disponibilizado pela API. |
| `/validar` | Enviar um jogo para validação e visualizar métricas e avisos. |
| `/analisar` | Analisar um conjunto de jogos e suas métricas de diversidade. |
| `/conferir` | Conferir jogos contra as 15 dezenas de um resultado informado. |
| `/ferramentas` | Usar a projeção informacional de orçamento. |
| `/carteira` | Área preparada para fluxos de carteira e diversificação. |

## Arquitetura

A API segue uma separação em camadas, com o domínio isolado da infraestrutura HTTP:

```text
Cliente HTTP
    │
    ▼
Express 5
    │  request id, Helmet, CORS, limite de corpo e rate limit
    ▼
Rotas + validação Zod
    │
    ▼
Serviços de aplicação/domínio
    │  geração, filtros, métricas, popularidade, diversidade e combinatória
    ▼
Adaptadores
    │  CSPRNG, tabela de preços e configuração
    ▼
Resposta JSON ou application/problem+json
```

O gerador não usa `Math.random()`. A implementação usa `crypto.randomInt` por meio de `CryptoRandomSource` e um embaralhamento parcial de Fisher–Yates. Os jogos retornados são ordenados, não possuem dezenas repetidas e respeitam o tamanho solicitado.

A API não mantém estado de usuário em memória e não persiste jogos gerados. Isso permite executar múltiplas instâncias, desde que o rate limit utilizado em produção seja colocado atrás de um mecanismo compartilhado, como Redis, quando necessário.

## Tecnologias

| Camada | Tecnologia | Uso |
|---|---|---|
| Backend | Node.js 20 ou superior | Runtime da API. |
| Backend | TypeScript 5.x com `strict` | Tipagem estática e contratos do domínio. |
| Backend | Express 5 | Servidor HTTP e roteamento. |
| Backend | Zod 4 | Validação de payloads e configuração. |
| Backend | Helmet | Cabeçalhos de segurança. |
| Backend | CORS | Controle de origens permitidas. |
| Backend | `express-rate-limit` | Limitação de requisições. |
| Backend | `pino-http` / `prom-client` | Dependências destinadas a logging e métricas. |
| Testes | Vitest | Testes unitários e de integração. |
| Testes | Supertest | Testes HTTP da API. |
| Frontend | Next.js 15 | Aplicação web e App Router. |
| Frontend | React 19 | Componentes e interação. |
| Frontend | TypeScript strict | Tipagem do cliente. |
| Frontend | Zod 4 | Validação da resposta principal da API. |
| Dados | JSON versionado | Armazenamento local dos resultados históricos. |

## Estrutura do repositório

```text
app-lotzy/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── app.ts                         # composição do Express
│   │   ├── server.ts                       # inicialização HTTP
│   │   ├── domain/games/
│   │   │   ├── constants.ts                # universo e combinatória
│   │   │   ├── types.ts                    # tipos do domínio
│   │   │   ├── ports/RandomSource.ts       # porta de aleatoriedade
│   │   │   └── services/
│   │   │       ├── GameGenerator.ts
│   │   │       ├── FilterEngine.ts
│   │   │       ├── GameAnalyzer.ts
│   │   │       ├── PopularityScorer.ts
│   │   │       ├── DiversityAnalyzer.ts
│   │   │       ├── CombinationExpander.ts
│   │   │       └── ExpectedValueCalculator.ts
│   │   ├── infrastructure/
│   │   │   ├── http/routes/                # rotas da API
│   │   │   ├── http/middlewares/            # tratamento de erros
│   │   │   ├── http/openapi/                # documento OpenAPI
│   │   │   ├── pricing/                     # preços versionados
│   │   │   └── random/                      # CSPRNG
│   │   └── shared/
│   │       ├── config/env.ts               # configuração validada
│   │       └── errors/AppError.ts
│   └── test/
│       ├── api.test.ts
│       └── domain.test.ts
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/                            # páginas do App Router
│       ├── components/PlayslipGrid.tsx     # volante 5×5
│       └── lib/api.ts                       # cliente HTTP e schemas
├── db/
│   └── resultados.json                     # histórico em formato JSON
├── plan/
│   ├── SSD-lotofacil-api-2.md              # especificação do backend
│   └── SSD-lotzy-frontend.md               # especificação do frontend
├── .env.example
└── README.md
```

## Pré-requisitos

Para executar o projeto localmente, instale:

- **Node.js 20 LTS ou superior**;
- **npm 10 ou superior**;
- Git, para clonar o repositório;
- `curl` ou outra ferramenta HTTP, opcionalmente, para testar a API pelo terminal.

Não é necessário instalar banco de dados, Docker ou credenciais de serviços externos para o fluxo local atual.

## Configuração

### Backend

A configuração é lida pelo arquivo `backend/src/shared/config/env.ts`. Para começar, copie o arquivo de exemplo:

```bash
cp .env.example .env
```

O backend deve ser iniciado a partir da pasta `backend/`, pois o `package.json` e os scripts da API estão nessa pasta.

| Variável | Padrão | Descrição |
|---|---:|---|
| `NODE_ENV` | `development` | Ambiente aceito: `development`, `test` ou `production`. |
| `PORT` | `3000` | Porta HTTP da API. |
| `CORS_ORIGINS` | vazio | Origens separadas por vírgulas. Em produção, informe explicitamente as origens autorizadas. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Duração da janela do rate limit em milissegundos. |
| `RATE_LIMIT_MAX` | `100` | Limite padrão de requisições por janela. |
| `RESPONSIBLE_GAMBLING_URL` | URL do gov.br | Link retornado junto às respostas de geração. |
| `PRICE_TABLE_VERSION` | `2024-11-04` | Versão da tabela de preços em centavos. |
| `WHEEL_CATALOG_VERSION` | `wheels-2026-09` | Versão do catálogo de fechamentos. |
| `POPULARITY_MODEL_VERSION` | `popularity-2026-09` | Versão do catálogo heurístico de padrões. |
| `API_KEYS` | vazio | Conjunto reservado para proteção futura por chave de API. |

O `.env.example` também contém `LOG_LEVEL=info`. Essa variável é mantida como referência de configuração, mas não é utilizada pelo schema atual de `env.ts`.

> Nunca versione `.env`, tokens, chaves ou credenciais. Em produção, use HTTPS, origens CORS explícitas e um rate limiter compartilhado se houver mais de uma réplica.

### Frontend

O frontend usa `NEXT_PUBLIC_API_URL`. Crie `frontend/.env.local` quando a API não estiver no endereço padrão:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Como a variável começa com `NEXT_PUBLIC_`, ela pode ser incorporada ao bundle do navegador. Ela deve conter somente uma URL pública da API, nunca uma chave secreta.

## Instalação e execução

### 1. Clonar o projeto

```bash
git clone https://github.com/barrosrafa/app-lotzy.git
cd app-lotzy
```

### 2. Instalar e testar o backend

```bash
cd backend
npm ci
npm run typecheck
npm test
```

### 3. Iniciar a API em desenvolvimento

Em um terminal, dentro de `backend/`:

```bash
npm run dev
```

A API ficará disponível em:

```text
http://localhost:3000
```

O servidor de desenvolvimento usa `tsx watch` e reinicia quando os arquivos TypeScript são alterados.

### 4. Instalar e iniciar o frontend

Em outro terminal, a partir da raiz do projeto:

```bash
cd frontend
npm ci
npm run dev
```

O frontend ficará disponível em:

```text
http://localhost:3001
```

O frontend já aponta, por padrão, para `http://localhost:3000/api/v1`. Se a API estiver em outra porta, defina `NEXT_PUBLIC_API_URL` em `frontend/.env.local`.

### 5. Executar versões compiladas

Backend:

```bash
cd backend
npm run build:api
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm start
```

O comando `npm run build` existente no `backend/package.json` compila a API e executa o build do frontend com `npm --prefix ../frontend run build`. Para execução independente, os comandos acima são mais explícitos.

## API HTTP

### Convenções gerais

A base versionada dos endpoints de negócio é:

```text
http://localhost:3000/api/v1
```

As respostas incluem `X-Request-Id`. O cliente pode enviar esse cabeçalho para facilitar correlação de logs:

```bash
curl http://localhost:3000/health \
  -H 'X-Request-Id: exemplo-local-001'
```

Payloads JSON inválidos semanticamente retornam `422` com `Content-Type: application/problem+json`. Um exemplo de erro:

```json
{
  "type": "https://api.lotofacil.internal/errors/validation-failed",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Um ou mais campos do payload são inválidos.",
  "instance": "/api/v1/games/generate-random",
  "requestId": "exemplo-local-001",
  "invalidParams": [
    {
      "name": "quantity",
      "reason": "Too small: expected number to be >=1"
    }
  ]
}
```

### Endpoints operacionais

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica se o processo está vivo. Retorna `{ "status": "ok" }`. |
| `GET` | `/ready` | Verifica dependências estáticas, como tabela de preços e catálogo de wheels. |
| `GET` | `/metrics` | Expõe uma métrica Prometheus mínima em texto. |
| `GET` | `/api/v1/openapi.json` | Publica o contrato OpenAPI 3.1 gerado pela aplicação. |

### Geração aleatória

#### `POST /api/v1/games/generate-random`

Gera de 1 a 500 jogos com 15 a 20 dezenas. O campo `unique` evita jogos duplicados dentro do lote.

```bash
curl -X POST http://localhost:3000/api/v1/games/generate-random \
  -H 'Content-Type: application/json' \
  -d '{
    "quantity": 2,
    "numbersPerGame": 15,
    "unique": true
  }'
```

Exemplo de resposta resumida:

```json
{
  "status": "success",
  "meta": {
    "requestId": "...",
    "generatedQuantity": 2,
    "numbersPerGame": 15,
    "priceTableVersion": "2024-11-04"
  },
  "data": [
    { "game": [1, 3, 4, 5, 7, 8, 10, 12, 14, 16, 18, 19, 21, 23, 25] }
  ],
  "cost": {
    "simpleBets": 1,
    "totalCents": 350,
    "formatted": "R$ 3,50"
  },
  "expectedValue": {
    "fixedTiersCents": 90,
    "note": "Parcela determinística. Faixas 14 e 15 requerem premissas."
  },
  "disclaimer": "Nenhuma combinação tem probabilidade superior a outra...",
  "responsibleGamblingUrl": "https://www.gov.br/..."
}
```

> **Atenção ao contrato atual:** `cost` representa o custo de um jogo de determinado tamanho, mesmo quando o lote contém vários jogos. O frontend atual multiplica `totalCents` e `simpleBets` por `meta.generatedQuantity` apenas para a apresentação do lote. Essa compensação é temporária e deve ser removida quando o contrato da API passar a retornar o custo total do lote.

#### `POST /api/v1/games/generate-filtered`

Gera de 1 a 100 jogos respeitando restrições. Antes de tentar gerar, a API verifica se os filtros são matematicamente viáveis.

```json
{
  "quantity": 3,
  "numbersPerGame": 15,
  "fixedNumbers": [2, 10],
  "excludedNumbers": [1, 25],
  "filters": {
    "evens": { "min": 6, "max": 8 },
    "primes": { "min": 4, "max": 6 },
    "sum": { "min": 170, "max": 220 },
    "maxConsecutiveRun": 5,
    "maxPopularityScore": 0.3,
    "maxOverlapWithBatch": 11,
    "repeatsFromPrevious": {
      "previousDraw": [2, 3, 5, 8, 9, 11, 13, 14, 16, 18, 19, 21, 22, 24, 25],
      "min": 8,
      "max": 10
    }
  },
  "budget": {
    "maxAttemptsPerGame": 5000,
    "maxTotalMs": 1000
  }
}
```

Os filtros aceitos são `evens`, `primes`, `fibonacci`, `sum`, `frame`, `maxConsecutiveRun`, `maxPopularityScore`, `maxOverlapWithBatch` e `repeatsFromPrevious`. Cada intervalo pode receber `min`, `max` ou ambos.

- `200`: quantidade solicitada foi gerada.
- `206`: houve geração parcial dentro do orçamento de tentativas ou tempo.
- `422`: filtros inviáveis ou orçamento esgotado sem gerar nenhum jogo.

### Catálogos e validação

| Método | Rota | Corpo ou retorno |
|---|---|---|
| `GET` | `/api/v1/games/filters` | Catálogo de filtros, domínio, expectativa, cobertura a priori e natureza do filtro. |
| `GET` | `/api/v1/games/patterns` | Catálogo do score heurístico, seus pesos, versão e ganho estimado de ordem de grandeza. |
| `POST` | `/api/v1/games/validate` | `{ "game": [1, 2, ..., 15] }`; normaliza, calcula métricas, custo e avisos. |
| `POST` | `/api/v1/games/analyze` | `{ "games": [[...]], "page": 1, "pageSize": 100 }`; retorna métricas agregadas e diversidade. |

Exemplo de validação:

```bash
curl -X POST http://localhost:3000/api/v1/games/validate \
  -H 'Content-Type: application/json' \
  -d '{"game":[15,1,2,3,4,5,6,7,8,9,10,11,12,13,14]}'
```

A resposta informa `normalizedGame`, `equivalentSimpleBets`, `cost`, `metrics` e `warnings`. Avisos como soma fora da faixa típica ou score de popularidade alto são informacionais; não significam que o jogo seja inválido.

### Desdobramento e conferência

#### `POST /api/v1/games/expand`

Expande de 16 a 20 dezenas em todas as combinações de 15 dezenas.

```json
{
  "numbers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  "format": "ndjson"
}
```

O número de apostas é `C(n, 15)`. Para 20 dezenas, o resultado chega a 15.504 combinações. Use `format: "ndjson"` para expansões grandes. JSON único acima de 1.000 combinações retorna `406 UNSUPPORTED_RESPONSE_SIZE`.

#### `POST /api/v1/games/check`

Confere de 1 a 500 jogos contra um resultado informado pelo cliente.

```json
{
  "drawnNumbers": [2, 3, 5, 8, 9, 11, 13, 14, 16, 18, 19, 21, 22, 24, 25],
  "games": [
    [1, 2, 3, 5, 8, 9, 11, 13, 14, 16, 19, 21, 22, 24, 25]
  ]
}
```

A resposta classifica cada jogo em `ELEVEN`, `TWELVE`, `THIRTEEN`, `FOURTEEN`, `FIFTEEN` ou `NONE`. Os prêmios de 11, 12 e 13 acertos são tratados como valores fixos da tabela configurada. As faixas de 14 e 15 acertos são pari-mutuel e não recebem valor inventado pela API.

### Carteira e fechamento

#### `POST /api/v1/games/portfolio`

Gera até 200 jogos buscando respeitar `maxOverlap` e `maxPopularityScore`, com limites explícitos de iterações e tempo.

```json
{
  "quantity": 10,
  "numbersPerGame": 15,
  "constraints": {
    "maxOverlap": 11,
    "maxPopularityScore": 0.5
  },
  "budget": {
    "maxIterations": 50000,
    "maxTotalMs": 500
  }
}
```

Retorna `200` quando a meta é atingida e `206` quando entrega uma carteira parcial ou não alcança integralmente a restrição de sobreposição.

#### `POST /api/v1/games/wheel`

Consulta o catálogo de fechamento pré-computado. A implementação atual disponibiliza somente `W(16,15,15)`:

```json
{
  "numbers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  "guarantee": {
    "ifDrawn": 15,
    "atLeast": 15
  }
}
```

O sistema retorna 16 bilhetes, custo, limite inferior de Schönheim, versão do catálogo e a garantia condicional. A garantia somente se aplica quando todas as 15 dezenas sorteadas estão entre as 16 escolhidas; ela não aumenta a probabilidade de esse evento ocorrer.

### Ferramentas informacionais

| Método | Rota | Entrada principal | Finalidade |
|---|---|---|---|
| `POST` | `/api/v1/tools/expected-value` | `games` e, opcionalmente, premissas de rateio | Separa a parcela determinística da parcela condicional do valor esperado. |
| `POST` | `/api/v1/tools/bankroll-check` | `monthlyBudgetCents`, `betCostCents`, `horizonMonths` | Projeta gasto, retorno esperado e perda esperada. Não é recomendação financeira. |
| `POST` | `/api/v1/tools/backtest` | `historicDraws` e, opcionalmente, `strategy.games` | Compara acertos observados com uma linha de base e informa o poder estatístico da amostra. |

Exemplo de projeção de orçamento:

```bash
curl -X POST http://localhost:3000/api/v1/tools/bankroll-check \
  -H 'Content-Type: application/json' \
  -d '{
    "monthlyBudgetCents": 3500,
    "betCostCents": 350,
    "horizonMonths": 3
  }'
```

O backtest sempre inclui `statisticalPower`. Pequenos históricos não são evidência suficiente para afirmar que uma estratégia altera a probabilidade de faixas raras.

## Banco de dados e histórico

### Arquivo disponível

`db/resultados.json` contém uma chave `Todos os Resultados`. O primeiro elemento é o cabeçalho e os demais são linhas com:

| Posição | Campo | Exemplo |
|---:|---|---|
| 0 | Concurso | `1` |
| 1 | Data | `29/09/2003` |
| 2 a 16 | D. 1 a D. 15 | Dezenas sorteadas de 1 a 25 |

No estado atual do repositório, o arquivo contém **3.782 concursos**, do concurso 1 ao concurso 3782, com datas que vão de 29/09/2003 a 17/09/2026 conforme o conteúdo versionado no arquivo.

### Leitura local

O JSON pode ser lido com Node.js:

```bash
node - <<'NODE'
const fs = require('node:fs');
const json = JSON.parse(fs.readFileSync('db/resultados.json', 'utf8'));
const rows = json['Todos os Resultados'];
const [header, ...draws] = rows;
console.log({ header, totalConcursos: draws.length, primeiro: draws[0], ultimo: draws.at(-1) });
NODE
```

### Limites atuais do histórico

O arquivo funciona como um artefato local versionado. Ele não é um banco de dados relacional, não possui migrações e não é consultado pelas rotas atuais. A API recebe `drawnNumbers` e `historicDraws` diretamente no corpo das requisições. Também não há integração implementada com a API oficial da Caixa nem um job de sincronização automática.

Se o projeto passar a persistir ou atualizar o histórico em produção, a implementação deverá definir previamente:

- fonte oficial e política de atualização;
- normalização de datas e dezenas;
- chave única por concurso;
- validação de concursos incompletos ou corrigidos;
- estratégia de cache e paginação;
- trilha de auditoria da origem dos dados.

## Frontend

O frontend é uma aplicação Next.js 15 com App Router, React 19 e TypeScript strict. O cliente HTTP fica em `frontend/src/lib/api.ts` e usa `fetch` para acessar a API.

O frontend:

- valida a resposta principal de geração com Zod;
- preserva o `X-Request-Id` na mensagem de erro;
- mostra respostas `206` como resultados parciais;
- mantém dinheiro em centavos até a formatação com `Intl.NumberFormat`;
- exibe o disclaimer recebido pela API;
- usa um volante 5×5 com estados visuais e textuais;
- não deve transformar `popularityScore` em previsão de sorteio;
- não deve embutir segredos no bundle do navegador.

A URL da API pode ser alterada sem recompilar o código-fonte:

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Para verificar a integração manualmente:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/v1/games/filters
curl -s -X POST http://localhost:3000/api/v1/games/generate-random \
  -H 'Content-Type: application/json' \
  -d '{"quantity":5,"numbersPerGame":15}'
```

## Regras matemáticas e de produto

O universo de uma aposta da Lotofácil é formado por 25 dezenas. Uma aposta simples escolhe 15 dezenas. Quando o jogo contém mais dezenas, o número de apostas simples equivalentes é:

```text
apostas simples = C(números escolhidos, 15)
```

| Dezenas escolhidas | Apostas simples equivalentes |
|---:|---:|
| 15 | 1 |
| 16 | 16 |
| 17 | 136 |
| 18 | 816 |
| 19 | 3.876 |
| 20 | 15.504 |

O código mantém os valores monetários em centavos. A tabela de preço é versionada em `backend/src/infrastructure/pricing/StaticPriceTable.ts` e a API calcula o custo com base no tamanho do jogo.

### Interpretação do score de popularidade

`popularityScore` é uma heurística que representa padrões visuais ou culturais que podem ser escolhidos por muitas pessoas, como sequências, linhas, colunas, diagonais, múltiplos de cinco, espelhamentos e datas. O score:

- não modela o mecanismo do sorteio;
- não é uma previsão;
- não altera a probabilidade de acerto;
- pode ser usado apenas como uma hipótese de redução de rateio nas faixas pari-mutuel;
- deve ser apresentado junto de sua natureza `heuristic` e de uma magnitude estimada, não como promessa de ganho.

### Transparência sobre filtros

Filtros como pares, primos, soma e Fibonacci descrevem subconjuntos do universo. A cobertura a priori de um filtro não é uma descoberta de padrão histórico e não constitui recomendação de aposta. O frontend deve usar o catálogo devolvido por `GET /games/filters`, em vez de inventar rótulos como “faixa ideal”.

## Qualidade, segurança e limites

### Testes disponíveis

No backend:

```bash
npm run typecheck
npm test
```

A suíte cobre, entre outros pontos:

- geração de 15 a 20 dezenas;
- unicidade e ordenação;
- pré-checagem de inviabilidade de filtros;
- caso em que não há dezenas livres após as fixas;
- score limitado ao intervalo esperado e confiança heurística;
- expansão combinatória;
- endpoint `/health`;
- propagação de `X-Request-Id`;
- geração de jogos;
- catálogo de filtros;
- erros de validação em formato Problem Details.

### Controles implementados

- corpo JSON limitado a 256 kB;
- Helmet habilitado;
- `x-powered-by` desabilitado;
- CORS configurável;
- rate limit padrão de 100 requisições por janela;
- rate limit pesado de 10 requisições por janela em expansão, backtest e carteira;
- validação de payloads com Zod;
- resposta de erros estruturada em `application/problem+json`;
- identificador de requisição em todas as respostas;
- uso de `crypto.randomInt` para geração;
- valores monetários representados em centavos.

### Recomendações para produção

Antes de publicar a API:

1. defina `NODE_ENV=production`;
2. configure `CORS_ORIGINS` com as origens exatas;
3. coloque a API atrás de HTTPS e de um proxy reverso;
4. substitua o rate limit em memória por uma estratégia compartilhada quando houver múltiplas réplicas;
5. revise a tabela de preços e sua versão antes de exibir valores ao usuário;
6. monitore `X-Request-Id`, respostas `422`, `429` e `206`;
7. não prometa previsão, aumento de probabilidade ou retorno financeiro;
8. não trate o JSON histórico como atualizado sem validar sua fonte e sua data de atualização.

## Solução de problemas

### O frontend não consegue acessar a API

Confirme se ambos os processos estão em execução e se `frontend/.env.local` aponta para a URL correta:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Se o navegador acusar CORS, ajuste `CORS_ORIGINS` no `.env` do backend. Para a configuração padrão deste projeto:

```env
CORS_ORIGINS=http://localhost:3001
```

Depois, reinicie a API.

### A API retorna `422`

Leia `detail`, `invalidParams` e `requestId`. Os números devem ser inteiros entre 1 e 25, sem repetição. Um jogo deve conter entre 15 e 20 dezenas. Em filtros, `min` não pode ser maior que `max`.

### A API retorna `206`

`206` é um resultado parcial, não uma falha HTTP completa. Ele indica que a API gerou parte do lote dentro do orçamento de tentativas ou tempo. O cliente deve ler `meta.partial`, `generatedQuantity`, `attempts` e `rejectionsByConstraint`.

### O custo exibido parece menor que o esperado

A API atual retorna o custo de um jogo em determinadas respostas de lote. O frontend multiplica esse valor pela quantidade gerada para a apresentação. Ao criar outro cliente, considere `meta.generatedQuantity` e verifique a versão do contrato antes de mostrar o custo ao usuário.

## Como contribuir

1. Faça um fork do repositório.
2. Crie uma branch descritiva:

   ```bash
   git checkout -b feat/nome-da-mudanca
   ```

3. Faça a alteração mantendo o domínio independente de Express, Zod e APIs de infraestrutura.
4. Atualize testes quando alterar comportamento ou contrato.
5. Execute as verificações:

   ```bash
   cd backend
   npm run typecheck
   npm test
   ```

6. Execute o build do frontend quando alterar a interface:

   ```bash
   cd frontend
   npm run build
   ```

7. Revise o diff, descreva limitações e abra um Pull Request.

### Regras para novas funcionalidades

- Não introduza afirmações de aumento de probabilidade.
- Não transforme uma estatística a priori em padrão histórico sem evidência e fonte.
- Mantenha cálculos financeiros em centavos.
- Inclua disclaimers junto de score, fechamento, diversificação e valor esperado.
- Prefira contratos versionados e validação Zod a payloads implícitos.
- Preserve a natureza stateless da API, salvo decisão arquitetural documentada.
- Para alterações na API, atualize o OpenAPI, os testes e este README.

## Licença

**A definir.** O repositório não contém atualmente um arquivo `LICENSE`. Defina a licença antes de distribuir o software ou aceitar contribuições sob termos formais.

## Contato

- Autor e mantenedor: [barrosrafa no GitHub](https://github.com/barrosrafa)
- Repositório: [github.com/barrosrafa/app-lotzy](https://github.com/barrosrafa/app-lotzy)

## Referências

[1]: https://github.com/barrosrafa/app-lotzy "Repositório oficial do projeto app-lotzy"
[2]: https://nodejs.org/ "Documentação oficial do Node.js"
[3]: https://expressjs.com/ "Documentação oficial do Express"
[4]: https://nextjs.org/docs "Documentação oficial do Next.js"
[5]: https://vitest.dev/ "Documentação oficial do Vitest"
[6]: https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/j/jogo-patologico "Informações do Ministério da Saúde sobre jogo patológico"


## Atualização v3 — execução e contratos reforçados

Esta versão consolida as melhorias técnicas do plano v3 no repositório `app-lotzy`. A aplicação permanece **stateless**: não mantém apostas, usuários ou resultados em banco durante a execução da API. O arquivo `db/resultados.json` é um artefato histórico local para análises futuras; ele não é usado para prever concursos e nenhuma funcionalidade altera a probabilidade matemática de uma combinação.

### Principais melhorias implementadas

| Área | Implementação | Efeito observável |
|---|---|---|
| Geração aleatória | `CryptoRandomSource` com `crypto.randomInt` e Fisher–Yates parcial | Amostragem sem `Math.random()` nem viés de módulo |
| Viabilidade | `FilterEngine.checkFeasibility` calcula envelopes alcançáveis antes da geração | Filtros impossíveis terminam imediatamente com `422` e `violations` |
| Orçamento | Geração filtrada limita tentativas por jogo e tempo total | Respostas parciais usam `206`, `partial` e `acceptanceRate` |
| Conferência | `POST /api/v1/games/check` recebe `drawnNumbers` e jogos | Retorna acertos, faixas 11–15 e prêmios fixos em centavos |
| Expansão | `POST /api/v1/games/expand` oferece `json` ou `ndjson` | Expansões grandes são transmitidas em linhas e cedem o event loop a cada 2.000 itens |
| Valores monetários | `StaticPriceTable` mantém `betPriceCents`, prêmios e versão | Evita floats e hard-code espalhado nas rotas |
| Erros | Respostas inválidas seguem `application/problem+json` | Erros incluem `type`, `status`, `instance`, `requestId` e parâmetros inválidos |
| Correlação | Cada requisição recebe ou preserva `X-Request-Id` | O identificador aparece no header e nos metadados das respostas de negócio |
| Contrato | OpenAPI 3.1 disponível em `/api/v1/openapi.json` | As rotas versionadas podem ser descobertas por clientes e ferramentas |
| Frontend | Next.js com volante acessível, estados textuais e páginas de geração, conferência, validação e análise | Interface responsiva sem depender apenas de cor para comunicar estado |

### Monorepo: comandos recomendados

A raiz agora oferece scripts para o fluxo completo. Execute:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm test
npm run typecheck
npm run build
```

`npm run build` compila a API TypeScript e, em seguida, executa `next build` no frontend. O erro anterior em que o script procurava `backend/frontend/package.json` foi corrigido para apontar para `../frontend`.

Para desenvolvimento, use dois terminais quando quiser trabalhar na API e na interface ao mesmo tempo:

```bash
# Terminal 1 — API, porta 3000
npm run dev

# Terminal 2 — Next.js, porta 3001
npm run dev:frontend
```

Também é possível executar os comandos diretamente em cada pacote:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

A API usa `http://localhost:3000` e o frontend usa `http://localhost:3001`. O cliente web aponta por padrão para `http://localhost:3000/api/v1`; para outra origem, configure `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

### Respostas parciais e falha rápida

A rota `POST /api/v1/games/generate-filtered` nunca deve permanecer tentando indefinidamente. O pedido aceita `budget.maxAttemptsPerGame` e `budget.maxTotalMs`. Quando o envelope matemático já prova que a restrição é impossível, a API responde `422` antes de sortear. Quando o orçamento termina depois de gerar pelo menos um jogo, responde `206` com `partial` e `acceptanceRate`.

Os exemplos são abreviados: um jogo real sempre contém de 15 a 20 dezenas distintas. Se nenhum jogo for produzido, a resposta é `422` com `FILTERS_TOO_RESTRICTIVE` e as contagens de rejeição.

### Expansão NDJSON

Para desdobrar 16–20 dezenas, prefira:

```bash
curl -N -X POST http://localhost:3000/api/v1/games/expand \
  -H 'Content-Type: application/json' \
  -d '{"numbers":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"format":"ndjson"}'
```

A primeira linha contém metadados. As demais contêm um objeto `{ "game": [...] }`. O formato JSON permanece disponível para respostas de até 1.000 combinações; acima desse limite a API exige NDJSON com `406` para evitar acumular uma resposta grande em memória. A escrita é feita em fatias de até 2.000 combinações, com `setImmediate` entre fatias.

### Conferência de jogos

`POST /api/v1/games/check` valida que `drawnNumbers` tenha exatamente 15 dezenas distintas e informa a faixa de cada jogo. As faixas 11, 12 e 13 possuem valores fixos da tabela versionada; 14 e 15 são marcadas como `pari-mutuel`, pois dependem do rateio do concurso. Dezenas duplicadas no sorteio oficial são rejeitadas com `422`.

### Limites e responsabilidade

Os filtros de soma, paridade, primos, Fibonacci, moldura, repetição e popularidade são ferramentas de composição e organização. Popularidade é uma heurística comportamental, não uma propriedade do sorteio. O histórico não prevê o próximo resultado; backtesting pode descrever o passado, mas não demonstra capacidade preditiva. A probabilidade de uma aposta simples de 15 dezenas permanece **1 em 3.268.760**. Aposte somente valores que possa perder e consulte os recursos de jogo responsável apresentados pela aplicação.

### Validação executada nesta versão

A suíte automatizada cobre geração, invariantes do domínio, envelope inviável, `requestId`, resposta parcial, validação RFC 9457 e rejeição de sorteio duplicado. A validação final foi executada com:

```text
npm test -- --run       → 18 testes aprovados
npm run typecheck       → aprovado
npm run build           → API + frontend aprovados
```

O build do frontend também foi revisado para usar `align-items:flex-end`, evitando o aviso de compatibilidade do Autoprefixer sobre `align-items:end`.
