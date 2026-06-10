'use strict';
const $ = (s, el = document) => el.querySelector(s);
const el = (t, props = {}, kids = []) => {
  const n = document.createElement(t);
  for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'html') n.innerHTML = props[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
    // Skip null/undefined/false so boolean attrs like `disabled` are truly absent.
    // setAttribute('disabled', null) would coerce to "null" and still disable the control.
    else if (props[k] == null || props[k] === false) continue;
    else n.setAttribute(k, props[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c != null &&
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
};
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || ('HTTP ' + r.status)); }
  return r.json();
};
const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
const pct = (s, t) => (t ? Math.round((s / t) * 100) : 0);
const fmt = s => { if (!s) return '—'; const d = new Date(s.replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleString(); };
const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const stat = (v, k) => el('div', { class: 'stat' }, [el('div', { class: 'v' }, String(v)), el('div', { class: 'k' }, k)]);

let ME = null;
const app = () => $('#app');

const TAB_ICON = { home: '📝', history: '📊', guide: '📖', admin: '👥' };
function setTabs(active) {
  const tabs = [['home', 'Practice'], ['history', 'History'], ['guide', 'Guide']];
  if (ME.role === 'admin') tabs.push(['admin', 'Admin']);
  const nav = $('#tabs'); nav.innerHTML = '';
  tabs.forEach(([id, label]) =>
    nav.appendChild(el('button', { class: 'tab' + (id === active ? ' active' : ''), onclick: () => route(id) },
      [el('span', { class: 'ti' }, TAB_ICON[id]), el('span', { class: 'tl' }, label)])));
  nav.appendChild(el('a', { class: 'tab dl', href: 'https://www.ksrevenue.gov/pdf/dlhb.pdf', target: '_blank', rel: 'noopener noreferrer' },
    [el('span', { class: 'ti' }, '📕'), el('span', { class: 'tl' }, 'Manual')]));
}
function renderWho() {
  $('#who').innerHTML = '';
  $('#who').append(el('span', {}, [
    document.createTextNode('Hi, '), el('b', {}, ME.name),
    ME.role === 'admin' ? el('span', { class: 'badge' }, 'ADMIN') : document.createTextNode(''),
  ]));
}

// ---------- home: take a practice test ----------
async function viewHome() {
  setTabs('home');
  app().innerHTML = '<div class="loading">Loading…</div>';
  const s = await api('/api/stats');
  const hero = el('div', { class: 'card hero' }, [
    el('h2', { style: 'margin-top:0' }, 'Take a Practice Test'),
    el('p', { class: 'lead' }, `${s.size} fresh questions pulled from every topic, in a new random mix each time. Choose the best answer; you're scored instantly. Pass = ${Math.ceil(s.size * 0.8)}/${s.size} (80%).`),
    el('button', { class: 'btn big', onclick: startPractice }, '▶  Start a practice test'),
    el('div', { style: 'margin-top:14px' },
      el('button', { class: 'btn ghost', onclick: startSignQuiz }, '🚸  Practice road signs only')),
    el('p', { class: 'lead', style: 'margin:14px 0 0;font-size:13px' }, 'Road-sign practice is a study drill and is not counted in your scores below.'),
  ]);
  const stats = el('div', { class: 'statline center' }, [
    stat(s.runs, 'tests taken'),
    stat(s.best != null ? s.best + '/' + s.size : '—', 'best'),
    stat(s.avg != null ? s.avg : '—', 'avg score'),
    stat(s.passes, 'passes'),
  ]);
  const official = el('div', { class: 'card softcard', style: 'text-align:center' }, [
    el('div', { style: 'font-weight:800;margin-bottom:4px' }, '🎓 Ready for the real test?'),
    el('p', { class: 'lead', style: 'margin:0 0 12px' },
      'When they pass these consistently, take the official Kansas knowledge exam online — no DMV trip. Run by the Kansas Dept. of Revenue: 25 questions, 80% to pass; needs a computer with a webcam, and a fee applies.'),
    el('a', { class: 'btn big', href: 'https://ks.knowtodrive.com', target: '_blank', rel: 'noopener noreferrer' },
      'Take the official KS test ↗'),
    el('p', { class: 'lead', style: 'margin:10px 0 0;font-size:13px' }, 'ks.knowtodrive.com'),
  ]);
  app().innerHTML = '';
  app().append(hero, el('div', { class: 'card softcard' }, stats), official);
}

let RESTART = null;
function startPractice() { return startQuiz({ url: '/api/practice', title: 'Practice Test', record: true, restart: startPractice }); }
function startSignQuiz() { return startQuiz({ url: '/api/signs', title: 'Road Sign Quiz', record: false, restart: startSignQuiz }); }

async function startQuiz(opts) {
  RESTART = opts.restart;
  setTabs('home');
  app().innerHTML = '<div class="loading">Building your quiz…</div>';
  const data = await api(opts.url);
  // shuffle each question's option display order, keep mapping to original index
  const qs = data.questions.map(q => ({ ...q, order: shuffle(q.options.map((_, i) => i)) }));
  const answers = {}; // id -> original option index
  let cur = 0;
  const startedAt = new Date().toISOString();

  function draw() {
    const q = qs[cur];
    const opts = el('div', { class: 'opts' });
    q.order.forEach((origIdx, displayPos) => {
      const sel = answers[q.id] === origIdx;
      opts.appendChild(el('div', { class: 'opt' + (sel ? ' sel' : ''), onclick: () => { answers[q.id] = origIdx; draw(); } },
        [el('span', { class: 'let' }, LET[displayPos]), el('span', {}, q.options[origIdx])]));
    });
    const answered = Object.keys(answers).length;
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'qhead' }, [el('span', { class: 'cat' }, q.category), el('span', {}, `Question ${cur + 1} of ${qs.length}`)]),
      q.image ? el('img', { class: 'signimg', src: q.image, alt: 'road sign' }) : null,
      el('div', { class: 'qtext' }, q.text),
      opts,
      el('div', { class: 'row' }, [
        el('button', { class: 'btn ghost', disabled: cur === 0 ? '' : null, onclick: () => { if (cur > 0) { cur--; draw(); } } }, '← Back'),
        cur < qs.length - 1
          ? el('button', { class: 'btn', onclick: () => { cur++; draw(); } }, 'Next →')
          : el('button', { class: 'btn', disabled: answered < qs.length ? '' : null, onclick: submit }, `Submit (${answered}/${qs.length})`),
      ]),
    ]);
    app().innerHTML = '';
    app().append(
      el('h2', {}, opts.title),
      el('div', { class: 'progress' }, el('span', { style: `width:${(answered / qs.length) * 100}%` })),
      card,
      el('div', { class: 'row' }, [
        el('span', { class: 'lead', style: 'margin:0' }, `${answered} of ${qs.length} answered`),
        el('button', { class: 'btn', disabled: answered < qs.length ? '' : null, onclick: submit }, 'Submit test'),
      ]));
  }
  async function submit() {
    if (Object.keys(answers).length < qs.length) return;
    app().innerHTML = '<div class="loading">Scoring…</div>';
    const responses = qs.map(q => ({ id: q.id, choice: answers[q.id] }));
    try {
      const res = await api('/api/practice/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, started_at: startedAt, record: opts.record }),
      });
      viewResult(res);
    } catch (e) {
      // Never lose a finished test to a transient error: redraw it with all answers
      // intact and an error banner, so they can just hit Submit again.
      draw();
      app().prepend(el('div', { class: 'err' },
        `Couldn't submit your test (${e.message}). Your answers are saved — tap Submit to try again.`));
    }
  }
  draw();
}

function viewResult(res) {
  const p = pct(res.score, res.total);
  const review = el('div', { class: 'review' });
  res.results.forEach((r, i) => {
    const opts = el('div', { class: 'opts' });
    r.options.forEach((text, idx) => {
      let cls = 'opt';
      if (idx === r.correct_index) cls += ' correct';
      else if (idx === r.your) cls += ' wrong';
      const mark = idx === r.correct_index ? '✓' : (idx === r.your ? '✗' : '');
      opts.appendChild(el('div', { class: cls }, [el('span', {}, text), mark ? el('span', { class: 'mark' }, mark) : null]));
    });
    review.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'qhead' }, [el('span', { class: 'cat' }, r.correct ? 'Correct' : 'Review'), el('span', {}, `Q${i + 1}`)]),
      r.image ? el('img', { class: 'signimg', src: r.image, alt: 'road sign' }) : null,
      el('div', { class: 'qtext' }, r.text), opts,
    ]));
  });
  app().innerHTML = '';
  app().append(
    el('div', { class: 'card scorebig' }, [
      el('div', { class: 'pct' }, p + '%'),
      el('div', { class: 'frac' }, `${res.score} of ${res.total} correct`),
      el('div', {}, el('span', { class: 'verdict ' + (res.passed ? 'pass' : 'fail') }, res.passed ? 'PASS' : 'Keep studying')),
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', onclick: () => (RESTART || startPractice)() }, '▶  Take another'),
      el('button', { class: 'btn ghost', onclick: () => route('history') }, 'My history'),
    ]),
    el('h2', { style: 'margin-top:24px' }, 'Review'),
    review);
}

async function viewHistory() {
  setTabs('history');
  app().innerHTML = '<div class="loading">Loading…</div>';
  const rows = await api('/api/history');
  app().innerHTML = '';
  app().append(el('h2', {}, 'My History'));
  if (!rows.length) { app().append(el('div', { class: 'empty' }, 'No tests yet — take a practice test!')); return; }
  app().append(el('p', { class: 'lead' }, 'Your last 10 tests — tap one to review the questions and answers.'));
  app().append(el('table', {}, [
    el('tr', {}, [el('th', {}, 'When'), el('th', {}, 'Score'), el('th', {}, 'Result'), el('th', {}, '')]),
    ...rows.slice(0, 10).map(r => el('tr', { class: 'clickable', onclick: () => openRun(r.id, viewHistory) }, [
      el('td', {}, fmt(r.finished_at)),
      el('td', {}, `${r.score}/${r.total} (${pct(r.score, r.total)}%)`),
      el('td', {}, el('span', { class: 'pill ' + (r.score >= 20 ? 'pass' : 'fail') }, r.score >= 20 ? 'pass' : 'fail')),
      el('td', { style: 'text-align:right;color:var(--muted)' }, 'review ›'),
    ])),
  ]));
}

// Review one run: each question with the answer given and the correct answer.
async function openRun(id, back) {
  app().innerHTML = '<div class="loading">Loading…</div>';
  const d = await api('/api/run/' + id);
  const r = d.run;
  app().innerHTML = '';
  app().append(
    el('div', { class: 'row', style: 'margin:0 0 10px' }, [
      el('button', { class: 'btn ghost', onclick: back }, '← Back'),
      el('span', { class: 'lead', style: 'margin:0' },
        `${fmt(r.finished_at)} · ${r.score}/${r.total} (${pct(r.score, r.total)}%)`),
    ]),
    el('h2', {}, 'Run review'));
  const wrap = el('div', { class: 'review' });
  d.items.forEach((it, i) => {
    const opts = el('div', { class: 'opts' });
    it.options.forEach((text, idx) => {
      let cls = 'opt';
      if (idx === it.correct_index) cls += ' correct';
      else if (idx === it.your) cls += ' wrong';
      const mark = idx === it.correct_index ? '✓' : (idx === it.your ? '✗' : '');
      opts.appendChild(el('div', { class: cls }, [el('span', {}, text), mark ? el('span', { class: 'mark' }, mark) : null]));
    });
    wrap.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'qhead' }, [
        el('span', { class: 'cat' }, it.correct ? 'Correct' : 'Missed'),
        el('span', {}, `Q${i + 1}` + (it.your == null ? ' · unanswered' : '')),
      ]),
      it.image ? el('img', { class: 'signimg', src: it.image, alt: 'road sign' }) : null,
      el('div', { class: 'qtext' }, it.text), opts,
    ]));
  });
  app().append(wrap, el('div', { class: 'row' }, el('button', { class: 'btn ghost', onclick: back }, '← Back')));
}

async function viewAdmin() {
  setTabs('admin');
  app().innerHTML = '<div class="loading">Loading…</div>';
  const users = await api('/api/admin/overview');
  app().innerHTML = '';
  app().append(el('h2', {}, "Admin · everyone's progress"),
    el('p', { class: 'lead' }, 'Tests taken and scores for every account.'));
  for (const u of users) {
    const card = el('div', { class: 'admin-card' }, [
      el('div', {}, [el('span', { class: 'uname' }, u.name),
        u.role === 'admin' ? el('span', { class: 'badge', style: 'background:var(--sun);border-radius:6px;padding:1px 6px;margin-left:8px;font-size:11px' }, 'ADMIN') : null,
        el('div', { class: 'uemail' }, u.email)]),
      el('div', { class: 'statline' }, [
        stat(u.runs, 'tests taken'),
        stat(u.best != null ? u.best + '/25' : '—', 'best'),
        stat(u.avg != null ? u.avg : '—', 'avg score'),
        stat(u.passes, 'passes'),
        stat(u.last ? fmt(u.last) : '—', 'last test'),
      ]),
      u.runs > 0 ? el('button', { class: 'btn ghost', style: 'margin-top:12px;padding:8px 14px', onclick: e => toggleRuns(card, u.email, e.target) }, 'View tests') : null,
    ]);
    app().append(card);
  }
}
async function toggleRuns(card, email, btn) {
  const existing = card.querySelector('.runs');
  if (existing) { existing.remove(); if (btn) btn.textContent = 'View tests'; return; }
  const rows = await api('/api/admin/user/' + encodeURIComponent(email) + '/runs');
  if (btn) btn.textContent = 'Hide tests';
  card.append(el('div', { class: 'runs', style: 'margin-top:12px' },
    rows.length ? el('table', {}, [
      el('tr', {}, [el('th', {}, 'When'), el('th', {}, 'Score'), el('th', {}, 'Result'), el('th', {}, '')]),
      ...rows.slice(0, 10).map(r => el('tr', { class: 'clickable', onclick: () => openRun(r.id, viewAdmin) }, [
        el('td', {}, fmt(r.finished_at)),
        el('td', {}, `${r.score}/${r.total}`),
        el('td', {}, el('span', { class: 'pill ' + (r.score >= 20 ? 'pass' : 'fail') }, r.score >= 20 ? 'pass' : 'fail')),
        el('td', { style: 'text-align:right;color:var(--muted)' }, 'review ›'),
      ])),
    ]) : el('div', { class: 'empty' }, 'No tests.')));
}

async function viewGuide() {
  setTabs('guide');
  app().innerHTML = '<div class="loading">Loading study guide…</div>';
  const res = await fetch('/guide.html');
  if (!res.ok) throw new Error('Could not load the guide (HTTP ' + res.status + ').');
  const htmlText = await res.text();
  app().innerHTML = '';
  app().append(el('div', { class: 'row', style: 'margin:0 0 10px' }, [
    el('span', { class: 'lead', style: 'margin:0' }, 'The full study guide — also downloadable as a PDF.'),
    el('a', { class: 'btn', href: '/Kansas-Driving-Study-Guide.pdf', download: 'Kansas-Driving-Study-Guide.pdf' }, '⬇ Download PDF'),
  ]));
  const g = el('div', { class: 'guide' }); g.innerHTML = htmlText;
  app().append(g);
}

function route(name) {
  ({ home: viewHome, history: viewHistory, guide: viewGuide, admin: viewAdmin }[name] || viewHome)()
    .catch(e => { app().innerHTML = ''; app().append(el('div', { class: 'err' }, e.message)); });
}

(async function init() {
  try { ME = await api('/api/me'); renderWho(); route('home'); }
  catch (e) { app().innerHTML = ''; app().append(el('div', { class: 'err' }, 'Sign-in problem: ' + e.message)); }
})();
