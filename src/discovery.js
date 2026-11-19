// First-time pickups: tells which never-seen weapon (or the tank) is coming up on the road.
export const ANNOUNCE_DISTANCE = 32;

const pickupOf = (reward) => (reward.kind === 'weapon' ? reward.weapon : reward.kind === 'tank' ? 'tank' : null);

export function newPickupAhead(game, seen) {
  for (const b of game.barrels) {
    if (!b.alive) continue;
    const id = pickupOf(b.reward);
    if (!id || seen.includes(id)) continue;
    const ahead = b.z - game.squad.z;
    if (ahead >= 0 && ahead <= ANNOUNCE_DISTANCE) return id;
  }
  return null;
}
