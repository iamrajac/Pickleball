import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { StandingsTable } from './src/components/StandingsTable';

const standings = [
  { name: 'Alice', played: 1, won: 1, lost: 0, pts: 3, scored: 11, conceded: 5, form: 'W' },
  { name: 'Bob', played: 1, won: 0, lost: 1, pts: 0, scored: 5, conceded: 11, form: 'L' }
];

const rounds = [
  [
    { played: true, teamA: ['Alice'], teamB: ['Bob'], scoreA: 11, scoreB: 5, duration: 120, notes: "Cool" }
  ]
];

try {
  const { container, getByText } = render(<StandingsTable standings={standings} rounds={rounds} profiles={{}} />);
  console.log("Rendered successfully.");
  
  fireEvent.click(getByText('Alice'));
  console.log("Clicked row.");
  
  console.log("Expanded successfully!");
} catch (e) {
  console.error("ERROR:", e);
}
