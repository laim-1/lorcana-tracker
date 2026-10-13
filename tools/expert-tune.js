// node tools/expert-tune.js iters games -> hill-climbs Expert's evalBoard weights (EW) vs Hard via expert-par.sh
const { execSync } = require("child_process"); const fs = require("fs");
const [IT = 20, G = 64] = process.argv.slice(2).map(Number); const XO = process.env.XO || '{"rep":2}';
const run = w => { const o = execSync(`sh tools/expert-par.sh ${G} 7 expert hard`, { env: { ...process.env, XO, EW: JSON.stringify(w) } }).toString(); return parseFloat(JSON.parse(o.split("\n")[0]).all) };
let best = JSON.parse(process.env.START || '{"lo":12,"ob":1,"h":2,"ic":8,"ink":3,"oh":1.5,"mv":1,"ex":0.45,"ml":3,"at":3,"ol":5,"th":400}'), bs = run(best); console.log("start", bs, JSON.stringify(best));
let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < IT; i++) { const w = { ...best }, ks = Object.keys(w); for (let j = 0; j < 3; j++) { const k = ks[Math.floor(r() * ks.length)]; w[k] = +(w[k] * (r() < 0.5 ? 1.6 : 1 / 1.6)).toFixed(3) }
  const s = run(w); const acc = s > bs + 2; console.log(i, s, acc ? "ACCEPT" : "", JSON.stringify(w)); if (acc) { best = w; bs = (s + bs) / 2 } fs.writeFileSync("/tmp/ew-best.json", JSON.stringify(best)) }
console.log("BEST", JSON.stringify(best));
