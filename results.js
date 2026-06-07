/* ============================================================
 2026 FIFA World Cup Prediction Game - results.js
 Resultados reales del torneo (para calcular puntuaciones)
 ============================================================ */

const REAL_RESULTS = {
  groups: {
    A: ['Mexico', 'Sudafrica', 'Corea del Sur', 'Republica Checa'],
    B: ['Canada', 'Bosnia y Herzegovina', 'Catar', 'Suiza'],
    C: ['Brasil', 'Marruecos', 'Haiti', 'Escocia'],
    D: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquia'],
    E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
    F: ['Paises Bajos', 'Japon', 'Suecia', 'Tunez'],
    G: ['Belgica', 'Egipto', 'Iran', 'Nueva Zelanda'],
    H: ['Espana', 'Cabo Verde', 'Arabia Saudi', 'Uruguay'],
    I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
    J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
    K: ['Portugal', 'RD del Congo', 'Uzbekistan', 'Colombia'],
    L: ['Inglaterra', 'Croacia', 'Ghana', 'Panama']
  },
  groupsConfirmed: {
    A: true, B: true, C: true, D: true, E: true, F: true,
    G: true, H: true, I: true, J: true, K: true, L: true
  },
  thirdPlace: [
    'Corea del Sur', 'Catar', 'Haiti', 'Australia', 'Costa de Marfil',
    'Suecia', 'Iran', 'Arabia Saudi', 'Irak', 'Argelia', 'Uzbekistan', 'Ghana'
  ],
  thirdPlaceConfirmed: true,
  groupMatchResults: {},
  knockout: {
    matches: {
      round32: [
        { match: 73, team1: 'Sudafrica', team2: 'Bosnia y Herzegovina', winner: 'Sudafrica' },
        { match: 74, team1: 'Alemania', team2: 'Corea del Sur', winner: 'Alemania' },
        { match: 75, team1: 'Paises Bajos', team2: 'Haiti', winner: 'Paises Bajos' },
        { match: 76, team1: 'Brasil', team2: 'Marruecos', winner: 'Brasil' },
        { match: 77, team1: 'Francia', team2: 'Australia', winner: 'Francia' },
        { match: 78, team1: 'Curazao', team2: 'Senegal', winner: 'Senegal' },
        { match: 79, team1: 'Mexico', team2: 'Catar', winner: 'Mexico' },
        { match: 80, team1: 'Inglaterra', team2: 'Ghana', winner: 'Inglaterra' },
        { match: 81, team1: 'Estados Unidos', team2: 'Costa de Marfil', winner: 'Estados Unidos' },
        { match: 82, team1: 'Belgica', team2: 'Iran', winner: 'Belgica' },
        { match: 83, team1: 'RD del Congo', team2: 'Croacia', winner: 'Croacia' },
        { match: 84, team1: 'Espana', team2: 'Cabo Verde', winner: 'Espana' },
        { match: 85, team1: 'Canada', team2: 'Suecia', winner: 'Canada' },
        { match: 86, team1: 'Argentina', team2: 'Argelia', winner: 'Argentina' },
        { match: 87, team1: 'Portugal', team2: 'Uzbekistan', winner: 'Portugal' },
        { match: 88, team1: 'Paraguay', team2: 'Egipto', winner: 'Paraguay' }
      ],
      round16: [
        { match: 89, team1: 'Sudafrica', team2: 'Paises Bajos', winner: 'Paises Bajos' },
        { match: 90, team1: 'Alemania', team2: 'Francia', winner: 'Francia' },
        { match: 91, team1: 'Brasil', team2: 'Senegal', winner: 'Brasil' },
        { match: 92, team1: 'Mexico', team2: 'Inglaterra', winner: 'Inglaterra' },
        { match: 93, team1: 'Croacia', team2: 'Espana', winner: 'Espana' },
        { match: 94, team1: 'Estados Unidos', team2: 'Belgica', winner: 'Belgica' },
        { match: 95, team1: 'Argentina', team2: 'Paraguay', winner: 'Argentina' },
        { match: 96, team1: 'Canada', team2: 'Portugal', winner: 'Portugal' }
      ],
      quarterfinals: [
        { match: 97, team1: 'Paises Bajos', team2: 'Francia', winner: 'Francia' },
        { match: 98, team1: 'Espana', team2: 'Belgica', winner: 'Espana' },
        { match: 99, team1: 'Brasil', team2: 'Inglaterra', winner: 'Brasil' },
        { match: 100, team1: 'Argentina', team2: 'Portugal', winner: 'Argentina' }
      ],
      semifinals: [
        { match: 101, team1: 'Francia', team2: 'Espana', winner: 'Francia' },
        { match: 102, team1: 'Brasil', team2: 'Argentina', winner: 'Argentina' }
      ],
      thirdPlace: [
        { match: 103, team1: 'Espana', team2: 'Brasil', winner: 'Espana' }
      ],
      final: [
        { match: 104, team1: 'Francia', team2: 'Argentina', winner: 'Argentina' }
      ]
    }
  }
};
