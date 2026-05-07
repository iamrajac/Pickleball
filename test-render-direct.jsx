import React from 'react';
import { renderToString } from 'react-dom/server';
import { StandingsTable } from './src/components/StandingsTable.jsx';

const standings = [
  { name: 'Alice', played: 1, won: 1, lost: 0, pts: 3, scored: 11, conceded: 5, form: 'W' },
];

const rounds = [
  [
    { played: true, teamA: ['Alice'], teamB: ['Bob'], scoreA: 11, scoreB: 5, duration: 120, notes: "Cool" }
  ]
];

const profiles = {};

// We need to polyfill useTimer or similar if it's used, but StandingsTable doesn't use hooks? Wait it uses useState.
// Actually renderToString will work for initial render.
// To test expanded state, we can modify StandingsTable source temporarily to expandedRow = 'Alice' for testing!

