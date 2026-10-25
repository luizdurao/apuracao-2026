// Coleta a parcial do 2º turno por município (arquivos de divulgação do TSE) → data/mun-2t.json
// {"hg":"20:01:08","dg":"25/10/2026","m":{"<cd>":[st,ts,tv,vv,f,l]}}
import { readFile, writeFile } from 'node:fs/promises';

const ELE = '6258';
const BASE = `https://resultados.tse.jus.br/oficial/ele2026/${ELE}/`;
const num = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const H = { 'user-agent': 'Mozilla/5.0 (apuracao-2026 coletor)', 'cache-control': 'no-cache' };
async function getJSON(url) { const r = await fetch(url + '?_=' + Date.now(), { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }

// lista de municípios: config do TSE; se falhar, usa os códigos do 1º turno (data/mun-1t.json)
let lista = [];
try {
  const cfg = await getJSON(`${BASE}config/mun-e00${ELE}-cm.json`);
  for (const uf of cfg.abr ?? []) for (const m of uf.mu ?? []) lista.push({ uf: String(uf.cd).toLowerCase(), cd: String(m.cd).padStart(5, '0') });
  console.log(`config: ${lista.length} municípios`);
} catch (e) {
  console.error('config indisponível, usando mun-1t:', e.message);
  const m1 = JSON.parse(await readFile('data/mun-1t.json', 'utf8'));
  lista = Object.entries(m1).filter(([, v]) => v.uf !== 'ZZ').map(([cd, v]) => ({ uf: v.uf.toLowerCase(), cd }));
}

let prev = { m: {} }; try { prev = JSON.parse(await readFile('data/mun-2t.json', 'utf8')); } catch {}
const out = { dg: prev.dg || null, hg: prev.hg || null, m: { ...prev.m } };   // mantém o que já tinha; substitui só o que buscar com sucesso
let ok = 0, falhas = 0;
// pula municípios já 100% apurados na coleta anterior; embaralha para distribuir falhas
const fila = lista.filter(({cd}) => { const v = prev.m?.[cd]; return !(v && v[1] > 0 && v[0] >= v[1]); }).sort(() => Math.random() - 0.5);
console.log(`fila: ${fila.length} municípios a consultar`);
const errosTipo = {};
async function worker() {
  while (fila.length) {
    const { uf, cd } = fila.shift();
    try {
      let j; try { j = await getJSON(`${BASE}dados/${uf}/${uf}${cd}-c0001-e00${ELE}-u.json`); }
      catch (e1) { await new Promise(r => setTimeout(r, 800)); j = await getJSON(`${BASE}dados/${uf}/${uf}${cd}-c0001-e00${ELE}-u.json`); }
      const cand = {};
      for (const a of j.carg?.[0]?.agr ?? []) for (const p of a.par ?? []) for (const k of p.cand ?? []) cand[k.n] = num(k.vap);
      out.m[cd] = [num(j.s?.st), num(j.s?.ts), num(j.v?.tv), num(j.v?.vv), cand['22'] || 0, cand['13'] || 0];
      if (!out.hg || j.hg > out.hg) { out.hg = j.hg; out.dg = j.dg; }
      ok++;
    } catch (e) { falhas++; const k = String(e.message).slice(0, 12); errosTipo[k] = (errosTipo[k] || 0) + 1; }
    await new Promise(r => setTimeout(r, 120));
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
out.ok = ok; out.falhas = falhas; out.quando = new Date().toISOString(); out.erros = errosTipo;
console.log(`municípios: ${ok} ok, ${falhas} falhas, último carimbo ${out.hg}`);
if (ok > 0) await writeFile('data/mun-2t.json', JSON.stringify(out));
