const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// In-memory store for Isolated Bouts: roomCode -> bout
const bouts = new Map();

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (bouts.has(code));
  return code;
}

// 10-Point Must Scoring Engine
function calculate10PointMust(roundStats, judgesList) {
  const judgeScores = [];
  let redRoundWins = 0;
  let blueRoundWins = 0;
  let drawVotes = 0;

  judgesList.forEach(judge => {
    const jStrikes = roundStats.judgeStrikes[judge.name] || { red: 0, blue: 0 };
    let redPts = 10;
    let bluePts = 10;

    if (jStrikes.red > jStrikes.blue) {
      redPts = 10;
      bluePts = 9;
      if (roundStats.blueKnockdowns > 0) {
        bluePts = Math.max(7, bluePts - roundStats.blueKnockdowns);
      }
      if (roundStats.redKnockdowns > 0) {
        redPts = Math.max(8, redPts - roundStats.redKnockdowns);
      }
    } else if (jStrikes.blue > jStrikes.red) {
      bluePts = 10;
      redPts = 9;
      if (roundStats.redKnockdowns > 0) {
        redPts = Math.max(7, redPts - roundStats.redKnockdowns);
      }
      if (roundStats.blueKnockdowns > 0) {
        bluePts = Math.max(8, bluePts - roundStats.blueKnockdowns);
      }
    } else {
      redPts = 10;
      bluePts = 10;
      if (roundStats.redKnockdowns > roundStats.blueKnockdowns) {
        redPts -= (roundStats.redKnockdowns - roundStats.blueKnockdowns);
      } else if (roundStats.blueKnockdowns > roundStats.redKnockdowns) {
        bluePts -= (roundStats.blueKnockdowns - roundStats.redKnockdowns);
      }
    }

    // Official foul deductions
    if (roundStats.redPenalties > 0) {
      redPts = Math.max(6, redPts - roundStats.redPenalties);
    }
    if (roundStats.bluePenalties > 0) {
      bluePts = Math.max(6, bluePts - roundStats.bluePenalties);
    }

    if (redPts > bluePts) redRoundWins++;
    else if (bluePts > redPts) blueRoundWins++;
    else drawVotes++;

    judgeScores.push({
      judgeName: judge.name,
      red: redPts,
      blue: bluePts,
      redStrikes: jStrikes.red,
      blueStrikes: jStrikes.blue
    });
  });

  let roundWinner = 'DRAW';
  if (redRoundWins > blueRoundWins && redRoundWins >= drawVotes) {
    roundWinner = 'RED';
  } else if (blueRoundWins > redRoundWins && blueRoundWins >= drawVotes) {
    roundWinner = 'BLUE';
  }

  return { judgeScores, roundWinner };
}

// Calculate Final Decision
function calculateFinalDecision(bout) {
  if (!bout.completedRounds.length) return { decision: 'NO CONTEST', judgeTotals: {} };

  const judgeTotals = {};
  bout.judges.forEach(j => {
    judgeTotals[j.name] = { red: 0, blue: 0 };
  });

  bout.completedRounds.forEach(round => {
    round.judgeScores.forEach(js => {
      if (!judgeTotals[js.judgeName]) {
        judgeTotals[js.judgeName] = { red: 0, blue: 0 };
      }
      judgeTotals[js.judgeName].red += js.red;
      judgeTotals[js.judgeName].blue += js.blue;
    });
  });

  let redJudges = 0;
  let blueJudges = 0;
  let drawJudges = 0;

  Object.values(judgeTotals).forEach(tot => {
    if (tot.red > tot.blue) redJudges++;
    else if (tot.blue > tot.red) blueJudges++;
    else drawJudges++;
  });

  const totalJudges = Object.keys(judgeTotals).length;
  let decision = '';

  if (redJudges === totalJudges && totalJudges > 0) {
    decision = `UNANIMOUS DECISION (UD) - ${bout.redFighter.toUpperCase()} WINS`;
  } else if (blueJudges === totalJudges && totalJudges > 0) {
    decision = `UNANIMOUS DECISION (UD) - ${bout.blueFighter.toUpperCase()} WINS`;
  } else if (redJudges > blueJudges && redJudges >= Math.ceil(totalJudges / 2)) {
    decision = drawJudges > 0
      ? `MAJORITY DECISION (MD) - ${bout.redFighter.toUpperCase()} WINS`
      : `SPLIT DECISION (SD) - ${bout.redFighter.toUpperCase()} WINS`;
  } else if (blueJudges > redJudges && blueJudges >= Math.ceil(totalJudges / 2)) {
    decision = drawJudges > 0
      ? `MAJORITY DECISION (MD) - ${bout.blueFighter.toUpperCase()} WINS`
      : `SPLIT DECISION (SD) - ${bout.blueFighter.toUpperCase()} WINS`;
  } else {
    decision = 'SPLIT / MAJORITY DRAW';
  }

  return { decision, judgeTotals };
}

function serializeBout(bout) {
  return {
    code: bout.code,
    title: bout.title,
    redFighter: bout.redFighter,
    blueFighter: bout.blueFighter,
    totalRounds: bout.totalRounds,
    roundDurationSeconds: bout.roundDurationSeconds,
    restDurationSeconds: bout.restDurationSeconds,
    requiredJudges: bout.requiredJudges,
    currentRound: bout.currentRound,
    state: bout.state,
    roundTimeRemaining: bout.roundTimeRemaining,
    restTimeRemaining: bout.restTimeRemaining,
    currentRoundStats: bout.currentRoundStats,
    completedRounds: bout.completedRounds,
    judges: Array.from(bout.judges.values()),
    finalDecision: bout.finalDecision,
    createdAt: bout.createdAt
  };
}

function broadcastBoutState(bout) {
  const data = serializeBout(bout);
  io.to(bout.code).emit('match_state_update', data);
  io.to(bout.code).emit('room_state', data);
}

// Robust, Isolated Timer Engine
function clearBoutTimer(bout) {
  if (bout.timerInterval) {
    clearInterval(bout.timerInterval);
    bout.timerInterval = null;
  }
}

function startRoundClock(bout) {
  clearBoutTimer(bout);
  bout.state = 'ROUND_ACTIVE';
  broadcastBoutState(bout);

  bout.timerInterval = setInterval(() => {
    if (bout.state !== 'ROUND_ACTIVE') return;

    bout.roundTimeRemaining--;

    if (bout.roundTimeRemaining <= 0) {
      bout.roundTimeRemaining = 0;
      clearBoutTimer(bout);
      endRoundAutomatically(bout);
      return;
    }

    io.to(bout.code).emit('clock_tick', {
      roundTimeRemaining: bout.roundTimeRemaining,
      currentRound: bout.currentRound,
      state: bout.state
    });
  }, 1000);
}

function pauseRound(bout) {
  if (bout.state !== 'ROUND_ACTIVE') return;
  clearBoutTimer(bout);
  bout.state = 'ROUND_PAUSED';
  broadcastBoutState(bout);
}

function resumeRound(bout) {
  if (bout.state !== 'ROUND_PAUSED') return;
  startRoundClock(bout);
}

function endRoundAutomatically(bout) {
  clearBoutTimer(bout);
  bout.state = 'ROUND_REST';
  bout.restTimeRemaining = bout.restDurationSeconds;

  const judgesList = Array.from(bout.judges.values());
  const roundOutcome = calculate10PointMust(bout.currentRoundStats, judgesList);

  const completedRecord = {
    roundNumber: bout.currentRound,
    redStrikes: bout.currentRoundStats.redStrikes,
    blueStrikes: bout.currentRoundStats.blueStrikes,
    redKnockdowns: bout.currentRoundStats.redKnockdowns,
    blueKnockdowns: bout.currentRoundStats.blueKnockdowns,
    redPenalties: bout.currentRoundStats.redPenalties,
    bluePenalties: bout.currentRoundStats.bluePenalties,
    judgeScores: roundOutcome.judgeScores,
    roundWinner: roundOutcome.roundWinner
  };

  bout.completedRounds.push(completedRecord);

  io.to(bout.code).emit('ring_bell', { event: 'ROUND_ENDED', round: bout.currentRound });

  if (bout.currentRound >= bout.totalRounds) {
    concludeMatch(bout);
    return;
  }

  broadcastBoutState(bout);

  // Start Rest Countdown
  bout.timerInterval = setInterval(() => {
    if (bout.state !== 'ROUND_REST') return;

    bout.restTimeRemaining--;

    if (bout.restTimeRemaining <= 0) {
      bout.restTimeRemaining = 0;
      clearBoutTimer(bout);
      prepareNextRound(bout);
      return;
    }

    io.to(bout.code).emit('rest_tick', {
      restTimeRemaining: bout.restTimeRemaining,
      currentRound: bout.currentRound,
      state: bout.state
    });
  }, 1000);
}

function prepareNextRound(bout) {
  clearBoutTimer(bout);
  bout.currentRound++;
  bout.state = 'ROUND_ACTIVE';
  bout.roundTimeRemaining = bout.roundDurationSeconds;
  bout.currentRoundStats = {
    redStrikes: 0,
    blueStrikes: 0,
    redKnockdowns: 0,
    blueKnockdowns: 0,
    redPenalties: 0,
    bluePenalties: 0,
    judgeStrikes: {}
  };

  io.to(bout.code).emit('ring_bell', { event: 'ROUND_STARTED', round: bout.currentRound });
  startRoundClock(bout);
}

function concludeMatch(bout) {
  clearBoutTimer(bout);
  bout.state = 'MATCH_FINISHED';
  bout.finalDecision = calculateFinalDecision(bout);

  io.to(bout.code).emit('ring_bell', { event: 'MATCH_CONCLUDED' });
  broadcastBoutState(bout);
}

// REST Endpoints
app.get('/api/info', (req, res) => {
  res.json({
    appName: 'Ringside Boxing Scoring System',
    version: '3.0.0',
    localIps: getLocalIpAddresses(),
    port: PORT,
    activeBouts: bouts.size,
    apkUrl: `/download/boxing-judge.apk`
  });
});

app.get('/api/bouts/:code', (req, res) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const bout = bouts.get(code);
  if (!bout) return res.status(404).json({ success: false, error: 'Bout not found' });
  res.json({ success: true, bout: serializeBout(bout) });
});

app.post('/api/bouts/create', (req, res) => {
  const customCode = req.body.roomCode ? req.body.roomCode.trim().toUpperCase() : null;
  const roomCode = customCode || generateRoomCode();

  if (bouts.has(roomCode)) {
    return res.status(400).json({ success: false, error: 'Bout code already exists' });
  }

  const bout = {
    code: roomCode,
    title: req.body.boutTitle || 'Championship Boxing Match',
    redFighter: req.body.redFighter || 'Red Fighter',
    blueFighter: req.body.blueFighter || 'Blue Fighter',
    totalRounds: parseInt(req.body.totalRounds, 10) || 3,
    roundDurationSeconds: parseInt(req.body.roundDurationSeconds, 10) || 180,
    restDurationSeconds: parseInt(req.body.restDurationSeconds, 10) || 60,
    requiredJudges: parseInt(req.body.requiredJudges, 10) || 3,
    currentRound: 1,
    state: 'CONFIGURED',
    roundTimeRemaining: parseInt(req.body.roundDurationSeconds, 10) || 180,
    restTimeRemaining: parseInt(req.body.restDurationSeconds, 10) || 60,
    timerInterval: null,
    currentRoundStats: {
      redStrikes: 0,
      blueStrikes: 0,
      redKnockdowns: 0,
      blueKnockdowns: 0,
      redPenalties: 0,
      bluePenalties: 0,
      judgeStrikes: {}
    },
    completedRounds: [],
    judges: new Map(),
    finalDecision: null,
    createdAt: Date.now()
  };

  bouts.set(roomCode, bout);
  res.json({ success: true, bout: serializeBout(bout) });
});

// Socket.IO Scoped to Isolated Rooms
io.on('connection', (socket) => {
  let currentBoutCode = null;
  let currentJudgeName = null;

  socket.on('create_bout', (data = {}, callback) => {
    let code = (data.roomCode || '').trim().toUpperCase();
    if (!code) code = generateRoomCode();
    else if (bouts.has(code)) {
      if (typeof callback === 'function') callback({ success: false, error: 'Code in use' });
      return;
    }

    const bout = {
      code,
      title: data.boutTitle || 'Championship Boxing Match',
      redFighter: data.redFighter || 'Red Fighter',
      blueFighter: data.blueFighter || 'Blue Fighter',
      totalRounds: parseInt(data.totalRounds, 10) || 3,
      roundDurationSeconds: parseInt(data.roundDurationSeconds, 10) || 180,
      restDurationSeconds: parseInt(data.restDurationSeconds, 10) || 60,
      requiredJudges: parseInt(data.requiredJudges, 10) || 3,
      currentRound: 1,
      state: 'CONFIGURED',
      roundTimeRemaining: parseInt(data.roundDurationSeconds, 10) || 180,
      restTimeRemaining: parseInt(data.restDurationSeconds, 10) || 60,
      timerInterval: null,
      currentRoundStats: {
        redStrikes: 0,
        blueStrikes: 0,
        redKnockdowns: 0,
        blueKnockdowns: 0,
        redPenalties: 0,
        bluePenalties: 0,
        judgeStrikes: {}
      },
      completedRounds: [],
      judges: new Map(),
      finalDecision: null,
      createdAt: Date.now()
    };

    bouts.set(code, bout);
    socket.join(code);
    currentBoutCode = code;

    console.log(`[Bout Created] ${code}: ${bout.blueFighter} vs ${bout.redFighter}`);
    if (typeof callback === 'function') callback({ success: true, bout: serializeBout(bout) });
  });

  socket.on('join_room', (data = {}, callback) => {
    const code = (data.roomCode || '').trim().toUpperCase();
    const isDashboard = Boolean(data.isDashboard);
    let judgeName = (data.judgeName || data.playerName || 'Judge').trim();

    const bout = bouts.get(code);
    if (!bout) {
      if (typeof callback === 'function') callback({ success: false, error: `Match room ${code} not found.` });
      return;
    }

    socket.join(code);
    currentBoutCode = code;

    if (!isDashboard) {
      if (judgeName === 'Judge' || judgeName === 'Android Player') {
        judgeName = `Judge ${bout.judges.size + 1}`;
      }
      currentJudgeName = judgeName;

      bout.judges.set(socket.id, {
        id: socket.id,
        name: judgeName,
        joinedAt: Date.now()
      });

      console.log(`[Judge Authenticated] Room ${code}: ${judgeName}`);
    }

    const boutData = serializeBout(bout);
    if (typeof callback === 'function') callback({ success: true, room: boutData, bout: boutData });
    broadcastBoutState(bout);
  });

  // Admin Controls (Strictly Room Isolated)
  socket.on('admin_start_round', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    console.log(`[Admin] Starting Round ${bout.currentRound} for ${code}`);
    io.to(code).emit('ring_bell', { event: 'ROUND_STARTED', round: bout.currentRound });
    startRoundClock(bout);
  });

  socket.on('admin_pause_round', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    pauseRound(bout);
  });

  socket.on('admin_resume_round', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    resumeRound(bout);
  });

  socket.on('admin_end_round', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    endRoundAutomatically(bout);
  });

  socket.on('admin_next_round', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    if (bout.currentRound < bout.totalRounds) {
      prepareNextRound(bout);
    } else {
      concludeMatch(bout);
    }
  });

  // Penalties & Knockdowns
  socket.on('admin_penalty', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const bout = bouts.get(code);
    if (!bout) return;

    const corner = (data.corner || '').toLowerCase();
    const type = data.type || 'deduction';

    if (corner === 'red') {
      if (type === 'knockdown') bout.currentRoundStats.redKnockdowns++;
      else bout.currentRoundStats.redPenalties++;
    } else if (corner === 'blue') {
      if (type === 'knockdown') bout.currentRoundStats.blueKnockdowns++;
      else bout.currentRoundStats.bluePenalties++;
    }

    broadcastBoutState(bout);
  });

  // Judge Strike Tap
  socket.on('tap', (data = {}) => {
    const code = (data.roomCode || currentBoutCode || '').trim().toUpperCase();
    const team = (data.team || '').toLowerCase();
    const bout = bouts.get(code);

    if (!bout) return;
    if (bout.state !== 'ROUND_ACTIVE') return;

    let judgeName = currentJudgeName || data.judgeName;
    if (!judgeName && bout.judges.has(socket.id)) {
      judgeName = bout.judges.get(socket.id).name;
    }
    if (!judgeName) judgeName = 'Judge';

    if (!bout.currentRoundStats.judgeStrikes) {
      bout.currentRoundStats.judgeStrikes = {};
    }

    if (!bout.currentRoundStats.judgeStrikes[judgeName]) {
      bout.currentRoundStats.judgeStrikes[judgeName] = { red: 0, blue: 0 };
    }

    if (team === 'red') {
      bout.currentRoundStats.redStrikes++;
      bout.currentRoundStats.judgeStrikes[judgeName].red++;
    } else if (team === 'blue') {
      bout.currentRoundStats.blueStrikes++;
      bout.currentRoundStats.judgeStrikes[judgeName].blue++;
    }

    io.to(code).emit('strike_event', {
      team,
      judgeName,
      redTotal: bout.currentRoundStats.redStrikes,
      blueTotal: bout.currentRoundStats.blueStrikes,
      currentRound: bout.currentRound,
      roundStats: bout.currentRoundStats,
      judges: Array.from(bout.judges.values())
    });
  });

  socket.on('disconnect', () => {
    if (currentBoutCode && bouts.has(currentBoutCode)) {
      const bout = bouts.get(currentBoutCode);
      if (currentJudgeName) {
        bout.judges.delete(socket.id);
        broadcastBoutState(bout);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`🥊 Ringside Boxing Server running on port ${PORT}`);
  console.log(`   - Public Cloud / Render Ready (PORT: ${PORT})`);
  console.log(`   - Master Web: http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`   - Local Wi-Fi: http://${ip.address}:${PORT}`);
  });
  console.log(`======================================================\n`);
});
