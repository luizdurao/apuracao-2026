"""Lê o CSV do boletim de urna (bweb) de uma UF pelo stdin e imprime JSON com a hora de
recebimento do último BU de presidente (= quando a UF fechou), mais p50/p90/p99."""
import sys, csv, json
uf = sys.argv[1]
r = csv.reader(sys.stdin, delimiter=';')
h = next(r)
ix = {n.strip('"'): i for i, n in enumerate(h)}
need = ['DS_CARGO_PERGUNTA', 'DT_BU_RECEBIDO', 'NR_ZONA', 'NR_SECAO', 'CD_MUNICIPIO']
missing = [k for k in need if k not in ix]
if missing:
    print(json.dumps({"uf": uf, "erro": f"colunas ausentes {missing}", "colunas": h[:40]})); sys.exit(0)
seen = {}
sample = []
for row in r:
    if len(sample) < 2: sample.append({'cargo': row[ix['DS_CARGO_PERGUNTA']] if len(row)>ix['DS_CARGO_PERGUNTA'] else None, 'dt': row[ix['DT_BU_RECEBIDO']] if len(row)>ix['DT_BU_RECEBIDO'] else None, 'ncols': len(row), 'nhead': len(h)})
    if len(row) <= max(ix.values()): continue
    if row[ix['DS_CARGO_PERGUNTA']].strip().lower() != 'presidente': continue
    key = (row[ix['CD_MUNICIPIO']], row[ix['NR_ZONA']], row[ix['NR_SECAO']])
    if key in seen: continue
    raw = row[ix['DT_BU_RECEBIDO']].strip()   # "2026-10-04 18:25:49" (layout 2026) ou "04/10/2026" + HH_BU_RECEBIDO
    t = row[ix['HH_BU_RECEBIDO']].strip() if 'HH_BU_RECEBIDO' in ix else ''
    parts = raw.split()
    d = parts[0] if parts else ''
    if len(parts) > 1 and not t: t = parts[1]
    if not t or not d: continue
    if '/' in d:
        dd, mm, yy = d.split('/'); d = f"{yy}-{mm}-{dd}"
    seen[key] = f"{d}T{t}"
ts = sorted(seen.values()); n = len(ts)
if n == 0:
    print(json.dumps({"uf": uf, "erro": "nenhuma seção", "amostra": sample})); sys.exit(0)
q = lambda p: ts[min(n - 1, int(n * p))]
print(json.dumps({"uf": uf, "secoes": n, "primeiro": ts[0], "p50": q(.5), "p90": q(.9), "p99": q(.99), "fechou": ts[-1]}))
