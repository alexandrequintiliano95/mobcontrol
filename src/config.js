// Tunable game constants. Simulation units: x is lateral, z is forward distance.
export const ROAD_HALF = 4.4;
export const SQUAD_SPEED = 7;
export const STEER_SPEED = 20;
export const SOLDIER_RADIUS = 0.28;
export const SOLDIER_FOLLOW = 10;
export const FORMATION_SPACING = 0.62;
export const MAX_SOLDIERS = 300;
export const BULLET_SPEED = 34;
export const BULLET_RANGE = 30;
export const BARREL_RADIUS = 0.75;
export const GATE_PER_DAMAGE = 1;
export const GATE_MAX = 30;
export const GATE_FULL_SQUAD = 6;
export const RECRUIT_SPEED = 12;
export const ZOMBIE_ACTIVATE_DIST = Infinity; // zombies march from the start
export const ZOMBIE_HOMING = 0;
export const BOSS_GAP = 24;
export const DRAG_GAIN = 2;
export const KEY_SPEED = 9;
// Every KILL_REWARD zombies shot down, one soldier joins the squad.
export const KILL_REWARD = 20;

export const WEAPONS = {
  rifle: { label: 'Fuzil', damage: 1, rate: 3, pierce: 1, splash: 0 },
  smg: { label: 'Metralhadora', damage: 0.75, rate: 6, pierce: 1, splash: 0 },
  sniper: { label: 'Sniper', damage: 6, rate: 0.9, pierce: 4, splash: 0, range: 27 },
  bazooka: { label: 'Bazuca', damage: 7, rate: 0.9, pierce: 1, splash: 1.6, range: 25 },
  ak47: { label: 'AK-47', damage: 1.6, rate: 7, pierce: 2, splash: 0, range: 27 },
  minigun: { label: 'Minigun', damage: 1.2, rate: 14, pierce: 1, splash: 0, range: 25 },
};
export const WEAPON_ORDER = ['rifle', 'smg', 'sniper', 'bazooka', 'ak47', 'minigun'];
// The tank is an allied unit (one per operation), not a weapon. Zombies run faster while it is around.
export const TANK = { hp: 25, damage: 30, rate: 1.2, splash: 2.6, radius: 0.9, zombieSpeedup: 1.6, fromLevel: 30 };

export const ZOMBIES = {
  walker: { hp: 3, speed: 1.6, radius: 0.35, kills: 1 },
  runner: { hp: 1.5, speed: 3.6, radius: 0.3, kills: 1 },
  brute: { hp: 14, speed: 1.1, radius: 0.6, kills: 4 },
  shield: { hp: 3, shield: 10, speed: 1.3, radius: 0.4, kills: 1 },
  bomber: { hp: 2, speed: 2.4, radius: 0.35, kills: 0, blast: 1.4 },
  fatty: { hp: 12, speed: 0.9, radius: 0.55, kills: 2, splits: 4 },
  mini: { hp: 1, speed: 3.2, radius: 0.25, kills: 1 },
};
export const BOSS_KINDS = ['brute', 'summoner', 'charger'];

export const BOSS = { radius: 1.6, speed: 2.4, killRate: 8, reach: 0.8, retreat: 10, advance: 4, stepSpeed: 9, chase: 2, minSeconds: 6, summonEvery: 2.5, summonCount: 3, chargerSpeed: 3.6 };
// From operation 50 on the boss walks in faster, chases harder and punches faster.
export const BOSS_LATE = { fromLevel: 50, speed: 4, chargerSpeed: 6, chase: 4, killRate: 10, lossShare: 0.5, efficiency: 0.35 };
