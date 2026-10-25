// Coleta as parciais do TSE (Brasil e exterior) e acrescenta ao histórico em data/.
// Executado pela GitHub Action a cada 5 minutos durante a apuração.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ELE = '6258';
const BASE = `https://resultados.tse.jus.br/oficial/ele2026/${ELE}/dados/`;
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
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (apuracao-2026 coletor)', 'cache-control': 'no-cache' } });
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
process.exitCode = 0;
if (mudou) console.log('CHANGED=1');
