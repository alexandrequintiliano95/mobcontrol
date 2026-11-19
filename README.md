# Esquadrão Z

Jogo de celular (PWA) em que um esquadrão corre por uma estrada atirando sozinho. Você arrasta o dedo para os lados para:

- destruir **barris com número** e resgatar os soldados que estão em cima (ou pegar uma arma nova);
- fugir dos **portões vermelhos**, que tiram soldados, e passar pelos **azuis**, que dão soldados (atirar num portão aumenta o número dele);
- segurar as **hordas de zumbis**;
- derrotar o **chefão** no fim de cada operação.

O jogo foi inspirado no minijogo de corrida que aparece em anúncios de jogos de estratégia, mas o nome, a arte e as fases são próprios.

## Jogar

- **No navegador:** abra o endereço do GitHub Pages (veja "Publicar").
- **Instalar no Android (Chrome):** toque em **INSTALAR** no menu do jogo, ou use o menu ⋮ → *Instalar app*.
- **Instalar no iPhone (Safari):** toque em **Compartilhar** → **Adicionar à Tela de Início**.

Depois de aberto uma vez, o jogo funciona sem internet. O progresso fica salvo no aparelho.

## Rodar no computador

Requer Node 22 ou mais novo.

```powershell
npm install
npm run serve
```

Abra http://localhost:5173. Para testar no celular pela mesma rede Wi-Fi, use `npm run serve -- --lan` e abra o endereço "Na rede" que aparecer. Pela rede local não dá para instalar nem jogar offline: isso exige HTTPS.

### Parâmetros de URL (para testes)

| Parâmetro | O que faz |
|---|---|
| `?level=N` | Joga a operação N, sem mudar o progresso salvo |
| `?soldiers=N` | Começa com N soldados |
| `?demo` | O piloto automático joga sozinho |
| `?debug` | Mostra o FPS |
| `?sw` | Liga o service worker em `localhost`, para testar o modo offline |

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes (regras do jogo, fases, controle, save, PWA) |
| `npm run icons` | Gera os ícones em `icons/` |
| `npm run vendor` | Copia o Three.js de `node_modules` para `vendor/` |

Não há passo de build: os arquivos do repositório são exatamente o que o navegador carrega.

## Estrutura

- `src/sim.js`: regras do jogo (simulação pura, testada no Node)
- `src/level.js`: gerador de fases; os números de dificuldade ficam em `DIFFICULTY`
- `src/config.js`: velocidades, armas e zumbis
- `src/render/`: 3D com Three.js
- `src/main.js`: loop do jogo, telas, som e vibração
- `sw.js` e `manifest.webmanifest`: PWA

## Publicar no GitHub Pages

1. O repositório precisa ser público, a não ser que você tenha um plano pago do GitHub.
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
3. O jogo fica em `https://<seu-usuario>.github.io/mobcontrol/`.

Ao mudar algum arquivo, ele precisa continuar listado em `ASSETS` no `sw.js`; o `npm test` avisa se faltar algum. Os celulares pegam a versão nova na abertura seguinte do jogo.
