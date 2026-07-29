# 🍀 Loto+Facil

App de **análise estatística e geração de jogos** de loterias da Caixa. Roda no
navegador, funciona **offline** e pode ser **instalado** como aplicativo (PWA).

**▶️ Acesse:** https://conradosouza.github.io/lotomaisfacil/

## Loterias suportadas

Lotofácil · Mega-Sena · Quina · Lotomania · Dupla Sena · Dia de Sorte
(troque no seletor do topo — cada uma com sua cor e suas regras).

## Recursos

- **Painel** — resumo, último concurso, dezenas mais quentes e mais atrasadas
- **Dezenas** — Score 0–100 por número (frequência + atraso + repetição + afinidade)
- **Padrões** — pares/ímpares, soma, faixas, repetição e duplas que mais saem
- **Gerar** — gerador por estratégias (presets + filtros) e **fechamentos** com
  garantia de prêmio mínimo verificada
- **Lab** — laboratório de estratégias com **backtesting** (walk-forward) e **Monte Carlo**
- **Conferir** — testa um jogo em todo o histórico
- **Meus jogos** — salve apostas e acompanhe os acertos a cada concurso

## Atualização dos concursos

Um robô (GitHub Actions) busca os concursos novos automaticamente todo dia.
Manualmente: `node scripts/atualizar.js`.

## Aviso

As loterias são sorteios **aleatórios**. Nenhuma estatística prevê o próximo
resultado. Este app é uma ferramenta de **estudo e diversão** — não garante prêmio.
