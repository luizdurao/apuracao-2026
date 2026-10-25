// Coleta as parciais do TSE (Brasil e exterior) e acrescenta ao histórico em data/.
// Executado pela GitHub Action a cada 5 minutos durante a apuração.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ELE = '6258';
const BASE = `https://resultados.tse.jus.br/oficial/ele2026/${ELE}/dados/`;
const UFS = ['ac','al','am','ap','ba','ce','df','es','go','ma','mg','ms','mt','pa','pb','pe','pi','pr','rj','rn','ro','rr','rs','sc','se','sp','to'];
const FONTES = [
  { uf: 'br', arquivo: 'data/historico-br.json' },
  { uf: 'zz', arquivo: 'data/historico-zz.json' },
];
const num = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const idOf = j => { const [d, m, y] = (j.dg || '').split('/'); return `${y}${m}${d}-${(j.hg || '').replace(/:/g, '')}`; };

function flat(j) {
  const cand = [];
  for (const a of j.carg?.[0]?.agr ?? []) for (const p of a.par ?? []) for (const k of p.cand ?? [])
    cand.push({ n: k.n, nmu: k.nmu, vap: num(k.vap), pvap: num(k.pvap) });
  return { order: idOf(j), ele: j.ele, dg: j.dg, hg: j.hg, pst: num(j.s?.pst), st: num(j.s?.st), ts: num(j.s?.ts),
    tv: num(j.v?.tv), vv: num(j.v?.vv), vb: num(j.v?.vb), vn: num(j.v?.vn), cand };
}

async function fetchJSON(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { headers: { 'user-agent': 'Mozilla/5.0 (apuracao-2026 coletor)', 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

await mkdir('data', { recursive: true });
let mudou = false;
for (const f of FONTES) {
  let hist = [];
  try { hist = JSON.parse(await readFile(f.arquivo, 'utf8')); } catch { /* primeiro run */ }
  try {
    const snap = flat(await fetchJSON(`${BASE}${f.uf}/${f.uf}-c0001-e00${ELE}-u.json`));
    if (!hist.some(h => h.order === snap.order)) {
      hist.push(snap); hist.sort((a, b) => a.order.localeCompare(b.order));
      await writeFile(f.arquivo, JSON.stringify(hist, null, 1));
      mudou = true;
      console.log(`${f.uf}: parcial ${snap.hg} gravada (${snap.pst}% das seções)`);
    } else console.log(`${f.uf}: sem parcial nova (${snap.hg})`);
  } catch (e) { console.error(`${f.uf}: falha na coleta: ${e.message}`); }
}
// Estados: um snapshot por UF por parcial, tudo em data/historico-uf.json ({uf: [snapshots]}).
// Para não inflar o arquivo, cada UF guarda só a parcial mais recente de cada percentual de seções distinto
// e sempre a última; a hora de fechamento é a primeira parcial com pst = 100.
{
  const arq = 'data/historico-uf.json';
  let hist = {};
  try { hist = JSON.parse(await readFile(arq, 'utf8')); } catch {}
  const results = await Promise.allSettled(UFS.map(async uf => [uf, flat(await fetchJSON(`${BASE}${uf}/${uf}-c0001-e00${ELE}-u.json`))]));
  let m = false;
  for (const r of results) {
    if (r.status !== 'fulfilled') { console.error(`uf: falha: ${r.reason?.message}`); continue; }
    const [uf, snap] = r.value;
    const list = hist[uf] ?? (hist[uf] = []);
    if (list.some(h => h.order === snap.order)) continue;
    const done = list.find(h => h.pst >= 100);
    if (done && snap.pst >= 100) continue;           // já fechou: não acumula repetições
    list.push(snap); list.sort((a, b) => a.order.localeCompare(b.order)); m = true;
  }
  if (m) { await writeFile(arq, JSON.stringify(hist)); mudou = true; console.log('uf: histórico atualizado'); }
}
process.exitCode = 0;
if (mudou) console.log('CHANGED=1');
