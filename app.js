/* ============================================================
 2026 FIFA World Cup Prediction Game - app.js
 Data fetched from openfootball/worldcup.json
 ============================================================ */

const DATA_SRC = 'https://raw.githubusercontent.com/openfootball/worldcup.json/refs/heads/master/2026';
const LEADERBOARD_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1_Oxh2vbnyXfWkWYUCuGdWMqdIyv8REJwpZIi1Bcdb-XIgvBJQYIp1iE6hDX5c-S5QwFXXM4Xi_vP/pub?output=csv';
const FORM_ID = '1rJAuhg0Mh8RsC6mroIIDwHMXH-6v2duyrMa4IK7iK2M';
const ENTRY_ID = 'entry.1820294448';

const DEADLINE = new Date('2026-06-11T17:00:00Z');
const KICKOFF = new Date('2026-06-11T19:00:00Z');

function isSubmissionClosed() {
  return new Date() > DEADLINE;
}

const puntuaciones = {
  grupos: {
    posicion: { primero: 5, segundo: 5, tercero: 5, cuarto: 0 },
    mejorTercero: 1,
    resultadoExacto: 5,
    quiniela1x2: 1
  },
  eliminatorias: {
    round32: 3, round16: 5, quarterfinals: 10, semifinals: 20,
    finalist: 30, champion: 50, thirdPlace: 20, fourthPlace: 20
  }
};

let QUINIELA_1X2_MATCHES = [];

function formatCountdown(ms) {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
}

function updateCountdowns() {
  const now = Date.now();
  const betEl = document.getElementById('cdBet');
  if (betEl) {
    const diff = DEADLINE.getTime() - now;
    betEl.textContent = diff > 0 ? formatCountdown(diff) : 'Cerrado!';
    betEl.classList.toggle('countdown-finished', diff <= 0);
  }
  const kickEl = document.getElementById('cdKick');
  if (kickEl) {
    const diff = KICKOFF.getTime() - now;
    kickEl.textContent = diff > 0 ? formatCountdown(diff) : 'Ya rueda el balon!';
    kickEl.classList.toggle('countdown-finished', diff <= 0);
  }
}

const TEAM_NAME_ES = {
  'Algeria': 'Argelia', 'Argentina': 'Argentina', 'Australia': 'Australia',
  'Austria': 'Austria', 'Belgium': 'Belgica', 'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Brazil': 'Brasil', 'Canada': 'Canada', 'Cape Verde': 'Cabo Verde',
  'Colombia': 'Colombia', 'Croatia': 'Croacia', 'Curacao': 'Curazao',
  'Czech Republic': 'Republica Checa', 'DR Congo': 'RD del Congo', 'Ecuador': 'Ecuador',
  'Egypt': 'Egipto', 'England': 'Inglaterra', 'France': 'Francia',
  'Germany': 'Alemania', 'Ghana': 'Ghana', 'Haiti': 'Haiti',
  'Iran': 'Iran', 'Iraq': 'Irak', 'Ivory Coast': 'Costa de Marfil',
  'Japan': 'Japon', 'Jordan': 'Jordania', 'Mexico': 'Mexico',
  'Morocco': 'Marruecos', 'Netherlands': 'Paises Bajos', 'New Zealand': 'Nueva Zelanda',
  'Norway': 'Noruega', 'Panama': 'Panama', 'Paraguay': 'Paraguay',
  'Portugal': 'Portugal', 'Qatar': 'Catar', 'Saudi Arabia': 'Arabia Saudi',
  'Scotland': 'Escocia', 'Senegal': 'Senegal', 'South Africa': 'Sudafrica',
  'South Korea': 'Corea del Sur', 'Spain': 'Espana', 'Sweden': 'Suecia',
  'Switzerland': 'Suiza', 'Tunisia': 'Tunez', 'Turkey': 'Turquia',
  'USA': 'Estados Unidos', 'Uruguay': 'Uruguay', 'Uzbekistan': 'Uzbekistan'
};

function translateTeamName(name) {
  if (!name) return name;
  return TEAM_NAME_ES[name] || name;
}

const FLAG_CODE = {
  'Mexico':'mx','Sudafrica':'za','Corea del Sur':'kr','Republica Checa':'cz',
  'Canada':'ca','Bosnia y Herzegovina':'ba','Catar':'qa','Suiza':'ch',
  'Brasil':'br','Marruecos':'ma','Haiti':'ht','Escocia':'gb-sct',
  'Estados Unidos':'us','Paraguay':'py','Australia':'au','Turquia':'tr',
  'Alemania':'de','Curazao':'cw','Costa de Marfil':'ci','Ecuador':'ec',
  'Paises Bajos':'nl','Japon':'jp','Suecia':'se','Tunez':'tn',
  'Belgica':'be','Egipto':'eg','Iran':'ir','Nueva Zelanda':'nz',
  'Espana':'es','Cabo Verde':'cv','Arabia Saudi':'sa','Uruguay':'uy',
  'Francia':'fr','Senegal':'sn','Irak':'iq','Noruega':'no',
  'Argentina':'ar','Argelia':'dz','Austria':'at','Jordania':'jo',
  'Portugal':'pt','RD del Congo':'cd','Uzbekistan':'uz','Colombia':'co',
  'Inglaterra':'gb-eng','Croacia':'hr','Ghana':'gh','Panama':'pa'
};

function getFlagClass(team) {
  if (!team) return '';
  const code = FLAG_CODE[team];
  return code ? 'fi fi-'+code : '';
}

let TEAMS_BY_GROUP = {};
let GROUP_NAMES = [];
let GROUP_MATCHES_BY_GROUP = {};
let BRACKET_R32 = [];
let KO_TREE = null;
let LOADED = false;
let tpAllocation = {};

const FIFA_RANKING_TIEBREAK = {
  'Argentina': 1, 'Francia': 2, 'Espana': 3, 'Inglaterra': 4, 'Brasil': 5,
  'Portugal': 6, 'Paises Bajos': 7, 'Belgica': 8, 'Alemania': 9, 'Croacia': 10,
  'Marruecos': 11, 'Colombia': 12, 'Uruguay': 13, 'Mexico': 14, 'Estados Unidos': 15,
  'Senegal': 16, 'Japon': 17, 'Suiza': 18, 'Iran': 19, 'Corea del Sur': 20,
  'Austria': 21, 'Australia': 22, 'Catar': 23, 'Noruega': 24, 'Ecuador': 25,
  'Turquia': 26, 'Canada': 27, 'Suecia': 28, 'Panama': 29, 'Egipto': 30,
  'Argelia': 31, 'Tunez': 32, 'Paraguay': 33, 'Costa de Marfil': 34, 'Arabia Saudi': 35,
  'Escocia': 36, 'Bosnia y Herzegovina': 37, 'Republica Checa': 38, 'Irak': 39,
  'Uzbekistan': 40, 'Jordania': 41, 'RD del Congo': 42, 'Sudafrica': 43,
  'Cabo Verde': 44, 'Nueva Zelanda': 45, 'Haiti': 46, 'Curazao': 47
};

function getTeamFifaRank(team) {
  return FIFA_RANKING_TIEBREAK[team] || 999;
}

function compareBestThirdsByRanking(a, b) {
  return (getTeamFifaRank(a.team) - getTeamFifaRank(b.team)) || a.group.localeCompare(b.group);
}

function getAllThirdPlaceCandidates() {
  return GROUP_NAMES
    .map(group => ({ group, team: state.groups[group]?.[2] || null }))
    .filter(item => item.team);
}

function ensureThirdPlaceRanking() {
  const candidates = getAllThirdPlaceCandidates();
  const validSet = new Set(candidates.map(c => c.team));
  const existing = (state.thirdPlace || []).filter(team => validSet.has(team));
  const existingSet = new Set(existing);
  const missing = candidates
    .filter(item => !existingSet.has(item.team))
    .sort(compareBestThirdsByRanking)
    .map(item => item.team);
  state.thirdPlace = [...existing, ...missing];
  if (state.thirdPlace.length < candidates.length) state.thirdPlaceConfirmed = false;
}

function getQualifiedThirdPlaceTeams() {
  ensureThirdPlaceRanking();
  return state.thirdPlace.slice(0, 8);
}

function buildTPAllocation() {
  tpAllocation = {};
  ensureThirdPlaceRanking();
  const qualifiedTeams = getQualifiedThirdPlaceTeams();
  if (qualifiedTeams.length !== 8) return;
  const candidates = getAllThirdPlaceCandidates();
  const groupByTeam = {};
  candidates.forEach(item => { groupByTeam[item.team] = item.group; });
  const byGroup = {};
  qualifiedTeams.forEach(team => {
    const g = groupByTeam[team];
    if (g) byGroup[g] = team;
  });
  if (Object.keys(byGroup).length !== 8) return;
  const groups = Object.keys(byGroup).sort();
  const key = groups.join("");
  const order = TP_TABLE[key];
  if (!order) { console.warn("No TP_TABLE mapping for:", key); return; }
  TP_COLUMNS.forEach((matchNum, index) => {
    const group = String(order[index]).replace(/^3/, "");
    tpAllocation[matchNum] = byGroup[group] || null;
  });
}

let state = {
  groups: {}, groupsConfirmed: {}, thirdPlace: [], thirdPlaceConfirmed: false,
  groupMatchResults: {}, knockoutResults: {}, matchTeams: {}
};

const LOCAL_STORAGE_VERSION = '9';
const LOCAL_STORAGE_VERSION_KEY = 'wc2026_version';
const LOCAL_STORAGE_PICKS_KEY = 'wc2026_picks';
let localSaveTimer = null;

function normalizeLoadedState() {
  ensureGroupsInitialized();
  buildTPAllocation();
  computeMatchTeams();
}

function saveLocalPredictionNow() {
  try {
    const payload = buildPayload();
    payload._localDraftSavedAt = new Date().toISOString();
    localStorage.setItem(LOCAL_STORAGE_PICKS_KEY, JSON.stringify(payload));
  } catch (e) { console.warn('Could not save local draft:', e); }
}

function saveLocalPredictionSoon() {
  clearTimeout(localSaveTimer);
  localSaveTimer = setTimeout(saveLocalPredictionNow, 250);
}

function clearLocalPrediction() {
  clearTimeout(localSaveTimer);
  try { localStorage.removeItem(LOCAL_STORAGE_PICKS_KEY); } catch (e) {}
}

function restoreLocalPrediction() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_PICKS_KEY);
    if (!saved) return false;
    const data = JSON.parse(saved);
    if (data.groups) {
      GROUP_NAMES.forEach(g => {
        if (Array.isArray(data.groups[g]) && data.groups[g].length) {
          state.groups[g] = data.groups[g].slice();
        }
      });
    }
    if (data.groupsConfirmed) {
      GROUP_NAMES.forEach(g => { if (data.groupsConfirmed[g]) state.groupsConfirmed[g] = true; });
    }
    if (Array.isArray(data.thirdPlace) && data.thirdPlace.length) {
      state.thirdPlace = data.thirdPlace.slice();
      state.thirdPlaceConfirmed = Boolean(data.thirdPlaceConfirmed);
    }
    if (data.groupMatchResults && typeof data.groupMatchResults === 'object') {
      state.groupMatchResults = {};
      Object.keys(data.groupMatchResults).forEach(key => {
        const r = data.groupMatchResults[key];
        if (r && typeof r === 'object') {
          state.groupMatchResults[key] = {
            team1Goals: r.team1Goals !== '' ? Number(r.team1Goals) : '',
            team2Goals: r.team2Goals !== '' ? Number(r.team2Goals) : ''
          };
        }
      });
    }
    if (data.knockout?.matches) {
      Object.values(data.knockout.matches).flat().forEach(match => {
        if (match?.match && match?.winner) state.knockoutResults[match.match] = match.winner;
      });
    } else if (data.knockout) {
      ['round32','round16','quarterfinals','semifinals'].forEach(round => {
        const treeArr = KO_TREE[round] || [];
        (data.knockout[round] || []).forEach((team, index) => {
          if (treeArr[index] && team) state.knockoutResults[treeArr[index].num] = team;
        });
      });
      if (data.knockout.final && KO_TREE.final?.[0]) state.knockoutResults[KO_TREE.final[0].num] = data.knockout.final;
      if (data.knockout.thirdPlace && KO_TREE.thirdPlace?.[0]) state.knockoutResults[KO_TREE.thirdPlace[0].num] = data.knockout.thirdPlace;
    }
    normalizeLoadedState();
    return true;
  } catch (e) {
    console.warn('Could not restore local draft:', e);
    clearLocalPrediction();
    return false;
  }
}

async function loadData() {
  try {
    const resp = await fetch(DATA_SRC+'/worldcup.json');
    const data = await resp.json();
    TEAMS_BY_GROUP = {};
    const seen = {}, done = {};
    data.matches.forEach(m => {
      const g = m.group;
      if (!g || !g.startsWith('Group ')) return;
      m.team1 = translateTeamName(m.team1);
      m.team2 = translateTeamName(m.team2);
      const letter = g.replace('Group ','');
      if (done[letter]) return;
      if (!TEAMS_BY_GROUP[letter]) TEAMS_BY_GROUP[letter] = [];
      if (!seen[letter]) seen[letter] = {};
      [m.team1, m.team2].forEach(t => {
        if (t && !seen[letter][t]) {
          seen[letter][t] = true;
          TEAMS_BY_GROUP[letter].push({ name: t, flag: '', fifa: '' });
        }
      });
      if (TEAMS_BY_GROUP[letter].length >= 4) done[letter] = true;
    });
    GROUP_NAMES = Object.keys(TEAMS_BY_GROUP).sort();
    GROUP_MATCHES_BY_GROUP = {};
    data.matches
      .filter(m => m.group && m.group.startsWith('Group '))
      .forEach((m, index) => {
        const letter = m.group.replace('Group ', '');
        if (!GROUP_MATCHES_BY_GROUP[letter]) GROUP_MATCHES_BY_GROUP[letter] = [];
        GROUP_MATCHES_BY_GROUP[letter].push({
          team1: m.team1, team2: m.team2, date: m.date || '', time: m.time || '',
          round: m.round || '', ground: m.ground || '', originalIndex: index,
          key: groupMatchKey(m.team1, m.team2)
        });
      });
    Object.keys(GROUP_MATCHES_BY_GROUP).forEach(group => {
      GROUP_MATCHES_BY_GROUP[group].sort((a, b) => {
        const dateCmp = String(a.date).localeCompare(String(b.date));
        if (dateCmp) return dateCmp;
        const timeCmp = String(a.time).localeCompare(String(b.time));
        if (timeCmp) return timeCmp;
        return a.originalIndex - b.originalIndex;
      });
    });
    QUINIELA_1X2_MATCHES = [];
    GROUP_NAMES.forEach(g => {
      const matches = GROUP_MATCHES_BY_GROUP[g] || [];
      matches.forEach(m => {
        QUINIELA_1X2_MATCHES.push({
          group: g, team1: m.team1, team2: m.team2, key: m.key,
          date: m.date, time: m.time, round: m.round, ground: m.ground
        });
      });
    });
    GROUP_NAMES.forEach(g => {
      state.groups[g] = TEAMS_BY_GROUP[g].map(t => t.name);
    });
    ensureGroupsInitialized();
    KO_TREE = {
      round32: [
        {num:73,slot1:{type:'runner_up',group:'A'},slot2:{type:'runner_up',group:'B'}},
        {num:74,slot1:{type:'winner',group:'E'},slot2:{type:'third_place',groups:['A','B','C','D','F']}},
        {num:75,slot1:{type:'winner',group:'F'},slot2:{type:'runner_up',group:'C'}},
        {num:76,slot1:{type:'winner',group:'C'},slot2:{type:'runner_up',group:'F'}},
        {num:77,slot1:{type:'winner',group:'I'},slot2:{type:'third_place',groups:['C','D','F','G','H']}},
        {num:78,slot1:{type:'runner_up',group:'E'},slot2:{type:'runner_up',group:'I'}},
        {num:79,slot1:{type:'winner',group:'A'},slot2:{type:'third_place',groups:['C','E','F','H','I']}},
        {num:80,slot1:{type:'winner',group:'L'},slot2:{type:'third_place',groups:['E','H','I','J','K']}},
        {num:81,slot1:{type:'winner',group:'D'},slot2:{type:'third_place',groups:['B','E','F','I','J']}},
        {num:82,slot1:{type:'winner',group:'G'},slot2:{type:'third_place',groups:['A','E','H','I','J']}},
        {num:83,slot1:{type:'runner_up',group:'K'},slot2:{type:'runner_up',group:'L'}},
        {num:84,slot1:{type:'winner',group:'H'},slot2:{type:'runner_up',group:'J'}},
        {num:85,slot1:{type:'winner',group:'B'},slot2:{type:'third_place',groups:['E','F','G','I','J']}},
        {num:86,slot1:{type:'winner',group:'J'},slot2:{type:'runner_up',group:'H'}},
        {num:87,slot1:{type:'winner',group:'K'},slot2:{type:'third_place',groups:['D','E','I','J','L']}},
        {num:88,slot1:{type:'runner_up',group:'D'},slot2:{type:'runner_up',group:'G'}}
      ],
      round16: [
        {num:89,slot1:{type:'winner_of',matchNum:73},slot2:{type:'winner_of',matchNum:75}},
        {num:90,slot1:{type:'winner_of',matchNum:74},slot2:{type:'winner_of',matchNum:77}},
        {num:91,slot1:{type:'winner_of',matchNum:76},slot2:{type:'winner_of',matchNum:78}},
        {num:92,slot1:{type:'winner_of',matchNum:79},slot2:{type:'winner_of',matchNum:80}},
        {num:93,slot1:{type:'winner_of',matchNum:83},slot2:{type:'winner_of',matchNum:84}},
        {num:94,slot1:{type:'winner_of',matchNum:81},slot2:{type:'winner_of',matchNum:82}},
        {num:95,slot1:{type:'winner_of',matchNum:86},slot2:{type:'winner_of',matchNum:88}},
        {num:96,slot1:{type:'winner_of',matchNum:85},slot2:{type:'winner_of',matchNum:87}}
      ],
      quarterfinals: [
        {num:97,slot1:{type:'winner_of',matchNum:89},slot2:{type:'winner_of',matchNum:90}},
        {num:98,slot1:{type:'winner_of',matchNum:93},slot2:{type:'winner_of',matchNum:94}},
        {num:99,slot1:{type:'winner_of',matchNum:91},slot2:{type:'winner_of',matchNum:92}},
        {num:100,slot1:{type:'winner_of',matchNum:95},slot2:{type:'winner_of',matchNum:96}}
      ],
      semifinals: [
        {num:101,slot1:{type:'winner_of',matchNum:97},slot2:{type:'winner_of',matchNum:98}},
        {num:102,slot1:{type:'winner_of',matchNum:99},slot2:{type:'winner_of',matchNum:100}}
      ],
      thirdPlace: [
        {num:103,slot1:{type:'loser_of',matchNum:101},slot2:{type:'loser_of',matchNum:102}}
      ],
      final: [
        {num:104,slot1:{type:'winner_of',matchNum:101},slot2:{type:'winner_of',matchNum:102}}
      ]
    };
    BRACKET_R32 = KO_TREE.round32;
    LOADED = true;
    return true;
  } catch(e) {
    console.error('Failed to load tournament data:', e);
    showToast('No hay manera de cargar los datos del Mundial. Revisa la conexion.', true);
    return false;
  }
}

function findTeamGroup(teamName) {
  for (const g of GROUP_NAMES) {
    if (state.groups[g] && state.groups[g].includes(teamName)) return g;
  }
  return TEAMS_BY_GROUP ? Object.keys(TEAMS_BY_GROUP).find(g => TEAMS_BY_GROUP[g].some(t=>t.name===teamName)) : null;
}

function getTeamFlagClass(teamName) { return getFlagClass(teamName); }

function groupMatchKey(team1, team2) {
  return [team1, team2].sort().join('__');
}

function getGroupMatchList(group) {
  if (GROUP_MATCHES_BY_GROUP[group] && GROUP_MATCHES_BY_GROUP[group].length) {
    return GROUP_MATCHES_BY_GROUP[group];
  }
  const teams = (TEAMS_BY_GROUP[group] || []).map(t => t.name);
  const matches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ team1: teams[i], team2: teams[j], key: groupMatchKey(teams[i], teams[j]), date: '', time: '', round: '', ground: '' });
    }
  }
  return matches;
}

function formatMatchDate(match) {
  if (!match.date) return '';
  const date = new Date(match.date + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return match.date;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
}

function getMatchdayNumber(match, fallback) {
  const found = String(match.round || '').match(/\d+/);
  return found ? found[0] : String(fallback + 1);
}

function ensureGroupsInitialized() {
  if (!state.groups) state.groups = {};
  if (!state.groupsConfirmed) state.groupsConfirmed = {};
  GROUP_NAMES.forEach(group => {
    const teams = (TEAMS_BY_GROUP[group] || []).map(t => t.name);
    const current = Array.isArray(state.groups[group]) ? state.groups[group] : [];
    const valid = current.filter(t => teams.includes(t));
    const missing = teams.filter(t => !valid.includes(t));
    state.groups[group] = [...valid, ...missing];
  });
  ensureThirdPlaceRanking();
}

function calculateGroupStandingsFromResults(group) {
  const teams = (TEAMS_BY_GROUP[group] || []).map(t => t.name);
  const matches = getGroupMatchList(group);
  const stats = {};
  teams.forEach(t => {
    stats[t] = { team: t, pts: 0, gf: 0, ga: 0, gd: 0, played: 0, wins: 0, draws: 0, losses: 0 };
  });
  matches.forEach(m => {
    const result = state.groupMatchResults[m.key];
    if (!result) return;
    const g1 = Number(result.team1Goals);
    const g2 = Number(result.team2Goals);
    if (isNaN(g1) || isNaN(g2)) return;
    const t1 = m.team1;
    const t2 = m.team2;
    stats[t1].played++;
    stats[t2].played++;
    stats[t1].gf += g1;
    stats[t1].ga += g2;
    stats[t2].gf += g2;
    stats[t2].ga += g1;
    if (g1 > g2) {
      stats[t1].pts += 3; stats[t1].wins++; stats[t2].losses++;
    } else if (g1 < g2) {
      stats[t2].pts += 3; stats[t2].wins++; stats[t1].losses++;
    } else {
      stats[t1].pts += 1; stats[t2].pts += 1;
      stats[t1].draws++; stats[t2].draws++;
    }
  });
  teams.forEach(t => { stats[t].gd = stats[t].gf - stats[t].ga; });
  return teams.map(t => stats[t]).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return getTeamFifaRank(a.team) - getTeamFifaRank(b.team);
  });
}

function calculateGroupStandings(group) {
  ensureGroupsInitialized();
  const matches = getGroupMatchList(group);
  const hasResults = matches.some(m => {
    const r = state.groupMatchResults[m.key];
    return r && !isNaN(Number(r.team1Goals)) && !isNaN(Number(r.team2Goals));
  });
  if (hasResults) {
    const fromResults = calculateGroupStandingsFromResults(group);
    state.groups[group] = fromResults.map(s => s.team);
    return fromResults.map((s, idx) => ({
      team: s.team, index: idx, pts: s.pts, gf: s.gf, ga: s.ga, gd: s.gd,
      played: s.played, wins: s.wins
    }));
  }
  const order = state.groups[group] || (TEAMS_BY_GROUP[group] || []).map(t => t.name);
  return order.map((team, index) => ({
    team, index, pts: 0, gf: 0, ga: 0, gd: 0, played: 0, wins: 0
  }));
}

function isGroupComplete(group) {
  return Boolean(state.groupsConfirmed && state.groupsConfirmed[group]);
}

function moveArrayItem(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function showToast(msg, error) {
  const c = document.getElementById('toastContainer');
  const d = document.createElement('div');
  d.className = error ? 'error-toast' : 'success-toast';
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function showLoading(msg) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingText').textContent = msg || 'Cargando...';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function fireConfetti() {
  const colors = ['#FFD700','#FF6B6B','#4CAF50','#64B5F6','#FF8A65','#BA68C8','#FFF176'];
  const c = document.getElementById('confettiContainer');
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100+'%';
    p.style.width = (6+Math.random()*10)+'px';
    p.style.height = (6+Math.random()*10)+'px';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration = (2+Math.random()*3)+'s';
    p.style.animationDelay = Math.random()*0.5+'s';
    c.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}

function renderGroups() {
  ensureGroupsInitialized();
  const grid = document.getElementById('groupsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const qualifiedThirds = new Set(getQualifiedThirdPlaceTeams());
  GROUP_NAMES.forEach(g => {
    const complete = isGroupComplete(g);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'group-card group-card-clickable' + (complete ? ' group-complete' : ' group-empty');
    card.title = complete ? 'Editar resultados del grupo ' + g : 'Introducir resultados del grupo ' + g;
    const h3 = document.createElement('h3');
    h3.textContent = 'Grupo ' + g;
    card.appendChild(h3);
    const standings = calculateGroupStandings(g);
    standings.forEach((stat, idx) => {
      const team = stat.team;
      const isThird = idx === 2;
      const isFourth = idx === 3;
      const thirdQualified = complete && state.thirdPlaceConfirmed && qualifiedThirds.has(team);
      const eliminated = isFourth || (isThird && complete && state.thirdPlaceConfirmed && !qualifiedThirds.has(team));
      const row = document.createElement('div');
      row.className = 'group-team pos-' + (idx + 1) + (eliminated ? ' eliminated' : '') + (isThird && thirdQualified ? ' qualified-third' : '') + (!complete ? ' group-team-unconfirmed' : '');
      const badge = document.createElement('span');
      badge.className = 'position-badge';
      badge.textContent = idx + 1;
      row.appendChild(badge);
      const flag = document.createElement('span');
      flag.className = 'team-flag ' + getTeamFlagClass(team);
      row.appendChild(flag);
      const name = document.createElement('span');
      name.className = 'team-name';
      name.textContent = team;
      row.appendChild(name);
      if (stat.played > 0) {
        const stats = document.createElement('span');
        stats.className = 'team-stats';
        stats.textContent = stat.pts + 'pts  ' + stat.gf + '-' + stat.ga;
        stats.style.cssText = 'margin-left:auto;font-size:12px;color:#666;';
        row.appendChild(stats);
      }
      card.appendChild(row);
    });
    const hint = document.createElement('div');
    hint.className = 'group-card-hint';
    hint.textContent = complete ? 'Editar resultados' : 'Introducir resultados';
    card.appendChild(hint);
    card.addEventListener('click', () => openGroupResultsModal(g));
    grid.appendChild(card);
  });
}

function renderQuiniela1x2() {
  const container = document.getElementById('quiniela1x2Panel');
  if (!container) return;
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'quiniela1x2-panel';
  const matchesByGroup = {};
  QUINIELA_1X2_MATCHES.forEach(m => {
    if (!matchesByGroup[m.group]) matchesByGroup[m.group] = [];
    matchesByGroup[m.group].push(m);
  });
  Object.keys(matchesByGroup).sort().forEach(g => {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'quiniela-group-header';
    groupHeader.innerHTML = '<h4>Grupo ' + g + '</h4>';
    panel.appendChild(groupHeader);
    matchesByGroup[g].forEach(m => {
      const result = state.groupMatchResults[m.key] || { team1Goals: '', team2Goals: '' };
      const dateLabel = m.date ? formatMatchDate({ date: m.date, time: m.time }) : '';
      const row = document.createElement('div');
      row.className = 'quiniela1x2-row';
      row.dataset.key = m.key;
      row.innerHTML = '<div class="quiniela-match-info"><span class="match-date">' + (dateLabel ? escapeHtml(dateLabel) : '') + '</span></div>' +
        '<div class="quiniela-match-teams">' +
        '<span class="team-flag ' + getTeamFlagClass(m.team1) + '"></span>' +
        '<span class="team-name-input">' + escapeHtml(m.team1) + '</span>' +
        '<div class="score-inputs">' +
        '<input type="number" min="0" max="20" class="score-input team1-goals" value="' + (result.team1Goals !== '' ? result.team1Goals : '') + '" placeholder="0" data-key="' + m.key + '" data-team="1">' +
        '<span class="score-separator">-</span>' +
        '<input type="number" min="0" max="20" class="score-input team2-goals" value="' + (result.team2Goals !== '' ? result.team2Goals : '') + '" placeholder="0" data-key="' + m.key + '" data-team="2">' +
        '</div>' +
        '<span class="team-name-input">' + escapeHtml(m.team2) + '</span>' +
        '<span class="team-flag ' + getTeamFlagClass(m.team2) + '"></span>' +
        '</div>' +
        '<div class="quiniela-1x2-display" id="1x2-' + m.key + '">' + get1x2FromResult(result) + '</div>';
      panel.appendChild(row);
    });
  });
  container.appendChild(panel);
  panel.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const isTeam1 = e.target.dataset.team === '1';
      const val = e.target.value;
      if (!state.groupMatchResults[key]) state.groupMatchResults[key] = { team1Goals: '', team2Goals: '' };
      if (isTeam1) state.groupMatchResults[key].team1Goals = val === '' ? '' : Number(val);
      else state.groupMatchResults[key].team2Goals = val === '' ? '' : Number(val);
      const display = document.getElementById('1x2-' + key);
      if (display) display.textContent = get1x2FromResult(state.groupMatchResults[key]);
      const group = QUINIELA_1X2_MATCHES.find(m => m.key === key)?.group;
      if (group) { renderGroups(); renderBestThirds(); renderThirdPlace(); }
      saveLocalPredictionSoon();
    });
    input.addEventListener('keydown', (e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); });
  });
}

function get1x2FromResult(result) {
  if (!result || result.team1Goals === '' || result.team2Goals === '') return '—';
  const g1 = Number(result.team1Goals);
  const g2 = Number(result.team2Goals);
  if (g1 > g2) return '1';
  if (g1 < g2) return '2';
  return 'X';
}

function openGroupResultsModal(group) {
  if (!LOADED) return;
  const modal = document.getElementById('groupResultsModal');
  const title = document.getElementById('groupResultsModalTitle');
  const body = document.getElementById('groupResultsModalBody');
  const confirmBtn = document.getElementById('groupResultsModalConfirm');
  title.textContent = 'Resultados Grupo ' + group;
  body.innerHTML = '';
  const matches = getGroupMatchList(group);
  const table = document.createElement('div');
  table.className = 'group-results-table';
  matches.forEach((m, idx) => {
    const result = state.groupMatchResults[m.key] || { team1Goals: '', team2Goals: '' };
    const dateLabel = m.date ? formatMatchDate({ date: m.date, time: m.time }) : '';
    const roundLabel = m.round ? 'Jornada ' + getMatchdayNumber(m, idx) : '';
    const row = document.createElement('div');
    row.className = 'group-result-row';
    row.innerHTML = '<div class="result-match-info"><span class="result-match-date">' + escapeHtml(dateLabel) + (roundLabel ? ' &middot; ' + roundLabel : '') + '</span><span class="result-match-ground">' + escapeHtml(m.ground || '') + '</span></div>' +
      '<div class="result-match-teams"><span class="team-flag ' + getTeamFlagClass(m.team1) + '"></span><span class="team-name">' + escapeHtml(m.team1) + '</span>' +
      '<div class="score-inputs"><input type="number" min="0" max="20" class="score-input modal-score-input team1-goals" value="' + (result.team1Goals !== '' ? result.team1Goals : '') + '" placeholder="0" data-key="' + m.key + '" data-team="1"><span class="score-separator">-</span><input type="number" min="0" max="20" class="score-input modal-score-input team2-goals" value="' + (result.team2Goals !== '' ? result.team2Goals : '') + '" placeholder="0" data-key="' + m.key + '" data-team="2"></div>' +
      '<span class="team-name">' + escapeHtml(m.team2) + '</span><span class="team-flag ' + getTeamFlagClass(m.team2) + '"></span></div>';
    table.appendChild(row);
  });
  body.appendChild(table);
  const standingsTitle = document.createElement('h4');
  standingsTitle.className = 'standings-preview-title';
  standingsTitle.textContent = 'Clasificacion (se calcula automaticamente)';
  body.appendChild(standingsTitle);
  const standingsDiv = document.createElement('div');
  standingsDiv.id = 'modalStandingsPreview';
  standingsDiv.className = 'standings-preview';
  body.appendChild(standingsDiv);
  const updateStandingsPreview = () => {
    const standings = calculateGroupStandingsFromResults(group);
    standingsDiv.innerHTML = '';
    standings.forEach((s, idx) => {
      const div = document.createElement('div');
      div.className = 'standings-preview-row pos-' + (idx + 1);
      div.innerHTML = '<span class="position-badge">' + (idx + 1) + '</span><span class="team-flag ' + getTeamFlagClass(s.team) + '"></span><span class="team-name">' + escapeHtml(s.team) + '</span><span class="team-stats">' + s.pts + 'pts  ' + s.gf + '-' + s.ga + '  (' + s.wins + 'V ' + s.draws + 'E ' + s.losses + 'D)</span>';
      standingsDiv.appendChild(div);
    });
  };
  updateStandingsPreview();
  table.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const isTeam1 = e.target.dataset.team === '1';
      const val = e.target.value;
      if (!state.groupMatchResults[key]) state.groupMatchResults[key] = { team1Goals: '', team2Goals: '' };
      if (isTeam1) state.groupMatchResults[key].team1Goals = val === '' ? '' : Number(val);
      else state.groupMatchResults[key].team2Goals = val === '' ? '' : Number(val);
      updateStandingsPreview();
      saveLocalPredictionSoon();
    });
    input.addEventListener('keydown', (e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); });
  });
  confirmBtn.textContent = 'Confirmar grupo';
  confirmBtn.onclick = () => {
    const allFilled = matches.every(m => {
      const r = state.groupMatchResults[m.key];
      return r && r.team1Goals !== '' && r.team2Goals !== '';
    });
    if (!allFilled) { showToast('Completa todos los resultados del grupo antes de confirmar', true); return; }
    state.groupsConfirmed[group] = true;
    const standings = calculateGroupStandingsFromResults(group);
    state.groups[group] = standings.map(s => s.team);
    ensureThirdPlaceRanking();
    buildTPAllocation();
    computeMatchTeams();
    renderGroups(); renderBestThirds(); renderThirdPlace(); renderKnockout(); renderQuiniela1x2();
    saveLocalPredictionSoon();
    closeModal('groupResultsModal');
    showToast('Grupo ' + group + ' confirmado');
    if (GROUP_NAMES.every(g => state.groupsConfirmed[g])) {
      setTimeout(() => showToast('Fase de grupos completada! Ahora completa la fase de eliminatorias.'), 500);
    }
  };
  modal.style.display = 'flex';
}

function openBestThirdsModal() {
  if (!LOADED) return;
  const modal = document.getElementById('bestThirdsModal');
  const body = document.getElementById('bestThirdsModalBody');
  const confirmBtn = document.getElementById('bestThirdsModalConfirm');
  body.innerHTML = '';
  ensureThirdPlaceRanking();
  const candidates = getAllThirdPlaceCandidates();
  const validSet = new Set(candidates.map(c => c.team));
  const existing = (state.thirdPlace || []).filter(team => validSet.has(team));
  const existingSet = new Set(existing);
  const missing = candidates.filter(item => !existingSet.has(item.team)).sort(compareBestThirdsByRanking).map(item => item.team);
  const all = [...existing, ...missing];
  const list = document.createElement('div');
  list.className = 'best-thirds-list';
  all.forEach((team, index) => {
    const item = document.createElement('div');
    item.className = 'best-third-item';
    item.draggable = true;
    item.dataset.team = team;
    item.innerHTML = '<span class="drag-handle">&#8942;&#8942;</span><span class="position-badge">' + (index + 1) + '</span><span class="team-flag ' + getTeamFlagClass(team) + '"></span><span class="team-name">' + escapeHtml(team) + '</span><span class="group-label">Grupo ' + findTeamGroup(team) + '</span>';
    item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', index); item.classList.add('dragging'); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => e.preventDefault());
    item.addEventListener('drop', e => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const to = index;
      const reordered = moveArrayItem(all, from, to);
      state.thirdPlace = reordered;
      renderBestThirds();
      openBestThirdsModal();
      saveLocalPredictionSoon();
    });
    list.appendChild(item);
  });
  body.appendChild(list);
  confirmBtn.textContent = 'Confirmar mejores terceros';
  confirmBtn.onclick = () => {
    state.thirdPlaceConfirmed = true;
    buildTPAllocation();
    computeMatchTeams();
    renderGroups(); renderThirdPlace(); renderKnockout();
    saveLocalPredictionSoon();
    closeModal('bestThirdsModal');
    showToast('Mejores terceros confirmados');
  };
  modal.style.display = 'flex';
}

function renderBestThirds() {
  const container = document.getElementById('bestThirdsPanel');
  if (!container) return;
  container.innerHTML = '';
  const candidates = getAllThirdPlaceCandidates();
  if (!candidates.length) return;
  ensureThirdPlaceRanking();
  const qualified = getQualifiedThirdPlaceTeams();
  const qualifiedSet = new Set(qualified);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'best-thirds-card' + (state.thirdPlaceConfirmed ? ' best-thirds-complete' : ' best-thirds-empty');
  card.title = state.thirdPlaceConfirmed ? 'Editar mejores terceros' : 'Ordenar mejores terceros';
  const h3 = document.createElement('h3');
  h3.textContent = 'Mejores Terceros';
  card.appendChild(h3);
  const all = state.thirdPlace || [];
  all.forEach((team, index) => {
    const isQualified = qualifiedSet.has(team);
    const row = document.createElement('div');
    row.className = 'best-third-row' + (isQualified ? ' best-third-qualified' : ' best-third-eliminated');
    const badge = document.createElement('span');
    badge.className = 'position-badge';
    badge.textContent = index + 1;
    row.appendChild(badge);
    const flag = document.createElement('span');
    flag.className = 'team-flag ' + getTeamFlagClass(team);
    row.appendChild(flag);
    const name = document.createElement('span');
    name.className = 'team-name';
    name.textContent = team;
    row.appendChild(name);
    const groupLabel = document.createElement('span');
    groupLabel.className = 'group-label';
    groupLabel.textContent = 'Grupo ' + findTeamGroup(team);
    row.appendChild(groupLabel);
    card.appendChild(row);
  });
  const hint = document.createElement('div');
  hint.className = 'best-thirds-hint';
  hint.textContent = state.thirdPlaceConfirmed ? 'Editar' : 'Ordenar';
  card.appendChild(hint);
  card.addEventListener('click', openBestThirdsModal);
  container.appendChild(card);
}

function renderThirdPlace() {
  const container = document.getElementById('thirdPlacePanel');
  if (!container) return;
  container.innerHTML = '';
  const candidates = getAllThirdPlaceCandidates();
  if (!candidates.length) return;
  ensureThirdPlaceRanking();
  const qualified = getQualifiedThirdPlaceTeams();
  const qualifiedSet = new Set(qualified);
  const grid = document.createElement('div');
  grid.className = 'third-place-grid';
  candidates.forEach(item => {
    const team = item.team;
    const isQualified = qualifiedSet.has(team);
    const div = document.createElement('div');
    div.className = 'third-place-item' + (isQualified ? ' third-place-qualified' : ' third-place-eliminated');
    div.innerHTML = '<span class="team-flag ' + getTeamFlagClass(team) + '"></span><span class="team-name">' + escapeHtml(team) + '</span><span class="group-label">' + item.group + '</span>';
    grid.appendChild(div);
  });
  container.appendChild(grid);
}

function computeMatchTeams() {
  state.matchTeams = {};
  const rounds = ['round32','round16','quarterfinals','semifinals','thirdPlace','final'];
  rounds.forEach(round => {
    (KO_TREE[round] || []).forEach(match => {
      const t1 = resolveSlot(match.slot1, match.num);
      const t2 = resolveSlot(match.slot2, match.num);
      state.matchTeams[match.num] = { team1: t1, team2: t2 };
    });
  });
}

function resolveSlot(slot, matchNum) {
  if (!slot) return null;
  if (slot.type === 'winner') return (state.groups[slot.group] || [])[0] || null;
  if (slot.type === 'runner_up') return (state.groups[slot.group] || [])[1] || null;
  if (slot.type === 'third_place') return tpAllocation[matchNum] || null;
  if (slot.type === 'winner_of') return state.knockoutResults[slot.matchNum] || null;
  if (slot.type === 'loser_of') {
    const winner = state.knockoutResults[slot.matchNum];
    const teams = state.matchTeams[slot.matchNum] || {};
    if (winner && teams.team1 && teams.team2) return winner === teams.team1 ? teams.team2 : teams.team1;
    return null;
  }
  return null;
}

function getMatchWinner(matchNum) { return state.knockoutResults[matchNum] || null; }

function getMatchLoser(matchNum) {
  const winner = getMatchWinner(matchNum);
  const teams = state.matchTeams[matchNum] || {};
  if (winner && teams.team1 && teams.team2) return winner === teams.team1 ? teams.team2 : teams.team1;
  return null;
}

function getTeamRound(team) {
  if (!team) return null;
  if (state.knockoutResults[104] === team) return 'champion';
  if (state.knockoutResults[103] === team) return 'thirdPlace';
  const loser103 = getMatchLoser(103);
  if (loser103 === team) return 'fourthPlace';
  const loser101 = getMatchLoser(101);
  const loser102 = getMatchLoser(102);
  if (loser101 === team || loser102 === team) return 'semifinals';
  const losersQF = [97,98,99,100].map(getMatchLoser).filter(Boolean);
  if (losersQF.includes(team)) return 'quarterfinals';
  const losersR16 = [89,90,91,92,93,94,95,96].map(getMatchLoser).filter(Boolean);
  if (losersR16.includes(team)) return 'round16';
  const losersR32 = [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88].map(getMatchLoser).filter(Boolean);
  if (losersR32.includes(team)) return 'round32';
  return null;
}

function renderKnockout() {
  if (!LOADED) return;
  const container = document.getElementById('bracketContainer');
  if (!container) return;
  container.innerHTML = '';
  computeMatchTeams();
  const roundNames = {
    round32: 'Dieciseisavos de final', round16: 'Octavos de final',
    quarterfinals: 'Cuartos de final', semifinals: 'Semifinales',
    thirdPlace: 'Tercer puesto', final: 'Final'
  };
  const roundOrder = ['round32', 'round16', 'quarterfinals', 'semifinals', 'thirdPlace', 'final'];
  roundOrder.forEach(round => {
    const matches = KO_TREE[round] || [];
    if (!matches.length) return;
    const section = document.createElement('div');
    section.className = 'knockout-round';
    const title = document.createElement('h3');
    title.textContent = roundNames[round];
    section.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'knockout-grid';
    matches.forEach(match => {
      const teams = state.matchTeams[match.num] || {};
      const t1 = teams.team1;
      const t2 = teams.team2;
      const winner = state.knockoutResults[match.num];
      const complete = Boolean(winner);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'knockout-match' + (complete ? ' match-complete' : ' match-empty');
      card.title = complete ? 'Editar resultado' : 'Seleccionar ganador';
      card.dataset.matchNum = match.num;
      [t1, t2].forEach((team, idx) => {
        const isWinner = winner === team;
        const row = document.createElement('div');
        row.className = 'knockout-team' + (isWinner ? ' winner' : '') + (!team ? ' team-placeholder' : '');
        const flag = document.createElement('span');
        flag.className = 'team-flag ' + getTeamFlagClass(team);
        row.appendChild(flag);
        const name = document.createElement('span');
        name.className = 'team-name';
        name.textContent = team || 'Por determinar';
        row.appendChild(name);
        if (isWinner) {
          const check = document.createElement('span');
          check.className = 'winner-check';
          check.textContent = '✓';
          row.appendChild(check);
        }
        card.appendChild(row);
      });
      const hint = document.createElement('div');
      hint.className = 'knockout-match-hint';
      hint.textContent = complete ? 'Editar' : 'Elegir ganador';
      card.appendChild(hint);
      card.addEventListener('click', () => openKnockoutMatchModal(match.num, round));
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });
}

function openKnockoutMatchModal(matchNum, round) {
  if (!LOADED) return;
  const modal = document.getElementById('knockoutMatchModal');
  const title = document.getElementById('knockoutMatchModalTitle');
  const body = document.getElementById('knockoutMatchModalBody');
  const confirmBtn = document.getElementById('knockoutMatchModalConfirm');
  computeMatchTeams();
  const teams = state.matchTeams[matchNum] || {};
  const t1 = teams.team1;
  const t2 = teams.team2;
  if (!t1 || !t2) { showToast('Este partido aun no tiene equipos definidos. Completa las fases anteriores.', true); return; }
  const roundNames = { round32: 'Dieciseisavos de final', round16: 'Octavos de final', quarterfinals: 'Cuartos de final', semifinals: 'Semifinal', thirdPlace: 'Partido por el tercer puesto', final: 'Final' };
  title.textContent = roundNames[round] || 'Partido de eliminatoria';
  body.innerHTML = '';
  const currentWinner = state.knockoutResults[matchNum];
  [t1, t2].forEach(team => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'knockout-team-select' + (currentWinner === team ? ' selected' : '');
    btn.innerHTML = '<span class="team-flag ' + getTeamFlagClass(team) + '"></span><span class="team-name">' + escapeHtml(team) + '</span>';
    btn.addEventListener('click', () => {
      state.knockoutResults[matchNum] = team;
      renderKnockout();
      saveLocalPredictionSoon();
      closeModal('knockoutMatchModal');
      showToast(team + ' avanza');
    });
    body.appendChild(btn);
  });
  confirmBtn.textContent = 'Cerrar';
  confirmBtn.onclick = () => closeModal('knockoutMatchModal');
  modal.style.display = 'flex';
}

function calculatePlayerScore(player, real) {
  let score = 0;
  const details = [];
  // Fase de grupos - posiciones
  GROUP_NAMES.forEach(group => {
    const predicted = player.groups?.[group] || [];
    const realOrder = real.groups?.[group] || [];
    for (let i = 0; i < 4; i++) {
      if (predicted[i] && realOrder[i] && predicted[i] === realOrder[i]) {
        score += puntuaciones.grupos.posicion.primero;
        details.push({ type: 'posicion', group, position: i + 1, team: predicted[i], points: 5 });
      }
    }
  });
  // Resultados exactos y 1X2
  QUINIELA_1X2_MATCHES.forEach(m => {
    const predicted = player.groupMatchResults?.[m.key];
    const realResult = real.groupMatchResults?.[m.key];
    if (!predicted || !realResult) return;
    const pG1 = Number(predicted.team1Goals);
    const pG2 = Number(predicted.team2Goals);
    const rG1 = Number(realResult.team1Goals);
    const rG2 = Number(realResult.team2Goals);
    if (isNaN(pG1) || isNaN(pG2) || isNaN(rG1) || isNaN(rG2)) return;
    if (pG1 === rG1 && pG2 === rG2) {
      score += puntuaciones.grupos.resultadoExacto;
      details.push({ type: 'resultadoExacto', matchKey: m.key, team1: m.team1, team2: m.team2, points: 5 });
    }
    const p1x2 = get1x2FromResult(predicted);
    const r1x2 = get1x2FromResult(realResult);
    if (p1x2 === r1x2) {
      score += puntuaciones.grupos.quiniela1x2;
      details.push({ type: '1x2', matchKey: m.key, team1: m.team1, team2: m.team2, points: 1 });
    }
  });
  // Mejores terceros
  if (player.thirdPlace && real.thirdPlace) {
    const predictedSet = new Set(player.thirdPlace.slice(0, 8));
    const realSet = new Set(real.thirdPlace.slice(0, 8));
    predictedSet.forEach(team => {
      if (realSet.has(team)) {
        score += puntuaciones.grupos.mejorTercero;
        details.push({ type: 'mejorTercero', team, points: puntuaciones.grupos.mejorTercero });
      }
    });
  }
  // Eliminatorias
  const roundPoints = {
    round32: 3, round16: 5, quarterfinals: 10, semifinals: 20,
    finalist: 30, champion: 50, thirdPlace: 20, fourthPlace: 20
  };
  const allTeams = new Set();
  GROUP_NAMES.forEach(g => { (player.groups?.[g] || []).forEach(t => allTeams.add(t)); });
  (player.thirdPlace || []).forEach(t => allTeams.add(t));
  allTeams.forEach(team => {
    const predRound = getTeamRoundFromPlayer(team, player);
    const realRound = getTeamRoundFromPlayer(team, real);
    if (predRound && realRound && predRound === realRound) {
      const pts = roundPoints[predRound] || 0;
      if (pts > 0) { score += pts; details.push({ type: 'eliminatoria', team, round: predRound, points: pts }); }
    }
  });
  return { score, details };
}

function getTeamRoundFromPlayer(team, player) {
  if (!team || !player) return null;
  const kr = {};
  if (player.knockout?.matches) {
    Object.values(player.knockout.matches).flat().forEach(m => { if (m?.match && m?.winner) kr[m.match] = m.winner; });
  }
  const mt = {};
  const rounds = ['round32','round16','quarterfinals','semifinals','thirdPlace','final'];
  const tpAlloc = {};
  const candidates = GROUP_NAMES.map(g => ({ group: g, team: player.groups?.[g]?.[2] || null })).filter(c => c.team);
  const qualified = (player.thirdPlace || []).slice(0, 8);
  const byGroup = {};
  qualified.forEach(t => { const g = candidates.find(c => c.team === t)?.group; if (g) byGroup[g] = t; });
  if (Object.keys(byGroup).length === 8) {
    const groups = Object.keys(byGroup).sort();
    const key = groups.join("");
    const order = TP_TABLE[key];
    if (order) {
      TP_COLUMNS.forEach((mn, idx) => {
        const g = String(order[idx]).replace(/^3/, "");
        tpAlloc[mn] = byGroup[g] || null;
      });
    }
  }
  rounds.forEach(round => {
    (KO_TREE?.[round] || []).forEach(match => {
      const t1 = resolveSlotFromPlayer(match.slot1, match.num, player, kr, tpAlloc);
      const t2 = resolveSlotFromPlayer(match.slot2, match.num, player, kr, tpAlloc);
      mt[match.num] = { team1: t1, team2: t2 };
    });
  });
  if (kr[104] === team) return 'champion';
  if (kr[103] === team) return 'thirdPlace';
  const loser103 = getMatchLoserFromData(103, kr, mt);
  if (loser103 === team) return 'fourthPlace';
  const loser101 = getMatchLoserFromData(101, kr, mt);
  const loser102 = getMatchLoserFromData(102, kr, mt);
  if (loser101 === team || loser102 === team) return 'semifinals';
  const losersQF = [97,98,99,100].map(n => getMatchLoserFromData(n, kr, mt)).filter(Boolean);
  if (losersQF.includes(team)) return 'quarterfinals';
  const losersR16 = [89,90,91,92,93,94,95,96].map(n => getMatchLoserFromData(n, kr, mt)).filter(Boolean);
  if (losersR16.includes(team)) return 'round16';
  const losersR32 = [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88].map(n => getMatchLoserFromData(n, kr, mt)).filter(Boolean);
  if (losersR32.includes(team)) return 'round32';
  return null;
}

function resolveSlotFromPlayer(slot, matchNum, player, kr, tpAlloc) {
  if (!slot) return null;
  if (slot.type === 'winner') return (player.groups?.[slot.group] || [])[0] || null;
  if (slot.type === 'runner_up') return (player.groups?.[slot.group] || [])[1] || null;
  if (slot.type === 'third_place') return tpAlloc[matchNum] || null;
  if (slot.type === 'winner_of') return kr[slot.matchNum] || null;
  if (slot.type === 'loser_of') {
    const winner = kr[slot.matchNum];
    const mt = {};
    const rounds = ['round32','round16','quarterfinals','semifinals','thirdPlace','final'];
    rounds.forEach(round => {
      (KO_TREE?.[round] || []).forEach(match => {
        const candidates = GROUP_NAMES.map(g => ({ group: g, team: player.groups?.[g]?.[2] || null })).filter(c => c.team);
        const qualified = (player.thirdPlace || []).slice(0, 8);
        const byGroup = {};
        qualified.forEach(t => { const g = candidates.find(c => c.team === t)?.group; if (g) byGroup[g] = t; });
        const tpA = {};
        if (Object.keys(byGroup).length === 8) {
          const groups = Object.keys(byGroup).sort();
          const key = groups.join("");
          const order = TP_TABLE[key];
          if (order) {
            TP_COLUMNS.forEach((mn, idx) => {
              const g = String(order[idx]).replace(/^3/, "");
              tpA[mn] = byGroup[g] || null;
            });
          }
        }
        mt[match.num] = {
          team1: resolveSlotFromPlayer(match.slot1, match.num, player, kr, tpA),
          team2: resolveSlotFromPlayer(match.slot2, match.num, player, kr, tpA)
        };
      });
    });
    const teams = mt[slot.matchNum] || {};
    if (winner && teams.team1 && teams.team2) return winner === teams.team1 ? teams.team2 : teams.team1;
    return null;
  }
  return null;
}

function getMatchLoserFromData(matchNum, kr, mt) {
  const winner = kr[matchNum];
  const teams = mt[matchNum] || {};
  if (winner && teams.team1 && teams.team2) return winner === teams.team1 ? teams.team2 : teams.team1;
  return null;
}

function calculateLeaderboard() {
  const players = parseLeaderboardCSV();
  const real = typeof REAL_RESULTS !== 'undefined' ? REAL_RESULTS : {};
  if (!players.length) return [];
  return players.map(player => {
    const result = calculatePlayerScore(player, real);
    return { name: player.name, score: result.score, details: result.details };
  }).sort((a, b) => b.score - a.score);
}

function parseLeaderboardCSV() {
  const csv = window.__leaderboardCSV || '';
  if (!csv) return [];
  const lines = csv.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const nameIdx = headers.indexOf('Nombre') !== -1 ? headers.indexOf('Nombre') : 0;
  const jsonIdx = headers.indexOf('JSON') !== -1 ? headers.indexOf('JSON') : -1;
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    let parsed = {};
    if (jsonIdx >= 0 && cols[jsonIdx]) {
      try { parsed = JSON.parse(cols[jsonIdx]); } catch (e) {}
    }
    return { name: cols[nameIdx] || 'Anonimo', raw: cols, ...parsed };
  });
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;
  const leaderboard = calculateLeaderboard();
  if (!leaderboard.length) {
    container.innerHTML = '<p class="note-text">No hay predicciones enviadas todavia.</p>';
    return;
  }
  const table = document.createElement('div');
  table.className = 'leaderboard-table';
  leaderboard.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (index < 3 ? ' top-' + (index + 1) : '');
    row.innerHTML = '<span class="leaderboard-rank">' + (index + 1) + '</span>' +
      '<span class="leaderboard-name">' + escapeHtml(entry.name) + '</span>' +
      '<span class="leaderboard-score">' + entry.score + ' pts</span>';
    row.addEventListener('click', () => showPlayerPrediction(entry));
    table.appendChild(row);
  });
  container.innerHTML = '';
  container.appendChild(table);
}

function showPlayerPrediction(entry) {
  const modal = document.getElementById('predictionModal');
  const title = document.getElementById('predictionModalTitle');
  const viewer = document.getElementById('predictionViewer');
  title.textContent = 'Prediccion de ' + escapeHtml(entry.name);
  viewer.innerHTML = '<p class="note-text">Puntuacion: ' + entry.score + ' puntos</p>';
  // Mostrar detalles de puntuacion
  if (entry.details && entry.details.length) {
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'scoring-details';
    const grouped = {};
    entry.details.forEach(d => {
      if (!grouped[d.type]) grouped[d.type] = [];
      grouped[d.type].push(d);
    });
    Object.keys(grouped).forEach(type => {
      const items = grouped[type];
      const total = items.reduce((sum, i) => sum + i.points, 0);
      const typeLabel = {
        posicion: 'Posiciones en grupo',
        resultadoExacto: 'Resultados exactos',
        '1x2': '1X2 acertados',
        mejorTercero: 'Mejores terceros',
        eliminatoria: 'Eliminatorias'
      }[type] || type;
      const section = document.createElement('div');
      section.className = 'scoring-detail-section';
      section.innerHTML = '<h4>' + typeLabel + ' (' + items.length + ' aciertos, ' + total + ' pts)</h4>';
      const list = document.createElement('div');
      list.className = 'scoring-detail-list';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'scoring-detail-item';
        if (item.team) div.textContent = '+ ' + item.points + ' pts - ' + item.team;
        else if (item.team1 && item.team2) div.textContent = '+ ' + item.points + ' pts - ' + item.team1 + ' vs ' + item.team2;
        else div.textContent = '+ ' + item.points + ' pts';
        list.appendChild(div);
      });
      section.appendChild(list);
      detailsDiv.appendChild(section);
    });
    viewer.appendChild(detailsDiv);
  }
  modal.style.display = 'flex';
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
      if (tabId === 'ranking') renderLeaderboard();
    });
  });
}

// ---- Submit / Reset ----
function buildPayload() {
  const knockoutMatches = {};
  const rounds = ['round32','round16','quarterfinals','semifinals','thirdPlace','final'];
  rounds.forEach(round => {
    knockoutMatches[round] = (KO_TREE[round] || []).map(match => {
      const teams = state.matchTeams[match.num] || {};
      return { match: match.num, team1: teams.team1 || null, team2: teams.team2 || null, winner: state.knockoutResults[match.num] || null };
    });
  });
  return {
    groups: state.groups, groupsConfirmed: state.groupsConfirmed,
    thirdPlace: state.thirdPlace, thirdPlaceConfirmed: state.thirdPlaceConfirmed,
    groupMatchResults: state.groupMatchResults,
    knockout: { matches: knockoutMatches }
  };
}

function submitPrediction() {
  if (!LOADED) { showToast('Los datos del torneo aun no se han cargado. Espera un momento.', true); return; }
  const incompleteGroups = GROUP_NAMES.filter(g => !state.groupsConfirmed[g]);
  if (incompleteGroups.length) { showToast('Completa todos los grupos antes de enviar.', true); return; }
  if (!state.thirdPlaceConfirmed) { showToast('Confirma los mejores terceros antes de enviar.', true); return; }
  const missingKO = [];
  const rounds = ['round32','round16','quarterfinals','semifinals','thirdPlace','final'];
  rounds.forEach(round => {
    (KO_TREE[round] || []).forEach(match => {
      const teams = state.matchTeams[match.num] || {};
      if (teams.team1 && teams.team2 && !state.knockoutResults[match.num]) missingKO.push(match.num);
    });
  });
  if (missingKO.length) { showToast('Completa todos los partidos de eliminatoria antes de enviar.', true); return; }
  const payload = buildPayload();
  const json = JSON.stringify(payload);
  if (json.length > 1950) { showToast('La prediccion es demasiado larga. Contacta al administrador.', true); return; }
  document.getElementById('nameModal').style.display = 'flex';
}

function confirmSubmitWithName() {
  const nameInput = document.getElementById('playerNameInput');
  const name = nameInput.value.trim();
  if (!name) { showToast('Introduce tu nombre antes de enviar.', true); return; }
  const payload = buildPayload();
  payload.name = name;
  const json = JSON.stringify(payload);
  const url = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/formResponse?' + ENTRY_ID + '=' + encodeURIComponent(json);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  clearLocalPrediction();
  showToast('Prediccion enviada! Gracias por participar, ' + name + '.');
  fireConfetti();
  document.getElementById('nameModal').style.display = 'none';
  nameInput.value = '';
  setTimeout(() => iframe.remove(), 5000);
}

function resetAll() {
  if (!confirm('Seguro que quieres borrar toda tu prediccion? Esta accion no se puede deshacer.')) return;
  state = {
    groups: {}, groupsConfirmed: {}, thirdPlace: [], thirdPlaceConfirmed: false,
    groupMatchResults: {}, knockoutResults: {}, matchTeams: {}
  };
  GROUP_NAMES.forEach(g => {
    state.groups[g] = TEAMS_BY_GROUP[g].map(t => t.name);
  });
  clearLocalPrediction();
  renderGroups(); renderBestThirds(); renderThirdPlace(); renderKnockout(); renderQuiniela1x2();
  showToast('Prediccion reiniciada.');
}

// ---- Helpers ----
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function loadLeaderboardCSV() {
  try {
    const resp = await fetch(LEADERBOARD_CSV_URL + '&_=' + Date.now());
    const csv = await resp.text();
    window.__leaderboardCSV = csv;
    return csv;
  } catch (e) { console.warn('Could not load leaderboard CSV:', e); return ''; }
}

// ---- Init ----
async function init() {
  showLoading('Cargando datos del Mundial 2026...');
  const loaded = await loadData();
  if (!loaded) { hideLoading(); return; }
  await loadLeaderboardCSV();
  try {
    const savedVersion = localStorage.getItem(LOCAL_STORAGE_VERSION_KEY);
    if (savedVersion !== LOCAL_STORAGE_VERSION) {
      clearLocalPrediction();
      localStorage.setItem(LOCAL_STORAGE_VERSION_KEY, LOCAL_STORAGE_VERSION);
    }
  } catch (e) {}
  restoreLocalPrediction();
  renderGroups(); renderBestThirds(); renderThirdPlace(); renderKnockout(); renderQuiniela1x2();
  updateCountdowns();
  setInterval(updateCountdowns, 1000);
  initTabs();
  hideLoading();
  if (isSubmissionClosed()) showToast('El plazo de envio de predicciones ha cerrado.', true);
}

// ---- Event Listeners ----
document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('btnSubmit').addEventListener('click', submitPrediction);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('confirmNameSubmit').addEventListener('click', confirmSubmitWithName);
  document.getElementById('cancelNameSubmit').addEventListener('click', () => {
    document.getElementById('nameModal').style.display = 'none';
    document.getElementById('playerNameInput').value = '';
  });
  document.getElementById('closePredictionModal').addEventListener('click', () => {
    document.getElementById('predictionModal').style.display = 'none';
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => { const modal = btn.closest('.modal'); if (modal) modal.style.display = 'none'; });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  });
});
