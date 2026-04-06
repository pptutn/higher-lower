// ═══════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════
const RANK_VALS = {
  'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,
  '9':9,'10':10,'J':11,'Q':12,'K':13
};
const ALL_RANKS  = Object.keys(RANK_VALS);
const ALL_SUITS  = ['♠','♥','♦','♣'];
const RED_SUITS  = new Set(['♥','♦']);

const CARD_H_PX  = 90;   // approximate rendered height of a small card
const STACK_OFF  = 14;   // px between stacked cards

const TIERS = [
  { thresh:    0, label:'PERFECT',     cls:'s-perfect', note:'Flawless — maximum score.' },
  { thresh:   -5, label:'EXCELLENT',   cls:'s-good',    note:'Outstanding play.' },
  { thresh:  -10, label:'VERY GOOD',   cls:'s-good',    note:'Strong performance.' },
  { thresh:  -16, label:'GOOD',        cls:'s-avg',     note:'Above average.' },
  { thresh:  -22, label:'AVERAGE',     cls:'s-avg',     note:'Room to improve.' },
  { thresh:-9999, label:'KEEP TRYING', cls:'s-poor',    note:'Study the probability table.' },
];

// Sudden-death tiers — based on Survival Rating (0–100)
// Rating = longevity (50pts) + accuracy (30pts) + piles kept (20pts)
const SD_TIERS = [
  { thresh: 95, label:'UNTOUCHABLE',  cls:'s-perfect', note:'Near-perfect survival.' },
  { thresh: 80, label:'IRON NERVE',   cls:'s-good',    note:'Outstanding under pressure.' },
  { thresh: 65, label:'SHARP',        cls:'s-good',    note:'Strong instincts.' },
  { thresh: 50, label:'STEADY',       cls:'s-avg',     note:'Held your ground.' },
  { thresh: 30, label:'FRAGILE',      cls:'s-avg',     note:'Too many early exits.' },
  { thresh:  0, label:'ELIMINATED',   cls:'s-poor',    note:'Wiped out fast.' },
];

// ═══════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════
let G = {};

function startGame() {
  // Build + Fisher-Yates shuffle
  const deck = [];
  for (const suit of ALL_SUITS)
    for (const [rank, value] of Object.entries(RANK_VALS))
      deck.push({ rank, suit, value, isRed: RED_SUITS.has(suit) });

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal 9 piles
  const piles = [];
  for (let i = 0; i < 9; i++) piles.push([deck.shift()]);

  // Track remaining ranks in the undealt deck
  const rem = {};
  for (const v of Object.values(RANK_VALS)) rem[v] = (rem[v] ?? 0) + 4;
  // Subtract the 9 dealt face-up cards
  for (const pile of piles) rem[pile[0].value]--;

  G = {
    deck,
    piles,
    phase:       'nominate',   // nominate | guess | result | gameover
    nominated:   null,
    dealtCard:   null,
    lastResult:  null,        // 'correct' | 'wrong'
    lastGuess:   null,
    score:       0,
    turnsLeft:   43,
    hintsOn:     G.hintsOn      ?? false,
    suddenDeath: G.suddenDeath  ?? false,
    deadPiles:   new Set(),
    rem,
  };

  document.getElementById('gameover').classList.remove('show');
  render();
}

// ═══════════════════════════════════════════════
//  Actions
// ═══════════════════════════════════════════════
function nominatePile(i) {
  if (G.phase !== 'nominate' && G.phase !== 'guess') return;
  G.nominated = i;
  G.phase = 'guess';
  render();
}

function makeGuess(guess) {
  if (G.phase !== 'guess') return;

  const dealt   = G.deck.shift();
  const topCard = G.piles[G.nominated].at(-1);
  const delta   = dealt.value - topCard.value;
  const actual  = delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'same';
  const correct = actual === guess;

  if (!correct) {
    G.score--;
    if (G.suddenDeath) G.deadPiles.add(G.nominated);
  }
  G.dealtCard  = dealt;
  G.lastGuess  = guess;
  G.lastResult = correct ? 'correct' : 'wrong';
  G.piles[G.nominated].push(dealt);
  G.rem[dealt.value] = Math.max(0, (G.rem[dealt.value] ?? 1) - 1);
  G.turnsLeft--;
  G.phase = 'result';
  render();

  if (window.matchMedia('(max-width: 600px)').matches) {
    G._autoAdvance = setTimeout(nextTurn, 1500);
  }
}

function nextTurn() {
  clearTimeout(G._autoAdvance);
  if (G.phase !== 'result') return;
  G.nominated  = null;
  G.dealtCard  = null;
  G.lastResult = null;
  G.lastGuess  = null;
  const allDead = G.suddenDeath && G.deadPiles.size >= G.piles.length;
  G.phase = (G.turnsLeft > 0 && !allDead) ? 'nominate' : 'gameover';
  render();
  if (G.phase === 'gameover') showGameover();
}

function toggleHints() {
  G.hintsOn = !G.hintsOn;
  render();
}

function toggleSuddenDeath() {
  if (G.turnsLeft < 43) return;
  G.suddenDeath = !G.suddenDeath;
  render();
}

// ═══════════════════════════════════════════════
//  Probability
// ═══════════════════════════════════════════════
function calcProbs(topValue) {
  const total = G.turnsLeft;
  if (total <= 0) return { higher: 0, lower: 0, same: 0 };
  let h = 0, l = 0, s = 0;
  for (let v = 2; v <= 14; v++) {
    const c = G.rem[v] ?? 0;
    if      (v > topValue) h += c;
    else if (v < topValue) l += c;
    else                   s += c;
  }
  return { higher: h / total, lower: l / total, same: s / total };
}

function bestKey(probs) {
  return probs.higher >= probs.lower && probs.higher >= probs.same ? 'higher'
       : probs.lower  >= probs.same  ? 'lower' : 'same';
}

// ═══════════════════════════════════════════════
//  ASCII card builders
// ═══════════════════════════════════════════════
//  small (5 lines × 7 chars):     big (4 lines × 11 chars):
//  ┌─────┐                        ┌─────────┐
//  │K    │                        │K        │
//  │  ♠  │                        │    ♠    │
//  │    K│                        │        K│
//  └─────┘                        └─────────┘

function smallCard(rank, suit) {
  const t = rank.padEnd(5);
  const b = rank.padStart(5);
  return `┌─────┐\n│${t}│\n│  ${suit}  │\n│${b}│\n└─────┘`;
}

function bigCard(rank, suit) {
  const t = rank.padEnd(9);
  const b = rank.padStart(9);
  return `┌─────────┐\n│${t}│\n│    ${suit}    │\n│${b}│\n└─────────┘`;
}

// Deck-back card (shown in deck indicator)
const DECK_BACK =
  `┌─────┐\n│▒▒▒▒▒│\n│▒ ♦ ▒│\n│▒▒▒▒▒│\n└─────┘`;

function makeCard(card, { big = false, isNew = false } = {}) {
  const el = document.createElement('pre');
  el.className = ['card', card.isRed ? 'red' : 'black', big ? 'big' : '', isNew ? 'card-new' : '']
                 .filter(Boolean).join(' ');
  el.textContent = big ? bigCard(card.rank, card.suit) : smallCard(card.rank, card.suit);
  return el;
}

// ═══════════════════════════════════════════════
//  Render — Piles
// ═══════════════════════════════════════════════
function renderPiles() {
  const area = document.getElementById('piles-area');
  area.innerHTML = '';

  G.piles.forEach((pile, i) => {
    const isDead     = G.deadPiles.has(i);
    const nominated  = G.nominated === i;
    const clickable  = (G.phase === 'nominate' || G.phase === 'guess') && !isDead;
    const newTopCard = nominated && G.phase === 'result';

    const pileEl = document.createElement('div');
    pileEl.className = ['pile',
      isDead    ? 'dead'      : '',
      clickable ? 'clickable' : '',
    ].filter(Boolean).join(' ');
    if (clickable) pileEl.addEventListener('click', () => nominatePile(i));

    const stackEl = document.createElement('div');
    stackEl.className = 'pile-stack';

    if (isDead) {
      const backEl = document.createElement('pre');
      backEl.className = 'card flipped';
      backEl.textContent = DECK_BACK;
      stackEl.appendChild(backEl);
    } else {
      const topCard = pile.at(-1);
      const cardEl = makeCard(topCard, { isNew: newTopCard });
      if (nominated) {
        if (G.phase === 'result') {
          cardEl.classList.add(G.lastResult === 'correct' ? 'card-correct' : 'card-wrong');
        } else {
          cardEl.classList.add('card-nominated');
        }
      }
      stackEl.appendChild(cardEl);
    }

    // Keyboard shortcut badge
    if (clickable) {
      const badge = document.createElement('div');
      badge.className = 'pile-key';
      badge.textContent = i + 1;
      stackEl.appendChild(badge);
    }

    pileEl.appendChild(stackEl);

    const lbl = document.createElement('div');
    lbl.className = 'pile-label';
    lbl.textContent = isDead ? 'dead' : `×${pile.length}`;
    pileEl.appendChild(lbl);

    area.appendChild(pileEl);
  });
}

// ═══════════════════════════════════════════════
//  Render — Deck indicator
// ═══════════════════════════════════════════════
function renderDeck() {
  const wrap = document.getElementById('deck-info');
  wrap.innerHTML = '';

  const backEl = document.createElement('pre');
  backEl.className = 'card black';
  backEl.style.color = 'rgba(80,130,200,0.65)';
  backEl.textContent = DECK_BACK;
  wrap.appendChild(backEl);

  const lbl = document.createElement('div');
  lbl.id = 'deck-count-lbl';
  lbl.textContent = `${G.turnsLeft} left`;
  wrap.appendChild(lbl);
}

// ═══════════════════════════════════════════════
//  Render — Action panel
// ═══════════════════════════════════════════════
function renderAction() {
  const panel  = document.getElementById('action-panel');
  const mobile = window.matchMedia('(max-width: 600px)').matches;
  panel.innerHTML = '';
  panel.onclick = null;

  // ── nominate ──────────────────────────────────
  if (G.phase === 'nominate') {
    if (mobile) {
      panel.innerHTML = `<div class="ap-prompt">── tap a pile ──</div>`;
    } else {
      panel.innerHTML = `
        <div class="ap-prompt">── Select a pile to nominate ──</div>
        <div class="ap-keys">
          <span style="border:1px solid var(--muted);padding:0 4px;border-radius:2px;font-size:0.65rem">1–9</span>
          &nbsp;select pile &nbsp;|&nbsp;
          <span style="border:1px solid var(--muted);padding:0 4px;border-radius:2px;font-size:0.65rem">H</span>&nbsp;Higher&nbsp;
          <span style="border:1px solid var(--muted);padding:0 4px;border-radius:2px;font-size:0.65rem">L</span>&nbsp;Lower&nbsp;
          <span style="border:1px solid var(--muted);padding:0 4px;border-radius:2px;font-size:0.65rem">S</span>&nbsp;Same&nbsp;|&nbsp;
          <span style="border:1px solid var(--muted);padding:0 4px;border-radius:2px;font-size:0.65rem">↵</span>&nbsp;next turn
        </div>`;
    }
    syncPanelHeight();
    return;
  }

  // ── guess ─────────────────────────────────────
  if (G.phase === 'guess') {
    const topCard = G.piles[G.nominated].at(-1);
    const probs   = G.hintsOn ? calcProbs(topCard.value) : null;
    const best    = probs ? bestKey(probs) : null;

    const lbl = document.createElement('div');
    lbl.className = 'ap-sublabel';
    lbl.textContent = mobile
      ? `Pile ${G.nominated + 1} — higher, lower or same?`
      : `Pile ${G.nominated + 1} — What comes next?`;
    panel.appendChild(lbl);

    // Only show big card on desktop — card is visible in grid on mobile
    if (!mobile) panel.appendChild(makeCard(topCard, { big: true }));

    const guessRow = document.createElement('div');
    guessRow.className = 'guess-row';
    [['higher', '▲ Higher', 'btn-higher'],
     ['same',   '= Same',   'btn-same'  ],
     ['lower',  '▼ Lower',  'btn-lower' ]].forEach(([val, label, cls]) => {
      const b = document.createElement('button');
      b.className = `btn ${cls}`;
      b.textContent = label;
      b.addEventListener('click', e => { e.stopPropagation(); makeGuess(val); });
      guessRow.appendChild(b);
    });
    panel.appendChild(guessRow);

    if (probs) {
      const fmt = p => (p * 100).toFixed(1) + '%';
      const w   = p => Math.max(1, Math.round(p * 100)) + '%';
      const tbl = document.createElement('div');
      tbl.className = 'prob-table';
      [
        { key:'higher', label:'HIGHER', fill:'higher' },
        { key:'lower',  label:'LOWER',  fill:'lower'  },
        { key:'same',   label:'SAME',   fill:'same'   },
      ].forEach(({ key, label, fill }) => {
        const row = document.createElement('div');
        row.className = `prob-row${key === best ? ' best' : ''}`;
        row.innerHTML = `
          <span class="prob-lbl">${label}</span>
          <div class="prob-bar"><div class="prob-fill ${fill}" style="width:${w(probs[key])}"></div></div>
          <span class="prob-pct">${fmt(probs[key])}${key === best ? ' ★' : ''}</span>`;
        tbl.appendChild(row);
      });
      panel.appendChild(tbl);
    }
    syncPanelHeight();
    return;
  }

  // ── result ────────────────────────────────────
  if (G.phase === 'result') {
    const prevCard  = G.piles[G.nominated].at(-2);
    const newCard   = G.piles[G.nominated].at(-1);
    const correct   = G.lastResult === 'correct';
    const actualStr = newCard.value > prevCard.value ? 'HIGHER'
                    : newCard.value < prevCard.value ? 'LOWER' : 'SAME';

    // Score flash
    const sv = document.getElementById('score-val');
    if (!correct) {
      sv.classList.remove('flash');
      void sv.offsetWidth;
      sv.classList.add('flash');
    }

    const banner = document.createElement('div');
    banner.className = `result-banner ${correct ? 'ok' : 'bad'}`;
    banner.textContent = correct ? '✓  Correct — no penalty' : '✗  Wrong — −1 point';
    panel.appendChild(banner);

    if (mobile) {
      // Compact one-liner: "was K♠ → dealt 7♥ (lower)"
      const det = document.createElement('div');
      det.className = 'ap-compact-result';
      det.innerHTML =
        `was <span class="hl">${prevCard.rank}${prevCard.suit}</span>`
        + ` → dealt <span class="hl">${newCard.rank}${newCard.suit}</span>`
        + ` &nbsp;·&nbsp; <span class="hl">${actualStr}</span>`;
      panel.appendChild(det);

      // Draining progress bar (matches auto-advance timer)
      const prog = document.createElement('div');
      prog.className = 'ap-progress';
      const fill = document.createElement('div');
      fill.className = `ap-progress-fill ${correct ? 'ok' : 'bad'}`;
      prog.appendChild(fill);
      panel.appendChild(prog);

      const hint = document.createElement('div');
      hint.className = 'ap-tap-hint';
      hint.textContent = 'tap to continue';
      panel.appendChild(hint);

      // Tap anywhere on panel to advance early
      panel.onclick = e => { e.stopPropagation(); clearTimeout(G._autoAdvance); nextTurn(); };
    } else {
      const row = document.createElement('div');
      row.className = 'result-row';

      const prevWrap = document.createElement('div');
      prevWrap.className = 'r-card-wrap';
      const prevLbl = document.createElement('div');
      prevLbl.className = 'r-card-lbl';
      prevLbl.textContent = 'was';
      prevWrap.appendChild(prevLbl);
      prevWrap.appendChild(makeCard(prevCard, { big: true }));

      const arrow = document.createElement('div');
      arrow.className = 'r-arrow';
      arrow.textContent = '→';

      const newWrap = document.createElement('div');
      newWrap.className = 'r-card-wrap';
      const newLbl = document.createElement('div');
      newLbl.className = 'r-card-lbl';
      newLbl.textContent = 'dealt';
      newWrap.appendChild(newLbl);
      newWrap.appendChild(makeCard(newCard, { big: true, isNew: true }));

      row.appendChild(prevWrap);
      row.appendChild(arrow);
      row.appendChild(newWrap);
      panel.appendChild(row);

      const det = document.createElement('div');
      det.className = 'result-detail';
      det.innerHTML =
        `Guessed <span class="hl">${G.lastGuess.toUpperCase()}</span>`
        + ` &nbsp;·&nbsp; Actual <span class="hl">${actualStr}</span>`;
      panel.appendChild(det);

      const btn = document.createElement('button');
      btn.className = 'btn btn-next';
      btn.textContent = G.turnsLeft > 0 ? 'Next Turn  →' : 'Final Score  →';
      btn.addEventListener('click', nextTurn);
      panel.appendChild(btn);
    }
    syncPanelHeight();
    return;
  }
}

// Keep main padding-bottom in sync with the fixed panel's actual height
function syncPanelHeight() {
  if (!window.matchMedia('(max-width: 600px)').matches) return;
  requestAnimationFrame(() => {
    const h = document.getElementById('action-panel').offsetHeight;
    document.querySelector('main').style.setProperty('--panel-h', (h + 8) + 'px');
  });
}

// ═══════════════════════════════════════════════
//  Render — Header
// ═══════════════════════════════════════════════
function renderHeader() {
  const sv = document.getElementById('score-val');
  sv.textContent = G.score;
  sv.className = G.score < 0 ? 'neg' : '';

  document.getElementById('turns-wrap').textContent =
    `${G.turnsLeft} turn${G.turnsLeft !== 1 ? 's' : ''} left`;

  const hb = document.getElementById('btn-hint');
  hb.textContent = `Hints: ${G.hintsOn ? 'ON' : 'OFF'}`;
  hb.className = `btn btn-hint${G.hintsOn ? ' on' : ''}`;

  const sb = document.getElementById('btn-sd');
  sb.textContent = `Sudden Death: ${G.suddenDeath ? 'ON' : 'OFF'}`;
  const sdLocked = G.turnsLeft < 43;
  sb.className = `btn btn-sd${G.suddenDeath ? ' on' : ''}${sdLocked ? ' locked' : ''}`;
  sb.disabled = sdLocked;
}

// ═══════════════════════════════════════════════
//  Game over
// ═══════════════════════════════════════════════
function getTier(score) {
  return TIERS.find(t => score >= t.thresh) ?? TIERS.at(-1);
}

function getSdTier(rating) {
  return SD_TIERS.find(t => rating >= t.thresh) ?? SD_TIERS.at(-1);
}

function showGameover() {
  if (G.suddenDeath) {
    showSdGameover();
  } else {
    showNormalGameover();
  }
  document.getElementById('gameover').classList.add('show');
}

function showNormalGameover() {
  const tier = getTier(G.score);
  document.getElementById('go-title').textContent = 'Game Over';
  const scoreEl = document.getElementById('go-score');
  scoreEl.textContent = G.score;
  scoreEl.className   = `go-score ${tier.cls}`;
  document.getElementById('go-score-suffix').textContent = '';
  document.getElementById('go-tier').textContent = `${tier.label} — ${tier.note}`;

  const ranges = TIERS.map((t, i) => {
    if (t.thresh === 0)     return '0';
    if (t.thresh === -9999) return `≤ ${TIERS[i - 1].thresh - 1}`;
    const hi = TIERS[i - 1].thresh - 1;
    return `${hi} to ${t.thresh}`;
  });

  document.getElementById('go-table').className = 'go-table';
  document.getElementById('go-table').innerHTML = TIERS.map((t, i) =>
    `<tr${t === tier ? ' class="active"' : ''}>
       <td>${t.label}</td>
       <td style="color:#4a6a4a">${ranges[i]}</td>
     </tr>`
  ).join('');
}

function showSdGameover() {
  const turnsPlayed    = 43 - G.turnsLeft;
  const wrongGuesses   = -G.score;
  const correctGuesses = Math.max(0, turnsPlayed - wrongGuesses);
  const pilesAlive     = G.piles.length - G.deadPiles.size;

  // Survival Rating (0–100):
  //   50 pts — longevity  (how far through the deck you lasted)
  //   30 pts — accuracy   (fraction of guesses correct)
  //   20 pts — resilience (fraction of piles still alive)
  const longevity  = turnsPlayed / 43;
  const accuracy   = turnsPlayed > 0 ? correctGuesses / turnsPlayed : 1;
  const resilience = pilesAlive / G.piles.length;
  const rating     = Math.round(longevity * 50 + accuracy * 30 + resilience * 20);

  const tier = getSdTier(rating);
  document.getElementById('go-title').textContent = '⚡ Sudden Death';

  const scoreEl = document.getElementById('go-score');
  scoreEl.textContent = rating;
  scoreEl.className   = `go-score ${tier.cls}`;
  document.getElementById('go-score-suffix').textContent = '/ 100';

  document.getElementById('go-tier').textContent = `${tier.label} — ${tier.note}`;

  const pct = v => Math.round(v * 100) + '%';
  document.getElementById('go-table').className = 'go-stats';
  document.getElementById('go-table').innerHTML = `
    <tr${longevity === 1 ? ' class="sd-highlight"' : ''}>
      <td>Turns survived</td><td>${turnsPlayed} / 43</td>
    </tr>
    <tr${accuracy === 1 ? ' class="sd-highlight"' : ''}>
      <td>Accuracy</td><td>${pct(accuracy)} (${correctGuesses}W ${wrongGuesses}L)</td>
    </tr>
    <tr${resilience === 1 ? ' class="sd-highlight"' : ''}>
      <td>Piles surviving</td><td>${pilesAlive} / 9</td>
    </tr>
    <tr>
      <td>Longevity · Accuracy · Resilience</td>
      <td>${Math.round(longevity*50)} · ${Math.round(accuracy*30)} · ${Math.round(resilience*20)}</td>
    </tr>`;
}

// ═══════════════════════════════════════════════
//  Result badge — card outline set in renderPiles(), badge added here
// ═══════════════════════════════════════════════
function applyResultGlow() {
  if (G.phase !== 'result' || G.nominated === null) return;
  const pileEls = document.querySelectorAll('#piles-area .pile');
  const pileEl  = pileEls[G.nominated];
  if (!pileEl) return;

  const correct = G.lastResult === 'correct';
  const badge = document.createElement('div');
  badge.className = `pile-result-badge ${correct ? 'ok' : 'bad'}`;
  badge.textContent = correct ? '✓ ok' : '✗ −1';
  pileEl.appendChild(badge);
}

// ═══════════════════════════════════════════════
//  Master render
// ═══════════════════════════════════════════════
function render() {
  renderHeader();
  renderPiles();
  renderDeck();
  renderAction();
  applyResultGlow();
}

// ═══════════════════════════════════════════════
//  How to Play
// ═══════════════════════════════════════════════
function openHtp() {
  document.getElementById('how-to-play').classList.add('show');
}
function closeHtp() {
  document.getElementById('how-to-play').classList.remove('show');
}

// ═══════════════════════════════════════════════
//  Keyboard shortcuts
// ═══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'Escape') {
    closeHtp();
    return;
  }

  if (G.phase === 'nominate' || G.phase === 'guess') {
    const n = parseInt(e.key);
    if (n >= 1 && n <= 9 && !G.deadPiles.has(n - 1)) { nominatePile(n - 1); return; }
  }

  if (G.phase === 'guess') {
    const k = e.key.toLowerCase();
    if (k === 'h') { makeGuess('higher'); return; }
    if (k === 'l') { makeGuess('lower');  return; }
    if (k === 's') { makeGuess('same');   return; }
  }

  if (G.phase === 'result') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      nextTurn();
      return;
    }
  }

  if (G.phase === 'gameover' && e.key === 'Enter') {
    document.getElementById('gameover').classList.remove('show');
    startGame();
  }
});

// ═══════════════════════════════════════════════
//  Boot — wire static buttons, then start
// ═══════════════════════════════════════════════
document.getElementById('btn-sd')        .addEventListener('click', toggleSuddenDeath);
document.getElementById('btn-hint')      .addEventListener('click', toggleHints);
document.getElementById('btn-new')       .addEventListener('click', startGame);
document.getElementById('btn-htp')       .addEventListener('click', openHtp);
document.getElementById('btn-play-again').addEventListener('click', startGame);
document.getElementById('htp-close')     .addEventListener('click', closeHtp);
document.getElementById('htp-sheet')     .addEventListener('click', e => e.stopPropagation());
document.getElementById('how-to-play')   .addEventListener('click', closeHtp);

startGame();
