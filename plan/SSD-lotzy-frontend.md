# System Specification Document — Lotzy Frontend

| | |
|---|---|
| **Versão** | 2.0.0 — alinhada ao código real de `barrosrafa/Lotzy` (branch `main`, 3 commits) |
| **Substitui** | SSD Frontend v1.0.0 (`app-lotzy.txt`) |
| **Stack** | Next.js 15 (App Router) · React 19 · TypeScript `strict` · TanStack Query v5 · Zod 4 · Tailwind CSS · shadcn/ui |
| **Backend** | Lotzy API — Node 20, Express 5, stateless, `application/problem+json` |
| **Idioma do código** | Inglês. Documentação e copy de interface em português. |

---

## 0. Divergências entre o SSD v1.0.0 e a API implementada

O SSD do anexo foi escrito contra o SSD do backend, não contra o código. Li o repositório. As diferenças abaixo não são detalhe de implementação: três delas fazem a interface exibir números errados ao usuário.

### 0.1. Endpoints ausentes no SSD frontend

O v1.0.0 mapeia 5 endpoints. A API expõe 16.

| Endpoint | Método | No SSD v1.0.0? |
|---|---|---|
| `/api/v1/games/generate-random` | POST | sim |
| `/api/v1/games/generate-filtered` | POST | sim |
| `/api/v1/games/filters` | GET | sim |
| `/api/v1/games/validate` | POST | sim |
| `/api/v1/games/analyze` | POST | sim |
| `/api/v1/games/patterns` | GET | **não** |
| `/api/v1/games/expand` | POST | **não** |
| `/api/v1/games/check` | POST | **não** |
| `/api/v1/games/portfolio` | POST | **não** |
| `/api/v1/games/wheel` | POST | **não** |
| `/api/v1/tools/expected-value` | POST | **não** |
| `/api/v1/tools/bankroll-check` | POST | **não** |
| `/api/v1/tools/backtest` | POST | **não** |
| `/health`, `/ready`, `/metrics`, `/api/v1/openapi.json` | GET | **não** |

### 0.2. Defeitos de contrato que a interface expõe ao usuário

| # | Defeito na API | Efeito na interface | Defesa no frontend |
|---|---|---|---|
| **D1** | `cost` em `generate-random`, `generate-filtered` e `portfolio` é calculado com `costFor(numbersPerGame)` — custo de **um** jogo, não do lote. Gerar 5 jogos de 15 dezenas devolve `totalCents: 350`. | O usuário vê R$ 3,50 onde gastaria R$ 17,50. **Erro financeiro visível, 5× para baixo.** | Adapter isolado multiplica por `meta.generatedQuantity`. Remover quando a API corrigir. §Passo 6 |
| **D2** | `expectedValue.fixedTiersCents: 90` é constante e também não multiplica pela quantidade. | EV do lote subestimado na mesma proporção. | Mesmo adapter. |
| **D3** | `expectedRateioGainCents = 17 × quantity`, constante — não depende do `popularityScore` obtido. | Um jogo com score 0,05 e outro com 0,90 exibem o mesmo "ganho". O número parece calculado e não é. | **Não exibir como valor por jogo.** Renderizar só a faixa de ordem de grandeza de `/games/patterns → estimatedGain`. §Passo 17 |
| **D4** | `rejectionsByConstraint` incrementa **todas** as restrições ativas a cada rejeição, porque `FilterEngine.check` devolve booleano sem dizer qual falhou. | "Soma rejeitou 412" é falso se quem rejeitou foi `primes`. | Rotular como "restrições ativas nas rejeições", nunca "o filtro X rejeitou N". §Passo 11 |
| **D5** | `/expand` materializa todas as combinações (`[...expand(...)]`) antes do primeiro `res.write`, sem `setImmediate`. | O NDJSON chega de uma vez; barra de progresso incremental é teatro. | Ler por stream (o contrato é NDJSON), mas exibir indeterminado até a API corrigir. §Passo 15 |
| **D6** | O catálogo de fechamento tem **um** sistema: `W(16,15,15)`, que são os 16 desdobramentos de 16 dezenas — idêntico a `/expand` com 16 números, mesmo custo (R$ 56). `triggerProbability ≈ 4,9×10⁻⁶`. | Uma tela de "sistemas de fechamento" com um item trivial promete sofisticação inexistente. | **Fora da v1 da interface.** §Passo 16 |
| **D7** | `advancedRoutes` é montado em `/api/v1/games` **depois** de `gameRoutes`, que já aplicou o limiter `standard`. `/wheel` e `/portfolio` consomem os dois limiters. | 429 muito antes do esperado nessas rotas. | Cooldown de 429 tratado genericamente. §Passo 5 |
| **D8** | `CORS_ORIGINS` vazio resolve para `origin: true` — libera qualquer origem. O SSD do backend especificava o oposto. | Funciona em dev e fica permissivo em prod se esquecerem a variável. | Não é problema do frontend, mas entra no checklist de deploy. §Passo 20 |
| **D9** | `/tools/backtest` conta apenas o **melhor** jogo por concurso e compara com um `baseline` de aposta única. | Com mais de um jogo na estratégia, a comparação é inválida por construção. | Fora da v1. §Passo 16 |

**D1 e D2 são bloqueantes.** Um gerador de apostas que mostra o custo errado por um fator igual à quantidade de jogos não pode ir para produção, com ou sem disclaimer. O adapter do Passo 6 é paliativo; a correção pertence à API.

### 0.3. Problemas de conteúdo no SSD v1.0.0

1. **A falácia voltou pela UI.** O v1.0.0 instrui rotular os sliders com "sugestão ideal: 6 a 8 pares, representando ~77,38% das combinações". Esse é exatamente o número que a §0.1 do SSD do backend derruba: 77,38% é a probabilidade combinatória *a priori*, não um padrão dos sorteios, e a palavra "ideal" transforma um fato aritmético em conselho. **Regra arquitetural: a interface não escreve texto de filtro. Ela renderiza `nature`, `note` e `deprecationHint` vindos de `GET /games/filters`.** Fonte única de verdade, backend. §Passo 8
2. **"Surpresinha Criptográfica"** sugere que a criptografia melhora o resultado. O CSPRNG evita viés de implementação, nada além. Nome novo: **"Gerar jogos"**.
3. **"comparação com a distribuição normal histórica"** (tela de análise) — não existe distribuição histórica no produto; existe a distribuição a priori. Reescrever.
4. **Nada sobre `popularityScore`, `diversity` ou `expectedValue`**, que são o que distingue esta API de um gerador qualquer.

### 0.4. O que o SSD v1.0.0 acerta e foi preservado

Máquina de 4 estados do volante interativo, tratamento de RFC 9457 por código, painel de diagnóstico de filtros, `206` como sucesso parcial, modal de inviabilidade com envelope alcançável, navegação por setas na grade, persistência local sem enviar dados a terceiros.

---

## 1. Princípios de arquitetura

1. **O frontend não duplica lógica combinatória.** Nenhum cálculo de soma, primos, overlap, custo ou EV é reimplementado no cliente. A única exceção é o adapter do Passo 6, que existe para corrigir um defeito e tem data de remoção.
2. **Catálogos são a fonte de verdade do texto.** `/games/filters` e `/games/patterns` definem rótulos, domínios, natureza e advertências. Hard-code de "sugestão ideal" é proibido por lint (§Passo 8).
3. **Toda resposta é validada com Zod antes de entrar no estado.** A API está em evolução e já diverge do seu próprio SSD; o cliente falha alto e cedo, não silenciosamente.
4. **Dinheiro nunca vira `number` de reais.** Centavos inteiros até a borda de formatação.
5. **Conformidade é componente, não texto solto.** `<Disclaimer>`, `<PopularityBadge>` e `<ConditionalGuarantee>` carregam a advertência consigo; não é possível renderizar o dado sem a advertência.

---

## 2. Direção visual

O objeto nativo do produto é o volante de papel marcado a caneta. A identidade sai daí — papel, grafite, tinta — e **deliberadamente não usa o roxo/magenta da Lotofácil oficial**: imitar a identidade da Caixa em um produto de terceiros cria confusão com o operador oficial e é risco jurídico antes de ser risco estético.

### 2.1. Tokens

```css
/* app/globals.css */
@layer base {
  :root {
    --paper:      #F4F5F2;  /* estoque de papel, levemente esverdeado */
    --paper-deep: #E7E9E3;  /* fundo de grade, sulcos do volante */
    --graphite:   #23262B;  /* texto */
    --graphite-2: #5C626B;  /* texto secundário */
    --ink:        #1B4D8F;  /* dezena marcada (variável) */
    --seal:       #0F6B4F;  /* dezena fixa */
    --strike:     #A32B2B;  /* dezena excluída */
    --caution:    #8A5A00;  /* 206 parcial, avisos não bloqueantes */
  }
  :root[data-theme='dark'] {
    --paper: #16181C; --paper-deep: #1E2126; --graphite: #E8EAE6;
    --graphite-2: #9AA1AA; --ink: #6FA2E8; --seal: #4FBF94;
    --strike: #E07A7A; --caution: #D9A441;
  }
}
```

### 2.2. Tipografia

Uma família, dois eixos de largura: **Archivo** para a interface e **Archivo Expanded** para as dezenas dentro do volante — os números ficam com a presença de algo impresso no papel, sem introduzir um segundo tipo aleatório. `font-variant-numeric: tabular-nums` obrigatório em toda célula numérica e em toda coluna de valores; sem isso a grade 5×5 "respira" a cada re-render.

Escala: 12 / 14 / 16 / 20 / 28 / 40. Corpo com no máximo 72 caracteres por linha.

### 2.3. Regra de cor e acessibilidade

Os três estados do volante são azul, verde e vermelho — indistinguíveis para deuteranopia. **Cor nunca carrega o estado sozinha**: cada estado tem ícone (ponto preenchido / cadeado / X), peso de borda distinto e `aria-label` textual. Testar com filtro de daltonismo é critério de aceite do Passo 9.

---

## 3. Estrutura de pastas

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # gerar jogos (rota raiz)
│   ├── filtros/page.tsx
│   ├── validar/page.tsx
│   ├── analisar/page.tsx
│   ├── conferir/page.tsx
│   ├── desdobrar/page.tsx
│   ├── ferramentas/page.tsx
│   ├── carteira/page.tsx
│   └── globals.css
├── components/
│   ├── playslip/
│   │   ├── PlayslipGrid.tsx          # grade 5x5, 4 estados
│   │   ├── PlayslipCell.tsx
│   │   └── useCellSelection.ts
│   ├── games/
│   │   ├── GameList.tsx
│   │   ├── GameCard.tsx
│   │   ├── CostSummary.tsx
│   │   ├── MetricsBar.tsx
│   │   └── DiversityPanel.tsx
│   ├── filters/
│   │   ├── FilterForm.tsx
│   │   ├── CatalogRangeField.tsx     # renderiza a partir de /filters
│   │   └── FilterDiagnostics.tsx
│   ├── compliance/
│   │   ├── Disclaimer.tsx
│   │   ├── PopularityBadge.tsx
│   │   └── ConditionalGuarantee.tsx
│   └── ui/                           # shadcn
├── lib/
│   ├── api/
│   │   ├── client.ts                 # fetch + RFC 9457 + X-Request-Id
│   │   ├── contracts.ts              # Zod de request e response
│   │   ├── endpoints.ts              # uma função por rota
│   │   └── compat.ts                 # ADAPTER TEMPORÁRIO — D1/D2
│   ├── query/
│   │   ├── keys.ts
│   │   └── provider.tsx
│   ├── format/money.ts
│   └── storage/wallet.ts
└── test/
    ├── msw/handlers.ts
    └── setup.ts
```

---

## 4. Passo a passo de desenvolvimento

### Passo 0 — Subir a API e conferir o contrato real

Antes de escrever uma linha de frontend, confirme contra o que está rodando, não contra a documentação.

```bash
git clone https://github.com/barrosrafa/Lotzy.git && cd Lotzy
cp .env.example .env && npm install && npm run build && npm test && npm run dev
```

```bash
curl -s localhost:3000/health
curl -s localhost:3000/api/v1/games/filters | jq
curl -s -X POST localhost:3000/api/v1/games/generate-random \
  -H 'content-type: application/json' \
  -d '{"quantity":5,"numbersPerGame":15}' | jq '{qtd: .meta.generatedQuantity, cost: .cost}'
```

**Critério de aceite:** a última chamada retorna `generatedQuantity: 5` com `cost.totalCents: 350`. Você acaba de reproduzir o defeito D1 — registre a issue no backend antes de seguir.

No `.env` do backend: `CORS_ORIGINS=http://localhost:3000` (o Next ocupa a 3000 em dev; mude a porta de um dos dois e ajuste).

### Passo 1 — Scaffold

```bash
npx create-next-app@latest lotzy-web --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
cd lotzy-web
npm i @tanstack/react-query @tanstack/react-query-devtools zod
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom \
        vitest @vitejs/plugin-react jsdom msw @playwright/test
npx playwright install --with-deps chromium
```

`tsconfig.json`: além de `strict`, ative `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes` — o domínio é cheio de acesso por índice (`game[i]`, `coveragePerNumber[n]`) e de campos opcionais vindos da API.

`.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

**Aceite:** `npm run build` e `npx tsc --noEmit` passam limpos.

### Passo 2 — Tokens e base

Cole o bloco da §2.1 em `app/globals.css`, exponha os tokens ao Tailwind v4 via `@theme`, carregue Archivo por `next/font/google` com `display: 'swap'` e `variable: '--font-archivo'`. Defina `:root { color-scheme: light dark }` e respeite `prefers-reduced-motion` globalmente.

**Aceite:** alternar o tema do sistema troca a paleta sem flash; `prefers-reduced-motion: reduce` zera transições.

### Passo 3 — shadcn/ui

```bash
npx shadcn@latest init
npx shadcn@latest add button input slider accordion dialog alert badge card tabs toast skeleton tooltip switch
```

Sobrescreva as cores dos componentes para os tokens da §2.1. Não deixe o tema padrão do shadcn passar — ele é reconhecível à distância e anula a §2.

**Aceite:** nenhum componente de `ui/` referencia cor literal; todos usam `var(--*)`.

### Passo 4 — Contratos

Todo schema de resposta usa `.passthrough()`: a API vai ganhar campos, e o cliente não pode quebrar por isso.

```typescript
// src/lib/api/contracts.ts
import { z } from 'zod';

export const dozen = z.number().int().min(1).max(25);
export const gameSchema = z.array(dozen).min(15).max(20);

export const popularitySchema = z.object({
  score: z.number().min(0).max(1),
  matchedPatterns: z.array(z.object({
    key: z.string(),
    group: z.enum(['geometric', 'arithmetic', 'calendar', 'compositional']),
    weight: z.number(),
  })),
  confidence: z.literal('heuristic'),
}).passthrough();

export const metricsSchema = z.object({
  size: z.number(), sum: z.number(), evens: z.number(), odds: z.number(),
  primes: z.number(), primeNumbers: z.array(dozen),
  fibonacci: z.number(), fibonacciNumbers: z.array(dozen),
  frame: z.number(), core: z.number(), maxConsecutiveRun: z.number(),
  popularity: popularitySchema,
}).passthrough();

export const costSchema = z.object({
  simpleBets: z.number().int(),
  totalCents: z.number().int(),
  formatted: z.string(),
}).passthrough();

export const generateRandomResponse = z.object({
  status: z.literal('success'),
  meta: z.object({
    requestId: z.string(),
    generatedQuantity: z.number().int(),
    numbersPerGame: z.number().int(),
    priceTableVersion: z.string(),
  }).passthrough(),
  data: z.array(z.object({ game: gameSchema })),
  cost: costSchema,
  expectedValue: z.object({ fixedTiersCents: z.number().int(), note: z.string() }).passthrough(),
  disclaimer: z.string(),
  responsibleGamblingUrl: z.string().url(),
}).passthrough();

export const generateFilteredResponse = z.object({
  status: z.literal('success'),
  meta: z.object({
    requestId: z.string(),
    generatedQuantity: z.number().int(),
    partial: z.boolean(),
    attempts: z.number().int(),
    acceptanceRate: z.number(),
    rejectionsByConstraint: z.record(z.string(), z.number().int()),
  }).passthrough(),
  data: z.array(z.object({ game: gameSchema, metrics: metricsSchema })),
  cost: costSchema,
  expectedRateioGainCents: z.number().int(),
  disclaimer: z.string(),
  responsibleGamblingUrl: z.string().url(),
}).passthrough();

export const filterCatalogResponse = z.object({
  data: z.array(z.object({
    key: z.string(),
    label: z.string(),
    domain: z.object({ min: z.number(), max: z.number() }).optional(),
    expected: z.number().optional(),
    stdDev: z.number().optional(),
    suggested: z.object({ min: z.number(), max: z.number() }).optional(),
    aPrioriCoverage: z.number().optional(),
    nature: z.enum(['statistical', 'cosmetic', 'behavioural']),
    confidence: z.string().optional(),
    note: z.string().optional(),
    deprecationHint: z.string().optional(),
  }).passthrough()),
}).passthrough();

export const diversitySchema = z.object({
  averageOverlap: z.number(), maxOverlap: z.number(), minOverlap: z.number(),
  coveragePerNumber: z.array(z.number().int()).length(25),
}).passthrough();

export const problemDetails = z.object({
  type: z.string(), title: z.string(), status: z.number(),
  detail: z.string(), instance: z.string(), requestId: z.string(),
  invalidParams: z.array(z.object({ name: z.string(), reason: z.string() })).optional(),
  violations: z.array(z.object({
    constraint: z.string(), reason: z.string(),
    requested: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    achievable: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  })).optional(),
  available: z.array(z.string()).optional(),
  rejectionsByConstraint: z.record(z.string(), z.number()).optional(),
}).passthrough();
```

> `diversity.averagePairwiseJaccard` e `coverageGini` estão no SSD do backend mas não foram conferidos no código-fonte lido. Deixados como opcionais via `.passthrough()` em vez de obrigatórios — validar contra `/openapi.json` antes de exibir na UI.

**Aceite:** um teste alimenta cada schema com a resposta real capturada no Passo 0 e passa.

### Passo 5 — Cliente HTTP

```typescript
// src/lib/api/client.ts
import { problemDetails } from './contracts';
import type { z } from 'zod';

const BASE = process.env.NEXT_PUBLIC_API_URL!;

export class ProblemError extends Error {
  constructor(public readonly problem: z.infer<typeof problemDetails>) {
    super(problem.detail);
    this.name = 'ProblemError';
  }
  /** Stable discriminator derived from the RFC 9457 `type` URI. */
  get code(): string {
    return this.problem.type.split('/').pop() ?? 'unknown';
  }
}

export interface RequestResult<T> { data: T; partial: boolean; requestId: string }

export async function post<S extends z.ZodTypeAny>(
  path: string,
  body: unknown,
  schema: S,
  signal?: AbortSignal,
): Promise<RequestResult<z.infer<S>>> {
  const requestId = crypto.randomUUID();
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = problemDetails.safeParse(payload);
    if (parsed.success) throw new ProblemError(parsed.data);
    throw new Error(`HTTP ${response.status} sem corpo problem+json.`);
  }

  // 206 is success, not an error: the batch came back smaller than requested.
  return {
    data: schema.parse(payload),
    partial: response.status === 206,
    requestId: response.headers.get('X-Request-Id') ?? requestId,
  };
}
```

Três decisões deliberadas: `206` sobe como sucesso com bandeira (nunca como erro); o `X-Request-Id` é gerado no cliente e guardado com o resultado, para o usuário poder citá-lo no suporte; e o `schema.parse` estoura em vez de `safeParse`, porque dado fora de contrato deve quebrar em desenvolvimento, não virar `undefined` na tela.

`429`: ler `RateLimit-Reset` (o backend usa `standardHeaders: true`) e alimentar um contador regressivo no botão. Lembrar de D7 — nas rotas avançadas o 429 chega mais cedo.

**Aceite:** com MSW simulando 422, 206, 429 e 500, os quatro caminhos produzem estados distintos na UI.

### Passo 6 — Adapter de compatibilidade (temporário)

```typescript
// src/lib/api/compat.ts
//
// TEMPORARY. Works around Lotzy API defects D1 and D2: `cost` and
// `expectedValue` are computed for a single ticket and not multiplied by
// the batch size. Delete this file once the API returns batch-level values.
// Tracking: <link da issue>
//
import type { Cost } from './contracts';

export interface BatchCost extends Cost {
  /** True while the workaround is active, so the UI can show a build note. */
  readonly adjustedClientSide: boolean;
}

export function toBatchCost(perGame: Cost, quantity: number): BatchCost {
  return {
    simpleBets: perGame.simpleBets * quantity,
    totalCents: perGame.totalCents * quantity,
    formatted: formatCents(perGame.totalCents * quantity),
    adjustedClientSide: true,
  };
}

export const toBatchFixedEv = (perGameCents: number, quantity: number) =>
  perGameCents * quantity;
```

Isolado num arquivo, com comentário de remoção e link de issue. **Não** espalhe a multiplicação pelos componentes — quando a API corrigir, a correção vira uma exclusão de arquivo e uma substituição de import.

**Aceite:** um teste garante que 5 jogos de 15 dezenas exibem R$ 17,50, e um segundo teste falha propositalmente quando a API passar a devolver o valor certo (sinalizando a hora de remover o adapter).

### Passo 7 — TanStack Query

```typescript
// src/lib/query/keys.ts
export const queryKeys = {
  filterCatalog: ['catalog', 'filters'] as const,
  patternCatalog: ['catalog', 'patterns'] as const,
  analysis: (games: number[][]) => ['analysis', games] as const,
};
```

Catálogos: `staleTime: Infinity` — a API já manda `Cache-Control: public, max-age=86400`. Geração é **mutation**, nunca query: é um efeito, não um dado cacheável, e `retry` deve ser `0` (repetir uma geração devolve outros jogos e confunde o usuário). Para 5xx em leitura, `retry: 2` com backoff.

**Aceite:** Devtools mostram os catálogos buscados uma vez por sessão e nenhuma geração cacheada.

### Passo 8 — Catálogos como fonte única de verdade

```typescript
// src/components/filters/CatalogRangeField.tsx
// Renders a filter control entirely from GET /games/filters.
// No hard-coded label, range or "ideal" copy: the honesty framing lives in
// the API and must not be re-authored in the UI.
export function CatalogRangeField({ entry, value, onChange }: Props) {
  return (
    <div>
      <label id={`${entry.key}-label`}>{entry.label}</label>

      {entry.nature === 'cosmetic' && entry.deprecationHint && (
        <p role="note" data-variant="cosmetic">{entry.deprecationHint}</p>
      )}
      {entry.nature === 'behavioural' && (
        <p role="note" data-variant="behavioural">{entry.note}</p>
      )}

      <RangeSlider
        aria-labelledby={`${entry.key}-label`}
        min={entry.domain?.min} max={entry.domain?.max}
        value={value} onValueChange={onChange}
      />

      {entry.suggested && (
        <button type="button" onClick={() => onChange([entry.suggested!.min, entry.suggested!.max])}>
          Usar faixa {entry.suggested.min}–{entry.suggested.max}
        </button>
      )}
      {entry.aPrioriCoverage !== undefined && (
        <p>
          {Math.round(entry.aPrioriCoverage * 100)}% das combinações possíveis caem nesta faixa.
          Filtrar reduz os jogos candidatos na mesma proporção.
        </p>
      )}
    </div>
  );
}
```

Repare no texto da cobertura: descreve o que o número **é** (proporção das combinações) e a consequência (reduz candidatos na mesma proporção). O v1.0.0 chamava a mesma faixa de "ideal". A diferença entre as duas frases é a diferença entre este produto e um site de palpites.

Regra de lint sugerida: `no-restricted-syntax` barrando os literais `77,38`, `77,11`, `78,92` e a palavra "ideal" em `src/components/filters/**`.

**Aceite:** desligar a API deixa os filtros indisponíveis com mensagem clara, e não com valores inventados pelo cliente.

### Passo 9 — Volante interativo 5×5

Máquina de quatro estados, preservada do v1.0.0: neutro → variável → fixo → excluído → neutro.

```typescript
// src/components/playslip/useCellSelection.ts
export type CellState = 'neutral' | 'variable' | 'fixed' | 'excluded';

const NEXT: Record<CellState, CellState> = {
  neutral: 'variable', variable: 'fixed', fixed: 'excluded', excluded: 'neutral',
};

export function useCellSelection(numbersPerGame: number) {
  const [states, setStates] = useState<Record<number, CellState>>({});

  const fixedNumbers = useMemo(
    () => Object.entries(states).filter(([, s]) => s === 'fixed').map(([n]) => Number(n)).sort((a, b) => a - b),
    [states],
  );
  const excludedNumbers = useMemo(
    () => Object.entries(states).filter(([, s]) => s === 'excluded').map(([n]) => Number(n)).sort((a, b) => a - b),
    [states],
  );

  // Client-side guards mirroring the API's own rules, so the user is not
  // sent to the network to be told something the UI already knows.
  const errors = useMemo(() => {
    const out: string[] = [];
    if (fixedNumbers.length > numbersPerGame) {
      out.push(`Você fixou ${fixedNumbers.length} dezenas para um jogo de ${numbersPerGame}.`);
    }
    if (25 - excludedNumbers.length < numbersPerGame) {
      out.push(`Sobram ${25 - excludedNumbers.length} dezenas disponíveis — não dá para montar um jogo de ${numbersPerGame}.`);
    }
    return out;
  }, [fixedNumbers, excludedNumbers, numbersPerGame]);

  return { states, cycle: (n: number) => setStates((s) => ({ ...s, [n]: NEXT[s[n] ?? 'neutral'] })), fixedNumbers, excludedNumbers, errors };
}
```

Acessibilidade obrigatória:

- A grade é `role="grid"` com 5 linhas `role="row"`; cada célula é `role="gridcell"` contendo um `<button>`.
- Setas movem o foco em duas dimensões; `Home`/`End` vão ao início e fim da linha; `PageUp`/`PageDown` à primeira e última linha. Foco roving (`tabIndex` 0 na célula ativa, −1 nas demais) — não 25 paradas de tabulação.
- `Espaço`/`Enter` avançam o estado. Rótulo completo, não só o número: `aria-label="Dezena 7, fixa. Enter para excluir."`
- `aria-live="polite"` num resumo textual fora da grade: "3 fixas, 2 excluídas, 20 disponíveis".
- Alvo de toque mínimo de 44×44 px. Em telas estreitas a grade ocupa a largura toda com `aspect-ratio: 1`.

**Aceite:** operar o volante inteiro sem mouse; leitor de tela anuncia estado e ação; em simulação de deuteranopia os três estados continuam distinguíveis.

### Passo 10 — Tela "Gerar jogos" (`/`)

Controles: quantidade (1–500) e dezenas por jogo (15–20, *segmented control*). O hero é o resultado, não um formulário — antes de gerar, a área de resultado mostra um volante vazio em estado de convite, não um vazio cinza.

Ao gerar: `GameList` com cada jogo em grade 5×5 compacta, `CostSummary` com o custo do **lote** (Passo 6), o `disclaimer` vindo da API renderizado logo acima do CTA, e a barra de exportação (copiar, `.txt`, `.csv`).

Um alerta de build fica visível enquanto `adjustedClientSide` for `true`: a equipe precisa ver que o número está sendo corrigido no cliente.

**Aceite:** 5 jogos de 15 dezenas exibem R$ 17,50; `disclaimer` aparece acima do botão, não em rodapé escondido.

### Passo 11 — Tela "Filtros" (`/filtros`)

Composição: `PlayslipGrid` (fixas/excluídas) + `FilterForm` alimentado pelo catálogo + `BudgetControls` + `FilterDiagnostics`.

`FilterDiagnostics` — e aqui mora o defeito D4:

```tsx
{partial && (
  <Alert variant="caution">
    Foram gerados {meta.generatedQuantity} de {requested} jogos dentro do tempo limite.
    Taxa de aceitação: {(meta.acceptanceRate * 100).toFixed(1)}%.
  </Alert>
)}

<details>
  <summary>Restrições ativas durante as rejeições</summary>
  <p>
    A API informa quais restrições estavam ativas quando cada candidato foi
    descartado, não qual delas causou o descarte. Use os números para ver o
    volume de tentativas, não para culpar um filtro específico.
  </p>
  <ul>{Object.entries(meta.rejectionsByConstraint).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
</details>
```

`422 INFEASIBLE_FILTERS` abre o `InfeasibleFiltersModal` com `violations[].achievable`, um botão "Ajustar para a faixa possível" que reescreve o formulário, e nada mais — o usuário quer a saída, não a explicação.

**Aceite:** pedir `sum: {min: 240, max: 270}` com dezenas fixas baixas abre o modal em menos de 100 ms com o envelope real.

### Passo 12 — Tela "Validar volante" (`/validar`)

Volante em modo de seleção única (15–20 dezenas), envia para `/games/validate`, exibe `normalizedGame`, `equivalentSimpleBets`, custo com `priceTableVersion`, `metrics` e `warnings`.

`warnings` são **não bloqueantes** por contrato. Renderizar como nota, nunca como erro: o jogo é válido. `HIGH_POPULARITY` usa o `<PopularityBadge>` do Passo 17.

**Aceite:** um jogo 1–16 consecutivo retorna 200 com `HIGH_POPULARITY` e `SUM_OUTSIDE_TYPICAL_RANGE`, ambos em tom de nota.

### Passo 13 — Tela "Analisar lote" (`/analisar`)

Entrada: colar jogos ou importar da carteira local. Paginação server-side (`page`, `pageSize` ≤ 100) para lotes de até 500.

`DiversityPanel` é o componente de maior valor da tela:

- `coveragePerNumber` como um volante 5×5 em mapa de calor, com a referência `N × k / 25` marcada.
- `maxOverlap` contra o piso matemático `max(0, 2k − 25)` — um lote de 15 dezenas **nunca** terá overlap abaixo de 5, e a UI deve mostrar o piso ao lado do valor para que 8 não pareça alto nem 6 pareça um feito.
- `uncoveredNumbers` em destaque quando houver.

Copy da tela: "distribuição das suas combinações", nunca "comparação com a distribuição histórica".

**Aceite:** com 20 jogos idênticos, `maxOverlap` = 15 e o painel diz o que está errado em uma frase.

### Passo 14 — Tela "Conferir" (`/conferir`)

Volante para marcar as 15 dezenas sorteadas + jogos da carteira. `POST /games/check`.

Resultado por faixa: `ELEVEN`…`FIFTEEN` e `NONE`. As faixas 11–13 mostram `fixedPrizeCents`; 14 e 15 mostram a `note` de pari-mutuel **sem inventar valor**. `summary.fixedPrizeTotalCents` é o único total que pode ser somado.

**Aceite:** um jogo com 14 acertos não exibe valor em reais em lugar nenhum.

### Passo 15 — Desdobramento (`/desdobrar`)

```typescript
// src/lib/api/expand.ts
export async function* streamExpansion(numbers: number[], signal?: AbortSignal) {
  const response = await fetch(`${BASE}/games/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ numbers, format: 'ndjson' }),
    signal,
  });
  if (!response.ok) throw new ProblemError(problemDetails.parse(await response.json()));

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line) yield JSON.parse(line);
  }
  if (buffer) yield JSON.parse(buffer);
}
```

Por causa de D5, o servidor só começa a escrever depois de montar tudo: use indicador **indeterminado**, não barra percentual. Renderize com virtualização (15.504 linhas para 20 dezenas) e ofereça download em `.csv` via `Blob`.

Aviso de custo obrigatório e destacado antes de confirmar: 20 dezenas custam **R$ 54.264,00**. Uma tela que expande sem dizer o preço é uma armadilha.

**Aceite:** expandir 20 dezenas não trava a aba; o custo aparece antes da confirmação, não depois.

### Passo 16 — Ferramentas (`/ferramentas`)

**Entram na v1:**

- `POST /tools/expected-value` — exibir `deterministic` e `conditional` em blocos **visualmente separados**. O contrato do backend separa os dois porque um é aritmética e o outro é premissa do usuário; juntá-los na UI desfaz a decisão. Campos de premissa editáveis e recálculo ao vivo, para o usuário ver o resultado se mexer.
- `POST /tools/bankroll-check` — orçamento mensal, custo e horizonte; devolve gasto e perda esperada. Apresentar como projeção, sem recomendação.

**Ficam fora da v1, com justificativa:**

- **Fechamento (`/wheel`)** — D6: catálogo com um único sistema, `W(16,15,15)`, que é o desdobramento trivial de 16 dezenas pelo mesmo custo de `/expand`. Uma tela dedicada venderia sofisticação inexistente. Reabrir quando o catálogo tiver sistemas reais (`W(18,13,11)` e similares).
- **Backtest (`/backtest`)** — D9: conta só o melhor jogo por concurso e compara com um baseline de aposta única. Com mais de um jogo, a comparação é inválida. O endpoint foi projetado para *demonstrar* ausência de sinal; implementado assim, produz uma tabela que parece resultado. Expor isso na UI antes da correção é o pior desfecho possível para um produto cujo diferencial é honestidade estatística.
- **Carteira balanceada (`/portfolio`)** — o `PortfolioBuilder` implementado é geração aleatória com descarte, sem reinício nem reparo local; para `maxOverlap` apertado ele devolve 206 quase sempre. Funciona, mas a tela prometeria otimização que não acontece. Reavaliar após o backend implementar o guloso com reinícios.

### Passo 17 — Componentes de conformidade

```tsx
// src/components/compliance/PopularityBadge.tsx
// The score and its magnitude are rendered together, by construction.
// Rendering the score alone is not possible through this API.
export function PopularityBadge({ popularity, estimatedGain }: Props) {
  const level = popularity.score > 0.5 ? 'alto' : popularity.score > 0.2 ? 'médio' : 'baixo';

  return (
    <Tooltip content={
      <>
        <p>Estima o quanto este jogo se parece com o que outras pessoas marcam. Não diz nada sobre o sorteio.</p>
        <p>
          Evitar padrões populares pode reduzir a divisão do prêmio nas faixas de 14 e 15 acertos.
          O efeito estimado é de cerca de {formatCents(estimatedGain.perBetCents)} por aposta
          — {(estimatedGain.percentOfBetCost * 100).toFixed(1)}% do custo.
        </p>
        <p>A probabilidade de acerto não muda.</p>
      </>
    }>
      <Badge data-level={level}>Padrão {level}</Badge>
    </Tooltip>
  );
}
```

`estimatedGain` vem de `GET /games/patterns`. **Não** use `expectedRateioGainCents` da resposta de geração: por D3 ele é constante e parece calculado por jogo. Um número falsamente preciso é pior que nenhum número.

`<Disclaimer>` renderiza a string que a API devolve, posicionada acima do CTA de geração, no fluxo do conteúdo — não em rodapé, não em modal dispensável, não em texto cinza-sobre-cinza.

**Aceite:** um teste de componente garante que nenhum score é renderizado sem a magnitude junto.

### Passo 18 — Carteira local

`localStorage` com chave versionada (`lotzy:wallet:v1`), schema Zod na leitura (dados podem estar corrompidos ou vir de uma versão anterior), limite de tamanho e botão de limpar. Nada sai do navegador. Exportar/importar `.json`.

**Aceite:** corromper a chave manualmente não quebra a aplicação; ela descarta e avisa.

### Passo 19 — Testes

| Camada | Ferramenta | Alvo |
|---|---|---|
| Contrato | Vitest | Cada schema do Passo 4 contra respostas reais capturadas no Passo 0 |
| Unitário | Vitest | `useCellSelection` (ciclo de estados, guardas), `toBatchCost`, formatação |
| Componente | Testing Library | Volante por teclado, `PopularityBadge` nunca sem magnitude, `warnings` como nota |
| Integração | MSW | 200, 206, 422 `VALIDATION_FAILED`, 422 `INFEASIBLE_FILTERS`, 429, 500 |
| E2E | Playwright | Gerar → salvar na carteira → conferir; filtros inviáveis → ajustar → gerar |
| Acessibilidade | axe-core no Playwright | Zero violações críticas em todas as rotas |
| Regressão de custo | Vitest | 5 jogos = R$ 17,50; teste que sinaliza quando a API corrigir D1 |

### Passo 20 — Performance e deploy

- Rotas de conteúdo estático (`/`, `/ferramentas`) como SSG. Os catálogos podem ser buscados no servidor com `revalidate: 86400` e hidratados via `HydrationBoundary`, eliminando o *flash* de filtros vazios.
- Orçamento de Web Vitals: LCP < 2,0 s em 4G, INP < 200 ms, **CLS < 0,05**. O CLS é o risco real aqui: o painel de resultados aparece depois da geração e empurra o layout. Reserve altura com `min-height` calculado a partir da quantidade pedida antes da resposta chegar.
- A grade de resultados usa `content-visibility: auto` para lotes grandes; a lista de desdobramento é virtualizada.
- `next/font` com `display: swap` e `preload` só do peso usado no primeiro paint.
- Checklist de produção: `NEXT_PUBLIC_API_URL` em HTTPS; **`CORS_ORIGINS` explícito no backend** (D8 — vazio libera qualquer origem); CSP sem `unsafe-inline`; nenhuma chave de API embutida no bundle (`API_KEYS` é do servidor, e o `X-Api-Key` do Lotzy não deve ser exposto ao browser — se for necessário, use um Route Handler do Next como proxy).

---

## 5. Erros RFC 9457 — mapeamento para a interface

| `type` (sufixo) | Status | Tratamento |
|---|---|---|
| `validation-failed` | 422 | Marcar campos por `invalidParams[].name`, mapeando o caminho do Zod para o campo do formulário |
| `infeasible-filters` | 422 | `InfeasibleFiltersModal` com `violations[].achievable` e ação de ajuste |
| `filters-too-restrictive` | 422 | Alerta com `rejectionsByConstraint` sob a ressalva de D4 e sugestão de aumentar `maxTotalMs` |
| `unsupported-response-size` | 406 | Trocar para NDJSON automaticamente e reenviar uma vez |
| `wheel-not-available` | 422 | Listar `available` — irrelevante enquanto o fechamento estiver fora da v1 |
| `rate-limited` (429) | 429 | Cooldown com `RateLimit-Reset`; lembrar de D7 nas rotas avançadas |
| `internal` | 500 | Mensagem genérica **com o `requestId` copiável** |

Todo erro exibe o `requestId`. É o único elo entre o que o usuário viu e o log do servidor.

---

## 6. Ordem de execução recomendada

Passos 0 → 5 são pré-requisito de tudo. Depois: **9 → 10 → 8 → 11** entrega o núcleo do produto (volante, geração, filtros honestos). **12 → 14 → 18** fecha o ciclo de uso real (validar, conferir, guardar). **13 → 16 → 15** adiciona a camada analítica. **17** não é uma fase: é transversal e entra junto com o Passo 10.

O Passo 6 deveria ser o primeiro a ser deletado.

---

## 7. Dívida registrada contra o backend

Abrir como issues em `barrosrafa/Lotzy`, em ordem de gravidade:

1. **D1/D2** — `cost` e `expectedValue` não multiplicam pela quantidade do lote. Erro financeiro visível ao usuário. *Bloqueante.*
2. **D3** — `expectedRateioGainCents` é constante e independe do `popularityScore`.
3. **D4** — `rejectionsByConstraint` não identifica a restrição que causou a rejeição; `FilterEngine.check` precisa devolver o motivo, não um booleano.
4. **D5** — `/expand` materializa todas as combinações e escreve em laço síncrono; viola o RNF-04 do próprio SSD.
5. **D9** — `/tools/backtest` compara o máximo sobre N jogos com um baseline de aposta única.
6. **D6** — catálogo de fechamento com um sistema trivial; ou popular com sistemas reais ou marcar o endpoint como experimental no OpenAPI.
7. **D8** — `CORS_ORIGINS` vazio resolve para `origin: true`, invertendo a decisão de segurança do SSD.
8. **D7** — `advancedRoutes` montado após `gameRoutes` faz `/wheel` e `/portfolio` consumirem dois rate limiters.

---

## 8. Conformidade — checklist de aceite da interface

- [ ] Nenhuma tela afirma, sugere ou insinua aumento de probabilidade.
- [ ] `disclaimer` da API renderizado acima do CTA em toda tela de geração.
- [ ] `responsibleGamblingUrl` acessível a partir de qualquer rota.
- [ ] Nenhum texto de filtro escrito no cliente; tudo vem de `/games/filters`.
- [ ] Os literais 77,38 / 77,11 / 78,92 e a palavra "ideal" não aparecem em nenhum componente de filtro.
- [ ] `popularityScore` nunca aparece sem a magnitude estimada ao lado.
- [ ] Faixas 14 e 15 nunca exibem valor em reais sem premissa explícita do usuário.
- [ ] Custo do lote correto antes de qualquer confirmação; aviso destacado acima de R$ 1.000.
- [ ] Nenhuma identidade visual que possa ser confundida com a da Caixa Econômica Federal.
- [ ] `requestId` visível em toda tela de erro.

---

*Especificação escrita contra o código de `barrosrafa/Lotzy@main` e contra o SSD da API v3.0.0. Substitui o SSD Frontend v1.0.0, que foi escrito contra a especificação e não contra a implementação.*
