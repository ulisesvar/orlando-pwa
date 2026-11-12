// Valida src/data/trip.json e itineraries.json con el mismo validador que usa la app. Uso: npm run validate:data
import { readFileSync } from 'node:fs';
import { validateTrip, ValidationError } from '../src/js/validate.js';
import { validateItineraries } from '../src/js/itinerary.js';

try {
  validateTrip(JSON.parse(readFileSync('src/data/trip.json', 'utf8')));
  console.log('trip.json válido');
  validateItineraries(JSON.parse(readFileSync('src/data/itineraries.json', 'utf8')));
  console.log('itineraries.json válido');
} catch (e) {
  console.error(e instanceof ValidationError ? e.errors.join('\n') : e.message);
  process.exit(1);
}
