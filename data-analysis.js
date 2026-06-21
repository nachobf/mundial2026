/* ============================================================
   DATA ANALYSIS — Bump Chart de evolución del leaderboard
   ============================================================ */

function daLog(msg) {
  console.log('[DataAnalysis]', msg);
}

/* -----------------------------------------------------------
   1. Cargar datos del mundial (cacheado en window)
   ----------------------------------------------------------- */
async function daLoadWorldCupData() {
  if (window.__worldCupData) return window.__worldCupData;
  try {
    const resp = await fetch(DATA_SRC + '/worldcup.json');
    const data = await resp.json();
    window.__worldCupData = data;
    return data;
  } catch (e) {
    daLog('Error cargando WC data: ' + e.message);
    return null;
  }
}

/* -----------------------------------------------------------
   2. Construir snapshot parcial de resultados reales
   ----------------------------------------------------------- */
function daBuildPartialReal(matchesWithResults) {
  const real = {
    groups: {},
    groupsConfirmed: {},
    groupMatchResults: {},
    thirdPlace: [],
    thirdPlaceConfirmed: false,
    knockout: { matches: { round32: [], round16: [], quarterfinals: [], semifinals: [], thirdPlace: [], final: [] } }
  };

  if (!matchesWithResults || matchesWithResults.length === 0) return real;

  const gNames = (typeof GROUP_NAMES !== 'undefined' && GROUP_NAMES.length) ? GROUP_NAMES : Object.keys(TEAMS_BY_GROUP || {}).sort();
  const tByGroup = (typeof TEAMS_BY_GROUP !== 'undefined') ? TEAMS_BY_GROUP : {};

  gNames.forEach(group => {
    real.groups[group] = [];
    real.groupsConfirmed[group] = false;
  });

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

  matchesWithResults.forEach(m => {
    const roundName = roundMap[m.round];
    if (!roundName) return;
    const t1Raw = m.team1, t2Raw = m.team2;
    const isPlaceholder = /^[WL]\d+$/.test(t1Raw) || /^[WL]\d+$/.test(t2Raw) || /^\d+[A-Z]$/.test(t1Raw) || /^\d+[A-Z]$/.test(t2Raw);
    if (isPlaceholder) return;

    const g1 = parseInt(m.score.ft[0], 10);
    const g2 = parseInt(m.score.ft[1], 10);
    const t1 = (typeof translateTeamName === 'function') ? translateTeamName(t1Raw) : t1Raw;
    const t2 = (typeof translateTeamName === 'function') ? translateTeamName(t2Raw) : t2Raw;
    const winner = g1 > g2 ? t1 : t2;

    real.knockout.matches[roundName].push({ match: m.num, team1: t1, team2: t2, winner: winner });
  });

  return real;
}

/* -----------------------------------------------------------
   3. Calcular puntuaciones día a día
   ----------------------------------------------------------- */
async function daProcessDailyScores() {
  const wcData = await daLoadWorldCupData();
  if (!wcData || !wcData.matches) {
    daLog('No hay datos WC o no tiene .matches');
    return [];
  }

  const lbData = window.__leaderboardData;
  if (!lbData || !lbData.players || !lbData.players.length) {
    daLog('No hay leaderboardData o está vacío');
    return [];
  }

  const players = lbData.players.map(p => {
    let parsed = p;
    if (typeof p.json === 'string') {
      try { parsed = JSON.parse(p.json); } catch(e) {}
    }
    return { name: p.name || 'Anónimo', ...parsed };
  }).filter(p => p.groups && Object.keys(p.groups).length > 0);

  daLog('Jugadores con predicción válida: ' + players.length);

  if (players.length === 0) {
    daLog('Ningún jugador tiene groups poblado. Revisa la estructura de __leaderboardData.players');
    return [];
  }

  const finished = (wcData.matches || []).filter(m =>
    m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
  );

  daLog('Partidos finalizados en JSON: ' + finished.length);

  if (finished.length === 0) {
    daLog('El JSON no tiene partidos con score.ft. El chart no puede generarse hasta que haya resultados reales.');
    return [];
  }

  const byDate = {};
  finished.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  });

  const dates = Object.keys(byDate).sort();
  daLog('Fechas con partidos: ' + dates.join(', '));

  const dailyScores = [];
  const matchesSoFar = [];

  dates.forEach(date => {
    matchesSoFar.push(...byDate[date]);
    const realPartial = daBuildPartialReal(matchesSoFar);

    const dayResults = players.map(player => {
      try {
        const result = calculatePlayerScore(player, realPartial);
        return { player: player.name || 'Anónimo', score: result.score, date };
      } catch (e) {
        daLog('Error score para ' + player.name + ': ' + e.message);
        return { player: player.name || 'Anónimo', score: 0, date };
      }
    });

    dayResults.sort((a, b) => b.score - a.score);
    dayResults.forEach((d, i) => { d.rank = i + 1; });
    dailyScores.push(...dayResults);
  });

  daLog('Total puntos de datos generados: ' + dailyScores.length);
  return dailyScores;
}

/* -----------------------------------------------------------
   4. Renderizar Bump Chart con D3
   ----------------------------------------------------------- */
function daRenderBumpChart(dailyData, topN) {
  const container = document.getElementById('bumpChartContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!dailyData || dailyData.length === 0) {
    container.innerHTML = '<p class="note-text">No hay datos para mostrar.</p>';
    return;
  }

  if (typeof d3 === 'undefined') {
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: D3.js no está cargado. Revisa el &lt;script&gt; en index.html.</p>';
    return;
  }

  const dates = [...new Set(dailyData.map(d => d.date))].sort();
  const lastDate = dates[dates.length - 1];
  const lastRanks = dailyData.filter(d => d.date === lastDate).sort((a, b) => a.rank - b.rank);
  const topPlayers = new Set(lastRanks.slice(0, topN).map(d => d.player));
  const filteredData = dailyData.filter(d => topPlayers.has(d.player));

  daLog('Renderizando chart: ' + topPlayers.size + ' jugadores, ' + dates.length + ' días, ' + filteredData.length + ' puntos');

  const margin = { top: 30, right: 150, bottom: 60, left: 50 };
  const containerWidth = container.clientWidth || 800;
  const width = Math.max(containerWidth - margin.left - margin.right, 300);
  const height = 520 - margin.top - margin.bottom;

  const svg = d3.select('#bumpChartContainer')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint()
    .domain(dates)
    .range([0, width])
    .padding(0.3);

  const maxRank = d3.max(filteredData, d => d.rank) || 1;
  const y = d3.scaleLinear()
    .domain([1, maxRank])
    .range([0, height]);

  const playersList = [...new Set(filteredData.map(d => d.player))];
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(playersList);

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.rank))
    .curve(d3.curveMonotoneX);

  const nested = d3.group(filteredData, d => d.player);

  // Grid horizontal
  svg.selectAll('.grid-line')
    .data(y.ticks(maxRank))
    .enter()
    .append('line')
    .attr('class', 'grid-line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', '#f0f0f0')
    .attr('stroke-dasharray', '3,3');

  // Líneas
  svg.selectAll('.bump-line')
    .data(Array.from(nested))
    .enter()
    .append('path')
    .attr('class', 'bump-line')
    .attr('d', ([, values]) => line(values))
    .attr('fill', 'none')
    .attr('stroke', ([player]) => color(player))
    .attr('stroke-width', 2.5)
    .attr('stroke-opacity', 0.85)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round');

  // Puntos
  const points = svg.selectAll('.bump-point')
    .data(filteredData)
    .enter()
    .append('circle')
    .attr('class', 'bump-point')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.rank))
    .attr('r', 0)
    .attr('fill', d => color(d.player))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  points.transition()
    .duration(700)
    .delay((d, i) => i * 10)
    .attr('r', 5);

  // Eje X
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }));

  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-35)')
    .style('font-size', '11px')
    .style('fill', '#666');
  xAxis.select('.domain').attr('stroke', '#ddd');
  xAxis.selectAll('.tick line').attr('stroke', '#eee');

  // Eje Y
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(maxRank).tickFormat(d => '#' + d));
  yAxis.selectAll('text').style('font-size', '11px').style('fill', '#666');
  yAxis.select('.domain').attr('stroke', '#ddd');
  yAxis.selectAll('.tick line').attr('stroke', '#eee');

  // Labels finales
  const lastPoints = filteredData.filter(d => d.date === lastDate);
  svg.selectAll('.bump-label')
    .data(lastPoints)
    .enter()
    .append('text')
    .attr('class', 'bump-label')
    .attr('x', width + 10)
    .attr('y', d => y(d.rank))
    .attr('dy', '0.35em')
    .text(d => `${d.rank}. ${d.player}`)
    .attr('fill', d => color(d.player))
    .attr('font-size', '12px')
    .attr('font-weight', '600');

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'bump-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(26, 26, 46, 0.95)')
    .style('color', '#fff')
    .style('padding', '10px 14px')
    .style('border-radius', '10px')
    .style('font-size', '13px')
    .style('pointer-events', 'none')
    .style('z-index', '10000')
    .style('box-shadow', '0 4px 20px rgba(0,0,0,0.3)');

  points
    .on('mouseover', function(event, d) {
      d3.select(this).transition().duration(150).attr('r', 8).attr('stroke-width', 3);
      svg.selectAll('.bump-line').attr('stroke-opacity', 0.12);
      svg.selectAll('.bump-line').filter(([player]) => player === d.player)
        .attr('stroke-opacity', 1).attr('stroke-width', 4);

      const dateObj = new Date(d.date + 'T00:00:00');
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(`
        <div style="font-weight:700;margin-bottom:4px;">${d.player}</div>
        <div style="color:#aaa;font-size:12px;">${dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}</div>
        <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;font-weight:700;">#${d.rank}</span>
          <span style="color:#7FD8FF;font-weight:600;">${d.score} pts</span>
        </div>
      `);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 12) + 'px');
    })
    .on('mouseout', function() {
      d3.select(this).transition().duration(150).attr('r', 5).attr('stroke-width', 2);
      svg.selectAll('.bump-line').attr('stroke-opacity', 0.85).attr('stroke-width', 2.5);
      tooltip.transition().duration(200).style('opacity', 0);
    });

  // Título eje Y
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left + 12)
    .attr('x', 0 - (height / 2))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#888')
    .text('Posición en el ranking');
}

/* -----------------------------------------------------------
   5. Entry point
   ----------------------------------------------------------- */
function initDataAnalysis() {
  const container = document.getElementById('bumpChartContainer');
  if (!container) return;

  container.innerHTML = '<p class="note-text">Cargando datos...</p>';

  const wcPromise = window.__worldCupData 
    ? Promise.resolve(window.__worldCupData) 
    : daLoadWorldCupData();

  const lbPromise = window.__leaderboardData && window.__leaderboardData.players
    ? Promise.resolve(window.__leaderboardData)
    : loadLeaderboard();

  Promise.all([wcPromise, lbPromise]).then(([wcData, lbData]) => {
    if (!wcData || !wcData.matches) {
      container.innerHTML = '<p class="note-text">No se pudieron cargar los datos del torneo.</p>';
      return;
    }

    const rawPlayers = lbData?.players || [];
    
    // Cada jugador tiene: name, score, details, prediction: {...}
    // donde prediction contiene groups, groupMatchResults, knockout, etc.
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
      container.innerHTML = '<p class="note-text">No se encontraron predicciones válidas.</p>';
      return;
    }

    container.innerHTML = '<p class="note-text">Jugadores: ' + players.length + '. Procesando...</p>';

    const finished = (wcData.matches || []).filter(m =>
      m.score && m.score.ft && Array.isArray(m.score.ft) && m.score.ft.length === 2 && m.date
    );

    if (finished.length === 0) {
      container.innerHTML += '<p class="note-text">El torneo aún no ha empezado.</p>';
      return;
    }

    daProcessAndRender(players, finished);

  }).catch(err => {
    console.error('[DataAnalysis] Error:', err);
    container.innerHTML = '<p class="note-text" style="color:#f44336;">Error: ' + err.message + '</p>';
  });
}

function daRefreshChart() {
  if (window.__bumpChartData) {
    const topN = parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10);
    daRenderBumpChart(window.__bumpChartData, topN);
  } else {
    initDataAnalysis();
  }
}

/* -----------------------------------------------------------
   6. Event listeners
   ----------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() {
  const refreshBtn = document.getElementById('btnRefreshBumpChart');
  const topSelect = document.getElementById('bumpChartTopN');
  if (refreshBtn) refreshBtn.addEventListener('click', daRefreshChart);
  if (topSelect) topSelect.addEventListener('change', daRefreshChart);
});

// Resize
window.addEventListener('resize', function() {
  const tab = document.getElementById('tab-data-analysis');
  if (tab && tab.classList.contains('active') && window.__bumpChartData) {
    clearTimeout(window.__bumpChartResizeTimer);
    window.__bumpChartResizeTimer = setTimeout(function() {
      daRenderBumpChart(window.__bumpChartData, parseInt(document.getElementById('bumpChartTopN')?.value || '10', 10));
    }, 300);
  }
});