#!/usr/bin/env bash
# Hora de fechamento de cada UF no 1º turno, a partir do boletim de urna aberto do TSE (bweb).
# Saída: data/fechamento-1t.json ({UF:{secoes,primeiro,p50,p90,p99,fechou}}) e data/fechamento-1t.log
set -uo pipefail
UFS="AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO ZZ"
BASE="https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb"
STAMP="${BWEB_STAMP:-051020261403}"
mkdir -p data tmp
: > tmp/linhas.jsonl
for uf in $UFS; do
  zip="tmp/$uf.zip"
  if ! curl -fsSL --retry 3 -o "$zip" "$BASE/bweb_1t_${uf}_${STAMP}.zip"; then echo "{\"uf\":\"$uf\",\"erro\":\"download falhou\"}" >> tmp/linhas.jsonl; continue; fi
  csv=$(unzip -Z1 "$zip" | grep -i '\.csv$' | head -1)
  if [ -z "$csv" ]; then echo "{\"uf\":\"$uf\",\"erro\":\"csv não encontrado: $(unzip -Z1 "$zip" | tr '\n' ' ')\"}" >> tmp/linhas.jsonl; rm -f "$zip"; continue; fi
  unzip -p "$zip" "$csv" | iconv -f latin1 -t utf8 | python3 scripts/fechamento_uf.py "$uf" >> tmp/linhas.jsonl
  rm -f "$zip"
  tail -1 tmp/linhas.jsonl
done
python3 - <<'EOF2'
import json
out, log = {}, []
for line in open('tmp/linhas.jsonl'):
    line = line.strip()
    if not line: continue
    d = json.loads(line); log.append(line)
    if 'erro' not in d: out[d.pop('uf')] = d
json.dump(out, open('data/fechamento-1t.json', 'w'), ensure_ascii=False, indent=1)
open('data/fechamento-1t.log', 'w').write("\n".join(log) + "\n")
print("UFs ok:", len(out))
EOF2
rm -rf tmp
