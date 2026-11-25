# Esquadrão Z

Jogo PWA para celular (pt-BR): um esquadrão corre sozinho por uma estrada atirando; o jogador arrasta para os lados. Barris com número dão soldados ou armas, portões somam ou subtraem soldados, hordas de zumbis vêm na direção do esquadrão e um chefão espera no fim de cada "Operação N". O jogo foi inspirado no minijogo de corrida do Last War, mas o nome, a arte e as fases são próprios.

O dono do projeto fala português e pede ajustes de jogabilidade em linguagem informal. Responda em português.

## Como trabalhar

- Sem build: o navegador carrega os arquivos do repositório como estão. Publicar é fazer push na `main`; a Vercel (`mobcontrol-six.vercel.app`) faz o deploy sozinha.
- `npm install` uma vez, depois `npm test` (node --test, ~90 testes). Rodar local: `npm run serve` → http://localhost:5173 (`?debug`, `?level=N`, `?soldiers=N`, `?demo`).
- Regras do jogo têm teste antes do código (TDD). Ajustes só de números não precisam de teste novo, mas `npm test` tem que passar.
- Depois de mexer na dificuldade, conferir com o piloto automático: `node --input-type=module -e "..."` usando `createGame`, `stepGame`, `autopilot` e `generateLevel` (ver `tests/balance.test.js`). Ele deve vencer as Operações 1 a 3; nas fases altas, algumas derrotas são esperadas.
- Arquivo novo em `src/`, `css/`, `icons/` ou `vendor/` precisa entrar em `ASSETS` no `sw.js`; o teste avisa se faltar.
- Commit com mensagem curta em inglês (`tune: ...`, `feat: ...`, `fix: ...`) e push na `main`, a não ser que peçam outra coisa.

## Onde mexer

| Quero mudar | Arquivo |
|---|---|
| Velocidades, armas, zumbis, chefão, tanque, portões | `src/config.js` |
| Fases: tamanho, barris (vida máx. `maxBarrelHp`), hordas, portões, onde aparecem armas e tanque | `src/level.js` (objeto `DIFFICULTY` no topo e `generateLevel`) |
| Regras: tiros, colisões, portões, chefão socando, tanque | `src/sim.js` (simulação pura, sem DOM) |
| Modelos 3D, cenário, efeitos, números nos barris | `src/render/` |
| HUD, menus, contagem regressiva, estrelas | `index.html`, `css/style.css`, `src/ui.js`, `src/main.js` |
| Som e vibração | `src/audio.js`, `src/device.js`, mapa `FEEDBACK` em `src/main.js` |
| PWA (offline, instalação) | `sw.js`, `manifest.webmanifest`, `src/pwa.js` |

## Decisões já tomadas com o dono (não desfazer sem pedir)

- Primeiro barril: 1 soldado, vida 4. Primeiro portão vermelho: -(4 + operação).
- Tiro no portão vale 1 ponto com até 6 soldados e menos conforme o esquadrão cresce (`GATE_FULL_SQUAD`).
- Zumbis andam reto, sem convergir para o esquadrão (`ZOMBIE_HOMING = 0`), e avançam desde o início da fase.
- Até a Operação 19 a fase começa com mais barris antes da primeira horda; da 20 em diante o começo é curto.
- Armas fortes no meio (45%) e perto do fim (75%) da estrada; da Operação 25 em diante a primeira fica em 30%.
- Escopeta 12 (`shotgun`): 6 chumbos em leque, maior dano por tiro, alcance curto (9). Da Operação 6 em diante, nas fases pares, aparece ao lado da primeira arma; quebrou um barril do par, o outro some. O piloto automático sempre escolhe a outra.
- AK-47 a partir da 20, minigun a partir da 25. Da 30 em diante, o último barril de arma traz **um** tanque aliado, e os zumbis ficam 60% mais rápidos enquanto ele existe.
- O chefão vai até o batalhão, para e soca (8 por segundo); nunca passa reto. Três chefões que se revezam a cada 5 operações.
- Cenário alterna entre deserto (fases ímpares) e cidade em ruínas (fases pares).
- Contagem 3-2-1-VAI antes de cada partida; porcentagem do caminho no HUD.
