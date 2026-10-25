# Apuração 2026 · Presidente

Painel estático que acompanha a apuração do 2º turno presidencial de 2026 (eleição TSE 6258) hora a hora e compara com o 1º turno: horário do TSE, seções apuradas, votos totais e válidos, % dos válidos e vantagem em p.p., Brasil e exterior.

- `index.html` lê o JSON oficial do TSE direto no navegador (1x por minuto) e o histórico em `data/`.
- `scripts/coletar.mjs` + `.github/workflows/coletar.yml` gravam uma parcial a cada 5 min em `data/historico-br.json` e `data/historico-zz.json`.
- Parciais do 1º turno: compiladas de coberturas ao vivo (Bloomberg Línea, TVT) e do resultado final do TSE.

Fonte: https://resultados.tse.jus.br — somente o TSE proclama o resultado.
