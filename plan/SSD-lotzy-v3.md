# SSD — Lotzy v3 (branch `feature/v3`)

## 1. Objetivo e limite do produto

O Lotzy é uma ferramenta independente para organizar jogos da Lotofácil, validar combinações e apresentar métricas descritivas. Ele não registra apostas, não prevê o próximo sorteio e não aumenta a probabilidade matemática de qualquer combinação. A interface deve manter esse limite explícito em geração, filtros, validação e análise.

A especificação consolida o código existente da API e as funcionalidades observáveis nas referências fornecidas. Recursos que não existem no contrato atual, como fechamentos matemáticos catalogados, assinatura, bolão, conta de usuário, previsão de dezenas e cálculo de prêmio baseado em rateio externo, não são inventados na interface.

## 2. Inventário consolidado sem duplicação

| Área | Funcionalidade consolidada | Implementação Lotzy |
|---|---|---|
| Geração | Gerar de 1 a 500 jogos com 15 a 20 dezenas e jogos únicos | `POST /api/v1/games/generate-random` e tela `/` |
| Filtros | Fixar dezenas, excluir dezenas e definir faixa de soma | `POST /api/v1/games/generate-filtered` e tela `/filtros` |
| Catálogo | Exibir domínio, natureza e advertências dos filtros disponíveis | `GET /api/v1/games/filters` |
| Validação | Confirmar uma combinação manual ou um lote gerado | `POST /api/v1/games/validate` para combinação manual; `/games/analyze` para lote |
| Análise | Exibir soma média, desvio da soma, popularidade, métricas e diversidade disponíveis na API | `POST /api/v1/games/analyze` e tela `/analisar` |
| Histórico | Consultar concursos com data, dezenas, período, concurso e ordem | `GET /api/history` e tela `/history` |
| Ajuda | Explicar o fluxo e os limites de uso | tela `/ajuda` |
| Conferência | Comparar jogos com dezenas informadas e identificar faixas de acerto | contrato existente `POST /api/v1/games/check`; mantido para evolução sem duplicar a validação |
| Desdobramento | Expandir 16–20 dezenas em combinações de 15 | contrato existente `POST /api/v1/games/expand`; não duplicado na UI atual |
| Responsabilidade | Avisos sobre equiprobabilidade, validade e limite financeiro | `disclaimer` da API + copy de interface |

## 3. Fluxo de navegação

O fluxo principal é deliberadamente linear:

`Gerar (/)` → `Filtros (/filtros)` opcional → `Validar (/validar)` → `Analisar (/analisar)`.

A geração simples leva o lote para `/validar` antes de exibir seus jogos. A geração com filtros faz o mesmo. O lote temporário é armazenado apenas no `sessionStorage` do navegador e é removido após a validação. Não há persistência de apostas ou envio a terceiros.

As áreas auxiliares são `Histórico (/history)` e `Ajuda (/ajuda)`. Os aliases legados `/conferir`, `/ferramentas` e `/carteira` permanecem redirecionados, mas `/filtros` e `/analisar` deixaram de ser redirects genéricos e passaram a ser telas reais.

## 4. Contratos reutilizados

A camada `frontend/src/lib/api.ts` é a única entrada de rede do cliente. Ela centraliza a URL da API, valida respostas do gerador e do histórico com Zod, formata moeda em centavos e normaliza a entrada textual de dezenas. A interface não reimplementa soma, paridade, popularidade, diversidade, custo ou combinatória.

O custo exibido para um lote multiplica o custo unitário retornado pela API pela quantidade gerada. Isso evita apresentar o custo de uma aposta como se fosse o custo do lote. As mensagens sobre filtros são derivadas do catálogo retornado por `/games/filters`; a interface não cria faixas “ideais” ou promessas históricas.

## 5. Requisitos de experiência

A navegação permanece responsiva e com foco visível. O volante mantém células de pelo menos 44 pixels, estados textuais via `aria-label` e quatro estados já existentes: disponível, marcada, fixa e excluída. A cor não é a única forma de comunicar estado. A interface respeita `prefers-reduced-motion`.

Os resultados são apresentados como dados descritivos. Popularidade é tratada como uma característica comportamental do padrão, não como previsão. Qualquer advertência de equiprobabilidade permanece próxima da ação ou do resultado correspondente.

## 6. Não incorporado por ausência de contrato

As referências apresentam recursos que não têm implementação correspondente no branch: dados diários externos da Caixa, resultados atualizados por integração externa, login, assinatura, bolão, fechamentos proprietários com garantias, previsões quentes/médias/frias, simulador histórico completo, cálculo automático de rateio, impressão oficial e carteira persistente. Esses itens foram registrados para rastreabilidade, mas foram excluídos da implementação por não existirem na API atual e para cumprir a regra de não inventar funcionalidade.

## 7. Critérios de aceite

`npm run build` deve compilar a API e o frontend. `npm run dev` deve iniciar a API na porta definida pelo backend e `npm run dev:frontend` deve iniciar o Next na porta 3001. O teste manual deve confirmar que gerar simples e gerar filtrado chegam a `/validar`, que a validação encaminha para `/analisar`, que a combinação manual exibe a resposta da API e que histórico e ajuda permanecem navegáveis.

## Referências

[1]: https://asloterias.com.br/gerador-lotofacil "Gerador Lotofácil de Números e Jogos Online"
[2]: https://www.ganhemaisfacil.com.br/ "Gerador e Simulador Para Lotofácil"
[3]: https://www.ganhemaisfacil.com.br/lotofacil/dicas/ "Dicas para jogar na Lotofácil"
[4]: https://www.ganhemaisfacil.com.br/lotofacil/estatisticas/ "Estatística da Lotofácil"
[5]: https://www.ganhemaisfacil.com.br/lotofacil/criarjogos/ "Simulador Lotofácil"
[6]: https://lotocarva.com/gerador-de-jogos/lotofacil "Gerador de Jogos Lotofácil Online"
[7]: https://lotocarva.com/estatistica/lotofacil "Estatísticas Lotofácil"
[8]: https://lotocarva.com/ferramentas/conferir/lotofacil "Conferidor Lotofácil"
[9]: https://geradordasorte.com.br/blog/gerador-de-numeros-da-lotofacil/ "Gerador de Números da Lotofácil"
[10]: https://www.calculoconfiavel.com.br/gerador-de-numeros-aleatorios-da-lotofacil "Gerador de Números Aleatórios da Lotofácil"
