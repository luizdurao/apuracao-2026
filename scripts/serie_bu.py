"""Reconstrói a série de apuração (acumulada por minuto) de um pleito a partir do boletim de urna
aberto do TSE (bweb), usando a hora em que cada urna foi recebida pela totalização.

Uso: python3 serie_bu.py <saida.json> <rotulo> <cand_a:nome> <cand_b:nome> <bweb_base_url> <stamp> [UF ...]
Ex.: python3 serie_bu.py data/serie-2022.json 2022 22:Bolsonaro 13:Lula \\
       https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2022/buweb/bweb_2t 311020221535

Saída: {"rotulo", "ufs":{UF:{secoes,primeiro,p50,p99,fechou}}, "serie":[{t,sec,tv,vv,vb,vn,a,b}, ...]}
onde t = "AAAA-MM-DDTHH:MM" (bucket de 1 min), valores acumulados; a/b = votos dos dois candidatos.
"""
import sys, csv, io, json, os, subprocess, tempfile, zipfile, urllib.request
from collections import defaultdict

out_path, rotulo, ca, cb, base, stamp = sys.argv[1:7]
ufs = sys.argv[7:] or "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO ZZ".split()
NA, nomeA = ca.split(':'); NB, nomeB = cb.split(':')

por_min = defaultdict(lambda: [0, 0, 0, 0, 0, 0, 0])  # sec, tv, vv, vb, vn, a, b
ufs_info = {}

def parse_dt(raw, hh):
    raw = raw.strip(); parts = raw.split()
    d = parts[0] if parts else ''
    t = hh.strip() if hh else (parts[1] if len(parts) > 1 else '')
    if not d or not t: return None
    if '/' in d:
        dd, mm, yy = d.split('/'); d = f"{yy}-{mm}-{dd}"
    return f"{d}T{t[:5]}", f"{d}T{t}"

for uf in ufs:
    url = f"{base}_{uf}_{stamp}.zip"
    tmp = tempfile.NamedTemporaryFile(suffix='.zip', delete=False).name
    try:
        urllib.request.urlretrieve(url, tmp)
        z = zipfile.ZipFile(tmp)
        name = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        f = io.TextIOWrapper(z.open(name), encoding='latin1', newline='')
        r = csv.reader(f, delimiter=';')
        h = [c.strip('"') for c in next(r)]
        ix = {n: i for i, n in enumerate(h)}
        secs = {}           # (mun,zona,secao) -> minuto
        times = []
        for row in r:
            if len(row) < len(h): continue
            if row[ix['DS_CARGO_PERGUNTA']].strip().lower() != 'presidente': continue
            p = parse_dt(row[ix['DT_BU_RECEBIDO']], row[ix['HH_BU_RECEBIDO']] if 'HH_BU_RECEBIDO' in ix else None)
            if not p: continue
            tmin, tfull = p
            key = (row[ix['CD_MUNICIPIO']], row[ix['NR_ZONA']], row[ix['NR_SECAO']])
            b = por_min[tmin]
            if key not in secs:
                secs[key] = tmin; times.append(tfull); b[0] += 1
                try:
                    b[1] += int(row[ix['QT_COMPARECIMENTO']])
                except Exception: pass
            tipo = row[ix['CD_TIPO_VOTAVEL']].strip()
            nr = row[ix['NR_VOTAVEL']].strip()
            try: q = int(row[ix['QT_VOTOS']])
            except Exception: q = 0
            if tipo == '1':
                b[2] += q
                if nr == NA: b[5] += q
                elif nr == NB: b[6] += q
            elif tipo == '2': b[3] += q
            elif tipo == '3': b[4] += q
        times.sort(); n = len(times)
        if n:
            q = lambda p: times[min(n - 1, int(n * p))]
            ufs_info[uf] = {"secoes": n, "primeiro": times[0], "p50": q(.5), "p99": q(.99), "fechou": times[-1]}
        print(f"{uf}: {n} seções", file=sys.stderr)
    except Exception as e:
        print(f"{uf}: falha {e}", file=sys.stderr)
    finally:
        try: os.remove(tmp)
        except Exception: pass

serie = []; acc = [0] * 7
for t in sorted(por_min):
    v = por_min[t]
    for i in range(7): acc[i] += v[i]
    serie.append({"t": t, "sec": acc[0], "tv": acc[1], "vv": acc[2], "vb": acc[3], "vn": acc[4], "a": acc[5], "b": acc[6]})
json.dump({"rotulo": rotulo, "candA": {"n": NA, "nome": nomeA}, "candB": {"n": NB, "nome": nomeB}, "ufs": ufs_info, "serie": serie},
          open(out_path, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f"{rotulo}: {len(serie)} minutos, {acc[0]} seções, válidos {acc[2]}", file=sys.stderr)
