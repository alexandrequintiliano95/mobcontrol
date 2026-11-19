import { stepGame } from '../../src/sim.js';

export const emptyLevel = (o = {}) => ({ number: 1, length: 1000, barrels: [], gates: [], zombies: [], boss: { hp: 100 }, ...o });
export function run(game, seconds, input = { targetX: 0 }) { for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(game, 1 / 60, input); }
export const eventsOf = (game, type) => game.events.filter((e) => e.type === type);
