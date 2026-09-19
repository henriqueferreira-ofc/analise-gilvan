import Chart from 'chart.js/auto';

const $ = id => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const charts = new Map();
let data;
let busy = false;
let presenting = !reducedMotion.matches;
let nextRefresh = Date.now();
let highlight = 0;
const source = import.meta.env.VITE_DASHBOARD_DATA_URL || `${import.meta.env.BASE_URL}api/painel`;
const snapshotSource = `${import.meta.env.BASE_URL}dados-painel.json`;
const refreshInterval = 5000;
let live = false;
let useSnapshot = false;
function dataFingerprint(payload) {
  return JSON.stringify([payload.churches, payload.cargo, payload.departments, payload.politics, payload.evangelical, payload.countingBasis]);
}

function setBadge(text, className) {
  const badge = $('sync-badge');
  if (!badge) return;
  badge.className = className;
  const dot = document.createElement('span');
  dot.className = 'dot';
  badge.replaceChildren(dot, document.createTextNode(text));
}

function number(id, value) {
  const el = $(id);
  if (!el) return;
  const old = Number(el.dataset.value || 0);
  if (el.dataset.value === String(value)) return;
  el.dataset.value = String(value);
  const start = performance.now();
  cancelAnimationFrame(el.frame);
  function tick(now) {
    const progress = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 1000);
    el.textContent = Math.round(old + (value - old) * (1 - (1 - progress) ** 3)).toLocaleString('pt-BR');
    if (progress < 1) el.frame = requestAnimationFrame(tick);
  }
  el.frame = requestAnimationFrame(tick);
}

function chart(id, entries, donut = false, horizontal = false) {
  const labels = entries.map(entry => entry[0]);
  const values = entries.map(entry => entry[1]);
  if (charts.has(id)) {
    const existing = charts.get(id);
    existing.data.labels = labels;
    existing.data.datasets[0].data = values;
    existing.update();
    return;
  }
  charts.set(id, new Chart($(id), {
    type: donut ? 'doughnut' : 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: donut ? ['#35a1e4', '#ffe522'] : '#35a1e4', borderRadius: donut ? 0 : 6, maxBarThickness: 44 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: reducedMotion.matches ? false : { duration: 1000 },
      indexAxis: horizontal ? 'y' : 'x',
      ...(donut ? { cutout: '65%' } : { scales: { x: { beginAtZero: true }, y: { beginAtZero: true, ticks: { precision: 0 } } } }),
      plugins: { legend: { display: donut, position: 'bottom' } },
    },
  }));
}

function validate(payload) {
  const groups = ['cargo', 'departments', 'politics', 'evangelical'];
  if (!payload || !Array.isArray(payload.churches) || !payload.churches.length || !Number.isFinite(Date.parse(payload.updatedAt)) ||
      payload.churches.some(c => typeof c.name !== 'string' || !Number.isInteger(c.responses) || c.responses < 0) ||
      groups.some(key => !payload[key] || typeof payload[key] !== 'object' || Array.isArray(payload[key]) || Object.values(payload[key]).some(n => !Number.isInteger(n) || n < 0))) {
    throw new Error('Formato de dados inválido.');
  }
  return payload;
}

function render(payload) {
  const total = payload.churches.length;
  const filled = payload.churches.filter(c => c.responses > 0).length;
  const responses = payload.churches.reduce((sum, c) => sum + c.responses, 0);
  for (const [id, value] of Object.entries({ 'home-churches': total, 'home-filled': filled, 'home-total': responses, 'stat-churches': total, 'stat-filled': filled, 'stat-pending': total - filled, 'stat-total': responses })) number(id, value);
  $('sync-time').textContent = `Dados de ${new Date(payload.updatedAt).toLocaleString('pt-BR')}`;
  if ($('monitor-state')) $('monitor-state').textContent = live ? 'Monitoramento conectado' : 'Painel ativo';
  if (!$('dashboard')) return;
  $('coverage-bar').value = filled / total * 100;
  $('coverage-label').textContent = `${Math.round(filled / total * 100)}% com dados · ${filled} de ${total} unidades`;
  $('counting-note').textContent = payload.countingBasis || 'Uma unidade por aba de respostas da planilha.';
  const ranking = [...payload.churches].sort((a, b) => b.responses - a.responses);
  $('church-list').replaceChildren(...ranking.map(c => {
    const row = document.createElement('div');
    row.className = `church-row ${c.responses ? 'has-data' : 'no-data'}`;
    const name = document.createElement('strong'); name.textContent = c.name;
    const count = document.createElement('span'); count.textContent = c.responses ? `${c.responses} cadastros` : 'Sem dados';
    row.append(name, count);
    return row;
  }));
  document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = false; canvas.nextElementSibling.hidden = true; });
  const entries = ranking.map(c => [c.name, c.responses]);
  chart('chart-overview', entries);
  $('chart-setores').parentElement.style.height = `${Math.max(340, total * 35)}px`;
  chart('chart-setores', entries, false, true);
  chart('chart-cargo', Object.entries(payload.cargo), false, true);
  chart('chart-departamentos', Object.entries(payload.departments));
  for (const [id, group] of [['chart-evangelico', 'evangelical'], ['chart-politica', 'politics'], ['chart-engajamento', 'politics']]) chart(id, ['Sim', 'Não'].map(key => [key, payload[group][key] || 0]), true);
  $('sync-time').textContent = `Dados de ${new Date(payload.updatedAt).toLocaleString('pt-BR')}`;
}

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    let response = await fetch(useSnapshot ? snapshotSource : source, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    // Hospedagens estáticas não executam o servidor de conexão.
    if (!import.meta.env.VITE_DASHBOARD_DATA_URL && (response.status === 404 || response.headers.get('content-type')?.includes('text/html'))) {
      useSnapshot = true;
      response = await fetch(snapshotSource, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    }
    if (!response.ok) throw new Error('Fonte indisponível.');
    const payload = validate(await response.json());
    live = payload.live === true;
    if (dataFingerprint(payload) !== (data && dataFingerprint(data))) render(payload);
    data = payload;
    $('sync-time').textContent = `${live ? 'Verificado em' : 'Dados de'} ${new Date(live ? (payload.checkedAt || payload.updatedAt) : payload.updatedAt).toLocaleString('pt-BR')}`;
    if ($('monitor-state')) $('monitor-state').textContent = live ? 'Monitoramento conectado' : 'Painel ativo';
    setBadge(live ? 'Fonte conectada' : 'Dados importados', `badge ${live ? 'badge-live' : ''}`);
  } catch {
    setBadge('Falha na atualização', 'badge badge-error');
    if ($('monitor-state')) $('monitor-state').textContent = data ? 'Exibindo última leitura' : 'Aguardando dados';
  } finally {
    busy = false;
    nextRefresh = Date.now() + refreshInterval;
  }
}
function initTabs() {
  const nav = document.querySelector('.section-nav');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const panels = links.map(link => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);
  function showPanel(id) {
    panels.forEach(panel => {
      panel.hidden = panel.id !== id;
      panel.classList.toggle('active', panel.id === id);
    });
    links.forEach(link => {
      const isActive = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    const id = link.getAttribute('href').slice(1);
    showPanel(id);
    history.replaceState(null, '', `#${id}`);
  });
  const initial = panels.find(panel => panel.id === location.hash.slice(1)) || panels[0];
  if (initial) showPanel(initial.id);
}

function initMonitorTilt() {
  const monitor = document.querySelector('.monitor');
  const layers = document.querySelector('.layers');
  if (!monitor || !layers) return;
  function onMove(event) {
    if (reducedMotion.matches) return;
    const rect = monitor.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    monitor.style.transform = `rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(${(-y * 6).toFixed(2)}px)`;
    layers.style.transform = `rotateX(${(-y * 18).toFixed(2)}deg) rotateY(${(x * 18).toFixed(2)}deg) translateY(${(-y * 12).toFixed(2)}px)`;
  }
  monitor.addEventListener('mouseenter', () => { if (!reducedMotion.matches) monitor.classList.add('tracking'); });
  monitor.addEventListener('mousemove', onMove);
  monitor.addEventListener('mouseleave', () => {
    monitor.classList.remove('tracking');
    monitor.style.transform = '';
    layers.style.transform = '';
  });
}

function presentationState() {
  document.body.classList.toggle('motion-paused', !presenting);
}
reducedMotion.addEventListener('change', () => {
  presenting = !reducedMotion.matches;
  charts.forEach(c => { c.options.animation = reducedMotion.matches ? false : { duration: 1000 }; });
  presentationState();
});
setInterval(() => {
  if (document.hidden) return;
  if (Date.now() >= nextRefresh) refresh();
  if (!presenting || !data) return;
  const rows = [...document.querySelectorAll('.church-row')];
  if (Date.now() % 6000 < 1000 && rows.length) {
    rows.forEach(row => row.classList.remove('spotlight'));
    rows[highlight++ % rows.length].classList.add('spotlight');
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', refresh);
initTabs();
initMonitorTilt();
presentationState();
refresh();
