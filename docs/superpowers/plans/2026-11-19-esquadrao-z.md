# Esquadrão Z: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** Um jogo PWA para celular em que um esquadrão corre por uma estrada atirando sozinho, destrói barris para ganhar soldados e armas, desvia de portões vermelhos, enfrenta hordas de zumbis e, no fim de cada fase, um chefão.

**Arquitetura:** Arquivos estáticos, sem build. As regras do jogo são uma simulação pura em JS (`src/sim.js`, sem DOM e sem Three.js), testada com `node --test`. A renderização (`src/render/`) só lê o estado e os eventos da simulação. `src/main.js` liga simulação, renderização, interface, som e PWA.

**Tecnologia:** JavaScript (módulos ES), Three.js 0.170.0 copiado em `vendor/`, Node 22 (`node:test`, `node:http`, `node:zlib`) para testes e ferramentas, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-19-esquadrao-z-design.md`

## Restrições globais

- Sem passo de build: o navegador carrega os arquivos do repositório como estão. Caminhos sempre relativos (`./`), porque o site roda em `/mobcontrol/` no GitHub Pages.
- Única dependência de runtime: `three@0.170.0`, copiado para `vendor/` e importado como `three` via import map. Ferramentas e testes usam só módulos nativos do Node 22 (o `three` de `node_modules` só nos testes de geometria).
- Os módulos de regra (`config`, `rng`, `formation`, `level`, `sim`, `autopilot`, `clock`, `storage`, `input`) não importam `three` nem usam DOM global, para rodar no Node.
- Textos da interface em português do Brasil. Identificadores de código em inglês.
- Nome "Esquadrão Z" e visual próprio. Nunca usar o nome, a arte ou o visual (ponte vermelha) do Last War.
- Coordenadas da simulação: `x` lateral em `[-ROAD_HALF, ROAD_HALF]`, `z` para a frente a partir de 0. Na renderização: `world.x = x`, `world.z = -z`, `y` para cima.
- Retrato primeiro: telas de 360 a 430 px de largura. Em telas largas, o jogo ocupa uma coluna 9:16 centralizada.
- Desempenho: atores repetidos com `InstancedMesh`; pixel ratio no máximo 2, rebaixado se o FPS cair; sem sombras reais.
- Service worker desligado em `localhost`/`127.0.0.1`, a não ser que a URL tenha `?sw`.
- Trabalho na branch `feat/esquadrao-z`, um commit por tarefa.

## Foco da revisão

1. O celular sai do app no meio da partida (ligação, notificação): o jogo pausa e, ao voltar, não "pula" segundos de simulação. Coberto na Tarefa 11 (`advanceClock` e passo manual).
2. Um segundo dedo encosta na tela durante o arraste: a direção segue só o primeiro dedo, sem salto. Coberto na Tarefa 11 (teste de `createInput`).
3. Esquadrão enorme (200 a 300 soldados): continua dentro da estrada, para em `MAX_SOLDIERS` e não derruba o FPS. Coberto nas Tarefas 3, 5 e 14.
4. Navegador em modo privado ou save corrompido: o jogo abre na Operação 1 com as opções padrão, sem travar. Coberto na Tarefa 11 (teste de `loadSave`).
5. Fases muito altas (60, 999): a fase gerada continua válida, com números finitos e quantidades limitadas. Coberto na Tarefa 4.

---

## Contratos de dados

Todas as tarefas usam estes formatos. `WeaponId` é `'rifle' | 'smg' | 'sniper' | 'bazooka'`; `ZombieKind` é `'walker' | 'runner' | 'brute'`.

```js
// Level: saída de generateLevel(n). Nunca é modificado pela simulação.
{
  number, length,                       // a corrida termina em z = length
  barrels: [{ id, x, z, hp, reward }],  // reward: { kind: 'soldiers', count } | { kind: 'weapon', weapon }
  gates:   [{ id, side, z, value }],    // side: -1 (metade esquerda, x < 0) | 1 (metade direita, x >= 0)
  zombies: [{ id, kind, x, z, hp }],
  boss:    { hp },
}

// Game: saída de createGame(level), modificado por stepGame.
{
  level, phase,                         // phase: 'run' | 'boss' | 'won' | 'lost'
  time, rng, nextId,
  shots, hits,                          // contadores acumulados (som de tiro e de impacto)
  squad:    { x, z, weapon },
  soldiers: [{ id, x, z, cooldown }],
  recruits: [{ id, x, z }],             // soldiers libertados correndo até o esquadrão
  bullets:  [{ x, z, prevZ, damage, pierce, splash, travelled, hitIds }],
  barrels:  [{ id, x, z, hp, maxHp, reward, alive }],
  gates:    [{ id, side, z, value, passed }],
  zombies:  [{ id, kind, x, z, hp, maxHp, active, alive }],
  boss:     { x, z, hp, maxHp, active, alive, biteTimer },
  events:   [],                         // stepGame só acrescenta; quem chama esvazia
}

// GameEvent
{ type: 'barrelDestroyed', id, x, z, reward }
{ type: 'barrelCrash', id, x, z, killed }
{ type: 'recruitJoined', x, z }
{ type: 'weapon', weapon }
{ type: 'gate', id, value, x, z }       // só quando o portão é aplicado ao esquadrão; value já arredondado
{ type: 'zombieKilled', id, kind, x, z }
{ type: 'soldierKilled', x, z, cause }  // cause: 'zombie' | 'barrel' | 'gate' | 'boss'
{ type: 'bossSpawn' } | { type: 'bossKilled', x, z } | { type: 'won' } | { type: 'lost' }
```

Helpers de teste usados nas Tarefas 5 a 8 (`tests/helpers/game.js`):

```js
export const emptyLevel = (o = {}) => ({ number: 1, length: 1000, barrels: [], gates: [], zombies: [], boss: { hp: 100 }, ...o });
export function run(game, seconds, input = { targetX: 0 }) { for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(game, 1 / 60, input); }
export const eventsOf = (game, type) => game.events.filter((e) => e.type === type);
```

---

### Tarefa 1: Estrutura do projeto, servidor local e Three.js

**Arquivos:**
- Criar: `package.json`, `.gitignore`, `tools/serve.mjs`, `tools/vendor-three.mjs`, `.claude/launch.json`, `vendor/three.module.min.js`
- Teste: `tests/serve.test.js`

**Interfaces:**
- Produz: `mimeFor(path: string) → string`, exportado de `tools/serve.mjs`. Scripts `npm test` (`node --test`), `npm run serve` (porta `PORT` ou 5173 em `127.0.0.1`; com `--lan`, escuta em `0.0.0.0` e imprime a URL da rede), `npm run vendor` e `npm run icons` (Tarefa 13).

- [ ] **Passo 1:** `git checkout -b feat/esquadrao-z`
- [ ] **Passo 2:** `package.json` com `"type": "module"`, `"private": true` e os scripts acima; `.gitignore` com `node_modules/`.
- [ ] **Passo 3: teste que falha**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mimeFor } from '../tools/serve.mjs';

test('serves game files with the MIME types browsers require', () => {
  assert.equal(mimeFor('/src/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeFor('/manifest.webmanifest'), 'application/manifest+json');
  assert.equal(mimeFor('/index.html'), 'text/html; charset=utf-8');
  assert.equal(mimeFor('/css/style.css'), 'text/css; charset=utf-8');
  assert.equal(mimeFor('/icons/icon-192.png'), 'image/png');
  assert.equal(mimeFor('/whatever.bin'), 'application/octet-stream');
});
```

- [ ] **Passo 4:** `npm test` deve FALHAR (módulo inexistente).
- [ ] **Passo 5:** Implementar `tools/serve.mjs`: servidor estático `node:http` na raiz do repositório; `/` serve `index.html`; recusa caminhos que saiam da raiz; 404 para arquivo ausente; `Cache-Control: no-store`. O servidor só sobe quando o arquivo é executado diretamente (`import.meta.url === pathToFileURL(process.argv[1]).href`).
- [ ] **Passo 6:** `npm test` deve PASSAR.
- [ ] **Passo 7:** `npm install --save-dev three@0.170.0`. `tools/vendor-three.mjs` copia `node_modules/three/build/three.module.min.js` para `vendor/`, e também `three.core.min.js` se o primeiro o importar. Rodar `npm run vendor` e conferir que `vendor/three.module.min.js` existe.
- [ ] **Passo 8:** `.claude/launch.json`: `{ "version": "0.0.1", "configurations": [{ "name": "esquadrao-z", "runtimeExecutable": "node", "runtimeArgs": ["tools/serve.mjs"], "port": 5173 }] }`.
- [ ] **Passo 9:** Commit `chore: scaffold project, dev server and vendored three.js`.

### Tarefa 2: Configuração e números aleatórios com semente

**Arquivos:**
- Criar: `src/config.js`, `src/rng.js`
- Teste: `tests/config.test.js`, `tests/rng.test.js`

**Interfaces:**
- Produz: as constantes abaixo, exportadas de `src/config.js`, e `createRng(seed: number) → { next(): number /* [0,1) */, range(min, max): number /* [min,max) */, int(min, max): number /* inteiro em [min,max] */, chance(p): boolean, pick(array): any }`.

Valores iniciais (ajustáveis na Tarefa 8):

```js
export const ROAD_HALF = 3.6, SQUAD_SPEED = 7, STEER_SPEED = 12, SOLDIER_RADIUS = 0.28,
  SOLDIER_FOLLOW = 10, FORMATION_SPACING = 0.62, MAX_SOLDIERS = 300,
  BULLET_SPEED = 34, BULLET_RANGE = 26, BARREL_RADIUS = 0.75,
  GATE_PER_DAMAGE = 0.25, GATE_MAX = 30, RECRUIT_SPEED = 12,
  ZOMBIE_ACTIVATE_DIST = 42, ZOMBIE_HOMING = 0.5, BOSS_GAP = 24,
  DRAG_GAIN = 1.3, KEY_SPEED = 9;
export const WEAPONS = {
  rifle:   { label: 'Fuzil',        damage: 1,    rate: 2.2, pierce: 1, splash: 0 },
  smg:     { label: 'Metralhadora', damage: 0.75, rate: 6,   pierce: 1, splash: 0 },
  sniper:  { label: 'Sniper',       damage: 6,    rate: 0.9, pierce: 4, splash: 0 },
  bazooka: { label: 'Bazuca',       damage: 7,    rate: 0.9, pierce: 1, splash: 1.6 },
};
export const WEAPON_ORDER = ['rifle', 'smg', 'sniper', 'bazooka'];
export const ZOMBIES = {
  walker: { hp: 3,   speed: 1.6, radius: 0.35, kills: 1 },
  runner: { hp: 1.5, speed: 3.6, radius: 0.30, kills: 1 },
  brute:  { hp: 14,  speed: 1.1, radius: 0.60, kills: 4 },
};
export const BOSS = { radius: 1.6, speed: 1.3, killRate: 6 };
```

- [ ] **Passo 1: testes que falham**

```js
// tests/config.test.js
test('every weapon pickup is stronger than the one before it', () => {
  const dps = WEAPON_ORDER.map((id) => WEAPONS[id].damage * WEAPONS[id].rate);
  for (let i = 1; i < dps.length; i++) assert.ok(dps[i] > dps[i - 1]);
});
// tests/rng.test.js
test('the same seed repeats the same sequence', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});
test('different seeds give different sequences', () => assert.notEqual(createRng(1).next(), createRng(2).next()));
test('next, range and int stay inside their bounds', () => {
  const r = createRng(7), seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = r.next(); assert.ok(n >= 0 && n < 1);
    const x = r.range(-3, 3); assert.ok(x >= -3 && x < 3);
    const k = r.int(2, 5); assert.ok(Number.isInteger(k) && k >= 2 && k <= 5); seen.add(k);
  }
  assert.equal(seen.size, 4);
});
test('chance and pick behave', () => {
  const r = createRng(3);
  assert.equal(r.chance(0), false); assert.equal(r.chance(1), true);
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `src/config.js` com os valores acima e `createRng` com mulberry32.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** Commit `feat: add game config and seeded rng`.

### Tarefa 3: Formação do esquadrão

**Arquivos:**
- Criar: `src/formation.js`
- Teste: `tests/formation.test.js`

**Interfaces:**
- Consome: `ROAD_HALF`, `SOLDIER_RADIUS`, `FORMATION_SPACING`, `MAX_SOLDIERS`.
- Produz: `formationOffsets(count: number) → Array<{ x, z }>` (deslocamentos em relação ao centro do esquadrão), `formationHalfWidth(count) → number` (maior `|x|`) e `formationRadius(count) → number` (maior distância ao centro).

Algoritmo: no carregamento do módulo, gerar uma vez uma malha hexagonal com espaçamento `FORMATION_SPACING` (linha `j` em `z = j·s·√3/2`, deslocada `s/2` em `x` nas linhas ímpares), incluindo `(0, 0)`. Descartar pontos com `|x| > ROAD_HALF − SOLDIER_RADIUS`, ordenar por `x² + z²` (desempate: `z` maior primeiro, depois `x` menor) e guardar os primeiros `MAX_SOLDIERS`. `formationOffsets(n)` devolve os primeiros `clamp(n, 0, MAX_SOLDIERS)`. Assim, formações pequenas são redondas e as grandes se alongam para trás sem sair da estrada.

- [ ] **Passo 1: testes que falham**

```js
test('a lone soldier stands at the squad center', () => assert.deepEqual(formationOffsets(1), [{ x: 0, z: 0 }]));
test('the first soldiers keep their places as the squad grows', () => {
  assert.equal(formationOffsets(37).length, 37);
  assert.deepEqual(formationOffsets(10), formationOffsets(20).slice(0, 10));
});
test('soldiers never stand closer than FORMATION_SPACING', () => {
  for (const n of [2, 10, 60, 150]) {
    const p = formationOffsets(n); let min = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z));
    assert.ok(min >= FORMATION_SPACING - 1e-9, `n=${n} min=${min}`);
  }
});
test('every squad size up to MAX_SOLDIERS fits on the road', () => {
  for (let n = 1; n <= MAX_SOLDIERS; n++) assert.ok(formationHalfWidth(n) <= ROAD_HALF - SOLDIER_RADIUS + 1e-9);
});
test('half width and radius describe the offsets', () => {
  const p = formationOffsets(40);
  assert.equal(formationHalfWidth(40), Math.max(...p.map((o) => Math.abs(o.x))));
  assert.equal(formationRadius(40), Math.max(...p.map((o) => Math.hypot(o.x, o.z))));
});
test('counts outside 0..MAX_SOLDIERS are clamped', () => {
  assert.deepEqual(formationOffsets(0), []);
  assert.equal(formationOffsets(MAX_SOLDIERS + 50).length, MAX_SOLDIERS);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `src/formation.js`.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** Commit `feat: squad formation`.

### Tarefa 4: Gerador de fases

**Arquivos:**
- Criar: `src/level.js`
- Teste: `tests/level.test.js`

**Interfaces:**
- Consome: `createRng`, constantes de `config.js`.
- Produz: `generateLevel(n: number) → Level` (ver Contratos de dados). Determinístico por `n`.

Procedimento (as constantes ficam juntas num objeto `DIFFICULTY` no topo de `level.js`, para ajuste):

```
rng = createRng(n * 9973 + 17); length = 220 + 20 * min(n - 1, 10)
slots: z = 14, depois z += rng.range(11, 16) enquanto z <= length - 16
expN = 1; expWeapon = 'rifle'; expDps() = expN * dano * cadência da expWeapon * 0.6
slot 0: barril em x = pick([-1.6, 1.6]), hp 4, reward { soldiers, count 1 }   (igual ao começo do vídeo)
slot 1: portão vermelho no lado oposto a esse barril, value -(4 + n)
slots mais próximos de 0.3·length e 0.62·length: barril de arma k (k = 0, 1) com
  WEAPON_ORDER[min(3, 1 + k + floor((n - 1) / 3))], x = pick([-1.8, 0, 1.8]),
  hp = max(4, round(expDps() * 3)); depois expWeapon = essa arma
demais slots, por peso (barris 0.45, portão 0.2, horda 0.35; nunca dois portões seguidos):
  barris: 1 barril em pick([-1.8, 0, 1.8]) (60%) ou 2 barris em -1.8 e 1.8 (40%). Cada um:
    bait = chance(0.15); count = min(12, int(1, 3) + floor(expN / 12)) * (bait ? 2 : 1)
    hp = max(2, round(expDps() * 3.2 * range(0.5, 1.0) * (bait ? 2.5 : 1)))
    expN += count * (bait ? 0.3 : 0.7)
  portão: side = pick([-1, 1]); azul com chance 0.3: value = int(3, 6) + floor(n / 2), expN += value * 0.5;
    senão value = -min(60, int(4, 8) + 2n + floor(expN / 4))
  horda: budget = expDps() * 2.2 * (0.8 + 0.1n); 1 brute se n >= 3 e chance(0.4);
    o resto é runner (25%, se n >= 2) ou walker; hp = ZOMBIES[kind].hp * (1 + 0.25(n - 1));
    adiciona zumbis até gastar o budget ou chegar a 60; cx = range(-1.8, 1.8);
    x = clamp(cx + range(-1.8, 1.8), ±(ROAD_HALF - 0.35)); z = slot + range(0, 3 + 0.08 * count);
    expN = max(1, expN - count * 0.05)
boss.hp = round(expDps() * (10 + n)); ids sequenciais a partir de 1 em barris, portões e zumbis
```

- [ ] **Passo 1: testes que falham**

```js
const zombieHp = (l) => l.zombies.reduce((s, z) => s + z.hp, 0);
test('the same operation number always builds the same road', () => assert.deepEqual(generateLevel(4), generateLevel(4)));
test('the first barrel teaches the rules: 1 soldier on top, 4 hp', () => {
  const [first] = [...generateLevel(1).barrels].sort((a, b) => a.z - b.z);
  assert.equal(first.hp, 4); assert.deepEqual(first.reward, { kind: 'soldiers', count: 1 });
});
test('operation 1 shows a red gate early and offers a weapon', () => {
  const l = generateLevel(1);
  assert.ok(l.gates.some((g) => g.value < 0 && g.z < 40));
  assert.ok(l.barrels.some((b) => b.reward.kind === 'weapon'));
});
test('everything sits on the road, before the finish line', () => {
  for (const n of [1, 3, 7, 12]) {
    const l = generateLevel(n);
    for (const b of l.barrels) { assert.ok(Math.abs(b.x) <= ROAD_HALF - BARREL_RADIUS); assert.ok(b.z >= 10 && b.z <= l.length - 10); }
    for (const z of l.zombies) assert.ok(Math.abs(z.x) <= ROAD_HALF - 0.3);
    for (const g of l.gates) { assert.ok(g.side === -1 || g.side === 1); assert.ok(g.z >= 10 && g.z <= l.length - 10); }
  }
});
test('later operations are longer and harder', () => {
  const [a, b, c] = [1, 5, 10].map(generateLevel);
  assert.ok(a.length <= b.length && b.length <= c.length);
  assert.ok(zombieHp(a) < zombieHp(b) && zombieHp(b) < zombieHp(c));
  assert.ok(a.boss.hp < b.boss.hp && b.boss.hp < c.boss.hp);
});
test('weapon pickups never step down a tier along the road', () => {
  for (const n of [1, 4, 9]) {
    const tiers = generateLevel(n).barrels.filter((b) => b.reward.kind === 'weapon').sort((a, b) => a.z - b.z).map((b) => WEAPON_ORDER.indexOf(b.reward.weapon));
    for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] >= tiers[i - 1]);
  }
});
test('ids are unique', () => {
  const l = generateLevel(6), ids = [...l.barrels, ...l.gates, ...l.zombies].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('very high operations stay valid and bounded', () => {
  for (const n of [60, 999]) {
    const l = generateLevel(n);
    assert.ok(l.length <= 420 && Number.isFinite(l.boss.hp) && l.boss.hp > 0);
    assert.ok(l.barrels.every((b) => Number.isFinite(b.hp) && b.hp > 0));
    assert.ok(l.gates.every((g) => Number.isFinite(g.value) && g.value >= -60));
    assert.ok(l.zombies.length <= 1500 && l.zombies.every((z) => Number.isFinite(z.hp) && Number.isFinite(z.x)));
  }
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `generateLevel` em `src/level.js` seguindo o procedimento.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** Commit `feat: procedural level generator`.

### Tarefa 5: Simulação, parte 1 (corrida, tiro, barris, recrutas e armas)

**Arquivos:**
- Criar: `src/sim.js`, `tests/helpers/game.js`
- Teste: `tests/sim-run.test.js`

**Interfaces:**
- Consome: `generateLevel` (só o formato `Level`), `formation.js`, `config.js`, `createRng`.
- Produz: `createGame(level: Level, options?: { seed?: number }) → Game` (copia as entidades, sem modificar `level`; semente padrão `level.number * 7919 + 1`); `stepGame(game: Game, dt: number, input: { targetX: number }) → void`; `addSoldiers(game: Game, count: number, at?: { x, z }) → number` (quantos entraram, respeitando `MAX_SOLDIERS`).

Regras deste passo, em `stepGame` (nada acontece se `phase` for `'won'` ou `'lost'`):
- `squad.z += SQUAD_SPEED·dt` na fase `'run'`. `squad.x` anda até `input.targetX` a no máximo `STEER_SPEED·dt` e fica limitado a `±max(0, ROAD_HALF − formationHalfWidth(n) − SOLDIER_RADIUS)`.
- Cada soldado vai até sua vaga (`squad + formationOffsets(n)[i]`) com fator `min(1, SOLDIER_FOLLOW·dt)`.
- Tiro: `cooldown -= dt`; ao chegar a 0, cria uma bala em `(x, z + 0.3)` com os dados da arma do esquadrão e soma `1/rate`. O `cooldown` inicial é sorteado em `[0, 1/rate)` com `game.rng`. Cada bala incrementa `game.shots`.
- Bala: `prevZ = z; z += BULLET_SPEED·dt`; some quando `travelled > BULLET_RANGE`. Ela acerta o alvo mais próximo cujo círculo cruza o segmento `[prevZ, z]` na sua coluna `x`, nunca o mesmo id duas vezes (`hitIds`); cada acerto soma `game.hits` e gasta 1 de `pierce`. Com `splash > 0`, o primeiro acerto também causa o dano a todos os zumbis (e ao chefão) num raio `splash` do impacto, e a bala some.
- Barril com `hp <= 0`: `alive = false` e evento `barrelDestroyed`. Se for de soldados, cria `count` recrutas no barril. Se for de arma, `squad.weapon` muda e sai o evento `weapon`.
- Recruta corre até o centro do esquadrão a `RECRUIT_SPEED` e entra (via `addSoldiers`, evento `recruitJoined`) quando a distância fica `<= formationRadius(n) + 0.8`. Se o esquadrão estiver cheio, o recruta some.

- [ ] **Passo 1: testes que falham**

```js
const barrel = (id, x, z, hp, reward = { kind: 'soldiers', count: 1 }) => ({ id, x, z, hp, reward });
test('a new game starts with one soldier holding a rifle at the start line', () => {
  const g = createGame(emptyLevel());
  assert.equal(g.soldiers.length, 1); assert.equal(g.squad.z, 0); assert.equal(g.squad.weapon, 'rifle'); assert.equal(g.phase, 'run');
});
test('createGame never modifies the level', () => {
  const level = emptyLevel({ barrels: [barrel(1, 0, 14, 4)] }), copy = structuredClone(level);
  const g = createGame(level); run(g, 4); assert.deepEqual(level, copy);
});
test('the squad runs forward at SQUAD_SPEED', () => { const g = createGame(emptyLevel()); run(g, 2); assert.ok(Math.abs(g.squad.z - 2 * SQUAD_SPEED) < 0.01); });
test('steering is limited by STEER_SPEED and stops at the road edge', () => {
  const g = createGame(emptyLevel());
  run(g, 0.1, { targetX: 99 }); assert.ok(g.squad.x <= STEER_SPEED * 0.1 + 1e-6);
  run(g, 2, { targetX: 99 }); assert.ok(Math.abs(g.squad.x - (ROAD_HALF - formationHalfWidth(1) - SOLDIER_RADIUS)) < 1e-6);
});
test('each soldier fires at its weapon rate and bullets expire after BULLET_RANGE', () => {
  const g = createGame(emptyLevel()); run(g, 3);
  assert.ok(Math.abs(g.shots - 3 * WEAPONS.rifle.rate) <= 1);
  assert.ok(g.bullets.every((b) => b.travelled <= BULLET_RANGE));
});
test('destroying a barrel frees its soldiers, who run in and join', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 20, 4, { kind: 'soldiers', count: 3 })] }));
  run(g, 4);
  assert.equal(eventsOf(g, 'barrelDestroyed').length, 1);
  assert.equal(eventsOf(g, 'recruitJoined').length, 3);
  assert.equal(g.soldiers.length, 4);
});
test('a weapon barrel arms the whole squad', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 14, 2, { kind: 'weapon', weapon: 'smg' })] }));
  run(g, 3); assert.equal(g.squad.weapon, 'smg'); assert.deepEqual(eventsOf(g, 'weapon').map((e) => e.weapon), ['smg']);
});
test('sniper bullets pierce through several targets', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 10, 5), barrel(2, 0, 12, 5)] }));
  g.squad.weapon = 'sniper'; g.soldiers[0].cooldown = 0;
  run(g, 0.5); assert.equal(eventsOf(g, 'barrelDestroyed').length, 2);
});
test('the squad never grows past MAX_SOLDIERS', () => {
  const g = createGame(emptyLevel({ barrels: [barrel(1, 0, 14, 1, { kind: 'soldiers', count: 5 })] }));
  addSoldiers(g, MAX_SOLDIERS - 2); run(g, 4); assert.equal(g.soldiers.length, MAX_SOLDIERS);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `createGame`, `stepGame` (regras acima) e `addSoldiers` em `src/sim.js`; criar `tests/helpers/game.js` como em Contratos de dados.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** Commit `feat: simulation core (run, shoot, barrels, recruits, weapons)`.

### Tarefa 6: Simulação, parte 2 (portões, zumbis e batida em barril)

**Arquivos:**
- Modificar: `src/sim.js`
- Teste: `tests/sim-hazards.test.js`

**Interfaces:**
- Consome e produz: as mesmas funções da Tarefa 5.

Regras:
- Bala que cruza `gate.z` no lado do portão (`side === 1 ? x >= 0 : x < 0`) é absorvida e faz `value = min(GATE_MAX, value + damage·GATE_PER_DAMAGE)`.
- Quando `squad.z >= gate.z` e o portão ainda não passou: `passed = true`. Se o centro do esquadrão está no lado do portão, aplica `v = Math.round(value)`: com `v > 0`, `addSoldiers(game, v)`; com `v < 0`, remove `min(−v, n)` soldados, começando pelos de trás, com um `soldierKilled` (cause `'gate'`) para cada. Sai o evento `gate` com `v`.
- Zumbi fica inativo até `z − squad.z < ZOMBIE_ACTIVATE_DIST`. Ativo, anda `z −= speed·dt` e `x += clamp(squad.x − x, −1, 1)·ZOMBIE_HOMING·speed·dt`. Ao encostar num soldado (distância `< radius + SOLDIER_RADIUS`), mata os `kills` soldados mais próximos (`soldierKilled`, cause `'zombie'`) e morre. Com `z < squad.z − 8`, some sem evento. Com `hp <= 0` por bala, sai `zombieKilled`.
- Barril vivo que encosta em algum soldado mata todos os soldados com `|s.x − b.x| < BARREL_RADIUS + SOLDIER_RADIUS` (cause `'barrel'`), vira `alive = false` e sai `barrelCrash` com `killed`.

- [ ] **Passo 1: testes que falham**

```js
const zombie = (id, x, z, kind = 'walker', hp = ZOMBIES[kind].hp) => ({ id, kind, x, z, hp });
test('a red gate on the squad side takes as many soldiers as its value', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 10, value: -40 }] }));
  addSoldiers(g, 29); run(g, 2.5, { targetX: 3 });
  const [e] = eventsOf(g, 'gate');
  assert.ok(e.value < 0); assert.equal(g.soldiers.length, 30 + e.value);
  assert.equal(eventsOf(g, 'soldierKilled').filter((k) => k.cause === 'gate').length, -e.value);
});
test('the other side of a red gate is safe', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 10, value: -5 }] }));
  addSoldiers(g, 9); run(g, 2.5, { targetX: -3 });
  assert.equal(g.soldiers.length, 10); assert.equal(eventsOf(g, 'gate').length, 0);
});
test('shooting a gate raises its value and a blue gate adds soldiers', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: -1, z: 20, value: -2 }] }));
  addSoldiers(g, 9); run(g, 3.5, { targetX: -3 });
  const [e] = eventsOf(g, 'gate');
  assert.ok(e.value > 0); assert.equal(g.soldiers.length, 10 + e.value);
});
test('a gate never goes above GATE_MAX', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: -1, z: 25, value: 0 }] }));
  addSoldiers(g, 59); run(g, 4, { targetX: -3 });
  assert.equal(eventsOf(g, 'gate')[0].value, GATE_MAX);
});
test('zombies wake up when the squad gets close and walk toward it', () => {
  const far = ZOMBIE_ACTIVATE_DIST + 10, g = createGame(emptyLevel({ zombies: [zombie(1, 0, far, 'walker', 1e9)] }));
  run(g, 0.5); assert.equal(g.zombies[0].active, false);
  run(g, 2); assert.equal(g.zombies[0].active, true); assert.ok(g.zombies[0].z < far);
});
test('a zombie that touches the squad kills one soldier and dies', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 15, 'walker', 1e9)] }));
  addSoldiers(g, 4); run(g, 3);
  assert.equal(g.soldiers.length, 4); assert.equal(g.zombies[0].alive, false);
  assert.deepEqual(eventsOf(g, 'soldierKilled').map((e) => e.cause), ['zombie']);
});
test('a brute kills ZOMBIES.brute.kills soldiers', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 15, 'brute', 1e9)] }));
  addSoldiers(g, 9); run(g, 3); assert.equal(g.soldiers.length, 10 - ZOMBIES.brute.kills);
});
test('bullets kill a zombie before it arrives', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 20)] }));
  run(g, 3); assert.equal(eventsOf(g, 'zombieKilled').length, 1); assert.equal(g.soldiers.length, 1);
});
test('bazooka splash hurts every zombie near the impact', () => {
  const g = createGame(emptyLevel({ zombies: [zombie(1, 0, 10, 'walker', 5), zombie(2, 0.8, 10.4, 'walker', 5)] }));
  g.squad.weapon = 'bazooka'; g.soldiers[0].cooldown = 0; run(g, 0.6);
  assert.equal(eventsOf(g, 'zombieKilled').length, 2);
});
test('a barrel that is not destroyed in time crashes into its column', () => {
  const g = createGame(emptyLevel({ barrels: [{ id: 1, x: 0, z: 12, hp: 1e9, reward: { kind: 'soldiers', count: 1 } }] }));
  addSoldiers(g, 9); run(g, 3);
  const [crash] = eventsOf(g, 'barrelCrash');
  assert.ok(crash.killed >= 1); assert.equal(g.soldiers.length, 10 - crash.killed); assert.equal(g.barrels[0].alive, false);
});
test('passing beside a barrel is harmless', () => {
  const g = createGame(emptyLevel({ barrels: [{ id: 1, x: 2.8, z: 12, hp: 1e9, reward: { kind: 'soldiers', count: 1 } }] }));
  run(g, 3, { targetX: -3 }); assert.equal(eventsOf(g, 'barrelCrash').length, 0); assert.equal(g.soldiers.length, 1);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar as regras em `src/sim.js`.
- [ ] **Passo 4:** `npm test` deve PASSAR (incluindo os testes da Tarefa 5).
- [ ] **Passo 5:** Commit `feat: gates, zombies and barrel crashes`.

### Tarefa 7: Simulação, parte 3 (chefão, vitória e derrota)

**Arquivos:**
- Modificar: `src/sim.js`
- Teste: `tests/sim-end.test.js`

Regras:
- O chefão começa parado em `(0, level.length + BOSS_GAP)`, inativo. Balas ignoram chefão inativo.
- Quando `squad.z >= level.length` na fase `'run'`: `squad.z = level.length`, `phase = 'boss'`, `boss.active = true` e sai `bossSpawn`. O esquadrão para de avançar, mas ainda vira para os lados.
- Chefão ativo anda `z −= BOSS.speed·dt` e vai na direção do `x` do esquadrão. Encostando em algum soldado (distância `< BOSS.radius + SOLDIER_RADIUS`), mata o soldado mais próximo a cada `1/BOSS.killRate` segundos (cause `'boss'`).
- Chefão com `hp <= 0`: `alive = false`, `bossKilled`, `phase = 'won'` e `won`.
- Sem nenhum soldado: `phase = 'lost'` e `lost`. Em `'won'` ou `'lost'`, `stepGame` não muda nada, nem `time`.

- [ ] **Passo 1: testes que falham**

```js
test('reaching the end of the road stops the squad and wakes the boss', () => {
  const g = createGame(emptyLevel({ length: 21, boss: { hp: 1e9 } }));
  assert.equal(g.boss.z, 21 + BOSS_GAP);
  run(g, 3.2);
  assert.equal(g.phase, 'boss'); assert.equal(g.squad.z, 21); assert.equal(g.boss.active, true);
  assert.equal(eventsOf(g, 'bossSpawn').length, 1);
  run(g, 1); assert.equal(g.squad.z, 21); assert.ok(g.boss.z < 21 + BOSS_GAP);
});
test('the boss bites BOSS.killRate soldiers per second while touching the squad', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 1e9 } }));
  addSoldiers(g, 99);
  const bites = () => eventsOf(g, 'soldierKilled').filter((e) => e.cause === 'boss').length;
  for (let i = 0; i < 3600 && bites() === 0; i++) stepGame(g, 1 / 60, { targetX: 0 });
  const before = bites(); run(g, 2);
  assert.ok(Math.abs(bites() - before - 2 * BOSS.killRate) <= 1);
});
test('killing the boss wins and freezes the game', () => {
  const g = createGame(emptyLevel({ length: 1, boss: { hp: 5 } }));
  addSoldiers(g, 9); run(g, 10);
  assert.equal(g.phase, 'won'); assert.equal(eventsOf(g, 'bossKilled').length, 1); assert.equal(eventsOf(g, 'won').length, 1);
  const t = g.time; run(g, 1); assert.equal(g.time, t);
});
test('losing the last soldier loses the game', () => {
  const g = createGame(emptyLevel({ gates: [{ id: 1, side: 1, z: 5, value: -50 }] }));
  run(g, 2, { targetX: 3 });
  assert.equal(g.phase, 'lost'); assert.equal(g.soldiers.length, 0); assert.equal(eventsOf(g, 'lost').length, 1);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar as regras em `src/sim.js`.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5:** Commit `feat: boss fight, win and loss`.

### Tarefa 8: Piloto automático e balanceamento

**Arquivos:**
- Criar: `src/autopilot.js`
- Modificar (ajuste fino): `src/config.js`, constantes `DIFFICULTY` de `src/level.js`
- Teste: `tests/balance.test.js`

**Interfaces:**
- Produz: `autopilot(game: Game) → { targetX: number }`. Também é usado pelo modo `?demo` (Tarefa 9).

Regras, em ordem (o resultado é sempre limitado a `±ROAD_HALF`):
1. Portão vermelho (valor arredondado `< 0`) não passado a até 16 à frente, com o esquadrão no lado dele: vai para `−side·(ROAD_HALF − 0.5)`.
2. Barril vivo a até 8 à frente, na coluna do esquadrão (`|b.x − squad.x| < BARREL_RADIUS + formationHalfWidth(n) + SOLDIER_RADIUS`), que não dá para destruir (regra 3): desvia 2.5 para o lado com mais espaço.
3. `dps = n·dano·cadência`. Barril vivo mais próximo com `z ∈ (squad.z + 2, squad.z + BULLET_RANGE]` e `hp <= dps·((z − squad.z)/SQUAD_SPEED)·0.8`: vai para `b.x`.
4. Portão azul não passado a até 16: vai para `side·(ROAD_HALF − 0.5)`.
5. Zumbi ativo mais próximo à frente, ou o chefão na fase `'boss'`: vai para o `x` dele. Senão, 0.

- [ ] **Passo 1: testes que falham**

```js
function playLevel(n, maxSeconds = 240) {
  const g = createGame(generateLevel(n)); let maxSoldiers = 1;
  for (let i = 0; i < maxSeconds * 60 && (g.phase === 'run' || g.phase === 'boss'); i++) {
    const input = autopilot(g);
    assert.ok(Math.abs(input.targetX) <= ROAD_HALF);
    stepGame(g, 1 / 60, input); g.events.length = 0;
    maxSoldiers = Math.max(maxSoldiers, g.soldiers.length);
  }
  return { phase: g.phase, time: g.time, maxSoldiers };
}
test('the autopilot clears operations 1 to 3', () => {
  for (const n of [1, 2, 3]) { const r = playLevel(n); assert.equal(r.phase, 'won', `operação ${n}: ${JSON.stringify(r)}`); }
});
test('operation 1 grows the squad past 10 soldiers and lasts 30 to 90 seconds', () => {
  const r = playLevel(1); assert.ok(r.maxSoldiers >= 10); assert.ok(r.time >= 30 && r.time <= 90);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `autopilot`.
- [ ] **Passo 4:** `npm test`. Se o piloto perder alguma das operações 1 a 3, ajustar `DIFFICULTY`/`config.js`, um número por vez, até passar, sem mudar regras. Todos os testes anteriores continuam passando.
- [ ] **Passo 5:** Commit `feat: autopilot and balance pass`.

### Tarefa 9: Renderização, parte 1 (palco, modelos, mundo, atores e modo demo)

**Arquivos:**
- Criar: `index.html` (mínimo: `#stage`, import map `{"imports": {"three": "./vendor/three.module.min.js"}}`, `<script type="module" src="src/main.js">`), `css/style.css`, `src/render/stage.js`, `src/render/geometry.js`, `src/render/world.js`, `src/render/actors.js`, `src/render/view.js`, `src/main.js` (provisório: só o modo demo)
- Teste: `tests/geometry.test.js`

**Interfaces:**
- Consome: `Game`, `Level`, `autopilot`, `createGame`, `stepGame`, `generateLevel`.
- Produz:
  - `createStage(container: HTMLElement) → { renderer, scene, camera, resize(): void, setPixelRatioCap(cap: number): void }`: fundo em degradê de entardecer (céu `#8ec5ff` → horizonte `#ffd29a`), neblina na cor do horizonte, `HemisphereLight` e `DirectionalLight` sem sombras, `PerspectiveCamera` de fov 50.
  - `geometry.js`: `mergeColored(parts: Array<{ geometry, color: number, matrix?: Matrix4 }>) → BufferGeometry` (sem índice, com atributo `color`), e os modelos low-poly (pés em `y = 0`, cores por vértice): `soldierGeometry()` (cerca de 1.0 de altura: uniforme `0x2f6fde`, capacete `0x1d3f7a`, pele `0xf1c27d`, arma `0x333333`), `legGeometry()`, `zombieGeometry()` (cerca de 1.05: pele `0x7fbf4d`, braços para a frente), `barrelGeometry()` (tambor amarelo `0xf2b705` com faixas `0x222222`, raio `BARREL_RADIUS`, altura cerca de 1.25), `gateFrameGeometry()`, `bossGeometry()`, `weaponGeometry(id: WeaponId)`, `rockGeometry()`, `cactusGeometry()`, `wreckGeometry()`.
  - `buildWorld(scene, level: Level) → { dispose(): void }`: asfalto com faixas tracejadas (CanvasTexture repetida) de `z = −30` até `level.length + 60`, mureta nas bordas, areia `0xe0b872` dos lados, linha de chegada em `level.length` e decoração instanciada (pedras, cactos, carcaças de carro) sorteada com `createRng(level.number)`.
  - `createActors(scene) → { sync(game: Game, time: number): void, dispose(): void }`: `InstancedMesh` para corpos de soldados e recrutas (capacidade 360), pernas (720), zumbis (400, cor e escala por tipo; brute com escala 1.7), balas (2000, traçante amarela), sombras em disco (800) e barras de vida dos zumbis feridos (400). Só desenha o que está em `z ∈ [squad.z − 12, squad.z + 80]`. Animação de corrida: balanço do corpo e pernas girando em `x`.
  - `createView(container) → { load(game: Game): void, render(game: Game, events: GameEvent[], dt: number): void, resize(): void }`: câmera atrás e acima do esquadrão (por volta de `(0.4·squad.x, 11, −squad.z + 11)`, olhando para `(0.4·squad.x, 0, −squad.z − 9)`), seguindo o `x` suavemente. Mede o FPS: se a média ficar abaixo de 45 por 2 s, rebaixa o pixel ratio de 2 para 1.5 e depois para 1, com `setPixelRatioCap`.
  - `src/main.js` provisório: gera a Operação 1 (ou `?level=N`), o piloto automático dirige, passo fixo de 1/60 e `view.render` a cada quadro. Com `?debug`, mostra o FPS num canto.

- [ ] **Passo 1: testes que falham** (rodam no Node com o `three` de `node_modules`)

```js
const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
test('mergeColored keeps every vertex and paints each part with its color', () => {
  const a = new BoxGeometry(1, 1, 1), b = new SphereGeometry(0.5, 6, 4);
  const merged = mergeColored([{ geometry: a, color: 0xff0000 }, { geometry: b, color: 0x00ff00 }]);
  const count = a.toNonIndexed().attributes.position.count + b.toNonIndexed().attributes.position.count;
  assert.equal(merged.attributes.position.count, count);
  const c = merged.attributes.color;
  assert.deepEqual([c.getX(0), c.getY(0), c.getZ(0)], [1, 0, 0]);
  assert.deepEqual([c.getX(count - 1), c.getY(count - 1), c.getZ(count - 1)], [0, 1, 0]);
});
test('actors stand on the ground at the agreed sizes', () => {
  const s = box(soldierGeometry()), z = box(zombieGeometry()), b = box(barrelGeometry());
  assert.ok(Math.abs(s.min.y) < 0.02 && s.max.y > 0.9 && s.max.y < 1.1);
  assert.ok(Math.abs(z.min.y) < 0.02 && z.max.y > 0.95 && z.max.y < 1.2);
  assert.ok(Math.abs(b.max.x - BARREL_RADIUS) < 0.05 && b.max.y > 1.1 && b.max.y < 1.4);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `geometry.js` e rodar `npm test` até PASSAR.
- [ ] **Passo 4:** Implementar `stage.js`, `world.js`, `actors.js`, `view.js`, `index.html`, `css/style.css` (coluna 9:16 centralizada em telas largas; `touch-action: none`; `overscroll-behavior: none`; altura `100dvh`) e o `main.js` provisório.
- [ ] **Passo 5: verificação no navegador.** Subir o servidor `esquadrao-z` (preview), abrir `http://localhost:5173/?debug` com viewport de celular (preset mobile). Esperado: estrada no deserto ao entardecer, esquadrão azul correndo e atirando traçantes amarelas, zumbis verdes vindo, e o esquadrão crescendo ao longo da corrida. Console sem erros. FPS de pelo menos 55 no PC.
- [ ] **Passo 6:** Commit `feat: 3D rendering of world and actors with demo mode`.

### Tarefa 10: Renderização, parte 2 (barris, portões, chefão, números e efeitos)

**Arquivos:**
- Criar: `src/render/labels.js`, `src/render/props.js`, `src/render/effects.js`
- Modificar: `src/render/view.js`

**Interfaces:**
- Produz:
  - `createLabel(opts: { width: number, height: number, worldHeight: number }) → { sprite: Sprite, set(text: string, fg: string, bg?: string): void, dispose(): void }`: CanvasTexture redesenhada só quando o texto ou a cor muda.
  - `createProps(scene, game: Game) → { sync(game: Game, time: number): void, dispose(): void }`:
    - **Barris:** cada um mostra `Math.ceil(hp)` em branco com contorno escuro. Barril de soldados mostra até 3 bonecos em cima e um selo azul `+N`. Barril de arma mostra o modelo da arma girando. Pisca ao levar tiro (quando `hp` muda) e some quando `alive` fica falso.
    - **Portões:** moldura e painel translúcido na metade da pista; vermelho `0xe5484d` com valor arredondado `< 0`, azul `0x3b82f6` com `> 0`, cinza com 0. Mostra o número com sinal (`-5`, `+3`), pulsa quando o valor muda e desaparece depois de passar.
    - **Chefão:** `bossGeometry` com escala 4, animação pesada, visível desde o fim da pista.
    - Objetos fora de `z ∈ [squad.z − 12, squad.z + 80]` ficam invisíveis.
  - `createEffects(scene) → { handle(event: GameEvent): void, update(dt: number): void, shake: number }`:
    - **Explosão:** partículas laranja → cinza, para `barrelDestroyed`, `barrelCrash` e `bossKilled`.
    - **Gosma verde:** mancha no chão para `zombieKilled`, que some em 6 s (anel circular de 200).
    - **Anel amarelo:** para `recruitJoined`.
    - **Número flutuante:** `+N`/`-N` para `gate`.
    - **Tremida de câmera:** `shake` para explosões e batidas.
  - `view.render` passa a usar `props.sync`, `effects.handle` para cada evento, `effects.update` e o `shake` da câmera.

- [ ] **Passo 1:** Implementar `labels.js`, `props.js` e `effects.js` e ligar tudo em `view.js`.
- [ ] **Passo 2: verificação no navegador** (`?demo&debug`, viewport de celular). Esperado:
  - Os números dos barris diminuem com os tiros e o barril explode no zero.
  - Os soldados libertados brilham e entram no esquadrão.
  - Os portões mudam de vermelho para azul quando levam tiro.
  - O chefão aparece no fim da estrada, e a explosão ocorre quando ele morre.
  - Console sem erros e FPS de pelo menos 55.
  - Capturar uma tela.
- [ ] **Passo 3:** `npm test` continua PASSANDO.
- [ ] **Passo 4:** Commit `feat: barrels, gates, boss, labels and effects`.

### Tarefa 11: Interface, controle, save e loop do jogo

**Arquivos:**
- Criar: `src/ui.js`, `src/input.js`, `src/storage.js`, `src/clock.js`
- Modificar: `index.html` (HUD e telas), `css/style.css`, `src/main.js` (máquina de estados completa)
- Teste: `tests/input.test.js`, `tests/storage.test.js`, `tests/clock.test.js`

**Interfaces:**
- Produz:
  - `loadSave(storage = globalThis.localStorage) → { level: number, sound: boolean, vibe: boolean }` e `saveSave(save, storage = globalThis.localStorage) → void`. O módulo exporta a chave `SAVE_KEY = 'esquadrao-z/save/v1'`; o padrão é `{ level: 1, sound: true, vibe: true }`. Nenhuma das duas lança erro.
  - `advanceClock(clock: { acc: number }, frameDt: number, step = 1 / 60) → number`: limita `frameDt` a 0.1, acumula em `clock.acc` e devolve quantos passos inteiros rodar (no máximo 6), guardando o resto.
  - `createInput(el: EventTarget, opts: { width: () => number, keyTarget?: EventTarget }) → { update(dt: number): number, reset(x: number): void, dispose(): void }`:
    - **Arraste:** é relativo e segue só o primeiro `pointerId`. Cada pixel move `2·ROAD_HALF·DRAG_GAIN / width()`, e o arraste continua do alvo atual (sem salto).
    - **Teclado:** ArrowLeft/ArrowRight/a/d movem o alvo a `KEY_SPEED` por segundo (`keyTarget` padrão: `globalThis`).
    - **Limite:** o alvo fica sempre em `±ROAD_HALF`.
  - `createUi(doc: Document) → { show(screen: 'menu' | 'pause' | 'won' | 'lost' | null, data?: object): void, hud(state: { count: number, level: number, progress: number, weapon: WeaponId, bossHp: number | null }): void, toast(text: string, tone: 'good' | 'bad' | 'info'): void, onAction(fn: (action: string) => void): void, setToggles(t: { sound: boolean, vibe: boolean }): void }`. Os botões levam `data-action`: `play`, `pause`, `resume`, `restart`, `next`, `menu`, `toggle-sound`, `toggle-vibe`, `install`.
- Telas (textos):
  - **Menu:** "ESQUADRÃO Z", "Operação N", botão "JOGAR" e a dica "Arraste para mover. Destrua barris para resgatar soldados. Fuja dos portões vermelhos."
  - **Pausa:** "PAUSADO", "CONTINUAR", "REINICIAR", "SOM" e "VIBRAÇÃO".
  - **Vitória:** "OPERAÇÃO N CONCLUÍDA!", soldados restantes e "PRÓXIMA OPERAÇÃO".
  - **Derrota:** "ESQUADRÃO PERDIDO" e "TENTAR DE NOVO".
- HUD: contagem de soldados (canto superior esquerdo), "Operação N" com barra de progresso no topo, arma atual, botão de pausa (canto superior direito, pelo menos 44 px), barra de vida do chefão na fase `'boss'`. Margens com `env(safe-area-inset-*)`.
- `main.js`:
  - **Estados:** `menu → playing ⇄ paused → won | lost`.
  - **Vitória:** salva `level + 1` e mostra a tela 1.2 s depois.
  - **Derrota:** mostra a tela 1 s depois.
  - **Reinício:** "Tentar de novo" e "Reiniciar" recriam a fase com `generateLevel`.
  - **Parâmetros de URL:** `?level=N`, `?soldiers=N` (só para testes), `?demo` (piloto automático) e `?debug` (FPS).
  - **Fundo do menu:** o menu mostra a fase parada na largada.

- [ ] **Passo 1: testes que falham**

```js
// tests/clock.test.js
test('runs one step per 1/60 s and keeps the remainder', () => {
  const c = { acc: 0 }; assert.equal(advanceClock(c, 2.5 / 60), 2); assert.ok(Math.abs(c.acc - 0.5 / 60) < 1e-9);
});
test('coming back from the background never runs more than 6 steps', () => {
  const c = { acc: 0 }; assert.equal(advanceClock(c, 5), 6); assert.ok(c.acc < 1 / 60);
});
// tests/storage.test.js
const DEFAULTS = { level: 1, sound: true, vibe: true };
const mem = (data = {}) => ({ data, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); } });
test('a fresh device starts at operation 1 with sound and vibration on', () => assert.deepEqual(loadSave(mem()), DEFAULTS));
test('progress survives a reload', () => { const s = mem(); saveSave({ level: 4, sound: false, vibe: true }, s); assert.deepEqual(loadSave(s), { level: 4, sound: false, vibe: true }); });
test('a corrupted save falls back to defaults', () => assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '{oops' })), DEFAULTS));
test('nonsense values are repaired', () => assert.deepEqual(loadSave(mem({ [SAVE_KEY]: '{"level":-3,"sound":"x"}' })), DEFAULTS));
test('blocked storage (private mode) never throws', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSave(blocked), DEFAULTS); assert.doesNotThrow(() => saveSave({ level: 2, sound: true, vibe: true }, blocked));
  assert.deepEqual(loadSave(undefined), DEFAULTS);
});
// tests/input.test.js
const ev = (type, props) => Object.assign(new Event(type), props);
const setup = () => { const el = new EventTarget(), keys = new EventTarget(); return { el, keys, input: createInput(el, { width: () => 400, keyTarget: keys }) }; };
const perPx = (2 * ROAD_HALF * DRAG_GAIN) / 400;
test('dragging moves the target in proportion to the finger', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 240 }));
  assert.ok(Math.abs(input.update(0) - 40 * perPx) < 1e-9);
});
test('a second finger is ignored while the first one drags', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointerdown', { pointerId: 2, clientX: 50 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 2, clientX: 0 }));
  assert.equal(input.update(0), 0);
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 220 }));
  assert.ok(Math.abs(input.update(0) - 20 * perPx) < 1e-9);
});
test('lifting the finger and touching again continues from the current target', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 200 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 230 }));
  el.dispatchEvent(ev('pointerup', { pointerId: 1, clientX: 230 }));
  el.dispatchEvent(ev('pointerdown', { pointerId: 3, clientX: 10 }));
  assert.ok(Math.abs(input.update(0) - 30 * perPx) < 1e-9);
});
test('the target never leaves the road', () => {
  const { el, input } = setup();
  el.dispatchEvent(ev('pointerdown', { pointerId: 1, clientX: 0 }));
  el.dispatchEvent(ev('pointermove', { pointerId: 1, clientX: 5000 }));
  assert.equal(input.update(0), ROAD_HALF);
});
test('arrow keys move the target at KEY_SPEED', () => {
  const { keys, input } = setup();
  keys.dispatchEvent(ev('keydown', { key: 'ArrowLeft' }));
  assert.ok(Math.abs(input.update(0.25) + 0.25 * KEY_SPEED) < 1e-9);
  keys.dispatchEvent(ev('keyup', { key: 'ArrowLeft' }));
  assert.ok(Math.abs(input.update(0.25) + 0.25 * KEY_SPEED) < 1e-9);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `clock.js`, `storage.js` e `input.js`, e rodar `npm test` até PASSAR.
- [ ] **Passo 4:** Implementar `ui.js`, o HUD e as telas em `index.html`/`css/style.css`, e o `main.js` completo.
- [ ] **Passo 5: verificação no navegador** (viewport de celular). Esperado:
  - Menu → JOGAR → arrastar com o mouse move o esquadrão.
  - O HUD mostra a contagem, a operação, o progresso e a arma.
  - Ao ganhar (`?soldiers=150` deixa fácil), aparece a tela de vitória e "PRÓXIMA OPERAÇÃO" abre a Operação 2. Ela continua lá depois de recarregar a página.
  - Ao perder, aparece a tela de derrota.
  - O botão de pausa congela o jogo.
  - Trocar de aba e voltar mantém o jogo pausado, sem pulo.
  - Console sem erros.
- [ ] **Passo 6:** Commit `feat: hud, menus, touch input, save and game loop`.

### Tarefa 12: Som, vibração, tela sempre ligada e pausa automática

**Arquivos:**
- Criar: `src/audio.js`, `src/device.js`
- Modificar: `src/main.js`
- Teste: `tests/device.test.js`, `tests/audio.test.js`

**Interfaces:**
- Produz:
  - `createLimiter(gaps: Record<string, number>) → (name: string, now: number) => boolean`: devolve `true` se já passou `gaps[name]` segundos desde o último `true` desse nome. Sem entrada em `gaps`, sempre `true`.
  - `createAudio() → { unlock(): void, play(name: SoundName): void, enabled: boolean }`: sons sintetizados com WebAudio: `shot`, `hit`, `explode`, `recruit`, `gateGood`, `gateBad`, `soldierDown`, `zombieDown`, `weapon`, `bossRoar`, `win`, `lose` e `click`. Intervalos mínimos: `shot` 0.07, `hit` 0.05, `zombieDown` 0.06, `soldierDown` 0.08, `recruit` 0.05. O `AudioContext` nasce e é retomado no `unlock()`, chamado no toque de JOGAR (exigência do iPhone).
  - `createHaptics(nav = globalThis.navigator) → { enabled: boolean, buzz(kind: 'light' | 'medium' | 'heavy' | 'win' | 'lose'): void }`: padrões `light: 12`, `medium: 25`, `heavy: [40, 30, 40]`, `win: [30, 60, 30, 60, 80]` e `lose: [120, 80, 200]`, com `light` limitado a 1 a cada 0.1 s.
  - `createWakeLock(nav = globalThis.navigator, doc = globalThis.document) → { acquire(): Promise<void>, release(): Promise<void> }`: pede de novo ao voltar a ficar visível enquanto estiver adquirido e engole erros.
- Mapa em `main.js`:

| Evento ou contador | Som | Vibração |
|---|---|---|
| `barrelDestroyed` | `explode` | `medium` |
| `barrelCrash` | `explode` | `heavy` |
| `recruitJoined` | `recruit` | |
| `weapon` | `weapon` | `medium` |
| `gate` com valor maior que 0 | `gateGood` | `light` |
| `gate` com valor menor que 0 | `gateBad` | `heavy` |
| `zombieKilled` | `zombieDown` | |
| `soldierKilled` | `soldierDown` | `light` |
| `bossSpawn` | `bossRoar` | `heavy` |
| `won` | `win` | `win` |
| `lost` | `lose` | `lose` |
| aumento de `shots` | `shot` | |
| aumento de `hits` | `hit` | |

- Comportamento em `main.js`:
  - **Pausa automática:** `visibilitychange` (oculto) ou `pagehide` durante a partida pausam o jogo e soltam o wake lock.
  - **Wake lock:** é adquirido ao começar e ao continuar uma partida.
  - **Interruptores:** SOM e VIBRAÇÃO, na pausa, atualizam e salvam o save.

- [ ] **Passo 1: testes que falham**

```js
// tests/audio.test.js
test('the limiter lets a sound through only after its gap', () => {
  const ok = createLimiter({ shot: 0.07 });
  assert.equal(ok('shot', 1), true); assert.equal(ok('shot', 1.05), false); assert.equal(ok('shot', 1.08), true);
  assert.equal(ok('win', 1), true); assert.equal(ok('win', 1), true);
});
// tests/device.test.js
test('buzz vibrates with the agreed pattern', () => {
  const calls = [], h = createHaptics({ vibrate: (p) => calls.push(p) });
  h.buzz('heavy'); assert.deepEqual(calls, [[40, 30, 40]]);
});
test('buzz is silent when vibration is off', () => {
  const calls = [], h = createHaptics({ vibrate: (p) => calls.push(p) });
  h.enabled = false; h.buzz('medium'); assert.deepEqual(calls, []);
});
test('phones without vibration (iPhone) never throw', () => assert.doesNotThrow(() => createHaptics({}).buzz('win')));
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `audio.js` e `device.js` e ligar tudo em `main.js`.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5: verificação no navegador.** Esperado:
  - Depois de tocar em JOGAR, saem sons de tiro (sem embolar com muitos soldados), explosões e portões.
  - Desligar o SOM na pausa silencia o jogo, e isso continua valendo depois de recarregar.
  - Trocar de aba pausa o jogo.
  - Console sem erros.
  - A vibração não dá para testar no PC: fica para o teste no celular (Tarefa 15).
- [ ] **Passo 6:** Commit `feat: sound effects, haptics, wake lock and auto-pause`.

### Tarefa 13: PWA (ícones, manifest, service worker e instalação)

**Arquivos:**
- Criar: `tools/png.mjs`, `tools/make-icons.mjs`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png` (180), `icons/favicon-32.png`, `manifest.webmanifest`, `sw.js`, `src/pwa.js`, `.nojekyll`
- Modificar: `index.html` (cabeçalho e UI de instalação no menu), `src/main.js`
- Teste: `tests/png.test.js`, `tests/pwa.test.js`

**Interfaces:**
- Produz:
  - `encodePng(width: number, height: number, rgba: Uint8Array) → Buffer`: PNG RGBA de 8 bits, com filtro 0 em todas as linhas, IDAT via `zlib.deflateSync` e CRC32 próprio.
  - `tools/make-icons.mjs` desenha o ícone por SDF com antialias: fundo em degradê `#1b1d2a` → `#2b3a67`, um "Z" amarelo `#f2b705` com contorno escuro e uma mira circular. A versão maskable tem fundo sem cantos arredondados e o conteúdo dentro dos 80% centrais.
  - `manifest.webmanifest`:

```json
{ "name": "Esquadrão Z", "short_name": "Esquadrão Z", "description": "Corra, atire e aumente seu esquadrão contra hordas de zumbis.",
  "lang": "pt-BR", "start_url": "./", "scope": "./", "display": "fullscreen", "orientation": "portrait",
  "background_color": "#1b1d2a", "theme_color": "#1b1d2a", "categories": ["games"],
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```

  - `sw.js` (script clássico):
    - **Constantes:** `const CACHE = 'esquadrao-z-v1'` e `const ASSETS = [...]`, uma string `'./…'` por linha.
    - **`install`:** `addAll(ASSETS)` e `skipWaiting()`.
    - **`activate`:** apaga os caches com outro nome e chama `clients.claim()`.
    - **`fetch`** (GET da mesma origem): responde do cache (`ignoreSearch`; navegação usa `./index.html`) e, ao mesmo tempo, busca na rede e atualiza o cache. Sem cache, vai direto à rede. Assim a versão nova entra na abertura seguinte.
  - `registerServiceWorker(loc = location, nav = navigator) → Promise<boolean>`: não registra em `localhost`/`127.0.0.1` sem `?sw`.
  - `setupInstall(ui)`: no Android, guarda o `beforeinstallprompt` e mostra o botão "INSTALAR" no menu (`data-action="install"`). No iPhone, fora do modo app, mostra a dica "Toque em Compartilhar e depois em Adicionar à Tela de Início". Esconde ambos quando já está instalado (`display-mode: fullscreen/standalone` ou `navigator.standalone`).
  - Cabeçalho do `index.html`:
    - `viewport` com `viewport-fit=cover, user-scalable=no`;
    - `theme-color`, `link rel="manifest"` e `link rel="apple-touch-icon"`;
    - `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent` e `apple-mobile-web-app-title`;
    - favicon.

- [ ] **Passo 1: testes que falham**

```js
// tests/png.test.js
test('encodePng writes a valid RGBA PNG', () => {
  const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]), png = encodePng(2, 1, px);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2); assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8); assert.equal(png[25], 6);
  const idat = png.indexOf('IDAT'), len = png.readUInt32BE(idat - 4);
  assert.deepEqual([...inflateSync(png.subarray(idat + 4, idat + 4 + len))], [0, ...px]);
});
// tests/pwa.test.js
const pngSize = (file) => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
test('the manifest is installable', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  for (const k of ['name', 'short_name', 'background_color', 'theme_color']) assert.ok(m[k]);
  assert.equal(m.start_url, './'); assert.equal(m.scope, './'); assert.equal(m.display, 'fullscreen'); assert.equal(m.orientation, 'portrait');
  for (const [size, purpose] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const icon = m.icons.find((i) => i.sizes === size && i.purpose === purpose && i.type === 'image/png');
    assert.ok(icon, `${size} ${purpose}`); assert.deepEqual(pngSize(icon.src), size.split('x').map(Number));
  }
});
test('the service worker precaches every file the game needs', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const a of assets.filter((a) => a !== './')) assert.ok(existsSync(a), `missing ${a}`);
  const needed = ['./index.html', './manifest.webmanifest', ...['src', 'css', 'vendor', 'icons'].flatMap((d) => readdirSync(d, { recursive: true }).filter((f) => /\.\w+$/.test(f)).map((f) => `./${d}/${f.replaceAll('\\', '/')}`))];
  for (const f of needed) assert.ok(assets.includes(f), `sw.js does not precache ${f}`);
});
test('index.html links the manifest and the iPhone icon', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const s of ['rel="manifest"', 'rel="apple-touch-icon"', 'viewport-fit=cover', 'name="theme-color"']) assert.ok(html.includes(s), s);
});
```

- [ ] **Passo 2:** `npm test` deve FALHAR.
- [ ] **Passo 3:** Implementar `tools/png.mjs`, `tools/make-icons.mjs` e rodar `npm run icons`; escrever `manifest.webmanifest`, `sw.js`, `src/pwa.js`, `.nojekyll` e o cabeçalho do `index.html`; ligar `registerServiceWorker` e `setupInstall` em `main.js`.
- [ ] **Passo 4:** `npm test` deve PASSAR.
- [ ] **Passo 5: verificação no navegador.** Abrir `http://localhost:5173/?sw`, recarregar e conferir que `navigator.serviceWorker.controller` não é nulo e que `fetch('manifest.webmanifest')` responde 200. Parar o servidor, recarregar: o jogo abre do cache (offline). Subir o servidor de novo. Abrir os ícones gerados e conferir o visual.
- [ ] **Passo 6:** Commit `feat: installable offline PWA`.

### Tarefa 14: Teste de jogo em tamanho de celular, desempenho e README

**Arquivos:**
- Modificar: o que o teste de jogo pedir
- Criar: `README.md` (substitui o atual)

- [ ] **Passo 1: telas.** Conferir as telas em 375×812 (preset mobile), 360×640, 430×932 e 844×390 (deitado). Esperado:
  - O HUD fica dentro das áreas seguras e não cobre a estrada à frente.
  - Os textos são legíveis e os botões têm pelo menos 44 px.
  - Deitado, o jogo fica na coluna 9:16, jogável.
- [ ] **Passo 2: desempenho.** Abrir `?debug&level=8&soldiers=300`. Esperado:
  - Pelo menos 55 FPS no PC, sem queda forte nas explosões.
  - Com o FPS médio abaixo de 45 por 2 s, o pixel ratio desce (de 2 para 1.5 e depois 1).
- [ ] **Passo 3: partidas manuais.** Jogar as Operações 1 e 2 arrastando com o mouse, perder pelo menos uma vez de propósito e anotar o que estiver ruim (dificuldade, leitura dos números, ritmo). Corrigir: regra nova ou ajuste em módulo puro ganha teste; ajuste de número em `config`/`DIFFICULTY` mantém `npm test` passando.
- [ ] **Passo 4: README.md.** Contém:
  - o que é o jogo e como jogar;
  - como rodar (`npm install`, `npm run serve`, `npm test`, `npm run icons`, `npm run vendor`);
  - parâmetros de URL;
  - como publicar no GitHub Pages;
  - como instalar no Android e no iPhone.
- [ ] **Passo 5:** `npm test` deve PASSAR. Commit `chore: mobile playtest fixes and readme`.

### Tarefa 15: Publicar no GitHub Pages

Precisa do OK do usuário antes de qualquer push ou mudança no GitHub.

- [ ] **Passo 1:** Confirmar com o usuário que o repositório é público (ou que ele tem plano pago) e pedir OK para levar a branch para a `main` e dar push.
- [ ] **Passo 2:** Com o OK: `git checkout main`, `git merge --ff-only feat/esquadrao-z` e `git push origin main`.
- [ ] **Passo 3:** O usuário ativa o Pages: Settings → Pages → Build and deployment → Source "Deploy from a branch" → `main` / `(root)` → Save. Se o usuário pedir, isso pode ser feito pelo Chrome dele.
- [ ] **Passo 4: verificação.** Abrir `https://alexandrequintiliano95.github.io/mobcontrol/`. Esperado:
  - O jogo carrega e o console fica sem erros.
  - `manifest.webmanifest` responde 200.
  - Depois de recarregar, `navigator.serviceWorker.controller` não é nulo.
- [ ] **Passo 5:** Passar ao usuário o link e o passo a passo de instalação. No celular, ele confere a instalação, o modo offline, a vibração (Android) e o som.
