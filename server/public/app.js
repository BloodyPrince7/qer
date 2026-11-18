// Ringside Match Audio Engine (Web Audio API)
class RingsideAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  ringBell() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [840, 1120, 1680, 2240];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const decay = idx === 0 ? 1.8 : 1.2;
      gain.gain.setValueAtTime(0.25 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + decay);
    });
  }

  playPunch(corner) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = corner === 'red' ? 'triangle' : 'sine';
    const startFreq = corner === 'red' ? 260 : 420;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }
}

const audio = new RingsideAudio();

// Bout State
const boutState = {
  socket: null,
  code: null,
  boutData: null,
  serverIps: [],
  serverPort: 3000
};

// DOM References
const el = {
  configView: document.getElementById('configView'),
  dashboardView: document.getElementById('dashboardView'),
  boutConfigForm: document.getElementById('boutConfigForm'),
  setupIpBadges: document.getElementById('setupIpBadges'),

  topBoutTitle: document.getElementById('topBoutTitle'),
  topRoomCodeDisplay: document.getElementById('topRoomCodeDisplay'),
  btnCopyRoomCode: document.getElementById('btnCopyRoomCode'),
  btnShowQr: document.getElementById('btnShowQr'),
  btnTestBell: document.getElementById('btnTestBell'),
  btnExitToConfig: document.getElementById('btnExitToConfig'),

  dashBlueFighterName: document.getElementById('dashBlueFighterName'),
  dashRedFighterName: document.getElementById('dashRedFighterName'),
  dashBlueStrikes: document.getElementById('dashBlueStrikes'),
  dashRedStrikes: document.getElementById('dashRedStrikes'),
  blueFoulBadge: document.getElementById('blueFoulBadge'),
  redFoulBadge: document.getElementById('redFoulBadge'),
  blueKdStrip: document.getElementById('blueKdStrip'),
  redKdStrip: document.getElementById('redKdStrip'),

  dashRoundLabel: document.getElementById('dashRoundLabel'),
  dashStatusPill: document.getElementById('dashStatusPill'),
  dashClockDigits: document.getElementById('dashClockDigits'),

  btnStartRound: document.getElementById('btnStartRound'),
  btnPauseRound: document.getElementById('btnPauseRound'),
  btnResumeRound: document.getElementById('btnResumeRound'),
  btnEndRound: document.getElementById('btnEndRound'),
  btnNextRound: document.getElementById('btnNextRound'),

  gaugeBluePct: document.getElementById('gaugeBluePct'),
  gaugeRedPct: document.getElementById('gaugeRedPct'),
  gaugeBlueFill: document.getElementById('gaugeBlueFill'),
  gaugeRedFill: document.getElementById('gaugeRedFill'),

  btnFoulBlue: document.getElementById('btnFoulBlue'),
  btnKdBlue: document.getElementById('btnKdBlue'),
  btnFoulRed: document.getElementById('btnFoulRed'),
  btnKdRed: document.getElementById('btnKdRed'),

  judgeRosterCount: document.getElementById('judgeRosterCount'),
  judgeCardsGrid: document.getElementById('judgeCardsGrid'),

  finalDecisionBanner: document.getElementById('finalDecisionBanner'),
  scorecardRowsBody: document.getElementById('scorecardRowsBody'),
  thJ1Header: document.getElementById('thJ1Header'),
  thJ2Header: document.getElementById('thJ2Header'),
  thJ3Header: document.getElementById('thJ3Header'),
  totBlueStrikes: document.getElementById('totBlueStrikes'),
  totRedStrikes: document.getElementById('totRedStrikes'),
  totJudge1: document.getElementById('totJudge1'),
  totJudge2: document.getElementById('totJudge2'),
  totJudge3: document.getElementById('totJudge3'),
  totConsensusWinner: document.getElementById('totConsensusWinner'),

  qrModal: document.getElementById('qrModal'),
  btnCloseQr: document.getElementById('btnCloseQr'),
  qrCanvasBox: document.getElementById('qrCanvasBox'),
  mobileUrlField: document.getElementById('mobileUrlField'),
  btnCopyMobileUrl: document.getElementById('btnCopyMobileUrl')
};

// Network IP Discovery
async function initServerInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    boutState.serverIps = data.localIps || [];
    boutState.serverPort = data.port || 3000;
    renderSetupIps();
  } catch (err) {
    console.error('Failed to load server info:', err);
  }
}

function renderSetupIps() {
  if (!boutState.serverIps.length) {
    el.setupIpBadges.innerHTML = `<span class="ip-pill">http://localhost:${boutState.serverPort}</span>`;
    return;
  }
  el.setupIpBadges.innerHTML = boutState.serverIps.map(ip => `
    <span class="ip-pill">${ip.address}:${boutState.serverPort}</span>
  `).join('');
}

// Socket.IO Setup
function setupSocket() {
  boutState.socket = io({
    reconnection: true,
    reconnectionDelay: 1000
  });

  boutState.socket.on('connect', () => {
    if (boutState.code) {
      boutState.socket.emit('join_room', { roomCode: boutState.code, isDashboard: true });
    }
  });

  boutState.socket.on('clock_tick', (data) => {
    el.dashClockDigits.textContent = formatClock(data.roundTimeRemaining);
  });

  boutState.socket.on('rest_tick', (data) => {
    el.dashClockDigits.textContent = formatClock(data.restTimeRemaining);
    el.dashStatusPill.textContent = `REST (${data.restTimeRemaining}s)`;
  });

  boutState.socket.on('ring_bell', () => {
    audio.ringBell();
  });

  boutState.socket.on('strike_event', (data) => {
    audio.playPunch(data.team);
    handleLiveStrike(data);
  });

  boutState.socket.on('match_state_update', (bout) => {
    boutState.boutData = bout;
    renderDashboardUI(bout);
  });
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Form Submission -> Transitions from Config to Dashboard
el.boutConfigForm.addEventListener('submit', (e) => {
  e.preventDefault();
  audio.init();

  const payload = {
    boutTitle: document.getElementById('cfgBoutTitle').value.trim(),
    blueFighter: document.getElementById('cfgBlueFighter').value.trim(),
    redFighter: document.getElementById('cfgRedFighter').value.trim(),
    requiredJudges: document.getElementById('cfgJudges').value,
    totalRounds: document.getElementById('cfgTotalRounds').value,
    roundDurationSeconds: document.getElementById('cfgRoundDuration').value,
    restDurationSeconds: document.getElementById('cfgRestDuration').value,
    roomCode: document.getElementById('cfgRoomCode').value.trim()
  };

  boutState.socket.emit('create_bout', payload, (res) => {
    if (res && res.success) {
      boutState.code = res.bout.code;
      boutState.boutData = res.bout;

      // Switch views: hide config screen, show dashboard screen
      el.configView.classList.add('hidden');
      el.dashboardView.classList.remove('hidden');

      renderDashboardUI(res.bout);
      setupQrCode(res.bout.code);
    } else {
      alert((res && res.error) || 'Could not initialize match room.');
    }
  });
});

// Live Strike Event
function handleLiveStrike(data) {
  el.dashRedStrikes.textContent = data.redTotal;
  el.dashBlueStrikes.textContent = data.blueTotal;

  updateGauge(data.blueTotal, data.redTotal);
  renderJudgesGrid(data.roundStats?.judgeStrikes || {});
}

function updateGauge(blue, red) {
  const total = blue + red;
  let bPct = 50;
  let rPct = 50;
  if (total > 0) {
    bPct = Math.round((blue / total) * 100);
    rPct = 100 - bPct;
  }
  el.gaugeBluePct.textContent = `${bPct}% Blue`;
  el.gaugeRedPct.textContent = `${rPct}% Red`;
  el.gaugeBlueFill.style.width = `${bPct}%`;
  el.gaugeRedFill.style.width = `${rPct}%`;
}

// Render Dashboard UI
function renderDashboardUI(bout) {
  el.topBoutTitle.textContent = bout.title;
  el.topRoomCodeDisplay.textContent = bout.code;
  el.dashBlueFighterName.textContent = bout.blueFighter;
  el.dashRedFighterName.textContent = bout.redFighter;

  el.dashRoundLabel.textContent = `ROUND ${bout.currentRound} OF ${bout.totalRounds}`;
  document.querySelectorAll('.active-round-num').forEach(node => node.textContent = bout.currentRound);

  // Status & Clock State
  if (bout.state === 'ROUND_ACTIVE') {
    el.dashClockDigits.textContent = formatClock(bout.roundTimeRemaining);
    el.dashStatusPill.textContent = 'ACTIVE';
    el.dashStatusPill.className = 'clock-status-pill status-active';

    el.btnStartRound.classList.add('hidden');
    el.btnPauseRound.classList.remove('hidden');
    el.btnResumeRound.classList.add('hidden');
    el.btnNextRound.classList.add('hidden');
  } else if (bout.state === 'ROUND_PAUSED') {
    el.dashClockDigits.textContent = formatClock(bout.roundTimeRemaining);
    el.dashStatusPill.textContent = 'PAUSED';
    el.dashStatusPill.className = 'clock-status-pill status-paused';

    el.btnStartRound.classList.add('hidden');
    el.btnPauseRound.classList.add('hidden');
    el.btnResumeRound.classList.remove('hidden');
    el.btnNextRound.classList.add('hidden');
  } else if (bout.state === 'ROUND_REST') {
    el.dashClockDigits.textContent = formatClock(bout.restTimeRemaining);
    el.dashStatusPill.textContent = `REST (${bout.restTimeRemaining}s)`;
    el.dashStatusPill.className = 'clock-status-pill status-rest';

    el.btnStartRound.classList.add('hidden');
    el.btnPauseRound.classList.add('hidden');
    el.btnResumeRound.classList.add('hidden');
    el.btnNextRound.classList.remove('hidden');
  } else if (bout.state === 'MATCH_FINISHED') {
    el.dashClockDigits.textContent = 'FINAL';
    el.dashStatusPill.textContent = 'CONCLUDED';
    el.dashStatusPill.className = 'clock-status-pill status-active';

    el.btnStartRound.classList.add('hidden');
    el.btnPauseRound.classList.add('hidden');
    el.btnResumeRound.classList.add('hidden');
    el.btnEndRound.classList.add('hidden');
    el.btnNextRound.classList.add('hidden');
  } else {
    el.dashClockDigits.textContent = formatClock(bout.roundDurationSeconds);
    el.dashStatusPill.textContent = 'READY';
    el.dashStatusPill.className = 'clock-status-pill status-ready';

    el.btnStartRound.classList.remove('hidden');
    el.btnPauseRound.classList.add('hidden');
    el.btnResumeRound.classList.add('hidden');
    el.btnNextRound.classList.add('hidden');
  }

  // Corner live numbers
  el.dashBlueStrikes.textContent = bout.currentRoundStats.blueStrikes;
  el.dashRedStrikes.textContent = bout.currentRoundStats.redStrikes;
  el.blueFoulBadge.textContent = `${bout.currentRoundStats.bluePenalties} Foul${bout.currentRoundStats.bluePenalties === 1 ? '' : 's'}`;
  el.redFoulBadge.textContent = `${bout.currentRoundStats.redPenalties} Foul${bout.currentRoundStats.redPenalties === 1 ? '' : 's'}`;
  el.blueKdStrip.textContent = `Knockdowns: ${bout.currentRoundStats.blueKnockdowns}`;
  el.redKdStrip.textContent = `Knockdowns: ${bout.currentRoundStats.redKnockdowns}`;

  updateGauge(bout.currentRoundStats.blueStrikes, bout.currentRoundStats.redStrikes);

  el.judgeRosterCount.textContent = `${bout.judges.length} Judge${bout.judges.length === 1 ? '' : 's'} Connected`;

  renderJudgesGrid(bout.currentRoundStats.judgeStrikes || {}, bout.judges);
  renderScorecardTable(bout);
}

// Render Ringside Judges Breakdown
function renderJudgesGrid(judgeStrikes = {}, judges = []) {
  if (!judges || judges.length === 0) {
    el.judgeCardsGrid.innerHTML = `
      <div class="empty-state-notice">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <span>Awaiting ringside judges to enter room code on mobile application...</span>
      </div>
    `;
    return;
  }

  el.judgeCardsGrid.innerHTML = judges.map(j => {
    const s = judgeStrikes[j.name] || { blue: 0, red: 0 };
    return `
      <div class="judge-live-card">
        <div class="judge-live-card-head">
          <span>${escapeHtml(j.name)}</span>
          <span class="active-judges-pill"><span class="pulse-green-dot"></span> Online</span>
        </div>
        <div class="judge-strikes-duo">
          <div class="judge-corner-box">
            <span class="corner-sub-sm blue-accent">BLUE STRIKES</span>
            <span class="corner-num-lg blue-accent">${s.blue}</span>
          </div>
          <span style="font-weight: 700; color: #94a3b8;">VS</span>
          <div class="judge-corner-box" style="text-align: right;">
            <span class="corner-sub-sm red-accent">RED STRIKES</span>
            <span class="corner-num-lg red-accent">${s.red}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Official 10-Point-Must Scorecard
function renderScorecardTable(bout) {
  const rounds = bout.completedRounds || [];

  if (rounds.length === 0) {
    el.scorecardRowsBody.innerHTML = `
      <tr class="empty-table-row">
        <td colspan="8">Round 1 in progress. Round score will tabulate in the ratio of 10 at the bell.</td>
      </tr>
    `;
    return;
  }

  let totB = 0;
  let totR = 0;
  const jTotals = { j1: { b: 0, r: 0 }, j2: { b: 0, r: 0 }, j3: { b: 0, r: 0 } };

  el.scorecardRowsBody.innerHTML = rounds.map(r => {
    totB += r.blueStrikes;
    totR += r.redStrikes;

    const j1 = r.judgeScores[0] || { blue: 9, red: 10 };
    const j2 = r.judgeScores[1] || { blue: 9, red: 10 };
    const j3 = r.judgeScores[2] || { blue: 9, red: 10 };

    jTotals.j1.b += j1.blue;
    jTotals.j1.r += j1.red;
    jTotals.j2.b += j2.blue;
    jTotals.j2.r += j2.red;
    jTotals.j3.b += j3.blue;
    jTotals.j3.r += j3.red;

    const winClass = r.roundWinner === 'BLUE' ? 'winner-blue-cell' : (r.roundWinner === 'RED' ? 'winner-red-cell' : '');
    const winName = r.roundWinner === 'BLUE' ? `${bout.blueFighter} (10 - ${r.judgeScores[0]?.red || 9})` : (r.roundWinner === 'RED' ? `${bout.redFighter} (10 - ${r.judgeScores[0]?.blue || 9})` : 'EVEN (10 - 10)');

    return `
      <tr>
        <td style="font-weight: 800;">Round ${r.roundNumber}</td>
        <td>${r.blueStrikes}</td>
        <td>${r.redStrikes}</td>
        <td style="font-size: 0.78rem; color: #64748b;">KD: B${r.blueKnockdowns}/R${r.redKnockdowns} &bull; Foul: B${r.bluePenalties}/R${r.redPenalties}</td>
        <td>${j1.blue} - ${j1.red}</td>
        <td>${j2.blue} - ${j2.red}</td>
        <td>${j3.blue} - ${j3.red}</td>
        <td class="${winClass}">${winName}</td>
      </tr>
    `;
  }).join('');

  el.totBlueStrikes.textContent = totB;
  el.totRedStrikes.textContent = totR;
  el.totJudge1.textContent = `${jTotals.j1.b} - ${jTotals.j1.r}`;
  el.totJudge2.textContent = `${jTotals.j2.b} - ${jTotals.j2.r}`;
  el.totJudge3.textContent = `${jTotals.j3.b} - ${jTotals.j3.r}`;

  if (bout.finalDecision) {
    el.finalDecisionBanner.classList.remove('hidden');
    el.finalDecisionBanner.textContent = bout.finalDecision.decision;
    el.totConsensusWinner.textContent = bout.finalDecision.decision.split('-')[0].trim();
  }
}

function setupQrCode(code) {
  // If hosted on a cloud domain (Render, Railway, custom domain), use window.location.origin
  // If running locally on localhost, prefer detected local Wi-Fi IP so phones on same network can connect
  let baseUrl = window.location.origin;
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && boutState.serverIps.length > 0) {
    baseUrl = `http://${boutState.serverIps[0].address}:${boutState.serverPort}`;
  }

  const judgeJoinUrl = `${baseUrl}/judge.html?room=${code}`;
  el.mobileUrlField.value = judgeJoinUrl;

  el.qrCanvasBox.innerHTML = '';
  new QRCode(el.qrCanvasBox, {
    text: judgeJoinUrl,
    width: 180,
    height: 180,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, t => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[t] || t));
}

// Admin Action Buttons
el.btnStartRound.addEventListener('click', () => {
  boutState.socket.emit('admin_start_round', { roomCode: boutState.code });
});
el.btnPauseRound.addEventListener('click', () => {
  boutState.socket.emit('admin_pause_round', { roomCode: boutState.code });
});
el.btnResumeRound.addEventListener('click', () => {
  boutState.socket.emit('admin_resume_round', { roomCode: boutState.code });
});
el.btnEndRound.addEventListener('click', () => {
  if (confirm('End current round and calculate 10-Point-Must scores?')) {
    boutState.socket.emit('admin_end_round', { roomCode: boutState.code });
  }
});
el.btnNextRound.addEventListener('click', () => {
  boutState.socket.emit('admin_next_round', { roomCode: boutState.code });
});

// Referee Penalties & Knockdowns
el.btnFoulBlue.addEventListener('click', () => {
  boutState.socket.emit('admin_penalty', { roomCode: boutState.code, corner: 'blue', type: 'deduction' });
});
el.btnKdBlue.addEventListener('click', () => {
  boutState.socket.emit('admin_penalty', { roomCode: boutState.code, corner: 'blue', type: 'knockdown' });
});
el.btnFoulRed.addEventListener('click', () => {
  boutState.socket.emit('admin_penalty', { roomCode: boutState.code, corner: 'red', type: 'deduction' });
});
el.btnKdRed.addEventListener('click', () => {
  boutState.socket.emit('admin_penalty', { roomCode: boutState.code, corner: 'red', type: 'knockdown' });
});

// Navigation / Modals
el.btnExitToConfig.addEventListener('click', () => {
  if (confirm('Exit current match and configure a new bout room?')) {
    boutState.code = null;
    el.dashboardView.classList.add('hidden');
    el.configView.classList.remove('hidden');
  }
});

el.btnShowQr.addEventListener('click', () => el.qrModal.classList.remove('hidden'));
el.btnCloseQr.addEventListener('click', () => el.qrModal.classList.add('hidden'));
el.qrModal.addEventListener('click', (e) => {
  if (e.target === el.qrModal) el.qrModal.classList.add('hidden');
});

el.btnCopyRoomCode.addEventListener('click', () => {
  navigator.clipboard.writeText(boutState.code).then(() => {
    alert(`Room code ${boutState.code} copied to clipboard!`);
  });
});

el.btnCopyMobileUrl.addEventListener('click', () => {
  navigator.clipboard.writeText(el.mobileUrlField.value).then(() => {
    el.btnCopyMobileUrl.textContent = 'Copied!';
    setTimeout(() => el.btnCopyMobileUrl.textContent = 'Copy', 1200);
  });
});

el.btnTestBell.addEventListener('click', () => audio.ringBell());

// Initialize
initServerInfo();
setupSocket();
