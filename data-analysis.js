/* ============================================================
   DATA ANALYSIS — Bump Chart (SCROLL HORIZONTAL + TOGGLE FIT)
   ============================================================ */

let BUMP_CHART_FIT_MODE = false;

function daLog(msg) {
  console.log('[DataAnalysis]', msg);
}

function daLoadWorldCupData() {
  if (window.__worldCupData) return Promise.resolve(window.__worldCupData);
  return fetch(DATA_SRC + '/worldcup.json')
    .then(r => r.json())
    .then(data => {
      window.__worldCupData = data;
      return data;
    });
}

/* -----------------------------------------------------------
   CONVERSIÓN DE FECHA/HORA A CEST (EUROPA CENTRAL)
   ----------------------------------------------------------- */
/**
 * Convierte la fecha local de un partido (date + time con zona horaria)
 * a la fecha correspondiente en CEST (UTC+2).
 * 
 * Ejemplo: "2026-06-23" + "21:00 UTC-5" → "2026-06-24" (04:00 CEST)
 * 
 * @param {string} dateStr - Fecha en formato "YYYY-MM-DD"
 * @param {string} timeStr - Hora en formato "HH:MM UTC±N"
 * @returns {string} Fecha en CEST como "YYYY-MM-DD"
 */
function daConvertToCESTDate(dateStr, timeStr) {
  if (!dateStr) return dateStr;
  
  let hour = 0, minute = 0, utcOffset = 0;
  
  if (timeStr) {
    const timeMatch = timeStr.match(/^(\d{2}):(\d{2})\s+UTC([+-]\d+)$/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      utcOffset = parseInt(timeMatch[3], 10);
    }
  }
  
  // Crear fecha en UTC: hora local - offset = UTC
  const [anio, mes, dia] = dateStr.split('-').map(Number);
  const utcHour = hour - utcOffset;
  const utcDate = new Date(Date.UTC(anio, mes - 1, dia, utcHour, minute));
  
  if (Number.isNaN(utcDate.getTime())) return dateStr;
  
  // Convertir UTC a CEST (UTC+2) para obtener la fecha en Europa
  const cestDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
  
  const y = cestDate.getUTCFullYear();
  const m = String(cestDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(cestDate.getUTCDate()).padStart(2, '0');
  
  return `${y}-${m}-${d}`;
}

/**
 * Versión completa con hora para ordenar dentro del mismo día CEST
 */
function daConvertToCEST(dateStr, timeStr) {
  if (!dateStr) return { date: dateStr, timestamp: 0 };
  
  let hour = 0, minute = 0, utcOffset = 0;
  
  if (timeStr) {
    const timeMatch = timeStr.match(/^(\d{2}):(\d{2})\s+UTC([+-]\d+)$/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      utcOffset = parseInt(timeMatch[3], 10);
    }
  }
  
  const [anio, mes, dia] = dateStr.split('-').map(Number);
  const utcHour = hour - utcOffset;
  const utcDate = new Date(Date.UTC(anio, mes - 1, dia, utcHour, minute));
  
  if (Number.isNaN(utcDate.getTime())) {
    return { date: dateStr, timestamp: new Date(dateStr + 'T00:00:00Z').getTime() };
  }
  
  // Añadir 2 horas para CEST
  const cestTimestamp = utcDate.getTime() + (2 * 60 * 60 * 1000);
  const cestDate = new Date(cestTimestamp);
  
  const y = cestDate.getUTCFullYear();
  const m = String(cestDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(cestDate.getUTCDate()).padStart(2, '0');
  
  return { 
    date: `${y}-${m}-${d}`, 
    timestamp: cestTimestamp 
  };
}

/**
 * Obtiene la fecha actual en CEST (Europe/Madrid) de forma robusta.
 * Reemplaza el antiguo new Date().toISOString() que daba la fecha UTC.
 */
function daGetTodayCEST() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}



function daPrecalcularBumpChart(players, finishedMatches) {
  const TOTAL_GROUP_MATCHES = 72;

  // Agrupar por fecha CEST en lugar de fecha local
  const byCESTDate = {};
  finishedMatches.forEach(m => {
    const cest = daConvertToCEST(m.date, m.time);
    const cestDate = cest.date;
    if (!byCESTDate[cestDate]) byCESTDate[cestDate] = [];
    byCESTDate[cestDate].push({ ...m, _cestTimestamp: cest.timestamp });
  });

  // Ordenar las fechas CEST
  const uniqueDates = Object.keys(byCESTDate).sort();
  
  const todayCEST = daGetTodayCEST();
  
  const hasTodayMatches = uniqueDates.includes(todayCEST);
  
  const dates = [...uniqueDates];
  if (!hasTodayMatches && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const lastDateObj = new Date(lastDate + 'T00:00:00');
    const todayObj = new Date(todayCEST + 'T00:00:00');
    
    if (todayObj > lastDateObj) {
      dates.push(todayCEST);
    }
  }

  const dailyScores = [];
  const matchesSoFar = [];

  dates.forEach(date => {
    if (byCESTDate[date]) {
      // Ordenar partidos del día por timestamp CEST para consistencia
      const dayMatches = byCESTDate[date].sort((a, b) => a._cestTimestamp - b._cestTimestamp);
      matchesSoFar.push(...dayMatches);
    }
    
    const realPartial = daBuildPartialReal(matchesSoFar);
    const groupMatchesSoFar = matchesSoFar.filter(m => m.group && m.group.startsWith('Group ')).length;
    const faseGruposTerminada = groupMatchesSoFar >= TOTAL_GROUP_MATCHES;

    const dayScores = players.map(player => {
      const score = daCalculateScore(player, realPartial, faseGruposTerminada);
      return { name: player.name || 'Anónimo', score };
    });

    dayScores.sort((a, b) => b.score - a.score);

    dayScores.forEach((d, i) => {
      dailyScores.push({
        player: d.name,
        score: d.score,
        date,  // Fecha CEST
        rank: i + 1,
        sharedRank: null
      });
    });

    let currentRank = 1;
    let previousScore = null;
    let playersAtRank = 0;
    
    dayScores.forEach((entry) => {
      const score = Number(entry.score) || 0;
      if (previousScore !== null && score !== previousScore) {
        currentRank += playersAtRank;
        playersAtRank = 0;
      }
      playersAtRank++;
      previousScore = score;
      
      const matchingEntry = dailyScores.find(d => d.player === entry.name && d.date === date);
      if (matchingEntry) {
        matchingEntry.sharedRank = currentRank;
      }
    });
  });

  window.__bumpChartData = dailyScores;
}

/* -----------------------------------------------------------
   CÁLCULO MANUAL DE PUNTUACIÓN
   ----------------------------------------------------------- */

/* -----------------------------------------------------------
   NUEVO: Ronda alcanzada incrementalmente
   ----------------------------------------------------------- */
function daGetTeamRoundReached(team, data, faseGruposTerminada) {
  if (!team || !data) return null;

  const rounds = ['round32', 'round16', 'quarterfinals', 'semifinals', 'thirdPlace', 'final'];

  // 1. Buscar en knockout matches la ronda más alta confirmada
  const ko = (data.knockout && data.knockout.matches) ? data.knockout.matches : {};
  let highestPlayed = null;

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const matches = ko[round] || [];
    for (let j = 0; j < matches.length; j++) {
      const m = matches[j];
      if (m.team1 === team || m.team2 === team) {
        if (m.winner) {
          if (m.winner === team) {
            if (round === 'final') {
              highestPlayed = 'champion';
            } else if (round === 'thirdPlace') {
              highestPlayed = 'thirdPlace';
            } else {
              highestPlayed = rounds[i + 1] || round;
            }
          } else {
            highestPlayed = round;
          }
        } else {
          highestPlayed = round;
        }
      }
    }
  }
  if (highestPlayed) return highestPlayed;

  // 2. Si no está en knockout pero la fase de grupos terminó,
  //    verificar clasificación (1º, 2º o mejor tercero)
  if (faseGruposTerminada) {
    const groups = data.groups || {};
    const groupKeys = Object.keys(groups);
    for (let i = 0; i < groupKeys.length; i++) {
      const g = groupKeys[i];
      const order = groups[g] || [];
      if (order[0] === team || order[1] === team) return 'round32';
      if (order[2] === team) {
        const tp = (data.thirdPlace || []).slice(0, 8);
        for (let j = 0; j < tp.length; j++) {
          if (tp[j] === team) return 'round32';
        }
      }
    }
  }

  return null;
}


function daCalculateScore(player, real, faseGruposTerminada) {
  let score = 0;

  if (faseGruposTerminada) {
    const groupNames = Object.keys(real.groups || {});
    groupNames.forEach(group => {
      const realOrder = real.groups[group] || [];
      const predOrder = player.groups?.[group] || [];
      for (let i = 0; i < 4; i++) {
        if (predOrder[i] && realOrder[i] && predOrder[i] === realOrder[i]) {
          score += 5;
        }
      }
    });
  }

  const predResults = player.groupMatchResults || {};
  const realResults = real.groupMatchResults || {};
  
  Object.keys(realResults).forEach(key => {
    const pred = predResults[key];
    const realResult = realResults[key];
    if (!pred || pred.team1Goals === '' || pred.team2Goals === '') return;
    
    const pG1 = Number(pred.team1Goals);
    const pG2 = Number(pred.team2Goals);
    const rG1 = Number(realResult.team1Goals);
    const rG2 = Number(realResult.team2Goals);
    
    if (isNaN(pG1) || isNaN(pG2) || isNaN(rG1) || isNaN(rG2)) return;
    
    if (pG1 === rG1 && pG2 === rG2) {
      score += 5;
    }
    
    const p1x2 = pG1 > pG2 ? '1' : pG1 < pG2 ? '2' : 'X';
    const r1x2 = rG1 > rG2 ? '1' : rG1 < rG2 ? '2' : 'X';
    if (p1x2 === r1x2) {
      score += 1;
    }
  });

  if (faseGruposTerminada) {
    const realTP = new Set((real.thirdPlace || []).slice(0, 8));
    const predTP = (player.thirdPlace || []).slice(0, 8);
    predTP.forEach(team => {
      if (realTP.has(team)) score += 1;
    });
  }

  const roundPoints = {
    round32: 3, round16: 5, quarterfinals: 10, semifinals: 20,
    finalist: 30, champion: 50, thirdPlace: 20, fourthPlace: 20
  };

  // NUEVO: Calcular ronda alcanzada incrementalmente
  const allTeams = new Set();
  
  // Equipos de grupos del jugador
  Object.keys(player.groups || {}).forEach(g => {
    const order = player.groups[g] || [];
    for (let i = 0; i < order.length; i++) {
      if (order[i]) allTeams.add(order[i]);
    }
  });
  
  // Equipos de grupos reales
  Object.keys(real.groups || {}).forEach(g => {
    const order = real.groups[g] || [];
    for (let i = 0; i < order.length; i++) {
      if (order[i]) allTeams.add(order[i]);
    }
  });
  
  // Mejores terceros
  (player.thirdPlace || []).forEach(t => { if (t) allTeams.add(t); });
  (real.thirdPlace || []).forEach(t => { if (t) allTeams.add(t); });

  allTeams.forEach(team => {
    const predRound = daGetTeamRoundReached(team, player, true);
    const realRound = daGetTeamRoundReached(team, real, faseGruposTerminada);
    if (predRound && realRound && predRound === realRound) {
      const pts = roundPoints[predRound] || 0;
      score += pts;
    }
  });

  return score;
}

/* -----------------------------------------------------------
   CONSTRUIR RESULTADOS REALES PARCIALES
   ----------------------------------------------------------- */
function daBuildPartialReal(matchesWithResults) {
  const real = {
    groups: {}, groupsConfirmed: {}, groupMatchResults: {},
    thirdPlace: [], thirdPlaceConfirmed: false,
    knockout: { matches: { round32: [], round16: [], quarterfinals: [], semifinals: [], thirdPlace: [], final: [] } }
  };

  const gNames = (typeof GROUP_NAMES !== 'undefined' && GROUP_NAMES.length) ? GROUP_NAMES : Object.keys(TEAMS_BY_GROUP || {}).sort();
  const tByGroup = (typeof TEAMS_BY_GROUP !== 'undefined') ? TEAMS_BY_GROUP : {};

  gNames.forEach(g => { real.groups[g] = []; real.groupsConfirmed[g] = false; });
  if (!matchesWithResults || matchesWithResults.length === 0) return real;

  const groupStats = {};
  const groupMatchesProcessed = {};

  matchesWithResults.forEach(m => {
    if (!m.group || !m.group.startsWith('Group ')) return;
    const group = m.group.replace('Group ', '');
    if (!gNames.includes(group)) return;

    if (!groupStats[group]) {
      groupStats[group] = {};
      const teams = (tByGroup[group] || []).map(t => t.name);
      teams.forEach(t => { groupStats[group][t] = { team: t, pts: 0, gf: 0, ga: 0, gd: 0, played: 0, wins: 0, draws: 0, losses: 0 }; });
    }
    if (!groupMatchesProcessed[group]) groupMatchesProcessed[group] = [];
    groupMatchesProcessed[group].push(m);

    const g1 = parseInt(m.score.ft[0], 10);
    const g2 = parseInt(m.score.ft[1], 10);
    const t1 = (typeof translateTeamName === 'function') ? translateTeamName(m.team1) : m.team1;
    const t2 = (typeof translateTeamName === 'function') ? translateTeamName(m.team2) : m.team2;

    if (!groupStats[group][t1] || !groupStats[group][t2]) return;

    groupStats[group][t1].played++; groupStats[group][t2].played++;
    groupStats[group][t1].gf += g1; groupStats[group][t1].ga += g2;
    groupStats[group][t2].gf += g2; groupStats[group][t2].ga += g1;

    if (g1 > g2) {
      groupStats[group][t1].pts += 3; groupStats[group][t1].wins++; groupStats[group][t2].losses++;
    } else if (g1 < g2) {
      groupStats[group][t2].pts += 3; groupStats[group][t2].wins++; groupStats[group][t1].losses++;
    } else {
      groupStats[group][t1].pts += 1; groupStats[group][t2].pts += 1;
      groupStats[group][t1].draws++; groupStats[group][t2].draws++;
    }
  });

  Object.keys(groupStats).forEach(group => {
    const teams = Object.keys(groupStats[group]);
    teams.forEach(t => { groupStats[group][t].gd = groupStats[group][t].gf - groupStats[group][t].ga; });
    const standings = teams.map(t => groupStats[group][t]).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return (typeof getTeamFifaRank === 'function' ? getTeamFifaRank(a.team) : 999) -
             (typeof getTeamFifaRank === 'function' ? getTeamFifaRank(b.team) : 999);
    });
    real.groups[group] = standings.map(s => s.team);
    real.groupsConfirmed[group] = true;

    (groupMatchesProcessed[group] || []).forEach(m => {
      const t1 = (typeof translateTeamName === 'function') ? translateTeamName(m.team1) : m.team1;
      const t2 = (typeof translateTeamName === 'function') ? translateTeamName(m.team2) : m.team2;
      const key = (typeof groupMatchKey === 'function') ? groupMatchKey(t1, t2) : [t1, t2].sort().join('__');
      real.groupMatchResults[key] = { team1Goals: parseInt(m.score.ft[0], 10), team2Goals: parseInt(m.score.ft[1], 10) };
    });
  });

  const candidates = [];
  gNames.forEach(group => {
    if (!real.groups[group] || real.groups[group].length < 3) return;
    const third = real.groups[group][2];
    const stats = groupStats[group] && groupStats[group][third];
    if (!stats) return;
    candidates.push({ team: third, group, pts: stats.pts, gf: stats.gf, ga: stats.ga, gd: stats.gd });
  });

  candidates.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return (typeof getTeamFifaRank === 'function' ? getTeamFifaRank(a.team) : 999) -
           (typeof getTeamFifaRank === 'function' ? getTeamFifaRank(b.team) : 999);
  });

  real.thirdPlace = candidates.map(c => c.team);
  real.thirdPlaceConfirmed = candidates.length >= 8;

  const roundMap = {
    'Round of 32': 'round32', 'Round of 16': 'round16',
    'Quarter-final': 'quarterfinals', 'Semi-final': 'semifinals',
    'Match for third place': 'thirdPlace', 'Final': 'final'
  };

  // NUEVO: Usar SIEMPRE los datos del backend si están disponibles
  // El backend ya procesó correctamente los partidos de KO (incluidos programados)
  if (window.__leaderboardData && window.__leaderboardData.realResults) {
    const br = window.__leaderboardData.realResults;
    
    if (br.knockout && br.knockout.matches) {
      for (const round of Object.keys(br.knockout.matches)) {
        real.knockout.matches[round] = [];
        for (const m of br.knockout.matches[round]) {
          real.knockout.matches[round].push({
            match: m.match,
            team1: m.team1,
            team2: m.team2,
            winner: m.winner
          });
        }
      }
    }
    
    if (br.groups) {
      for (const g of Object.keys(br.groups)) {
        real.groups[g] = br.groups[g];
        real.groupsConfirmed[g] = true;
      }
    }
    if (br.thirdPlace && br.thirdPlace.length > 0) {
      real.thirdPlace = br.thirdPlace;
      real.thirdPlaceConfirmed = true;
    }
    if (br.groupMatchResults) {
      for (const key of Object.keys(br.groupMatchResults)) {
        real.groupMatchResults[key] = br.groupMatchResults[key];
      }
    }
    
    return real;
  }

  // Fallback: reconstruir desde matchesWithResults (solo si no hay datos del backend)
  matchesWithResults.forEach(m => {
    const roundName = roundMap[m.round];
    if (!roundName) return;
    const t1Raw = m.team1, t2Raw = m.team2;
    const isPlaceholder = /^[WL]\d+$/.test(t1Raw) || /^[WL]\d+$/.test(t2Raw) || /^\d+[A-Z]$/.test(t1Raw) || /^\d+[A-Z]$/.test(t2Raw);
    if (isPlaceholder) return;

    const t1 = (typeof translateTeamName === 'function') ? translateTeamName(t1Raw) : t1Raw;
    const t2 = (typeof translateTeamName === 'function') ? translateTeamName(t2Raw) : t2Raw;

    const g1 = m.score && m.score.ft && Array.isArray(m.score.ft) ? parseInt(m.score.ft[0], 10) : null;
    const g2 = m.score && m.score.ft && Array.isArray(m.score.ft) ? parseInt(m.score.ft[1], 10) : null;
    const winner = (g1 !== null && g2 !== null) ? (g1 > g2 ? t1 : t2) : null;

    real.knockout.matches[roundName].push({ match: m.num, team1: t1, team2: t2, winner: winner });
  });

  return real;
}

/* -----------------------------------------------------------
   PROCESAMIENTO Y RENDERIZADO
   ----------------------------------------------------------- */
function daProcessAndRender(players, finishedMatches) {
  const container = document.getElementById('bumpChartContainer');

  const TOTAL_GROUP_MATCHES = 72;

  // Agrupar por fecha CEST
  const byCESTDate = {};
  finishedMatches.forEach(m => {
    const cest = daConvertToCEST(m.date, m.time);
    const cestDate = cest.date;
    if (!byCESTDate[cestDate]) byCESTDate[cestDate] = [];
    byCESTDate[cestDate].push({ ...m, _cestTimestamp: cest.timestamp });
  });

  const uniqueDates = Object.keys(byCESTDate).sort();
  
  const todayCEST = daGetTodayCEST();
  
  const hasTodayMatches = uniqueDates.includes(todayCEST);
  
  const dates = [...uniqueDates];
  if (!hasTodayMatches && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const lastDateObj = new Date(lastDate + 'T00:00:00');
    const todayObj = new Date(todayCEST + 'T00:00:00');
    
    if (todayObj > lastDateObj) {
      dates.push(todayCEST);
    }
  }

  const dailyScores = [];
  const matchesSoFar = [];
  let processed = 0;
  const total = dates.length * players.length;

  function processNextDate(dateIndex) {
    if (dateIndex >= dates.length) {
      container.innerHTML = '<p class="note-text">Datos generados: ' + dailyScores.length + ' puntos. Renderizando...</p>';
      window.__bumpChartData = dailyScores;
      daRenderBumpChart(dailyScores, parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10));
      return;
    }

    const date = dates[dateIndex];
    
    if (byCESTDate[date]) {
      const dayMatches = byCESTDate[date].sort((a, b) => a._cestTimestamp - b._cestTimestamp);
      matchesSoFar.push(...dayMatches);
    }
    
    const realPartial = daBuildPartialReal(matchesSoFar);

    const groupMatchesSoFar = matchesSoFar.filter(m => m.group && m.group.startsWith('Group ')).length;
    const faseGruposTerminada = groupMatchesSoFar >= TOTAL_GROUP_MATCHES;

    const dayScores = players.map(player => {
      processed++;
      const score = daCalculateScore(player, realPartial, faseGruposTerminada);
      return { name: player.name || 'Anónimo', score };
    });

    dayScores.sort((a, b) => b.score - a.score);

    dayScores.forEach((d, i) => {
      dailyScores.push({
        player: d.name,
        score: d.score,
        date,
        rank: i + 1,
        sharedRank: null
      });
    });

    let currentRank = 1;
    let previousScore = null;
    let playersAtRank = 0;
    
    dayScores.forEach((entry) => {
      const score = Number(entry.score) || 0;
      if (previousScore !== null && score !== previousScore) {
        currentRank += playersAtRank;
        playersAtRank = 0;
      }
      playersAtRank++;
      previousScore = score;
      
      const matchingEntry = dailyScores.find(d => d.player === entry.name && d.date === date);
      if (matchingEntry) {
        matchingEntry.sharedRank = currentRank;
      }
    });

    if (dateIndex % 2 === 0 || dateIndex === dates.length - 1) {
      const isToday = date === todayCEST;
      const hasData = !!byCESTDate[date];
      container.innerHTML = '<p class="note-text">Procesando: día ' + (dateIndex + 1) + '/' + dates.length + 
        ' (' + processed + '/' + total + ' cálculos)' + 
        (faseGruposTerminada ? ' — Fase de grupos COMPLETA' : '') +
        (isToday ? (hasData ? ' — HOY' : ' — HOY (sin nuevos partidos)') : '') + '</p>';
    }

    setTimeout(() => processNextDate(dateIndex + 1), 10);
  }

  processNextDate(0);
}

/* -----------------------------------------------------------
   FUNCIÓN COMPARTIDA: Aplicar filtro de tiempo (día/semana)
   ----------------------------------------------------------- */
function daApplyTimeFilter(dailyData, timeFilter) {
  if (timeFilter === 'week') {
    return daGroupByWeek(dailyData);
  }
  if (timeFilter === 'total') {
    return daGroupByTotal(dailyData);
  }
  return dailyData;
}

/* -----------------------------------------------------------
   AGRUPAR POR TOTAL (acumulado final)
   ----------------------------------------------------------- */
function daGroupByTotal(dailyData) {
  const byPlayer = {};

  dailyData.forEach(d => {
    if (!byPlayer[d.player]) {
      byPlayer[d.player] = { ...d };
    } else {
      // Acumular puntos, mantener el rank del último día
      byPlayer[d.player].points += d.points;
      byPlayer[d.player].score = d.score;
      byPlayer[d.player].rank = d.rank;
      byPlayer[d.player].sharedRank = d.sharedRank;
    }
  });

  return Object.values(byPlayer);
}

/* -----------------------------------------------------------
   TOGGLE FIT MODE — BUMP CHART
   ----------------------------------------------------------- */
function daToggleFitMode() {
  BUMP_CHART_FIT_MODE = !BUMP_CHART_FIT_MODE;
  const wrapper = document.getElementById('bumpChartScrollWrapper');
  const btn = document.getElementById('btnToggleFitBump');
  
  if (BUMP_CHART_FIT_MODE) {
    wrapper.classList.add('fit-mode');
    btn.textContent = '🔍 Zoom normal';
    btn.style.background = '#1a1a2e';
  } else {
    wrapper.classList.remove('fit-mode');
    btn.textContent = '↔️ Ajustar al ancho';
    btn.style.background = '#6c757d';
  }
  
  if (window.__bumpChartData && window.__bumpChartData.length > 0) {
    const topN = parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10);
    const timeFilter = document.getElementById('bumpChartTimeFilter')?.value || 'day';
    daRenderBumpChart(window.__bumpChartData, topN, timeFilter);
  }
}

/* -----------------------------------------------------------
   RENDERIZADO DEL BUMP CHART (CON FILTRO DE TIEMPO)
   ----------------------------------------------------------- */
function daRenderBumpChart(dailyData, topN, timeFilter) {
  const container = document.getElementById('bumpChartContainer');
  const wrapper = document.getElementById('bumpChartScrollWrapper');
  container.innerHTML = '';

  // Aplicar filtro de tiempo
  let filteredData = daApplyTimeFilter(dailyData, timeFilter);

  const dates = [...new Set(filteredData.map(d => d.date))].sort();
  if (dates.length === 0) {
    container.innerHTML = '<p class="note-text">No hay fechas para mostrar.</p>';
    return;
  }

  const lastDate = dates[dates.length - 1];
  const lastRanks = filteredData.filter(d => d.date === lastDate).sort((a, b) => a.rank - b.rank);
  const topPlayers = new Set(lastRanks.slice(0, topN).map(d => d.player));
  const chartData = filteredData.filter(d => topPlayers.has(d.player));

  const isMobile = window.innerWidth <= 768;
  const isFitMode = BUMP_CHART_FIT_MODE;
  
  const margin = { 
    top: 30, 
    right: isMobile ? (isFitMode ? 50 : 80) : (isFitMode ? 90 : 150), 
    bottom: 60, 
    left: isMobile ? (isFitMode ? 35 : 45) : 50 
  };
  
  const minWidthPerDate = isMobile ? 70 : 100;
  const containerWidth = wrapper.clientWidth || 800;
  
  let width, svgWidth;
  
  if (isFitMode) {
    svgWidth = Math.max(containerWidth, 300);
    width = Math.max(svgWidth - margin.left - margin.right, 200);
  } else {
    const calculatedWidth = Math.max(dates.length * minWidthPerDate, containerWidth);
    svgWidth = calculatedWidth;
    width = svgWidth - margin.left - margin.right;
  }
  
  const height = isMobile ? 400 : 520;
  const innerHeight = height - margin.top - margin.bottom;

  container.style.width = isFitMode ? '100%' : svgWidth + 'px';
  container.style.height = height + 'px';
  container.style.minWidth = isFitMode ? '0' : svgWidth + 'px';

  const svg = d3.select('#bumpChartContainer')
    .append('svg')
    .attr('width', isFitMode ? '100%' : svgWidth)
    .attr('height', height)
    .attr('viewBox', `0 0 ${svgWidth} ${height}`)
    .attr('preserveAspectRatio', isFitMode ? 'xMidYMid meet' : 'xMinYMin meet')
    .style('display', 'block')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint().domain(dates).range([0, width]).padding(0.3);
  const maxRank = d3.max(chartData, d => d.rank) || 1;
  const y = d3.scaleLinear().domain([1, maxRank]).range([0, innerHeight]);

  const playersList = [...new Set(chartData.map(d => d.player))];
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(playersList);
  const line = d3.line().x(d => x(d.date)).y(d => y(d.rank)).curve(d3.curveMonotoneX);
  const nested = d3.group(chartData, d => d.player);

  // Grid horizontal
  svg.selectAll('.grid-line').data(y.ticks(maxRank)).enter().append('line')
    .attr('class', 'grid-line').attr('x1', 0).attr('x2', width)
    .attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', '#f0f0f0').attr('stroke-dasharray', '3,3');

  // Líneas
  const lines = svg.selectAll('.bump-line').data(Array.from(nested)).enter().append('path')
    .attr('class', 'bump-line').attr('d', ([, values]) => line(values))
    .attr('fill', 'none').attr('stroke', ([player]) => color(player))
    .attr('stroke-width', isMobile ? 2 : 2.5).attr('stroke-opacity', 0.85)
    .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
    .attr('data-player', ([player]) => player);

  // Puntos
  const points = svg.selectAll('.bump-point').data(chartData).enter().append('circle')
    .attr('class', 'bump-point').attr('cx', d => x(d.date)).attr('cy', d => y(d.rank))
    .attr('r', isMobile ? 4 : 5)
    .attr('fill', d => color(d.player)).attr('stroke', '#fff').attr('stroke-width', 2)
    .attr('data-player', d => d.player);

  // Eje X
  const xAxis = svg.append('g').attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const date = new Date(d + 'T00:00:00');
      if (timeFilter === 'week') {
        return isMobile 
          ? date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' })
          : 'Sem. ' + date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
      }
      return isMobile 
        ? date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric' })
        : date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
    }));
  
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-35)')
    .style('font-size', isMobile ? '9px' : '11px')
    .style('fill', '#666');
  xAxis.select('.domain').attr('stroke', '#ddd');

  // Eje Y
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(maxRank).tickFormat(d => '#' + d));
  yAxis.selectAll('text')
    .style('font-size', isMobile ? '10px' : '11px')
    .style('fill', '#666');
  yAxis.select('.domain').attr('stroke', '#ddd');

  // Tooltip
  const tooltip = d3.select('body').append('div').attr('class', 'bump-tooltip')
    .style('opacity', 0).style('position', 'absolute').style('background', 'rgba(26,26,46,0.95)').style('color', '#fff')
    .style('padding', '10px 14px').style('border-radius', '10px').style('font-size', '13px')
    .style('pointer-events', 'none').style('z-index', '10000').style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  function showTooltip(event, pointData) {
    const [py, pm, pd] = pointData.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(py, pm - 1, pd));
    const label = timeFilter === 'week' ? 'Semana del ' : '';
    tooltip.transition().duration(150).style('opacity', 1);
    tooltip.html(`
      <div style="font-weight:700;margin-bottom:4px;">${pointData.player}</div>
      <div style="color:#aaa;font-size:12px;">${label}${dateObj.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'long' })}</div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;font-weight:700;">#${pointData.rank}</span>
        <span style="color:#7FD8FF;font-weight:600;">${pointData.score} pts</span>
      </div>
    `);
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }

  function highlightPlayer(playerName) {
    svg.selectAll('.bump-line').attr('stroke-opacity', 0.12);
    svg.selectAll('.bump-line').filter(([p]) => p === playerName)
      .attr('stroke-opacity', 1).attr('stroke-width', isMobile ? 3 : 4);
    
    svg.selectAll('.bump-point').attr('r', isMobile ? 4 : 5).attr('stroke-width', 2);
    svg.selectAll('.bump-point').filter(d => d.player === playerName)
      .attr('r', isMobile ? 6 : 8).attr('stroke-width', 3);
  }

  function resetHighlight() {
    svg.selectAll('.bump-line').attr('stroke-opacity', 0.85).attr('stroke-width', isMobile ? 2 : 2.5);
    svg.selectAll('.bump-point').attr('r', isMobile ? 4 : 5).attr('stroke-width', 2);
    tooltip.transition().duration(200).style('opacity', 0);
  }

  points.on('mouseover', function(event, d) {
    highlightPlayer(d.player);
    showTooltip(event, d);
  }).on('mousemove', function(event) {
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }).on('mouseout', resetHighlight);

  // Labels del último día
  const lastPoints = chartData.filter(d => d.date === lastDate);
  
  const labels = svg.selectAll('.bump-label').data(lastPoints).enter().append('text')
    .attr('class', 'bump-label')
    .attr('x', width + (isMobile ? 5 : 10))
    .attr('y', d => y(d.rank))
    .attr('dy', '0.35em')
    .text(d => isMobile ? d.player.substring(0, 8) : `${d.rank}. ${d.player}`)
    .attr('fill', d => color(d.player))
    .attr('font-size', isMobile ? '10px' : '12px')
    .attr('font-weight', '600')
    .style('cursor', 'pointer')
    .style('pointer-events', 'all');

  labels.on('mouseenter', function(event, d) {
    highlightPlayer(d.player);
    showTooltip(event, d);
  }).on('mousemove', function(event) {
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }).on('mouseleave', resetHighlight);

  // Título eje Y
  svg.append('text').attr('transform', 'rotate(-90)').attr('y', 0 - margin.left + 12)
    .attr('x', 0 - (innerHeight / 2)).attr('dy', '1em').style('text-anchor', 'middle')
    .style('font-size', '12px').style('fill', '#888').text('Posición');
}

/* -----------------------------------------------------------
   ENTRY POINT
   ----------------------------------------------------------- */
function initDataAnalysis() {
  const container = document.getElementById('bumpChartContainer');
  if (!container) {
    console.error('[DataAnalysis] No existe #bumpChartContainer');
    return;
  }

  if (window.__bumpChartData && window.__bumpChartData.length > 0) {
    container.innerHTML = '<p class="note-text">Renderizando gráfico...</p>';
    const topN = parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10);
    daRenderBumpChart(window.__bumpChartData, topN);
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];
    
    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    daProcessAndRender(players, finished);

  }).catch(err => {
    console.error('[DataAnalysis] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

/* -----------------------------------------------------------
   CONTROLES DEL BUMP CHART
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshBumpChart');
  const topSelect = document.getElementById('bumpChartTopN');
  const timeSelect = document.getElementById('bumpChartTimeFilter');
  const toggleBtn = document.getElementById('btnToggleFitBump');
  
  if (refreshBtn) refreshBtn.addEventListener('click', function() {
    if (window.__bumpChartData) {
      const topN = parseInt(topSelect?.value || '10', 10);
      const timeFilter = timeSelect?.value || 'day';
      daRenderBumpChart(window.__bumpChartData, topN, timeFilter);
    } else {
      initDataAnalysis();
    }
  });
  
  if (topSelect) topSelect.addEventListener('change', function() {
    if (window.__bumpChartData) {
      const timeFilter = timeSelect?.value || 'day';
      daRenderBumpChart(window.__bumpChartData, parseInt(topSelect.value, 10), timeFilter);
    }
  });
  
  if (timeSelect) timeSelect.addEventListener('change', function() {
    if (window.__bumpChartData) {
      const topN = parseInt(topSelect?.value || '10', 10);
      daRenderBumpChart(window.__bumpChartData, topN, timeSelect.value);
    }
  });
  
  if (toggleBtn) toggleBtn.addEventListener('click', daToggleFitMode);
});

window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && window.__bumpChartData) {
    clearTimeout(window.__bumpChartResizeTimer);
    window.__bumpChartResizeTimer = setTimeout(function() {
      daRenderBumpChart(window.__bumpChartData, parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10));
    }, 300);
  }
});

/* ============================================================
   LINE RANKING — Puntuación vs Tiempo (Día/Semana)
   ============================================================ */

let LINE_RANKING_FIT_MODE = false;

/**
 * Obtiene la fecha de inicio de semana (lunes) para una fecha dada
 */
function daGetWeekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0=domingo, 1=lunes...
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(y, m - 1, diff));
  const yy = monday.getUTCFullYear();
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(monday.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}


/**
 * Agrupa datos diarios por semana (toma el último valor de cada semana)
 */
function daGroupByWeek(dailyData) {
  const byWeek = {};
  
  dailyData.forEach(d => {
    const weekStart = daGetWeekStart(d.date);
    if (!byWeek[weekStart]) byWeek[weekStart] = {};
    byWeek[weekStart][d.player] = d; // Sobrescribe: queda el último día de la semana
  });
  
  const result = [];
  const weeks = Object.keys(byWeek).sort();
  weeks.forEach(week => {
    Object.values(byWeek[week]).forEach(d => {
      result.push({ ...d, date: week, _isWeek: true });
    });
  });
  
  return result;
}

function daToggleFitLineRanking() {
  LINE_RANKING_FIT_MODE = !LINE_RANKING_FIT_MODE;
  const wrapper = document.getElementById('lineRankingScrollWrapper');
  const btn = document.getElementById('btnToggleFitLine');
  
  if (LINE_RANKING_FIT_MODE) {
    wrapper.classList.add('fit-mode');
    btn.textContent = '🔍 Zoom normal';
    btn.style.background = '#1a1a2e';
  } else {
    wrapper.classList.remove('fit-mode');
    btn.textContent = '↔️ Ajustar al ancho';
    btn.style.background = '#6c757d';
  }
  
  if (window.__lineRankingData && window.__lineRankingData.length > 0) {
    const topN = parseInt(document.getElementById('lineRankingTopN')?.value || '10', 10);
    const timeFilter = document.getElementById('lineRankingTimeFilter')?.value || 'day';
    daRenderLineRanking(window.__lineRankingData, topN, timeFilter);
  }
}

function daRenderLineRanking(dailyData, topN, timeFilter) {
  const container = document.getElementById('lineRankingContainer');
  const wrapper = document.getElementById('lineRankingScrollWrapper');
  container.innerHTML = '';

  // Aplicar filtro de tiempo
  let filteredData = dailyData;
  if (timeFilter === 'week') {
    filteredData = daGroupByWeek(dailyData);
  }

  const dates = [...new Set(filteredData.map(d => d.date))].sort();
  if (dates.length === 0) {
    container.innerHTML = '<p class="note-text">No hay fechas para mostrar.</p>';
    return;
  }

  // Seleccionar top jugadores por puntuación final
  const lastDate = dates[dates.length - 1];
  const lastScores = filteredData
    .filter(d => d.date === lastDate)
    .sort((a, b) => b.score - a.score);
  const topPlayers = new Set(lastScores.slice(0, topN).map(d => d.player));
  const chartData = filteredData.filter(d => topPlayers.has(d.player));

  const isMobile = window.innerWidth <= 768;
  const isFitMode = LINE_RANKING_FIT_MODE;
  
  const margin = { 
    top: 30, 
    right: isMobile ? (isFitMode ? 50 : 80) : (isFitMode ? 90 : 150), 
    bottom: 60, 
    left: isMobile ? (isFitMode ? 45 : 55) : 60 
  };
  
  const minWidthPerDate = isMobile ? 70 : 100;
  const containerWidth = wrapper.clientWidth || 800;
  
  let width, svgWidth;
  
  if (isFitMode) {
    svgWidth = Math.max(containerWidth, 300);
    width = Math.max(svgWidth - margin.left - margin.right, 200);
  } else {
    const calculatedWidth = Math.max(dates.length * minWidthPerDate, containerWidth);
    svgWidth = calculatedWidth;
    width = svgWidth - margin.left - margin.right;
  }
  
  const height = isMobile ? 400 : 520;
  const innerHeight = height - margin.top - margin.bottom;

  container.style.width = isFitMode ? '100%' : svgWidth + 'px';
  container.style.height = height + 'px';
  container.style.minWidth = isFitMode ? '0' : svgWidth + 'px';

  const svg = d3.select('#lineRankingContainer')
    .append('svg')
    .attr('width', isFitMode ? '100%' : svgWidth)
    .attr('height', height)
    .attr('viewBox', `0 0 ${svgWidth} ${height}`)
    .attr('preserveAspectRatio', isFitMode ? 'xMidYMid meet' : 'xMinYMin meet')
    .style('display', 'block')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint().domain(dates).range([0, width]).padding(0.3);
  
  const maxScore = d3.max(chartData, d => d.score) || 1;
  const y = d3.scaleLinear().domain([0, maxScore * 1.05]).range([innerHeight, 0]);

  const playersList = [...new Set(chartData.map(d => d.player))];
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(playersList);
  
  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.score))
    .curve(d3.curveMonotoneX);
  
  const nested = d3.group(chartData, d => d.player);

  // Grid
  svg.append('g')
    .attr('class', 'grid-y')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
    .attr('stroke', '#f0f0f0')
    .attr('stroke-dasharray', '3,3');
  svg.select('.grid-y').select('.domain').remove();

  // Líneas
  const lines = svg.selectAll('.line-ranking-line').data(Array.from(nested)).enter().append('path')
    .attr('class', 'line-ranking-line')
    .attr('d', ([, values]) => line(values))
    .attr('fill', 'none')
    .attr('stroke', ([player]) => color(player))
    .attr('stroke-width', isMobile ? 2.5 : 3)
    .attr('stroke-opacity', 0.85)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .attr('data-player', ([player]) => player);

  // Área bajo la línea (subtle)
  const area = d3.area()
    .x(d => x(d.date))
    .y0(innerHeight)
    .y1(d => y(d.score))
    .curve(d3.curveMonotoneX);

  svg.selectAll('.line-ranking-area').data(Array.from(nested)).enter().append('path')
    .attr('class', 'line-ranking-area')
    .attr('d', ([, values]) => area(values))
    .attr('fill', ([player]) => color(player))
    .attr('fill-opacity', 0.08)
    .attr('stroke', 'none');

  // Puntos
  const points = svg.selectAll('.line-ranking-point').data(chartData).enter().append('circle')
    .attr('class', 'line-ranking-point')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.score))
    .attr('r', isMobile ? 4 : 5)
    .attr('fill', d => color(d.player))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('data-player', d => d.player);

  // Eje X
  const xAxis = svg.append('g').attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const date = new Date(d + 'T00:00:00');
      if (timeFilter === 'week') {
        return isMobile 
          ? date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' })
          : 'Sem. ' + date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
      }
      return isMobile 
        ? date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric' })
        : date.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' });
    }));
  
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-35)')
    .style('font-size', isMobile ? '9px' : '11px')
    .style('fill', '#666');
  xAxis.select('.domain').attr('stroke', '#ddd');

  // Eje Y
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' pts'));
  yAxis.selectAll('text')
    .style('font-size', isMobile ? '10px' : '11px')
    .style('fill', '#666');
  yAxis.select('.domain').attr('stroke', '#ddd');

  // Tooltip
  const tooltip = d3.select('body').append('div').attr('class', 'line-ranking-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26,26,46,0.95)')
    .style('color', '#fff')
    .style('padding', '10px 14px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  function showTooltip(event, pointData) {
    const [py, pm, pd] = pointData.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(py, pm - 1, pd));
    const label = timeFilter === 'week' ? 'Semana del ' : '';
    tooltip.transition().duration(150).style('opacity', 1);
    tooltip.html(`
      <div style="font-weight:700;margin-bottom:4px;">${pointData.player}</div>
      <div style="color:#aaa;font-size:12px;">${label}${dateObj.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'long' })}</div>
      <div style="margin-top:6px;font-size:18px;font-weight:700;color:#7FD8FF;">${pointData.score} pts</div>
    `);
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }

  function highlightPlayer(playerName) {
    svg.selectAll('.line-ranking-line').attr('stroke-opacity', 0.12);
    svg.selectAll('.line-ranking-line').filter(([p]) => p === playerName)
      .attr('stroke-opacity', 1).attr('stroke-width', isMobile ? 4 : 5);
    
    svg.selectAll('.line-ranking-area').attr('fill-opacity', 0.02);
    svg.selectAll('.line-ranking-area').filter(([p]) => p === playerName)
      .attr('fill-opacity', 0.15);
    
    svg.selectAll('.line-ranking-point').attr('r', isMobile ? 4 : 5).attr('stroke-width', 2);
    svg.selectAll('.line-ranking-point').filter(d => d.player === playerName)
      .attr('r', isMobile ? 6 : 8).attr('stroke-width', 3);
  }

  function resetHighlight() {
    svg.selectAll('.line-ranking-line').attr('stroke-opacity', 0.85).attr('stroke-width', isMobile ? 2.5 : 3);
    svg.selectAll('.line-ranking-area').attr('fill-opacity', 0.08);
    svg.selectAll('.line-ranking-point').attr('r', isMobile ? 4 : 5).attr('stroke-width', 2);
    tooltip.transition().duration(200).style('opacity', 0);
  }

  points.on('mouseover', function(event, d) {
    highlightPlayer(d.player);
    showTooltip(event, d);
  }).on('mousemove', function(event) {
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }).on('mouseout', resetHighlight);

  // Labels del último día
  const lastPoints = chartData.filter(d => d.date === lastDate);
  
  const labels = svg.selectAll('.line-ranking-label').data(lastPoints).enter().append('text')
    .attr('class', 'line-ranking-label')
    .attr('x', width + (isMobile ? 5 : 10))
    .attr('y', d => y(d.score))
    .attr('dy', '0.35em')
    .text(d => isMobile ? d.player.substring(0, 8) : `${d.player} (${d.score})`)
    .attr('fill', d => color(d.player))
    .attr('font-size', isMobile ? '10px' : '12px')
    .attr('font-weight', '600')
    .style('cursor', 'pointer')
    .style('pointer-events', 'all');

  labels.on('mouseenter', function(event, d) {
    highlightPlayer(d.player);
    showTooltip(event, d);
  }).on('mousemove', function(event) {
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  }).on('mouseleave', resetHighlight);

  // Título eje Y
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left + 12)
    .attr('x', 0 - (innerHeight / 2))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#888')
    .text('Puntuación');
}

function daInitLineRanking() {
  const container = document.getElementById('lineRankingContainer');
  if (!container) {
    console.error('[LineRanking] No existe #lineRankingContainer');
    return;
  }

  // Reutilizar datos del bump chart si existen
  if (window.__bumpChartData && window.__bumpChartData.length > 0) {
    window.__lineRankingData = window.__bumpChartData;
    container.innerHTML = '<p class="note-text">Renderizando gráfico...</p>';
    const topN = parseInt(document.getElementById('lineRankingTopN')?.value || '10', 10);
    const timeFilter = document.getElementById('lineRankingTimeFilter')?.value || 'day';
    daRenderLineRanking(window.__lineRankingData, topN, timeFilter);
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];
    
    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    // Calcular datos (igual que bump chart pero guardamos en variable global)
    daProcessAndRenderLineRanking(players, finished);

  }).catch(err => {
    console.error('[LineRanking] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

function daProcessAndRenderLineRanking(players, finishedMatches) {
  const container = document.getElementById('lineRankingContainer');
  const TOTAL_GROUP_MATCHES = 72;

  const byCESTDate = {};
  finishedMatches.forEach(m => {
    const cest = daConvertToCEST(m.date, m.time);
    const cestDate = cest.date;
    if (!byCESTDate[cestDate]) byCESTDate[cestDate] = [];
    byCESTDate[cestDate].push({ ...m, _cestTimestamp: cest.timestamp });
  });

  const uniqueDates = Object.keys(byCESTDate).sort();
  
  const todayCEST = daGetTodayCEST();
  
  const hasTodayMatches = uniqueDates.includes(todayCEST);
  
  const dates = [...uniqueDates];
  if (!hasTodayMatches && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const lastDateObj = new Date(lastDate + 'T00:00:00');
    const todayObj = new Date(todayCEST + 'T00:00:00');
    
    if (todayObj > lastDateObj) {
      dates.push(todayCEST);
    }
  }

  const dailyScores = [];
  const matchesSoFar = [];
  let processed = 0;
  const total = dates.length * players.length;

  function processNextDate(dateIndex) {
    if (dateIndex >= dates.length) {
      window.__lineRankingData = dailyScores;
      const topN = parseInt(document.getElementById('lineRankingTopN')?.value || '10', 10);
      const timeFilter = document.getElementById('lineRankingTimeFilter')?.value || 'day';
      daRenderLineRanking(dailyScores, topN, timeFilter);
      return;
    }

    const date = dates[dateIndex];
    
    if (byCESTDate[date]) {
      const dayMatches = byCESTDate[date].sort((a, b) => a._cestTimestamp - b._cestTimestamp);
      matchesSoFar.push(...dayMatches);
    }
    
    const realPartial = daBuildPartialReal(matchesSoFar);
    const groupMatchesSoFar = matchesSoFar.filter(m => m.group && m.group.startsWith('Group ')).length;
    const faseGruposTerminada = groupMatchesSoFar >= TOTAL_GROUP_MATCHES;

    const dayScores = players.map(player => {
      processed++;
      const score = daCalculateScore(player, realPartial, faseGruposTerminada);
      return { name: player.name || 'Anónimo', score };
    });

    dayScores.sort((a, b) => b.score - a.score);

    dayScores.forEach((d, i) => {
      dailyScores.push({
        player: d.name,
        score: d.score,
        date,
        rank: i + 1,
        sharedRank: null
      });
    });

    let currentRank = 1;
    let previousScore = null;
    let playersAtRank = 0;
    
    dayScores.forEach((entry) => {
      const score = Number(entry.score) || 0;
      if (previousScore !== null && score !== previousScore) {
        currentRank += playersAtRank;
        playersAtRank = 0;
      }
      playersAtRank++;
      previousScore = score;
      
      const matchingEntry = dailyScores.find(d => d.player === entry.name && d.date === date);
      if (matchingEntry) {
        matchingEntry.sharedRank = currentRank;
      }
    });

    if (dateIndex % 2 === 0 || dateIndex === dates.length - 1) {
      const isToday = date === todayCEST;
      const hasData = !!byCESTDate[date];
      container.innerHTML = '<p class="note-text">Procesando puntuaciones: día ' + (dateIndex + 1) + '/' + dates.length + 
        ' (' + processed + '/' + total + ' cálculos)' + 
        (isToday ? (hasData ? ' — HOY' : ' — HOY (sin nuevos partidos)') : '') + '</p>';
    }

    setTimeout(() => processNextDate(dateIndex + 1), 10);
  }

  processNextDate(0);
}

/* -----------------------------------------------------------
   CONTROLES DEL LINE RANKING
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshLineRanking');
  const topSelect = document.getElementById('lineRankingTopN');
  const timeSelect = document.getElementById('lineRankingTimeFilter');
  const toggleBtn = document.getElementById('btnToggleFitLine');
  
  if (refreshBtn) refreshBtn.addEventListener('click', function() {
    if (window.__lineRankingData) {
      const topN = parseInt(topSelect?.value || '10', 10);
      const timeFilter = timeSelect?.value || 'day';
      daRenderLineRanking(window.__lineRankingData, topN, timeFilter);
    } else {
      daInitLineRanking();
    }
  });
  
  if (topSelect) topSelect.addEventListener('change', function() {
    if (window.__lineRankingData) {
      daRenderLineRanking(window.__lineRankingData, parseInt(topSelect.value, 10), timeSelect?.value || 'day');
    }
  });
  
  if (timeSelect) timeSelect.addEventListener('change', function() {
    if (window.__lineRankingData) {
      daRenderLineRanking(window.__lineRankingData, parseInt(topSelect?.value || '10', 10), timeSelect.value);
    }
  });
  
  if (toggleBtn) toggleBtn.addEventListener('click', daToggleFitLineRanking);
});

window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && window.__lineRankingData) {
    clearTimeout(window.__lineRankingResizeTimer);
    window.__lineRankingResizeTimer = setTimeout(function() {
      const topN = parseInt(document.getElementById('lineRankingTopN')?.value || '10', 10);
      const timeFilter = document.getElementById('lineRankingTimeFilter')?.value || 'day';
      daRenderLineRanking(window.__lineRankingData, topN, timeFilter);
    }, 300);
  }
});

/* -----------------------------------------------------------
   MÁXIMO PUNTOS POSIBLE POR DÍA (para % relativo al máximo)
   ----------------------------------------------------------- */
function daCalculateMaxDeltaForDay(newMatches, faseGruposTerminada, prevFaseGruposTerminada) {
  let maxDelta = 0;

  // 1. Resultados exactos (5) + 1X2 (1) = 6 pts por cada partido de grupos
  const groupMatches = newMatches.filter(m => m.group && m.group.startsWith('Group '));
  maxDelta += groupMatches.length * 6;

  // 2. Si la fase de grupos se completó este día: posiciones (12×4×5) + mejores terceros (8×1)
  if (faseGruposTerminada && !prevFaseGruposTerminada) {
    maxDelta += (12 * 4 * 5) + (8 * 1); // 240 + 8 = 248
  }

  // 3. Eliminatorias: cada partido resuelto otorga los puntos de la ronda alcanzada
  const roundPoints = {
    'Round of 32': 3,
    'Round of 16': 5,
    'Quarter-final': 10,
    'Semi-final': 20,
    'Match for third place': 20,
    'Final': 50
  };

  newMatches.forEach(m => {
    if (m.round && roundPoints[m.round]) {
      maxDelta += roundPoints[m.round];
    }
  });

  return maxDelta;
}

/* ============================================================
   DAILY POINTS — Puntos ganados por día/semana (barras verticales)
   ============================================================ */

let DAILY_POINTS_FIT_MODE = false;
let __dailyPointsData = null;
let __dailyPointsAllSelected = true; // Estado del botón "Todos/Ninguno"

const TOURNAMENT_END = '2026-07-19';

/**
 * Determina a qué semana del torneo pertenece una fecha CEST
 * Semana 1: 11-17 jun, Semana 2: 18-24 jun, etc. hasta el 19 julio
 */
function daGetTournamentWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(Date.UTC(2026, 5, 11)); // 11 de junio
  const diffMs = date - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}


/**
 * Calcula todas las semanas del torneo hasta la fecha final o hoy
 */
function daGetAllTournamentWeeks() {
  const start = new Date(Date.UTC(2026, 5, 11));
  const end = new Date(Date.UTC(2026, 6, 19)); // 19 de julio
  const today = new Date();
  const limit = today < end ? today : end;

  const weeks = [];
  let current = new Date(start);
  let weekNum = 1;

  while (current <= limit) {
    weeks.push(weekNum);
    current.setUTCDate(current.getUTCDate() + 7);
    weekNum++;
  }

  return weeks;
}


/**
 * Calcula los puntos ganados CADA DÍA (delta) para cada jugador.
 */
function daCalculateDailyPoints(players, finishedMatches) {
  const TOTAL_GROUP_MATCHES = 72;

  const byCESTDate = {};
  finishedMatches.forEach(m => {
    const cest = daConvertToCEST(m.date, m.time);
    if (!byCESTDate[cest.date]) byCESTDate[cest.date] = [];
    byCESTDate[cest.date].push(m);
  });

  const dates = Object.keys(byCESTDate).sort();
  const todayCEST = daGetTodayCEST();

  if (!byCESTDate[todayCEST] && dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    if (new Date(lastDate + 'T00:00:00') > new Date(todayCEST + 'T00:00:00')) {
      dates.push(todayCEST);
    }
  }

  const cumulativeScores = {};
  players.forEach(p => { cumulativeScores[p.name] = {}; });

  const matchesSoFar = [];
  let prevMatchesCount = 0;
  let prevFaseGruposTerminada = false;
  const byDay = {};

  dates.forEach((date, idx) => {
    if (byCESTDate[date]) {
      matchesSoFar.push(...byCESTDate[date]);
    }

    const realPartial = daBuildPartialReal(matchesSoFar);
    const groupMatchesSoFar = matchesSoFar.filter(m => m.group && m.group.startsWith('Group ')).length;
    const faseGruposTerminada = groupMatchesSoFar >= TOTAL_GROUP_MATCHES;

    const dayData = [];

    players.forEach(player => {
      const score = daCalculateScore(player, realPartial, faseGruposTerminada);
      const prevScore = idx > 0 ? cumulativeScores[player.name][dates[idx - 1]] : 0;
      const delta = score - prevScore;

      cumulativeScores[player.name][date] = score;

      dayData.push({
        player: player.name,
        points: delta,
        totalScore: score,
        date: date,
        week: daGetTournamentWeek(date)
      });
    });

    // Calcular máximo teórico posible del día
    const newMatches = matchesSoFar.slice(prevMatchesCount);
    const maxDelta = daCalculateMaxDeltaForDay(newMatches, faseGruposTerminada, prevFaseGruposTerminada);

    byDay[date] = dayData;
    byDay[date].forEach(d => {
      d.pct = maxDelta > 0 ? Math.round((d.points / maxDelta) * 100) : 0;
      d.maxDelta = maxDelta;
    });

    prevMatchesCount = matchesSoFar.length;
    prevFaseGruposTerminada = faseGruposTerminada;
  });

  // Semanas dinámicas hasta la fecha final del torneo
  const allWeeks = daGetAllTournamentWeeks();
  const usedWeeks = [...new Set(dates.map(daGetTournamentWeek))].sort((a, b) => a - b);
  const weeks = allWeeks.filter(w => w <= Math.max(...usedWeeks, ...allWeeks));

  return {
    byDay,
    players: players.map(p => p.name),
    dates,
    weeks
  };
}


function daGroupDailyByWeek(data) {
  const { byDay, players, dates, weeks } = data;
  const byWeek = {};

  weeks.forEach(w => {
    byWeek[w] = {};
    players.forEach(p => {
      byWeek[w][p] = {
        player: p,
        points: 0,
        totalScore: 0,
        date: `Semana ${w}`,
        week: w,
        maxDelta: 0
      };
    });
  });

  dates.forEach(date => {
    const week = daGetTournamentWeek(date);
    if (!byWeek[week]) return;

    byDay[date].forEach(d => {
      byWeek[week][d.player].points += d.points;
      byWeek[week][d.player].totalScore = d.totalScore;
      byWeek[week][d.player].maxDelta += (d.maxDelta || 0);
    });
  });

  weeks.forEach(w => {
    const weekData = Object.values(byWeek[w]);
    weekData.forEach(d => {
      d.pct = d.maxDelta > 0 ? Math.round((d.points / d.maxDelta) * 100) : 0;
    });
  });

  const newByDay = {};
  weeks.forEach(w => {
    newByDay[`Semana ${w}`] = Object.values(byWeek[w]);
  });

  return {
    byDay: newByDay,
    players,
    dates: weeks.map(w => `Semana ${w}`),
    weeks
  };
}


function daToggleFitDailyPoints() {
  DAILY_POINTS_FIT_MODE = !DAILY_POINTS_FIT_MODE;
  const wrapper = document.getElementById('dailyPointsScrollWrapper');
  const btn = document.getElementById('btnToggleFitDaily');
  
  if (DAILY_POINTS_FIT_MODE) {
    wrapper.classList.add('fit-mode');
    btn.textContent = '🔍 Zoom normal';
    btn.style.background = '#1a1a2e';
  } else {
    wrapper.classList.remove('fit-mode');
    btn.textContent = '↔️ Ajustar al ancho';
    btn.style.background = '#6c757d';
  }
  
  daRefreshDailyPoints();
}

/* ===== DROPDOWN MULTISELECT DE JUGADORES ===== */

function daTogglePlayersDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('dailyPointsPlayersDropdown');
  const toggle = document.getElementById('btnDailyPointsPlayersToggle');
  const menu = document.getElementById('dailyPointsPlayersMenu');
  
  const isOpen = menu.classList.contains('open');
  
  // Cerrar todos los dropdowns primero
  document.querySelectorAll('.dp-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dp-dropdown-toggle.active').forEach(t => t.classList.remove('active'));
  
  if (!isOpen) {
    menu.classList.add('open');
    toggle.classList.add('active');
  }
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', function(e) {
  // Daily Points dropdown
  const dropdown = document.getElementById('dailyPointsPlayersDropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    const menu = document.getElementById('dailyPointsPlayersMenu');
    const toggle = document.getElementById('btnDailyPointsPlayersToggle');
    if (menu) menu.classList.remove('open');
    if (toggle) toggle.classList.remove('active');
  }

  // Category Chart players dropdown
  const catDropdown = document.getElementById('categoryChartPlayersDropdown');
  const catToggleBtn = document.getElementById('btnCategoryChartPlayersToggle');
  if (catDropdown && !catDropdown.contains(e.target) && 
      e.target !== catToggleBtn && !catToggleBtn.contains(e.target)) {
    const menu = document.getElementById('categoryChartPlayersMenu');
    const toggle = document.getElementById('btnCategoryChartPlayersToggle');
    if (menu) menu.classList.remove('open');
    if (toggle) toggle.classList.remove('active');
  }
  
  // Category Chart categories dropdown
  const catCatDropdown = document.getElementById('categoryChartCategoriesDropdown');
  const catCatToggleBtn = document.getElementById('btnCategoryChartCategoriesToggle');
  if (catCatDropdown && !catCatDropdown.contains(e.target) && 
      e.target !== catCatToggleBtn && !catCatToggleBtn.contains(e.target)) {
    const menu = document.getElementById('categoryChartCategoriesMenu');
    const toggle = document.getElementById('btnCategoryChartCategoriesToggle');
    if (menu) menu.classList.remove('open');
    if (toggle) toggle.classList.remove('active');
  }

  // Radar Chart players dropdown
  const radarDropdown = document.getElementById('radarChartPlayersDropdown');
  const radarToggleBtn = document.getElementById('btnRadarChartPlayersToggle');
  if (radarDropdown && !radarDropdown.contains(e.target) && 
      e.target !== radarToggleBtn && !radarToggleBtn.contains(e.target)) {
    const menu = document.getElementById('radarChartPlayersMenu');
    const toggle = document.getElementById('btnRadarChartPlayersToggle');
    if (menu) menu.classList.remove('open');
    if (toggle) toggle.classList.remove('active');
  }
});

function daUpdateToggleText() {
  const checkboxes = document.querySelectorAll('#dailyPointsPlayersContainer input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);
  const text = document.getElementById('dpPlayersToggleText');
  
  if (!text) return;
  
  if (checked.length === 0) {
    text.textContent = 'Ninguno seleccionado';
  } else if (checked.length === checkboxes.length) {
    text.textContent = 'Todos seleccionados';
  } else if (checked.length === 1) {
    text.textContent = checked[0].dataset.player;
  } else {
    text.textContent = `${checked.length} seleccionados`;
  }
}

function daRenderPlayerCheckboxes() {
  const container = document.getElementById('dailyPointsPlayersContainer');
  if (!container || !__dailyPointsData) return;

  container.innerHTML = '';
  const players = __dailyPointsData.players;

  players.forEach((p, index) => {
    const id = 'dp-player-' + index;

    const label = document.createElement('label');
    label.className = 'dp-dropdown-item';
    label.htmlFor = id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = true;
    cb.dataset.player = p;
    cb.addEventListener('change', function() {
      daUpdateSelectAllCheckbox();
      daUpdateToggleText();
      daRefreshDailyPoints();
    });

    const span = document.createElement('span');
    span.textContent = p;

    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });

  daUpdateSelectAllCheckbox();
  daUpdateToggleText();
}

function daUpdateSelectAllCheckbox() {
  const selectAllCb = document.getElementById('dpSelectAllCheckbox');
  const checkboxes = document.querySelectorAll('#dailyPointsPlayersContainer input[type="checkbox"]');
  if (!selectAllCb || checkboxes.length === 0) return;
  
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);
  
  selectAllCb.checked = allChecked;
  selectAllCb.indeterminate = !allChecked && !noneChecked;
}

function daToggleSelectAllPlayers() {
  const selectAllCb = document.getElementById('dpSelectAllCheckbox');
  const checkboxes = document.querySelectorAll('#dailyPointsPlayersContainer input[type="checkbox"]');
  
  const shouldCheck = selectAllCb.checked;
  
  checkboxes.forEach(cb => {
    cb.checked = shouldCheck;
  });
  
  daUpdateToggleText();
  daRefreshDailyPoints();
}

function daGetSelectedPlayersFromCheckboxes() {
  const checkboxes = document.querySelectorAll('#dailyPointsPlayersContainer input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.dataset.player);
  return selected.length > 0 ? selected : (__dailyPointsData ? __dailyPointsData.players : []);
}

function daGetSelectedPlayersFromCheckboxes() {
  const checkboxes = document.querySelectorAll('#dailyPointsPlayersContainer input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.dataset.player);
  return selected.length > 0 ? selected : (__dailyPointsData ? __dailyPointsData.players : []);
}

/* ===== SELECTORES ===== */

function daPopulateDailyPointsControls() {
  if (!__dailyPointsData) return;
  
  const { dates, weeks } = __dailyPointsData;
  
  // Selector de día/semana
  const daySelect = document.getElementById('dailyPointsDay');
  const timeFilter = document.getElementById('dailyPointsTimeFilter')?.value || 'day';
  
  if (daySelect) {
    const currentVal = daySelect.value;
    daySelect.innerHTML = '';
    
    const items = timeFilter === 'week' 
      ? weeks.map(w => ({ value: `Semana ${w}`, label: `Semana ${w}` }))
      : dates.map(d => {
          const dateObj = new Date(d + 'T00:00:00');
          return { 
            value: d, 
            label: dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) 
          };
        });
    
    items.forEach((item, i) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      if (i === items.length - 1) opt.selected = true;
      daySelect.appendChild(opt);
    });
    
    if (currentVal && Array.from(daySelect.options).some(o => o.value === currentVal)) {
      daySelect.value = currentVal;
    }
  }
}

/* ===== REFRESH Y RENDER ===== */

function daRefreshDailyPoints() {
  if (!__dailyPointsData) {
    daInitDailyPoints();
    return;
  }
  
  const timeFilter = document.getElementById('dailyPointsTimeFilter')?.value || 'day';
  let data = __dailyPointsData;
  
  if (timeFilter === 'week') {
    data = daGroupDailyByWeek(__dailyPointsData);
  }
  
  daPopulateDailyPointsControls();
  
  const selectedPlayers = daGetSelectedPlayersFromCheckboxes();
  const selectedDay = document.getElementById('dailyPointsDay')?.value || data.dates[data.dates.length - 1];
  const scale = document.getElementById('dailyPointsScale')?.value || 'absolute';
  
  daRenderDailyPoints(data, selectedPlayers, selectedDay, scale);
}

function daRenderDailyPoints(data, selectedPlayers, selectedDay, scale) {
  const container = document.getElementById('dailyPointsContainer');
  const wrapper = document.getElementById('dailyPointsScrollWrapper');
  container.innerHTML = '';

  if (!data.byDay[selectedDay]) {
    container.innerHTML = '<p class="note-text">No hay datos para el período seleccionado.</p>';
    return;
  }

  let dayData = data.byDay[selectedDay]
    .filter(d => selectedPlayers.includes(d.player))
    .sort((a, b) => b.totalScore - a.totalScore);

  if (dayData.length === 0) {
    container.innerHTML = '<p class="note-text">Ningún jugador seleccionado tiene datos.</p>';
    return;
  }

  const isMobile = window.innerWidth <= 768;
  const isFitMode = DAILY_POINTS_FIT_MODE;
  
  const margin = { 
    top: 30, 
    right: isMobile ? 20 : 40, 
    bottom: isMobile ? 100 : 80, 
    left: isMobile ? (isFitMode ? 45 : 55) : 60 
  };
  
  const barWidth = isMobile ? 30 : 40;
  const minWidthPerPlayer = barWidth + (isMobile ? 8 : 12);
  const containerWidth = wrapper.clientWidth || 800;
  const calculatedWidth = Math.max(dayData.length * minWidthPerPlayer, containerWidth);
  
  let width, svgWidth;
  
  if (isFitMode) {
    svgWidth = Math.max(containerWidth, 300);
    width = Math.max(svgWidth - margin.left - margin.right, 200);
  } else {
    svgWidth = Math.max(calculatedWidth, containerWidth);
    width = svgWidth - margin.left - margin.right;
  }
  
  const height = isMobile ? 450 : 520;
  const innerHeight = height - margin.top - margin.bottom;

  container.style.width = isFitMode ? '100%' : svgWidth + 'px';
  container.style.height = height + 'px';
  container.style.minWidth = isFitMode ? '0' : svgWidth + 'px';

  const svg = d3.select('#dailyPointsContainer')
    .append('svg')
    .attr('width', isFitMode ? '100%' : svgWidth)
    .attr('height', height)
    .attr('viewBox', `0 0 ${svgWidth} ${height}`)
    .attr('preserveAspectRatio', isFitMode ? 'xMidYMid meet' : 'xMinYMin meet')
    .style('display', 'block')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(dayData.map(d => d.player))
    .range([0, width])
    .padding(0.2);

  const allDayData = data.byDay[selectedDay];
  const maxValue = scale === 'percent' 
    ? 100 
    : d3.max(allDayData, d => d.points) * 1.1;
  
  const y = d3.scaleLinear()
    .domain([0, maxValue || 1])
    .range([innerHeight, 0]);

  const allPlayers = __dailyPointsData ? __dailyPointsData.players : [];
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(allPlayers);

  svg.append('g')
    .attr('class', 'grid-y')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#f0f0f0')
    .attr('stroke-dasharray', '3,3');
  svg.select('.grid-y').select('.domain').remove();

  const bars = svg.selectAll('.daily-bar').data(dayData).enter().append('rect')
    .attr('class', 'daily-bar')
    .attr('x', d => x(d.player))
    .attr('y', innerHeight)
    .attr('width', x.bandwidth())
    .attr('height', 0)
    .attr('fill', d => color(d.player))
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('opacity', 0.85);

  bars.transition()
    .duration(600)
    .delay((d, i) => i * 30)
    .attr('y', d => y(scale === 'percent' ? d.pct : d.points))
    .attr('height', d => innerHeight - y(scale === 'percent' ? d.pct : d.points));

  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const name = d;
      return isMobile && name.length > 8 ? name.substring(0, 6) + '...' : name;
    }));
  
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.5em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)')
    .style('font-size', isMobile ? '9px' : '11px')
    .style('fill', '#444');
  xAxis.select('.domain').attr('stroke', '#ddd');

  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
      if (scale === 'percent') return d + '%';
      return d + ' pts';
    }));
  yAxis.selectAll('text')
    .style('font-size', isMobile ? '10px' : '11px')
    .style('fill', '#666');
  yAxis.select('.domain').attr('stroke', '#ddd');

  const tooltip = d3.select('body').append('div')
    .attr('class', 'daily-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26,26,46,0.95)')
    .style('color', '#fff')
    .style('padding', '12px 16px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  bars.on('mouseover', function(event, d) {
    d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 2);
    
    const isWeek = d.date.startsWith('Semana');
    const [py, pm, pd] = isWeek ? [0,0,0] : d.date.split('-').map(Number);
    const dateObj = isWeek ? null : new Date(Date.UTC(py, pm - 1, pd));
    tooltip.transition().duration(150).style('opacity', 1);
    tooltip.html(`
      <div style="font-weight:700;margin-bottom:6px;font-size:15px;">${d.player}</div>
      <div style="color:#aaa;font-size:12px;margin-bottom:8px;">${isWeek ? d.date : dateObj.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;gap:16px;">
          <span>Puntos ${isWeek ? 'esta semana' : 'este día'}:</span>
          <span style="font-weight:700;color:#7FD8FF;">${d.points} pts</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:16px;">
          <span>Total acumulado:</span>
          <span style="font-weight:700;">${d.totalScore} pts</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:16px;">
          <span>% del mejor:</span>
          <span style="font-weight:700;color:#FFD700;">${d.pct}%</span>
        </div>
      </div>
    `);
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  })
  .on('mousemove', function(event) {
    tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
  })
  .on('mouseout', function() {
    d3.select(this).attr('opacity', 0.85).attr('stroke', 'none');
    tooltip.transition().duration(200).style('opacity', 0);
  });

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left + 12)
    .attr('x', 0 - (innerHeight / 2))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#888')
    .text(scale === 'percent' ? 'Porcentaje (%)' : 'Puntos ganados');

  // Media sobre TODOS los jugadores
  const allValues = allDayData.map(d => scale === 'percent' ? d.pct : d.points);
  const avgValue = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  
  if (avgValue > 0) {
    svg.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(avgValue))
      .attr('y2', y(avgValue))
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('opacity', 0.6);
    
    svg.append('text')
      .attr('x', width)
      .attr('y', y(avgValue) - 5)
      .attr('text-anchor', 'end')
      .style('font-size', '10px')
      .style('fill', '#ff6b6b')
      .style('opacity', 0.7)
      .text('Media: ' + (scale === 'percent' ? Math.round(avgValue) + '%' : avgValue.toFixed(1) + ' pts'));
  }
}

function daInitDailyPoints() {
  const container = document.getElementById('dailyPointsContainer');
  if (!container) {
    console.error('[DailyPoints] No existe #dailyPointsContainer');
    return;
  }

  if (__dailyPointsData) {
    daRenderPlayerCheckboxes();
    daPopulateDailyPointsControls();
    daRefreshDailyPoints();
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];
    
    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    __dailyPointsData = daCalculateDailyPoints(players, finished);
    daRenderPlayerCheckboxes();
    daPopulateDailyPointsControls();
    daRefreshDailyPoints();

  }).catch(err => {
    console.error('[DailyPoints] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

/* -----------------------------------------------------------
   CONTROLES DEL DAILY POINTS
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshDailyPoints');
  const daySelect = document.getElementById('dailyPointsDay');
  const timeSelect = document.getElementById('dailyPointsTimeFilter');
  const scaleSelect = document.getElementById('dailyPointsScale');
  const toggleBtn = document.getElementById('btnToggleFitDaily');
  
  if (refreshBtn) refreshBtn.addEventListener('click', daRefreshDailyPoints);
  if (daySelect) daySelect.addEventListener('change', daRefreshDailyPoints);
  if (timeSelect) timeSelect.addEventListener('change', function() {
    daPopulateDailyPointsControls();
    daRefreshDailyPoints();
  });
  if (scaleSelect) scaleSelect.addEventListener('change', daRefreshDailyPoints);
  if (toggleBtn) toggleBtn.addEventListener('click', daToggleFitDailyPoints);
});

/* ============================================================
   CATEGORY CHART — Puntos por tipo de puntuación (barras horizontales apiladas)
   ============================================================ */

let CATEGORY_CHART_FIT_MODE = false;
let __categoryChartData = null;
let __categoryChartPlayers = [];

const CATEGORY_CONFIG = {
  exactResults: { label: 'Resultados exactos', max: 360, color: '#4CAF50' },
  oneXTwo: { label: '1X2', max: 72, color: '#2196F3' },
  groupPositions: { label: 'Posiciones grupos', max: 240, color: '#FF9800' },
  bestThirds: { label: 'Mejores terceros', max: 8, color: '#9C27B0' },
  knockoutRounds: { label: 'Fase final (hasta semis)', max: 356, color: '#F44336' },
  finalPositions: { label: 'Campeón, finalista, 3º, 4º', max: 150, color: '#FFD700' }
};

const CATEGORY_ORDER = ['exactResults', 'oneXTwo', 'groupPositions', 'bestThirds', 'knockoutRounds', 'finalPositions'];

/**
 * Calcula los puntos por categoría para cada jugador
 */
function daCalculateCategoryScores(players, finishedMatches) {
  const TOTAL_GROUP_MATCHES = 72;

  // Construir el estado real completo con TODOS los partidos
  const real = daBuildPartialReal(finishedMatches);
  const groupMatchesCount = finishedMatches.filter(m => m.group && m.group.startsWith('Group ')).length;
  const faseGruposTerminada = groupMatchesCount >= TOTAL_GROUP_MATCHES;

  return players.map(player => {
    const cats = daCalculateScoreByCategory(player, real, faseGruposTerminada);
    cats.player = player.name;
    cats.totalScore = cats.exactResults + cats.oneXTwo + cats.groupPositions + cats.bestThirds + cats.knockoutRounds + cats.finalPositions;
    return cats;
  });
}

/**
 * Calcula la puntuación desglosada por categoría para un jugador.
 * Cada categoría es independiente y suma solo los puntos de esa categoría.
 */
function daCalculateScoreByCategory(player, real, faseGruposTerminada) {
  const cats = {
    exactResults: 0,
    oneXTwo: 0,
    groupPositions: 0,
    bestThirds: 0,
    knockoutRounds: 0,
    finalPositions: 0
  };

  const roundPoints = {
    round32: 3, round16: 5, quarterfinals: 10, semifinals: 20,
    finalist: 30, champion: 50, thirdPlace: 20, fourthPlace: 20
  };

  // 1. Resultados exactos y 1X2
  const predResults = player.groupMatchResults || {};
  const realResults = real.groupMatchResults || {};

  Object.keys(realResults).forEach(key => {
    const pred = predResults[key];
    const realResult = realResults[key];
    if (!pred || pred.team1Goals === '' || pred.team2Goals === '') return;

    const pG1 = Number(pred.team1Goals);
    const pG2 = Number(pred.team2Goals);
    const rG1 = Number(realResult.team1Goals);
    const rG2 = Number(realResult.team2Goals);

    if (isNaN(pG1) || isNaN(pG2) || isNaN(rG1) || isNaN(rG2)) return;

    if (pG1 === rG1 && pG2 === rG2) {
      cats.exactResults += 5;
    }

    const p1x2 = pG1 > pG2 ? '1' : pG1 < pG2 ? '2' : 'X';
    const r1x2 = rG1 > rG2 ? '1' : rG2 > rG1 ? '2' : 'X';
    if (p1x2 === r1x2) {
      cats.oneXTwo += 1;
    }
  });

  // 2. Posiciones de grupos (solo si fase de grupos terminada)
  if (faseGruposTerminada) {
    const groupNames = Object.keys(real.groups || {});
    groupNames.forEach(group => {
      const realOrder = real.groups[group] || [];
      const predOrder = player.groups?.[group] || [];
      for (let i = 0; i < 4; i++) {
        if (predOrder[i] && realOrder[i] && predOrder[i] === realOrder[i]) {
          cats.groupPositions += 5;
        }
      }
    });
  }

  // 3. Mejores terceros (solo si fase de grupos terminada)
  if (faseGruposTerminada) {
    const realTP = new Set((real.thirdPlace || []).slice(0, 8));
    const predTP = (player.thirdPlace || []).slice(0, 8);
    predTP.forEach(team => {
      if (realTP.has(team)) cats.bestThirds += 1;
    });
  }

  // 4. Eliminatorias — ronda alcanzada incrementalmente
  const allTeams = new Set();
  
  Object.keys(player.groups || {}).forEach(g => {
    const order = player.groups[g] || [];
    for (let i = 0; i < order.length; i++) {
      if (order[i]) allTeams.add(order[i]);
    }
  });
  Object.keys(real.groups || {}).forEach(g => {
    const order = real.groups[g] || [];
    for (let i = 0; i < order.length; i++) {
      if (order[i]) allTeams.add(order[i]);
    }
  });
  (player.thirdPlace || []).forEach(t => { if (t) allTeams.add(t); });
  (real.thirdPlace || []).forEach(t => { if (t) allTeams.add(t); });

  allTeams.forEach(team => {
    const predRound = daGetTeamRoundReached(team, player, true);
    const realRound = daGetTeamRoundReached(team, real, faseGruposTerminada);
    if (predRound && realRound && predRound === realRound) {
      const pts = roundPoints[predRound] || 0;
      if (['round32', 'round16', 'quarterfinals', 'semifinals'].includes(predRound)) {
        cats.knockoutRounds += pts;
      } else if (['champion', 'finalist', 'thirdPlace', 'fourthPlace'].includes(predRound)) {
        cats.finalPositions += pts;
      }
    }
  });

  return cats;
}


window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && __dailyPointsData) {
    clearTimeout(window.__dailyPointsResizeTimer);
    window.__dailyPointsResizeTimer = setTimeout(function() {
      daRefreshDailyPoints();
    }, 300);
  }
});

/* -----------------------------------------------------------
   TOGGLE FIT MODE — CATEGORY CHART
   ----------------------------------------------------------- */
function daToggleFitCategory() {
  CATEGORY_CHART_FIT_MODE = !CATEGORY_CHART_FIT_MODE;
  const wrapper = document.getElementById('categoryChartScrollWrapper');
  const btn = document.getElementById('btnToggleFitCategory');

  if (CATEGORY_CHART_FIT_MODE) {
    wrapper.classList.add('fit-mode');
    btn.textContent = '🔍 Zoom normal';
    btn.style.background = '#1a1a2e';
  } else {
    wrapper.classList.remove('fit-mode');
    btn.textContent = '↔️ Ajustar al ancho';
    btn.style.background = '#6c757d';
  }

  daRefreshCategoryChart();
}

/* -----------------------------------------------------------
   RENDERIZADO DEL CATEGORY CHART (barras horizontales apiladas)
   ----------------------------------------------------------- */
function daRenderCategoryChart(data, selectedPlayers, selectedCategories, scale) {
  const container = document.getElementById('categoryChartContainer');
  const wrapper = document.getElementById('categoryChartScrollWrapper');
  container.innerHTML = '';

  let chartData = data.filter(d => selectedPlayers.includes(d.player));

  // Ordenar por puntuación total descendente
  chartData.sort((a, b) => b.totalScore - a.totalScore);

  if (chartData.length === 0) {
    container.innerHTML = '<p class="note-text">Ningún jugador seleccionado tiene datos.</p>';
    return;
  }

  const isMobile = window.innerWidth <= 768;
  const isFitMode = CATEGORY_CHART_FIT_MODE;

  const margin = { 
    top: 30, 
    right: isMobile ? 20 : 60, 
    bottom: 40, 
    left: isMobile ? (isFitMode ? 100 : 120) : 150 
  };

  const barHeight = isMobile ? 24 : 32;
  const barGap = isMobile ? 4 : 6;
  const containerWidth = wrapper.clientWidth || 800;
  const calculatedHeight = Math.max(chartData.length * (barHeight + barGap) + margin.top + margin.bottom, 400);

  let width, svgWidth;

  if (isFitMode) {
    svgWidth = Math.max(containerWidth, 300);
    width = Math.max(svgWidth - margin.left - margin.right, 200);
  } else {
    svgWidth = Math.max(containerWidth, 600);
    width = svgWidth - margin.left - margin.right;
  }

  const height = calculatedHeight;
  const innerHeight = height - margin.top - margin.bottom;

  container.style.width = isFitMode ? '100%' : svgWidth + 'px';
  container.style.height = height + 'px';
  container.style.minWidth = isFitMode ? '0' : svgWidth + 'px';

  const svg = d3.select('#categoryChartContainer')
    .append('svg')
    .attr('width', isFitMode ? '100%' : svgWidth)
    .attr('height', height)
    .attr('viewBox', `0 0 ${svgWidth} ${height}`)
    .attr('preserveAspectRatio', isFitMode ? 'xMidYMid meet' : 'xMinYMin meet')
    .style('display', 'block')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Categorías activas
  const activeCategories = selectedCategories.length > 0 ? selectedCategories : CATEGORY_ORDER;

  // Preparar datos: en modo %, cada categoría es su propio % sobre su máximo
  const stackData = chartData.map(d => {
    const obj = { player: d.player, totalScore: d.totalScore };
    let cumulative = 0;
    activeCategories.forEach(cat => {
      const config = CATEGORY_CONFIG[cat];
      const val = d[cat] || 0;
      // En modo %, el valor es el % sobre el máximo de esa categoría
      const displayVal = scale === 'percent' 
        ? (config.max > 0 ? (val / config.max) * 100 : 0)
        : val;
      obj[cat] = displayVal;
      obj[cat + '_raw'] = val; // Guardar valor raw para tooltip
      obj[cat + '_start'] = cumulative;
      cumulative += displayVal;
    });
    obj.cumulative = cumulative;
    return obj;
  });

  // Dominio del eje X: suma de todos los % o puntos
  const maxTotal = d3.max(stackData, d => d.cumulative) * 1.05;

  const x = d3.scaleLinear()
    .domain([0, maxTotal || 1])
    .range([0, width]);

  const y = d3.scaleBand()
    .domain(stackData.map(d => d.player))
    .range([0, innerHeight])
    .padding(0.15);

  // Grid vertical
  svg.append('g')
    .attr('class', 'grid-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line')
    .attr('stroke', '#f0f0f0')
    .attr('stroke-dasharray', '3,3');
  svg.select('.grid-x').select('.domain').remove();

  // Barras apiladas - cada categoría apilada una tras otra
  activeCategories.forEach(cat => {
    const config = CATEGORY_CONFIG[cat];

    svg.selectAll('.cat-bar-' + cat)
      .data(stackData)
      .enter()
      .append('rect')
      .attr('class', 'cat-bar cat-bar-' + cat)
      .attr('y', d => y(d.player))
      .attr('x', d => x(d[cat + '_start']))
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', config.color)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('opacity', 0.9)
      .transition()
      .duration(600)
      .delay((d, i) => i * 50)
      .attr('width', d => x(d[cat]));
  });

  // Eje Y (jugadores)
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).tickFormat(d => {
      const name = d;
      return isMobile && name.length > 10 ? name.substring(0, 8) + '...' : name;
    }));

  yAxis.selectAll('text')
    .style('font-size', isMobile ? '10px' : '12px')
    .style('fill', '#444')
    .style('font-weight', '500');
  yAxis.select('.domain').attr('stroke', '#ddd');

  // Eje X
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => {
      if (scale === 'percent') return d + '%';
      return d + ' pts';
    }));

  xAxis.selectAll('text')
    .style('font-size', isMobile ? '10px' : '11px')
    .style('fill', '#666');
  xAxis.select('.domain').attr('stroke', '#ddd');

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'category-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26,26,46,0.95)')
    .style('color', '#fff')
    .style('padding', '12px 16px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)')
    .style('max-width', '280px');

  // Overlay invisible para tooltip en cada barra completa
  svg.selectAll('.cat-bar-overlay')
    .data(stackData)
    .enter()
    .append('rect')
    .attr('class', 'cat-bar-overlay')
    .attr('y', d => y(d.player))
    .attr('x', 0)
    .attr('height', y.bandwidth())
    .attr('width', d => x(d.cumulative))
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      let html = `<div style="font-weight:700;margin-bottom:8px;font-size:15px;">${d.player}</div>`;
      html += `<div style="color:#aaa;font-size:12px;margin-bottom:10px;">Total: ${d.totalScore} pts</div>`;
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';

      activeCategories.forEach(cat => {
        const config = CATEGORY_CONFIG[cat];
        const rawVal = d[cat + '_raw'] || 0;
        const pct = config.max > 0 ? Math.round((rawVal / config.max) * 100) : 0;
        html += `<div style="display:flex;align-items:center;gap:8px;">`;
        html += `<span style="width:10px;height:10px;border-radius:2px;background:${config.color};display:inline-block;"></span>`;
        html += `<span style="flex:1;">${config.label}:</span>`;
        html += `<span style="font-weight:700;">${rawVal} pts</span>`;
        html += `<span style="color:#7FD8FF;font-size:11px;">(${pct}%)</span>`;
        html += `</div>`;
      });

      html += '</div>';

      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(html);
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
    })
    .on('mouseout', function() {
      tooltip.transition().duration(200).style('opacity', 0);
    });

  // Leyenda
  const legend = svg.append('g')
    .attr('transform', `translate(0, ${-margin.top + 5})`);

  let legendX = 0;
  activeCategories.forEach((cat, i) => {
    const config = CATEGORY_CONFIG[cat];

    legend.append('rect')
      .attr('x', legendX)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', config.color)
      .attr('rx', 2);

    legend.append('text')
      .attr('x', legendX + 16)
      .attr('y', 10)
      .style('font-size', '11px')
      .style('fill', '#666')
      .text(config.label);

    legendX += (config.label.length * 7) + 30;
  });

  // Título eje X
  svg.append('text')
    .attr('transform', `translate(${width / 2}, ${innerHeight + 35})`)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#888')
    .text(scale === 'percent' ? 'Suma de % sobre el máximo de cada categoría' : 'Puntos');
}
function daRefreshCategoryChart() {
  if (!__categoryChartData) {
    daInitCategoryChart();
    return;
  }

  const selectedPlayers = daGetSelectedCategoryPlayers();
  const selectedCategories = daGetSelectedCategories();
  const scale = document.getElementById('categoryChartScale')?.value || 'points';

  daRenderCategoryChart(__categoryChartData, selectedPlayers, selectedCategories, scale);
}

function daInitCategoryChart() {
  const container = document.getElementById('categoryChartContainer');
  if (!container) {
    console.error('[CategoryChart] No existe #categoryChartContainer');
    return;
  }

  if (__categoryChartData) {
    daRefreshCategoryChart();
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];

    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    __categoryChartData = daCalculateCategoryScores(players, finished);
    __categoryChartPlayers = players.map(p => p.name);
    daRenderCategoryCheckboxes();
    daRenderCategoryPlayerCheckboxes();
    daRefreshCategoryChart();

  }).catch(err => {
    console.error('[CategoryChart] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

/* ===== CHECKBOXES DE CATEGORÍAS ===== */
function daRenderCategoryCheckboxes() {
  const container = document.getElementById('categoryChartCategoriesContainer');
  if (!container) return;

  container.innerHTML = '';

  CATEGORY_ORDER.forEach(cat => {
    const config = CATEGORY_CONFIG[cat];
    const label = document.createElement('label');
    label.className = 'dp-dropdown-item';
    label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.category = cat;
    cb.addEventListener('change', daRefreshCategoryChart);

    const colorDot = document.createElement('span');
    colorDot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${config.color};display:inline-block;flex-shrink:0;`;

    const span = document.createElement('span');
    span.textContent = config.label + ' (max ' + config.max + ')';
    span.style.flex = '1';

    label.appendChild(cb);
    label.appendChild(colorDot);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function daToggleCategoriesDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('categoryChartCategoriesMenu');
  const toggle = document.getElementById('btnCategoryChartCategoriesToggle');

  const isOpen = menu.classList.contains('open');

  document.querySelectorAll('.dp-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dp-dropdown-toggle.active').forEach(t => t.classList.remove('active'));

  if (!isOpen) {
    menu.classList.add('open');
    toggle.classList.add('active');
  }
}

function daToggleSelectAllCategories() {
  const selectAllCb = document.getElementById('dpSelectAllCategoriesCheckbox');
  const checkboxes = document.querySelectorAll('#categoryChartCategoriesContainer input[type="checkbox"]');

  checkboxes.forEach(cb => {
    cb.checked = selectAllCb.checked;
  });

  daRefreshCategoryChart();
}

function daGetSelectedCategories() {
  const checkboxes = document.querySelectorAll('#categoryChartCategoriesContainer input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.dataset.category);
}

/* ===== DROPDOWN MULTISELECT DE JUGADORES PARA CATEGORY CHART ===== */

function daToggleCategoryPlayersDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('categoryChartPlayersMenu');
  const toggle = document.getElementById('btnCategoryChartPlayersToggle');

  const isOpen = menu.classList.contains('open');

  document.querySelectorAll('.dp-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dp-dropdown-toggle.active').forEach(t => t.classList.remove('active'));

  if (!isOpen) {
    menu.classList.add('open');
    toggle.classList.add('active');
  }
}

function daUpdateCategoryPlayersToggleText() {
  const checkboxes = document.querySelectorAll('#categoryChartPlayersContainer input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);
  const text = document.getElementById('dpCategoryPlayersToggleText');

  if (!text) return;

  if (checked.length === 0) {
    text.textContent = 'Ninguno seleccionado';
  } else if (checked.length === checkboxes.length) {
    text.textContent = 'Todos seleccionados';
  } else if (checked.length === 1) {
    text.textContent = checked[0].dataset.player;
  } else {
    text.textContent = `${checked.length} seleccionados`;
  }
}

function daRenderCategoryPlayerCheckboxes() {
  const container = document.getElementById('categoryChartPlayersContainer');
  if (!container) return;
  
  container.innerHTML = '';
  const players = __categoryChartPlayers.length > 0 ? __categoryChartPlayers : 
                  (__dailyPointsData ? __dailyPointsData.players : []);
  
  if (players.length === 0) return;

  players.forEach((p, index) => {
    const id = 'dp-cat-player-' + index;

    const label = document.createElement('label');
    label.className = 'dp-dropdown-item';
    label.htmlFor = id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = true;
    cb.dataset.player = p;
    cb.addEventListener('change', function() {
      daUpdateCategorySelectAllCheckbox();
      daUpdateCategoryPlayersToggleText();
      daRefreshCategoryChart();
    });

    const span = document.createElement('span');
    span.textContent = p;

    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });

  daUpdateCategorySelectAllCheckbox();
  daUpdateCategoryPlayersToggleText();
}

function daUpdateCategorySelectAllCheckbox() {
  const selectAllCb = document.getElementById('dpSelectAllCategoryCheckbox');
  const checkboxes = document.querySelectorAll('#categoryChartPlayersContainer input[type="checkbox"]');
  if (!selectAllCb || checkboxes.length === 0) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);

  selectAllCb.checked = allChecked;
  selectAllCb.indeterminate = !allChecked && !noneChecked;
}

function daToggleSelectAllCategoryPlayers() {
  const selectAllCb = document.getElementById('dpSelectAllCategoryCheckbox');
  const checkboxes = document.querySelectorAll('#categoryChartPlayersContainer input[type="checkbox"]');

  const shouldCheck = selectAllCb.checked;

  checkboxes.forEach(cb => {
    cb.checked = shouldCheck;
  });

  daUpdateCategoryPlayersToggleText();
  daRefreshCategoryChart();
}

function daGetSelectedCategoryPlayers() {
  const checkboxes = document.querySelectorAll('#categoryChartPlayersContainer input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.dataset.player);
  return selected.length > 0 ? selected : (__dailyPointsData ? __dailyPointsData.players : []);
}

/* -----------------------------------------------------------
   CONTROLES DEL CATEGORY CHART
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshCategoryChart');
  const scaleSelect = document.getElementById('categoryChartScale');
  const toggleBtn = document.getElementById('btnToggleFitCategory');
  const catToggleBtn = document.getElementById('btnCategoryChartCategoriesToggle');
  const selectAllCatCb = document.getElementById('dpSelectAllCategoriesCheckbox');
  const catPlayersToggleBtn = document.getElementById('btnCategoryChartPlayersToggle');
  const selectAllCatPlayersCb = document.getElementById('dpSelectAllCategoryCheckbox');

  if (refreshBtn) refreshBtn.addEventListener('click', daRefreshCategoryChart);
  if (scaleSelect) scaleSelect.addEventListener('change', daRefreshCategoryChart);
  if (toggleBtn) toggleBtn.addEventListener('click', daToggleFitCategory);
  if (catToggleBtn) catToggleBtn.addEventListener('click', daToggleCategoriesDropdown);
  if (selectAllCatCb) selectAllCatCb.addEventListener('change', daToggleSelectAllCategories);
  if (catPlayersToggleBtn) catPlayersToggleBtn.addEventListener('click', daToggleCategoryPlayersDropdown);
  if (selectAllCatPlayersCb) selectAllCatPlayersCb.addEventListener('change', daToggleSelectAllCategoryPlayers);
});

window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && __categoryChartData) {
    clearTimeout(window.__categoryChartResizeTimer);
    window.__categoryChartResizeTimer = setTimeout(function() {
      daRefreshCategoryChart();
    }, 300);
  }
});

/* ============================================================
   RADAR CHART — ZOOM + PAN/DRAG + TOOLTIPS (sin colisiones)
   ============================================================ */

let RADAR_CHART_FIT_MODE = true;
let RADAR_CHART_ZOOM = 100;
const RADAR_CHART_ZOOM_MIN = 50;
const RADAR_CHART_ZOOM_MAX = 500;
const RADAR_CHART_ZOOM_STEP = 50;
let __radarChartData = null;
let __radarChartPlayers = [];


// Paleta de colores para jugadores (compartida)
const RADAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#FF8C42', '#6C5CE7', '#00B894', '#E17055', '#74B9FF', '#A29BFE',
  '#FD79A8', '#FDCB6E', '#55A3FF', '#00CEC9'
];

// Estado del viewBox para pan
let RADAR_VIEWBOX = {
  x: 0, y: 0, width: 0, height: 0,
  baseWidth: 0, baseHeight: 0,
  isDragging: false, lastMouseX: 0, lastMouseY: 0
};

function daZoomRadarChart(delta) {
  RADAR_CHART_ZOOM = Math.max(RADAR_CHART_ZOOM_MIN, Math.min(RADAR_CHART_ZOOM_MAX, RADAR_CHART_ZOOM + delta));
  daRefreshRadarChart();
  const zoomText = document.getElementById('radarZoomText');
  if (zoomText) zoomText.textContent = RADAR_CHART_ZOOM + '%';
}

function daResetRadarZoom() {
  RADAR_CHART_ZOOM = 100;
  RADAR_VIEWBOX.x = 0;
  RADAR_VIEWBOX.y = 0;
  daRefreshRadarChart();
  const zoomText = document.getElementById('radarZoomText');
  if (zoomText) zoomText.textContent = '100%';
}

function daApplyPan(dx, dy) {
  const container = document.getElementById('radarChartContainer');
  const svg = container.querySelector('svg');
  if (!svg) return;

  const rect = svg.getBoundingClientRect();
  const scaleX = RADAR_VIEWBOX.width / rect.width;
  const scaleY = RADAR_VIEWBOX.height / rect.height;

  RADAR_VIEWBOX.x -= dx * scaleX;
  RADAR_VIEWBOX.y -= dy * scaleY;

  const maxX = Math.max(0, RADAR_VIEWBOX.baseWidth - RADAR_VIEWBOX.width);
  const maxY = Math.max(0, RADAR_VIEWBOX.baseHeight - RADAR_VIEWBOX.height);

  RADAR_VIEWBOX.x = Math.max(0, Math.min(maxX, RADAR_VIEWBOX.x));
  RADAR_VIEWBOX.y = Math.max(0, Math.min(maxY, RADAR_VIEWBOX.y));

  svg.setAttribute('viewBox',
    `${RADAR_VIEWBOX.x} ${RADAR_VIEWBOX.y} ${RADAR_VIEWBOX.width} ${RADAR_VIEWBOX.height}`);
}

function daToggleRadarPlayersDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('radarChartPlayersMenu');
  const toggle = document.getElementById('btnRadarChartPlayersToggle');

  const isOpen = menu.classList.contains('open');

  document.querySelectorAll('.dp-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.dp-dropdown-toggle.active').forEach(t => t.classList.remove('active'));

  if (!isOpen) {
    menu.classList.add('open');
    toggle.classList.add('active');
  }
}

function daUpdateRadarPlayersToggleText() {
  const checkboxes = document.querySelectorAll('#radarChartPlayersContainer input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);
  const text = document.getElementById('dpRadarPlayersToggleText');

  if (!text) return;

  if (checked.length === 0) {
    text.textContent = 'Ninguno seleccionado';
  } else if (checked.length === checkboxes.length) {
    text.textContent = 'Todos seleccionados (' + checked.length + ')';
  } else if (checked.length === 1) {
    text.textContent = checked[0].dataset.player;
  } else {
    text.textContent = checked.length + ' seleccionados';
  }
}

function daRenderRadarPlayerCheckboxes() {
  const container = document.getElementById('radarChartPlayersContainer');
  if (!container || !__radarChartData) return;

  container.innerHTML = '';
  const players = __radarChartPlayers.length > 0 ? __radarChartPlayers : 
                  (__dailyPointsData ? __dailyPointsData.players : []);

  if (players.length === 0) return;

  players.forEach((p, index) => {
    const color = RADAR_COLORS[index % RADAR_COLORS.length];
    const id = 'dp-radar-player-' + index;

    const label = document.createElement('label');
    label.className = 'dp-dropdown-item';
    label.htmlFor = id;
    label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.checked = true;
    cb.dataset.player = p;
    cb.addEventListener('change', function() {
      daUpdateRadarSelectAllCheckbox();
      daUpdateRadarPlayersToggleText();
      daRefreshRadarChart();
    });

    // Punto de color del jugador
    const colorDot = document.createElement('span');
    colorDot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;

    const span = document.createElement('span');
    span.textContent = p;
    span.style.flex = '1';

    label.appendChild(cb);
    label.appendChild(colorDot);
    label.appendChild(span);
    container.appendChild(label);
  });

  daUpdateRadarSelectAllCheckbox();
  daUpdateRadarPlayersToggleText();
}

function daUpdateRadarSelectAllCheckbox() {
  const selectAllCb = document.getElementById('dpSelectAllRadarCheckbox');
  const checkboxes = document.querySelectorAll('#radarChartPlayersContainer input[type="checkbox"]');
  if (!selectAllCb || checkboxes.length === 0) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);

  selectAllCb.checked = allChecked;
  selectAllCb.indeterminate = !allChecked && !noneChecked;
}

function daToggleSelectAllRadarPlayers() {
  const selectAllCb = document.getElementById('dpSelectAllRadarCheckbox');
  const checkboxes = document.querySelectorAll('#radarChartPlayersContainer input[type="checkbox"]');

  checkboxes.forEach(cb => {
    cb.checked = selectAllCb.checked;
  });

  daUpdateRadarPlayersToggleText();
  daRefreshRadarChart();
}

function daGetSelectedRadarPlayers() {
  const checkboxes = document.querySelectorAll('#radarChartPlayersContainer input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.dataset.player);
  return selected.length > 0 ? selected : 
    (__radarChartPlayers ? __radarChartPlayers : []);
}

function daRefreshRadarChart() {
  if (!__radarChartData) {
    daInitRadarChart();
    return;
  }

  const selectedPlayers = daGetSelectedRadarPlayers();
  const scale = document.getElementById('radarChartScale')?.value || 'percent';
  daRenderRadarChart(__radarChartData, selectedPlayers, scale);
}

function daRenderRadarChart(data, selectedPlayers, scale) {
  const container = document.getElementById('radarChartContainer');
  const wrapper = document.getElementById('radarChartScrollWrapper');
  container.innerHTML = '';

  let chartData = data.filter(d => selectedPlayers.includes(d.player));

  if (chartData.length === 0) {
    container.innerHTML = '<p class="note-text">Ningún jugador seleccionado tiene datos.</p>';
    return;
  }

  const isMobile = window.innerWidth <= 768;

  const margin = { top: isMobile ? 40 : 60, right: isMobile ? 60 : 100, bottom: isMobile ? 80 : 60, left: isMobile ? 60 : 100 };
  const containerWidth = wrapper.clientWidth || 600;

  const size = Math.min(containerWidth - margin.left - margin.right,
                        isMobile ? 500 : 520);

  const width = size;
  const height = size;
  const radius = Math.min(width, height) / 2 - (isMobile ? 10 : 20);
  const baseWidth = width + margin.left + margin.right;
  const baseHeight = height + margin.top + margin.bottom;

  // === ZOOM: viewBox más pequeño = zoom in ===
  const zoomFactor = 100 / RADAR_CHART_ZOOM;

  const viewBoxWidth = baseWidth * zoomFactor;
  const viewBoxHeight = baseHeight * zoomFactor;

  // Si es la primera vez o zoom cambió, centrar el viewBox
  if (RADAR_VIEWBOX.baseWidth !== baseWidth ||
      RADAR_VIEWBOX.baseHeight !== baseHeight ||
      RADAR_VIEWBOX.width !== viewBoxWidth ||
      RADAR_VIEWBOX.height !== viewBoxHeight) {

    const maxX = Math.max(0, baseWidth - viewBoxWidth);
    const maxY = Math.max(0, baseHeight - viewBoxHeight);

    RADAR_VIEWBOX = {
      x: maxX / 2,
      y: maxY / 2,
      width: viewBoxWidth,
      height: viewBoxHeight,
      baseWidth: baseWidth,
      baseHeight: baseHeight,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
  }

  container.style.width = '100%';
  container.style.height = baseHeight + 'px';
  container.style.minWidth = '0';
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.position = 'relative';  // necesario para el overlay absoluto

  const svg = d3.select('#radarChartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', baseHeight)
    .attr('viewBox', `${RADAR_VIEWBOX.x} ${RADAR_VIEWBOX.y} ${RADAR_VIEWBOX.width} ${RADAR_VIEWBOX.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block')
    .append('g')
    .attr('transform', `translate(${baseWidth / 2},${baseHeight / 2})`);

  
  const categories = [
    { key: 'exactResults', label: 'Resultados exactos', max: 360 },
    { key: 'oneXTwo', label: '1X2', max: 72 },
    { key: 'groupPositions', label: 'Posiciones grupos', max: 240 },
    { key: 'bestThirds', label: 'Mejores terceros', max: 8 },
    { key: 'knockoutRounds', label: 'Fase final (hasta semis)', max: 356 },
    { key: 'finalPositions', label: 'Campeón, finalista, 3º, 4º', max: 150 }
  ];

  const angleSlice = (Math.PI * 2) / categories.length;
  const maxDomain = scale === 'percent' ? 100 : d3.max(chartData, d => {
    return d3.max(categories, c => d[c.key] || 0);
  });
  const rScale = d3.scaleLinear().domain([0, maxDomain]).range([0, radius]);

  // Grid circular
  const levels = scale === 'percent' ? [20, 40, 60, 80, 100] : [20, 40, 60, 80, 100];
  levels.forEach(level => {
    const val = scale === 'percent' ? level : Math.round((level / 100) * maxDomain);
    svg.append('circle')
      .attr('r', rScale(val))
      .attr('fill', 'none')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1);

    svg.append('text')
      .attr('x', 4)
      .attr('y', -rScale(val))
      .attr('dy', '0.35em')
      .style('font-size', isMobile ? '8px' : '10px')
      .style('fill', '#aaa')
      .text(scale === 'percent' ? level + '%' : val);
  });

  // Ejes radiales
  categories.forEach((cat, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    svg.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', x).attr('y2', y)
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1);

    const labelDistance = isMobile ? radius + 25 : radius + 45;
    const labelX = Math.cos(angle) * labelDistance;
    const labelY = Math.sin(angle) * labelDistance;

    svg.append('text')
      .attr('x', labelX).attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', isMobile ? '9px' : '13px')
      .style('font-weight', '600')
      .style('fill', '#444')
      .text(cat.label);
  });

  // Dibujar áreas de cada jugador
  chartData.forEach((playerData, idx) => {
    const color = RADAR_COLORS[idx % RADAR_COLORS.length];

    const points = categories.map((cat, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const rawVal = playerData[cat.key] || 0;
      const displayVal = scale === 'percent'
        ? (cat.max > 0 ? (rawVal / cat.max) * 100 : 0)
        : rawVal;
      const r = rScale(displayVal);
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        value: rawVal,
        pct: cat.max > 0 ? Math.round((rawVal / cat.max) * 100) : 0,
        category: cat.label,
        max: cat.max
      };
    });

    const lineGenerator = d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinearClosed);

    svg.append('path')
      .datum(points)
      .attr('d', lineGenerator)
      .attr('fill', color)
      .attr('fill-opacity', 0.08)
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7);

    svg.selectAll('.radar-point-' + idx)
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'radar-point-' + idx)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', isMobile ? 3 : 4)
      .attr('fill', color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
  });

  // Leyenda
  const legendY = radius + 70;
  const legend = svg.append('g')
    .attr('transform', `translate(0, ${legendY})`);

  const itemsPerRow = isMobile ? 4 : 8;
  const itemWidth = isMobile ? 70 : 100;

  chartData.forEach((d, i) => {
    const color = RADAR_COLORS[i % RADAR_COLORS.length];
    const row = Math.floor(i / itemsPerRow);
    const col = i % itemsPerRow;
    const totalRowWidth = Math.min(chartData.length - row * itemsPerRow, itemsPerRow) * itemWidth;
    const startX = -totalRowWidth / 2 + col * itemWidth;

    const legendItem = legend.append('g')
      .attr('transform', `translate(${startX}, ${row * 20})`);

    legendItem.append('rect')
      .attr('width', 10).attr('height', 10)
      .attr('rx', 2)
      .attr('fill', color);

    legendItem.append('text')
      .attr('x', 14).attr('y', 5)
      .attr('dy', '0.35em')
      .style('font-size', isMobile ? '9px' : '11px')
      .style('font-weight', '500')
      .style('fill', '#555')
      .text(d.player.length > (isMobile ? 7 : 10) ? d.player.substring(0, isMobile ? 5 : 8) + '...' : d.player);
  });

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'radar-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26,26,46,0.95)')
    .style('color', '#fff')
    .style('padding', '10px 14px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  chartData.forEach((playerData, idx) => {
    const color = RADAR_COLORS[idx % RADAR_COLORS.length];

    const points = categories.map((cat, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const rawVal = playerData[cat.key] || 0;
      const displayVal = scale === 'percent'
        ? (cat.max > 0 ? (rawVal / cat.max) * 100 : 0)
        : rawVal;
      const r = rScale(displayVal);
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        value: rawVal,
        pct: cat.max > 0 ? Math.round((rawVal / cat.max) * 100) : 0,
        category: cat.label,
        player: playerData.player,
        max: cat.max
      };
    });

    svg.selectAll('.radar-hit-' + idx)
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'radar-hit-' + idx)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', isMobile ? 10 : 12)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('mouseover', function(event, d) {
        d3.select(this.parentNode).selectAll('.radar-point-' + idx)
          .filter((p, i) => p.x === d.x && p.y === d.y)
          .attr('r', isMobile ? 6 : 7);

        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`
          <div style="font-weight:700;margin-bottom:4px;color:${color};">${d.player}</div>
          <div style="color:#aaa;font-size:12px;margin-bottom:6px;">${d.category}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;">
            <span>Puntos:</span>
            <span style="font-weight:700;">${d.value} / ${d.max}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:16px;">
            <span>Porcentaje:</span>
            <span style="font-weight:700;color:#7FD8FF;">${d.pct}%</span>
          </div>
        `);
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
      })
      .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this.parentNode).selectAll('.radar-point-' + idx)
          .attr('r', isMobile ? 3 : 4);
        tooltip.transition().duration(200).style('opacity', 0);
      });
  });
  daInitPanOnContainer(container);
}

/* ============================================================
   PAN EN EL CONTENEDOR PADRE (no bloquea tooltips del SVG)
   ============================================================

   El contenedor captura mousedown. Si el target es un vértice
   (circle con clase radar-hit-*), no iniciamos drag → tooltip funciona.
   Si el target es el fondo, iniciamos drag → pan funciona.

   Para que esto funcione, el SVG debe estar ENCIMA del overlay
   en el z-index, o no debe haber overlay. En su lugar, usamos
   el contenedor como área de captura y verificamos el target.
   ============================================================ */

function daInitPanOnContainer(container) {
  // Eliminar listeners previos para evitar duplicados
  if (container._panCleanup) {
    container._panCleanup();
  }

  // Solo activar pan cuando hay zoom (>100%)
  if (RADAR_CHART_ZOOM <= 100) {
    container.style.cursor = 'default';
    return;
  }

  let isDragging = false;
  let lastX = 0, lastY = 0;

  const onMouseDown = (e) => {
    // Verificar si el click fue en un vértice del radar (tooltip)
    const target = e.target;
    const isVertex = target.tagName === 'circle' && 
                     target.classList && 
                     Array.from(target.classList).some(c => c.startsWith('radar-hit-'));

    // Si es un vértice, NO iniciar drag (dejar que el tooltip de D3 funcione)
    if (isVertex) return;

    // Si es el fondo, iniciar drag
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    container.style.cursor = 'grabbing';
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    daApplyPan(dx, dy);
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = 'grab';
  };

  const onMouseLeave = () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = 'grab';
  };

  // Touch support
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const target = e.target;
    const isVertex = target.tagName === 'circle' && 
                     target.classList && 
                     Array.from(target.classList).some(c => c.startsWith('radar-hit-'));
    if (isVertex) return;

    isDragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    e.preventDefault();
  };

  const onTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    daApplyPan(dx, dy);
    e.preventDefault();
  };

  const onTouchEnd = () => {
    isDragging = false;
  };

  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseup', onMouseUp);
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd);

  container.style.cursor = 'grab';

  // Guardar función de cleanup
  container._panCleanup = () => {
    container.removeEventListener('mousedown', onMouseDown);
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('mouseup', onMouseUp);
    container.removeEventListener('mouseleave', onMouseLeave);
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
  };
}

function daInitRadarChart() {
  const container = document.getElementById('radarChartContainer');
  if (!container) {
    console.error('[RadarChart] No existe #radarChartContainer');
    return;
  }

  if (__radarChartData) {
    daRenderRadarPlayerCheckboxes();
    daRefreshRadarChart();
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];

    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    __radarChartData = daCalculateCategoryScores(players, finished);
    __radarChartPlayers = players.map(p => p.name);
    daRenderRadarPlayerCheckboxes();
    daRefreshRadarChart();

  }).catch(err => {
    console.error('[RadarChart] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

/* ============================================================
   CONTROLES DEL RADAR CHART
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshRadarChart');
  const playersToggleBtn = document.getElementById('btnRadarChartPlayersToggle');
  const selectAllCb = document.getElementById('dpSelectAllRadarCheckbox');
  const scaleSelect = document.getElementById('radarChartScale');
  const zoomInBtn = document.getElementById('btnRadarZoomIn');
  const zoomOutBtn = document.getElementById('btnRadarZoomOut');
  const zoomResetBtn = document.getElementById('btnRadarZoomReset');

  if (refreshBtn) refreshBtn.addEventListener('click', daRefreshRadarChart);
  if (playersToggleBtn) playersToggleBtn.addEventListener('click', daToggleRadarPlayersDropdown);
  if (selectAllCb) selectAllCb.addEventListener('change', daToggleSelectAllRadarPlayers);
  if (scaleSelect) scaleSelect.addEventListener('change', daRefreshRadarChart);
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => daZoomRadarChart(RADAR_CHART_ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => daZoomRadarChart(-RADAR_CHART_ZOOM_STEP));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', daResetRadarZoom);
});


/* ============================================================
   PODIUM CHART — Top 3 por Categoría (v4 con selector de escala)
   ============================================================ */

let PODIUM_CHART_FIT_MODE = true;
let __podiumChartData = null;
let PODIUM_TOP_N = 3; 

function daRefreshPodiumChart() {
  if (!__podiumChartData) {
    daInitPodiumChart();
    return;
  }
  const scale = document.getElementById('podiumChartScale')?.value || 'points';
  const topN = parseInt(document.getElementById('podiumChartTopN')?.value || '3', 10);
  daRenderPodiumChart(__podiumChartData, scale, topN);
}

function daRenderPodiumChart(data, scale, topN) {
  const container = document.getElementById('podiumChartContainer');
  const wrapper = document.getElementById('podiumChartScrollWrapper');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="note-text">No hay datos para mostrar.</p>';
    return;
  }

  const isMobile = window.innerWidth <= 768;

  const categories = [
    { key: 'exactResults', label: 'Resultados exactos', color: '#4CAF50', max: 360 },
    { key: 'oneXTwo', label: '1X2', color: '#2196F3', max: 72 },
    { key: 'groupPositions', label: 'Posiciones grupos', color: '#FF9800', max: 240 },
    { key: 'bestThirds', label: 'Mejores terceros', color: '#9C27B0', max: 8 },
    { key: 'knockoutRounds', label: 'Fase final (hasta semis)', color: '#F44336', max: 356 },
    { key: 'finalPositions', label: 'Campeón, finalista, 3º, 4º', color: '#FFD700', max: 150 }
  ];

  const margin = { top: 20, right: isMobile ? 10 : 20, bottom: 20, left: isMobile ? 10 : 20 };
  const containerWidth = wrapper.clientWidth || 800;

  const cols = isMobile ? 1 : (containerWidth < 900 ? 2 : 3);
  const cardGapX = 16;
  const cardGapY = 16;

  // === ALTURA DINÁMICA SEGÚN TOP N ===
  const headerHeight = 48;
  const barHeight = 28;
  const barGap = 8;
  const paddingTop = 14;    // espacio entre header y primera barra
  const paddingBottom = 14; // espacio debajo de última barra

  // Calcular altura necesaria por card según cuántos items se muestran
  const itemsPerCard = Math.min(topN, data.length); // máximo de jugadores por categoría
  const cardContentHeight = paddingTop + (itemsPerCard * barHeight) + ((itemsPerCard - 1) * barGap) + paddingBottom;
  const cardHeight = Math.max(headerHeight + cardContentHeight, 120); // mínimo 120px
  // ====================================

  const cardWidth = (containerWidth / cols) - cardGapX;

  const rows = Math.ceil(categories.length / cols);
  const totalWidth = cols * cardWidth + (cols - 1) * cardGapX + margin.left + margin.right;
  const totalHeight = rows * cardHeight + (rows - 1) * cardGapY + margin.top + margin.bottom;

  container.style.width = '100%';
  container.style.height = totalHeight + 'px';
  container.style.minWidth = '0';

  const svg = d3.select('#podiumChartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', totalHeight)
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('display', 'block');

  const tooltip = d3.select('body').append('div')
    .attr('class', 'podium-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26,26,46,0.95)')
    .style('color', '#fff')
    .style('padding', '10px 14px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  categories.forEach((cat, catIdx) => {
    const col = catIdx % cols;
    const row = Math.floor(catIdx / cols);
    const x = margin.left + col * (cardWidth + cardGapX);
    const y = margin.top + row * (cardHeight + cardGapY);

    const cardGroup = svg.append('g')
      .attr('transform', `translate(${x},${y})`);

    // Fondo con color sombreado (no blanco) para modo oscuro
    const bgColor = d3.color(cat.color).copy({opacity: 0.12});
    const bgColorStr = bgColor.formatHex8 ? bgColor.formatHex8() : bgColor.toString();

    cardGroup.append('rect')
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 12)
      .attr('ry', 12)
      .attr('fill', bgColorStr)
      .attr('stroke', cat.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3);

    // Header con color sólido
    cardGroup.append('rect')
      .attr('width', cardWidth)
      .attr('height', headerHeight)
      .attr('rx', 12)
      .attr('ry', 12)
      .attr('fill', cat.color);

    cardGroup.append('rect')
      .attr('y', headerHeight / 2)
      .attr('width', cardWidth)
      .attr('height', headerHeight / 2)
      .attr('fill', cat.color);

    // Título
    cardGroup.append('text')
      .attr('x', cardWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('fill', '#fff')
      .text(cat.label);

    // Subtítulo con máximo
    cardGroup.append('text')
      .attr('x', cardWidth / 2)
      .attr('y', 36)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '500')
      .style('fill', 'rgba(255,255,255,0.85)')
      .text('Máx: ' + cat.max + ' pts');

    // Top N (filtrado por topN)
    const catData = data.map(d => ({
      player: d.player,
      value: d[cat.key] || 0,
      pct: cat.max > 0 ? Math.round((d[cat.key] / cat.max) * 100) : 0
    })).sort((a, b) => b.value - a.value).slice(0, topN);

    const barMax = scale === 'percent' ? cat.max : Math.max(catData[0]?.value || 1, 1);
    const barStartY = headerHeight + paddingTop;
    const maxBarWidth = cardWidth - 40;

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#B0BEC5', '#B0BEC5', '#B0BEC5', '#B0BEC5', '#B0BEC5', '#B0BEC5', '#B0BEC5'];
    const medalEmojis = ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8', '9', '10'];

    catData.forEach((entry, idx) => {
      const barY = barStartY + idx * (barHeight + barGap);
      const barWidth = (entry.value / barMax) * maxBarWidth;

      // Fondo de barra semi-transparente
      cardGroup.append('rect')
        .attr('x', 20)
        .attr('y', barY)
        .attr('width', maxBarWidth)
        .attr('height', barHeight)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', d3.color(cat.color).copy({opacity: 0.08}).toString());

      // Barra de valor
      cardGroup.append('rect')
        .attr('x', 20)
        .attr('y', barY)
        .attr('width', 0)
        .attr('height', barHeight)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', cat.color)
        .attr('fill-opacity', 0.7 + (idx * 0.05))
        .transition()
        .duration(600)
        .delay(idx * 100)
        .attr('width', Math.max(barWidth, 4));

      // Medal
      cardGroup.append('text')
        .attr('x', 12)
        .attr('y', barY + barHeight / 2)
        .attr('dy', '0.35em')
        .style('font-size', '14px')
        .text(medalEmojis[idx] || (idx + 1));

      // Nombre
      cardGroup.append('text')
        .attr('x', 28)
        .attr('y', barY + barHeight / 2)
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', '#e0e0e0')
        .text(entry.player.length > 14 ? entry.player.substring(0, 12) + '...' : entry.player);

      // Valor
      const displayValue = scale === 'percent' ? entry.pct + '%' : entry.value + ' pts';
      cardGroup.append('text')
        .attr('x', cardWidth - 12)
        .attr('y', barY + barHeight / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#ccc')
        .text(displayValue);

      // Tooltip hit area
      cardGroup.append('rect')
        .attr('x', 20)
        .attr('y', barY)
        .attr('width', cardWidth - 40)
        .attr('height', barHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          tooltip.transition().duration(150).style('opacity', 1);
          tooltip.html(`
            <div style="font-weight:700;margin-bottom:4px;">${entry.player}</div>
            <div style="color:#aaa;font-size:12px;margin-bottom:6px;">${cat.label}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;">
              <span>Puntos:</span>
              <span style="font-weight:700;">${entry.value} / ${cat.max}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;">
              <span>Porcentaje:</span>
              <span style="font-weight:700;color:#7FD8FF;">${entry.pct}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-top:4px;">
              <span>Posición:</span>
              <span style="font-weight:700;color:${medalColors[idx] || '#888'};">${medalEmojis[idx] || (idx + 1)} #${idx + 1}</span>
            </div>
          `);
          tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
        })
        .on('mouseout', function() {
          tooltip.transition().duration(200).style('opacity', 0);
        });
    });
  });
}


function daInitPodiumChart() {
  const container = document.getElementById('podiumChartContainer');
  if (!container) {
    console.error('[PodiumChart] No existe #podiumChartContainer');
    return;
  }

  if (__podiumChartData) {
    daRefreshPodiumChart();
    return;
  }

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (lbData) window.__leaderboardData = lbData;
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];

    const players = rawPlayers.map(p => {
      const pred = p.prediction || p;
      return { 
        name: p.name || pred.name || 'Anónimo', 
        ...pred 
      };
    }).filter(p => {
      return p.groups && typeof p.groups === 'object' && Object.keys(p.groups).length > 0;
    });

    if (players.length === 0) {
      container.innerHTML = '<p class="note-text">Ningún jugador tiene predicción válida.</p>';
      return;
    }

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML = '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    __podiumChartData = daCalculateCategoryScores(players, finished);
    daRefreshPodiumChart();

  }).catch(err => {
    console.error('[PodiumChart] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

/* -----------------------------------------------------------
   CONTROLES DEL PODIUM CHART
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshPodiumChart');
  const scaleSelect = document.getElementById('podiumChartScale');
  const topNSelect = document.getElementById('podiumChartTopN');

  if (refreshBtn) refreshBtn.addEventListener('click', daRefreshPodiumChart);
  if (scaleSelect) scaleSelect.addEventListener('change', daRefreshPodiumChart);
  if (topNSelect) topNSelect.addEventListener('change', daRefreshPodiumChart);
});

window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && __podiumChartData) {
    clearTimeout(window.__podiumChartResizeTimer);
    window.__podiumChartResizeTimer = setTimeout(function() {
      daRefreshPodiumChart();
    }, 300);
  }
});