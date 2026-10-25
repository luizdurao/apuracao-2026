#!/usr/bin/env bash
# Calcula, por UF, a hora em que a apuração do 1º turno (04/10/2026) fechou, a partir do
# boletim de urna aberto do TSE (bweb): colunas DT_BU_RECEBIDO / HH_BU_RECEBIDO.
# "fechou" = hora de recebimento do último BU de presidente da UF; também grava a hora em
# que 50%, 90% e 99% das seções já tinham sido recebidas, e o total de seções.
# Saída: data/fechamento-1t.json
set -euo pipefail
UFS="AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO ZZ"
BASE="https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb"
STAMP="${BWEB_STAMP:-051020261403}"
mkdir -p data tmp
echo "{" > tmp/out.json
first=1
for uf in $UFS; do
  zip="tmp/$uf.zip"
  if ! curl -fsSL --retry 3 -o "$zip" "$BASE/bweb_1t_${uf}_${STAMP}.zip"; then echo "$uf: download falhou"; continue; fi
  csv=$(unzip -Z1 "$zip" | grep -i '\.csv$' | head -1)
  # Lê o CSV (latin1, ';', aspas), filtra cargo Presidente e extrai timestamp de recebimento por seção
  unzip -p "$zip" "$csv" | iconv -f latin1 -t utf8 | python3 - "$uf" <<'EOF' >> tmp/out.json
import sys, csv
uf = sys.argv[1]
r = csv.reader(sys.stdin, delimiter=';')
h = next(r)
ix = {n: i for i, n in enumerate(h)}
need = ['DS_CARGO_PERGUNTA', 'DT_BU_RECEBIDO', 'HH_BU_RECEBIDO', 'NR_ZONA', 'NR_SECAO', 'CD_MUNICIPIO']
if not all(k in ix for k in need):
    sys.stderr.write(f"{uf}: colunas ausentes {[k for k in need if k not in ix]}\n"); sys.exit(0)
seen = {}
for row in r:
    if row[ix['DS_CARGO_PERGUNTA']].strip().lower() != 'presidente': continue
    key = (row[ix['CD_MUNICIPIO']], row[ix['NR_ZONA']], row[ix['NR_SECAO']])
    if key in seen: continue
    d, t = row[ix['DT_BU_RECEBIDO']].strip(), row[ix['HH_BU_RECEBIDO']].strip()
    if not t: continue
    dd, mm, yy = d.split('/')
    seen[key] = f"{yy}-{mm}-{dd}T{t}"
ts = sorted(seen.values())
n = len(ts)
if n == 0:
    sys.stderr.write(f"{uf}: nenhuma seção\n"); sys.exit(0)
q = lambda p: ts[min(n-1, int(n*p))]
import json
sys.stdout.write(json.dumps({uf: {"secoes": n, "p50": q(.5), "p90": q(.9), "p99": q(.99), "fechou": ts[-1], "primeiro": ts[0]}})[1:-1] + ",\n")
sys.stderr.write(f"{uf}: {n} seções, fechou {ts[-1]}\n")
EOF
  rm -f "$zip"
done
# fecha o JSON (remove a última vírgula)
python3 - <<'EOF'
import re, json
s = open('tmp/out.json').read().rstrip().rstrip(',') + "\n}"
d = json.loads(s)
json.dump(d, open('data/fechamento-1t.json', 'w'), ensure_ascii=False, indent=1)
print("UFs:", len(d))
EOF
rm -rf tmp
