// Test switches in the address (?debug, ?demo, ?level=N, ?soldiers=N). They only work on this computer,
// so players on the published site cannot skip operations or start with a bigger squad.
export function readFlags(loc = location) {
  const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  const params = new URLSearchParams(local ? loc.search : '');
  const level = Math.floor(Number(params.get('level')));
  return {
    debug: params.has('debug'),
    demo: params.has('demo'),
    level: params.has('level') ? level || 1 : null,
    soldiers: Math.max(1, Math.floor(Number(params.get('soldiers')) || 1)),
  };
}
