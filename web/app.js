/* Isometric low-poly village — Canvas2D, zero deps. Works for Hermes + OpenCode. */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const repoSel = document.getElementById('repo');
let S = null, repo = '', artifactsCache = {};
const TW = 64, TH = 32; let OX = 480, OY = 180;
const iso = (x, y) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2];

const HUTS = { ARCHITECT: {gx: 1.5, gy: 1.5, c: '#5aa9e6'}, CODER: {gx: 8.5, gy: 1.5, c: '#7bd88a'}, TESTER: {gx: 1.5, gy: 8.5, c: '#e07a5f'}, MANAGER: {gx: 8.5, gy: 8.5, c: '#b388eb'} };
const SQ = {gx: 5, gy: 5};
const V = {};
Object.keys(HUTS).forEach((r, i) => V[r] = {role: r, x: SQ.gx + (i - 1.5), y: SQ.gy + (i % 2 ? 1 : -1), tx: 0, ty: 0, bubble: '', bt: 0, col: HUTS[r].c, wt: 0});
let hitZones = [];

function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(); }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) * f, g = ((n >> 8) & 255) * f, b = (n & 255) * f; return `rgb(${r|0},${g|0},${b|0})`; }

function drawTile(gx, gy, base) {
  const [x, y] = iso(gx, gy), [x1, y1] = iso(gx + 1, gy), [x2, y2] = iso(gx + 1, gy + 1), [x3, y3] = iso(gx, gy + 1);
  poly([[x, y], [x1, y1], [x2, y2], [x3, y3]], base);
}
function drawHut(gx, gy, color, label, active) {
  const [x, y] = iso(gx + .5, gy + .5);
  const w = 44, h = 34;
  poly([[x - w, y], [x, y - w / 2 - 6], [x + w, y], [x, y + w / 2 - 6]], shade(color, .55)); // ground
  poly([[x - 26, y - 6], [x - 26, y - 34], [x + 26, y - 34], [x + 26, y - 6]], shade(color, .9)); // walls
  poly([[x - 32, y - 32], [x, y - 58], [x + 32, y - 32]], shade(color, 1.15)); // low-poly roof
  poly([[x - 32, y - 32], [x, y - 20], [x + 32, y - 32]], shade(color, .7));
  if (active) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x + 18, y - 20, 5, 0, 7); ctx.fill(); } // lamp = active
  ctx.fillStyle = '#0c1612'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + 14);
  hitZones.push({kind: 'hut', id: label, x: x - 34, y: y - 60, w: 68, h: 80});
}
function drawVillager(v) {
  const [x, y] = iso(v.x, v.y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 12, 5, 0, 0, 7); ctx.fill();
  poly([[x - 9, y - 2], [x + 9, y - 2], [x, y - 26]], v.col); // low-poly body
  ctx.fillStyle = '#f1d3a5'; ctx.beginPath(); ctx.arc(x, y - 30, 7, 0, 7); ctx.fill(); // head
  ctx.fillStyle = '#0c1612'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(v.role[0], x, y - 27);
  if (v.bt > Date.now()) {
    ctx.font = '12px sans-serif'; const t = v.bubble; const w = Math.min(220, ctx.measureText(t).width + 16);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#234';
    const bx = Math.min(Math.max(x - w / 2, 6), cv.width - w - 6);
    ctx.beginPath(); ctx.roundRect(bx, y - 92, w, 34, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillText(t.slice(0, 42), bx + w / 2, y - 78); ctx.fillText(t.slice(42, 84), bx + w / 2, y - 65);
  }
  hitZones.push({kind: 'villager', id: v.role, x: x - 14, y: y - 40, w: 28, h: 44});
}
function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height); hitZones = [];
  for (let gx = 0; gx < 10; gx++) for (let gy = 0; gy < 10; gy++)
    drawTile(gx, gy, (gx + gy) % 2 ? '#1d3327' : '#21392c');
  const [sx, sy] = iso(SQ.gx + .5, SQ.gy + .5);
  poly([[sx - 60, sy], [sx, sy - 30], [sx + 60, sy], [sx, sy + 30]], '#2a4636'); // square
  ctx.fillStyle = '#cfe3d4'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(S && S.meeting ? '◉ TOWN MEETING' : 'TOWN SQUARE', sx, sy + 4);
  Object.entries(HUTS).forEach(([r, h]) => drawHut(h.gx, h.gy, h.c, r, S && S.current_agent === r));
  // trees
  [[3, 2], [7, 3], [2, 6], [6, 7]].forEach(([gx, gy]) => { const [x, y] = iso(gx, gy); poly([[x - 12, y], [x + 12, y], [x, y - 30]], '#2d6a4f'); });
  Object.values(V).sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(drawVillager);
}
function step() {
  const t = Date.now();
  Object.values(V).forEach((v, i) => {
    if (S && S.meeting) { v.tx = SQ.gx + .5 + (i - 1.5) * .7; v.ty = SQ.gy + .5 + (i % 2 ? .6 : -.6); }
    else if (S && S.current_agent === v.role) { v.tx = HUTS[v.role].gx + .5; v.ty = HUTS[v.role].gy + 1.4; }
    else if (t > v.wt) { v.tx = 2 + Math.random() * 6; v.ty = 2 + Math.random() * 6; v.wt = t + 4000 + Math.random() * 4000; }
    v.x += (v.tx - v.x) * .03; v.y += (v.ty - v.y) * .03;
  });
  draw(); requestAnimationFrame(step);
}
async function poll() {
  try {
    const r = await fetch('/api/village/state?repo=' + encodeURIComponent(repo));
    S = await r.json();
    document.getElementById('provider').textContent = S.provider + ' · ' + S.project;
    document.getElementById('status').textContent = S.status + ' · ' + S.current_agent;
    document.getElementById('iter').textContent = 'iter ' + S.iteration;
    document.getElementById('meeting').classList.toggle('hidden', !S.meeting);
    // assign bubbles
    (S.talks || []).slice(-4).forEach((tk, i) => {
      const roles = Object.keys(V); const v = V[tk.author] || V[roles[i % 4]];
      if (v) { v.bubble = tk.text; v.bt = Date.now() + 9000; }
    });
    document.getElementById('talks').innerHTML = (S.talks || []).slice(-8).reverse().map(t => `<li><b>${t.author}</b> · ${t.text}</li>`).join('');
    document.getElementById('mems').innerHTML = (S.memories || []).map(m => `<li><b>${m.source}</b> · ${m.text}</li>`).join('');
    document.getElementById('issues').innerHTML = (S.open_issues || []).map(x => `<li>${x}</li>`).join('');
  } catch (e) { /* server starting */ }
  setTimeout(poll, 3000);
}
cv.addEventListener('click', async e => {
  const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / r.width, my = (e.clientY - r.top) * cv.height / r.height;
  const z = hitZones.find(z => mx > z.x && mx < z.x + z.w && my > z.y && my < z.y);
  if (!z) return;
  const ar = await (await fetch('/api/village/artifacts?repo=' + encodeURIComponent(repo))).json();
  const map = {ARCHITECT: 'plan', CODER: 'report', TESTER: 'test_report', MANAGER: 'review'};
  const key = z.kind === 'villager' ? map[z.id] : (map[z.id] ? map[z.id] : 'brief');
  document.getElementById('pTitle').textContent = z.id;
  document.getElementById('pBody').textContent = (ar.artifacts[key] || '(no artifact yet)').slice(-3000);
});
async function init() {
  const rs = await (await fetch('/api/village/repos')).json();
  repoSel.innerHTML = rs.repos.map(r => `<option>${r}</option>`).join('');
  repo = rs.repos[0] || ''; repoSel.value = repo;
  repoSel.onchange = () => repo = repoSel.value;
  poll(); requestAnimationFrame(step);
}
function fit() { const st = document.getElementById('stage'); cv.width = st.clientWidth; cv.height = st.clientHeight; OX = cv.width / 2; OY = 120; }
window.addEventListener('resize', fit); fit(); init();
