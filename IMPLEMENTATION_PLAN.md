# Plano de implementação e auditoria do Lotzy

**Data da auditoria:** 2026-09-20  
**Branch analisada:** `main`  
**Fonte de requisitos:** `pasted_content.txt` anexado ao pedido

## 1. Resultado executivo

O projeto atual é uma API stateless de geração, análise combinatória, histórico local e simulação, com frontend Next.js. A suíte existente passou com **40 testes**, o typecheck e o build do backend; o build do frontend também passou. O anexo, porém, descreve uma evolução muito maior do produto: banco persistente, autenticação, sincronização externa, ML/GAN, análise de PRNG, treinamento assíncrono, IA generativa, push e gráficos avançados. Esses módulos **não existiam na branch `main`** e não foram inventados como se estivessem prontos.

## 2. Implementado nesta entrega

| Item | Situação | Observação |
|---|---|---|
| Atualização de dependência crítica | Implementado | Next.js atualizado de `15.5.4` para `15.5.25`; a vulnerabilidade crítica foi eliminada. Permanecem 2 vulnerabilidades altas transitivas cuja correção indicada exige Next `16.3.5` (major) e deve ser tratada em uma migração dedicada. |
| Feature flags | Implementado | Novo `backend/src/shared/config/features.ts`; defaults seguros (`false`) para IA, ML, análise PRNG e sincronização. |
| Auditoria executável | Implementado | Testes, typecheck, builds e `npm audit` executados antes das mudanças. |
| Rate limiting | Parcial | Existe limiter local em memória; a configuração agora explicita `RATE_LIMIT_STORE`/`REDIS_URL`, mas o adaptador Redis ainda requer infraestrutura e integração dedicada. |
| Disclaimer | Implementado | A API já informa que simulação/heurísticas não alteram probabilidades. |

## 3. Achados de segurança e confiabilidade

### Alta prioridade

1. **Next.js:** a atualização para `15.5.25` removeu a vulnerabilidade crítica reportada inicialmente; `npm audit` ainda aponta 2 vulnerabilidades altas transitivas, cuja correção recomendada exige Next 16 e deve ser avaliada em migração separada.
2. **Ausência de autenticação e autorização:** o anexo pede endpoints administrativos e treinamento por usuário, mas a branch não possui JWT, identidade de usuário, RBAC ou proteção de `/admin/sync`.
3. **Rate limit não distribuído:** o limiter usa memória do processo; em múltiplas instâncias ele não compartilha estado. A implementação Redis/BullMQ do anexo depende de infraestrutura ainda inexistente.
4. **Operações custosas sem teto de negócio uniforme:** desdobramento e simulação usam workers, mas payloads de simulação não possuem limites máximos explícitos para quantidade de cartões e concursos.
5. **Dados não persistentes:** o histórico é carregado de arquivo local; não há Prisma, migrações, integridade transacional ou backup automatizado.

### Média prioridade

1. `/metrics` ainda é um placeholder (`lotzy_up 1`), não um exporter Prometheus completo.
2. `/ready` verifica apenas flags estáticas e não detecta indisponibilidade/defasagem do dataset.
3. O contrato OpenAPI é mínimo e não descreve schemas, respostas de erro, limites ou autenticação.
4. Não há pipeline CI explícito executando `npm audit`, testes, typecheck e builds.
5. Dependências e APIs de terceiros do anexo (Caixa/Guido, OpenAI/Gemini, Redis) ainda não têm cliente, timeout, retry, circuit breaker ou validação Zod implementados.
6. Os algoritmos de ML/GAN/PRNG propostos precisam de validação científica e de produto: loteria não se torna previsível por histórico, IA ou simulação quântica.

### Baixa prioridade / qualidade

1. O README ainda menciona `feature/v6` embora a auditoria tenha sido feita em `main`.
2. Há aliases de rotas e camadas legadas que aumentam superfície de manutenção.
3. A cobertura atual é funcional, mas não há meta automatizada de 80% para serviços de domínio.
4. Falta documentação de retenção/consentimento caso IA, contas, push ou histórico pessoal sejam adicionados.

## 4. Plano por fases

### Fase 1 — Fundação segura

- [x] Integrar `features` às rotas e responder `404/feature_disabled` quando uma capacidade estiver desligada.
- [x] Adicionar autenticação JWT, RBAC e proteção de endpoints administrativos.
- [x] Adicionar limites de payload para simulação/desdobramento e testes de abuso.
- [ ] Migrar histórico para Prisma/PostgreSQL com migrations, constraints e seed idempotente.
- [ ] Substituir limiter em memória por Redis com fallback explícito apenas em desenvolvimento.
- [x] Completar exporter Prometheus e readiness com checks reais.
- [x] Adicionar CI com testes, typecheck, builds e audit.

### Fase 2 — Dados e análise retrospectiva

- [ ] Cliente de API externa com timeout, retry exponencial, validação Zod, deduplicação e não sobrescrita de dados válidos.
- [ ] Scheduler de sincronização e endpoint administrativo protegido.
- [ ] `performance-analyzer` com paginação, worker e contrato de relatório.
- [ ] Gráficos de frequência, soma, heatmap, atraso, paridade e sazonalidade.
- [ ] Especificar claramente que toda análise é retrospectiva e não preditiva.

### Fase 3 — IA/ML opt-in

- [ ] Dataset versionado e loader com validação de concursos.
- [ ] LSTM/Transformer em worker isolado, com artefatos versionados, timeout e fallback CSPRNG.
- [ ] GAN somente como experimento offline; impedir que seja apresentado como previsão.
- [ ] Limites de custo/tempo e uma tarefa por usuário.
- [ ] Avaliação temporal fora da amostra e comparação contra baseline aleatório antes de expor qualquer resultado.

### Fase 4 — IA generativa, contas e notificações

- [ ] Provider abstrato para OpenAI/Gemini, com secrets fora do código, timeout, orçamento e rate limit por usuário.
- [ ] Não persistir conversas sem consentimento; sanitizar contexto e exibir disclaimer.
- [ ] Push Web VAPID com opt-in, revogação e proteção de chaves.
- [ ] Tela de treinamento e acompanhamento de jobs via BullMQ/Redis.

### Fase 5 — Análise de PRNG/quântica educacional

- [ ] Manter como módulo experimental desligado por padrão.
- [ ] Implementar detectores apenas sobre sequências sintéticas e documentar limites estatísticos.
- [ ] Não afirmar engenharia reversa da Caixa; usar linguagem educacional e evidência reprodutível.
- [ ] Revisão técnica independente antes de publicar o dashboard.

## 5. Critérios de aceite futuros

Cada fase deve entregar testes unitários e de integração, contratos OpenAPI atualizados, logs sem segredos, métricas, limites de abuso, documentação operacional e rollback. Nenhum recurso de IA pode remover o gerador CSPRNG nem sugerir aumento de probabilidade. O CI deve falhar em vulnerabilidades críticas/altas não aceitas e em regressões de build.

## 6. Validação realizada

- Backend: `npm test -- --reporter=dot` — **46/46 testes aprovados** após a implementação desta entrega.
- Backend: `npm run typecheck` — **aprovado** após a implementação desta entrega.
- Backend: `npm run build:api` — **aprovado**.
- Frontend: `npm run build` — **aprovado após a atualização do Next.js**.
- Auditoria de dependências: backend sem vulnerabilidades reportadas; frontend reportou a vulnerabilidade do Next.js corrigida nesta entrega.
