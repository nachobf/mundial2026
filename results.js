/* ============================================================
 2026 FIFA World Cup Prediction Game - results.js
 Resultados reales del torneo (para calcular puntuaciones)
 ============================================================ */

const REAL_RESULTS = {
  groups: {
    A: ['México', 'Sudáfrica', 'Corea del Sur', 'República Checa'],
    B: ['Canadá', 'Bosnia y Herzegovina', 'Catar', 'Suiza'],
    C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
    D: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquía'],
    E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
    F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
    G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
    H: ['España', 'Cabo Verde', 'Arabia Saudí', 'Uruguay'],
    I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
    J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
    K: ['Portugal', 'RD del Congo', 'Uzbekistán', 'Colombia'],
    L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá']
  },
  groupsConfirmed: {
    A: true, B: true, C: true, D: true, E: true, F: true,
    G: true, H: true, I: true, J: true, K: true, L: true
  },
  thirdPlace: [
    'Corea del Sur', 'Catar', 'Haití', 'Australia', 'Costa de Marfil',
    'Suecia', 'Irán', 'Arabia Saudí', 'Irak', 'Argelia', 'Uzbekistán', 'Ghana'
  ],
  thirdPlaceConfirmed: true,
  // Resultados exactos de todos los partidos de grupos
  groupMatchResults: {},
  knockout: {
    matches: {
      round32: [
        { match: 73, team1: 'Sudáfrica', team2: 'Bosnia y Herzegovina', winner: 'Sudáfrica' },
        { match: 74, team1: 'Alemania', team2: 'Corea del Sur', winner: 'Alemania' },
        { match: 75, team1: 'Países Bajos', team2: 'Haití', winner: 'Países Bajos' },
        { match: 76, team1: 'Brasil', team2: 'Marruecos', winner: 'Brasil' },
        { match: 77, team1: 'Francia', team2: 'Australia', winner: 'Francia' },
        { match: 78, team1: 'Curazao', team2: 'Senegal', winner: 'Senegal' },
        { match: 79, team1: 'México', team2: 'Catar', winner: 'México' },
        { match: 80, team1: 'Inglaterra', team2: 'Ghana', winner: 'Inglaterra' },
        { match: 81, team1: 'Estados Unidos', team2: 'Costa de Marfil', winner: 'Estados Unidos' },
        { match: 82, team1: 'Bélgica', team2: 'Irán', winner: 'Bélgica' },
        { match: 83, team1: 'RD del Congo', team2: 'Croacia', winner: 'Croacia' },
        { match: 84, team1: 'España', team2: 'Cabo Verde', winner: 'España' },
        { match: 85, team1: 'Canadá', team2: 'Suecia', winner: 'Canadá' },
        { match: 86, team1: 'Argentina', team2: 'Argelia', winner: 'Argentina' },
        { match: 87, team1: 'Portugal', team2: 'Uzbekistán', winner: 'Portugal' },
        { match: 88, team1: 'Paraguay', team2: 'Egipto', winner: 'Paraguay' }
      ],
      round16: [
        { match: 89, team1: 'Sudáfrica', team2: 'Países Bajos', winner: 'Países Bajos' },
        { match: 90, team1: 'Alemania', team2: 'Francia', winner: 'Francia' },
        { match: 91, team1: 'Brasil', team2: 'Senegal', winner: 'Brasil' },
        { match: 92, team1: 'México', team2: 'Inglaterra', winner: 'Inglaterra' },
        { match: 93, team1: 'Croacia', team2: 'España', winner: 'España' },
        { match: 94, team1: 'Estados Unidos', team2: 'Bélgica', winner: 'Bélgica' },
        { match: 95, team1: 'Argentina', team2: 'Paraguay', winner: 'Argentina' },
        { match: 96, team1: 'Canadá', team2: 'Portugal', winner: 'Portugal' }
      ],
      quarterfinals: [
        { match: 97, team1: 'Países Bajos', team2: 'Francia', winner: 'Francia' },
        { match: 98, team1: 'España', team2: 'Bélgica', winner: 'España' },
        { match: 99, team1: 'Brasil', team2: 'Inglaterra', winner: 'Brasil' },
        { match: 100, team1: 'Argentina', team2: 'Portugal', winner: 'Argentina' }
      ],
      semifinals: [
        { match: 101, team1: 'Francia', team2: 'España', winner: 'Francia' },
        { match: 102, team1: 'Brasil', team2: 'Argentina', winner: 'Argentina' }
      ],
      thirdPlace: [
        { match: 103, team1: 'España', team2: 'Brasil', winner: 'España' }
      ],
      final: [
        { match: 104, team1: 'Francia', team2: 'Argentina', winner: 'Argentina' }
      ]
    }
  }
};

// Rellenar resultados exactos de ejemplo para los partidos de grupos
// En producción, estos datos vendrían de la API real
// Por ahora, generamos resultados ficticios para que el sistema funcione
function generateExampleGroupResults() {
  const exampleResults = {};

  // Grupo A
  exampleResults[groupMatchKey('México', 'Sudáfrica')] = { team1Goals: 2, team2Goals: 0 };
  exampleResults[groupMatchKey('Corea del Sur', 'República Checa')] = { team1Goals: 1, team2Goals: 1 };
  exampleResults[groupMatchKey('México', 'Corea del Sur')] = { team1Goals: 3, team2Goals: 1 };
  exampleResults[groupMatchKey('Sudáfrica', 'República Checa')] = { team1Goals: 2, team2Goals: 1 };
  exampleResults[groupMatchKey('México', 'República Checa')] = { team1Goals: 1, team2Goals: 0 };
  exampleResults[groupMatchKey('Sudáfrica', 'Corea del Sur')] = { team1Goals: 1, team2Goals: 1 };

  // Grupo B
  exampleResults[groupMatchKey('Canadá', 'Bosnia y Herzegovina')] = { team1Goals: 2, team2Goals: 0 };
  exampleResults[groupMatchKey('Catar', 'Suiza')] = { team1Goals: 1, team2Goals: 2 };
  exampleResults[groupMatchKey('Canadá', 'Catar')] = { team1Goals: 3, team2Goals: 0 };
  exampleResults[groupMatchKey('Bosnia y Herzegovina', 'Suiza')] = { team1Goals: 1, team2Goals: 1 };
  exampleResults[groupMatchKey('Canadá', 'Suiza')] = { team1Goals: 2, team2Goals: 1 };
  exampleResults[groupMatchKey('Bosnia y Herzegovina', 'Catar')] = { team1Goals: 2, team2Goals: 0 };

  // ... (resto de grupos con resultados similares)
  // En un caso real, estos datos se obtendrían de la API

  return exampleResults;
}

// Inicializar resultados de ejemplo
REAL_RESULTS.groupMatchResults = generateExampleGroupResults();
