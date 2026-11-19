// Tunable game constants. Simulation units: x is lateral, z is forward distance.
export const ROAD_HALF = 3.6;
export const SQUAD_SPEED = 7;
export const STEER_SPEED = 20;
export const SOLDIER_RADIUS = 0.28;
export const SOLDIER_FOLLOW = 10;
export const FORMATION_SPACING = 0.62;
export const MAX_SOLDIERS = 300;
export const BULLET_SPEED = 34;
export const BULLET_RANGE = 26;
export const BARREL_RADIUS = 0.75;
export const GATE_PER_DAMAGE = 0.25;
export const GATE_MAX = 30;
export const RECRUIT_SPEED = 12;
export const ZOMBIE_ACTIVATE_DIST = 42;
export const ZOMBIE_HOMING = 0.5;
export const BOSS_GAP = 24;
export const DRAG_GAIN = 2;
export const KEY_SPEED = 9;

export const WEAPONS = {
  rifle: { label: 'Fuzil', damage: 1, rate: 3, pierce: 1, splash: 0 },
  smg: { label: 'Metralhadora', damage: 0.75, rate: 6, pierce: 1, splash: 0 },
  sniper: { label: 'Sniper', damage: 6, rate: 0.9, pierce: 4, splash: 0 },
  bazooka: { label: 'Bazuca', damage: 7, rate: 0.9, pierce: 1, splash: 1.6 },
};
export const WEAPON_ORDER = ['rifle', 'smg', 'sniper', 'bazooka'];

export const ZOMBIES = {
  walker: { hp: 3, speed: 1.6, radius: 0.35, kills: 1 },
  runner: { hp: 1.5, speed: 3.6, radius: 0.3, kills: 1 },
  brute: { hp: 14, speed: 1.1, radius: 0.6, kills: 4 },
};

export const BOSS = { radius: 1.6, speed: 1.3, killRate: 6, minSeconds: 7 };
