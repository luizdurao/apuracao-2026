"""Agrega o boletim de urna do 1º turno (bweb) por município: seções, comparecimento, votos de
Flávio (22), Lula (13), demais nominais, brancos e nulos. Saída: data/mun-1t.json
  {"<cd_municipio>": {"uf":"SP","nm":"SÃO PAULO","sec":N,"comp":N,"f":N,"l":N,"o":N,"vb":N,"vn":N}}
"""
import sys, csv, io, json, os, tempfile, zipfile, urllib.request
from collections import defaultdict

BASE = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb/bweb_1t"
STAMP = "051020261403"
UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO ZZ".split()
out = {}
for uf in UFS:
    tmp = tempfile.NamedTemporaryFile(suffix='.zip', delete=False).name
    try:
        urllib.request.urlretrieve(f"{BASE}_{uf}_{STAMP}.zip", tmp)
        z = zipfile.ZipFile(tmp)
        name = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        f = io.TextIOWrapper(z.open(name), encoding='latin1', newline='')
        r = csv.reader(f, delimiter=';')
        h = [c.strip('"') for c in next(r)]
        ix = {n: i for i, n in enumerate(h)}
        mun = defaultdict(lambda: {"uf": uf, "nm": "", "sec": 0, "comp": 0, "f": 0, "l": 0, "o": 0, "vb": 0, "vn": 0})
        secs = set()
        for row in r:
            if len(row) < len(h): continue
            if row[ix['DS_CARGO_PERGUNTA']].strip().lower() != 'presidente': continue
            cd = row[ix['CD_MUNICIPIO']].strip(); m = mun[cd]
            if not m["nm"]: m["nm"] = row[ix['NM_MUNICIPIO']].strip()
            key = (cd, row[ix['NR_ZONA']], row[ix['NR_SECAO']])
            if key not in secs:
                secs.add(key); m["sec"] += 1
                try: m["comp"] += int(row[ix['QT_COMPARECIMENTO']])
                except Exception: pass
            tipo = row[ix['CD_TIPO_VOTAVEL']].strip(); nr = row[ix['NR_VOTAVEL']].strip()
            try: q = int(row[ix['QT_VOTOS']])
            except Exception: q = 0
            if tipo == '1':
                if nr == '22': m["f"] += q
                elif nr == '13': m["l"] += q
                else: m["o"] += q
            elif tipo == '2': m["vb"] += q
            elif tipo == '3': m["vn"] += q
        out.update(mun)
        print(f"{uf}: {len(mun)} municípios", file=sys.stderr)
    except Exception as e:
        print(f"{uf}: falha {e}", file=sys.stderr)
    finally:
        try: os.remove(tmp)
        except Exception: pass
json.dump(out, open('data/mun-1t.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f"total {len(out)} municípios", file=sys.stderr)
