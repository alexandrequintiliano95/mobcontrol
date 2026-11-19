# Esquadrão Z: design

Data: 2026-11-19. Status: aprovado no chat (abordagem 1).

## Intenção

Jogar no celular só o minijogo de corrida e tiro que aparece no Last War: Survival Game
(modo "Operação Especial"), sem a parte de base, alianças e o resto do jogo.
Referência: https://www.youtube.com/shorts/aAjkx7Xg0a8

## Objetivos

- As mecânicas do vídeo: o esquadrão corre sozinho e atira para a frente; o jogador só
  move para os lados; barris com número (vida) dão soldados ou armas; hordas de zumbis;
  portões vermelhos tiram soldados.
- Feito para celular: em pé (retrato), tela cheia, controle por toque.
- PWA: instala na tela inicial e funciona offline depois da primeira abertura.
- Publicado no GitHub Pages deste repositório.

## Fora do escopo

Base, construção, loja, moedas, multiplayer, contas, ranking online e música.

## Anti-objetivos

- Copiar nome, arte, personagens ou visual do Last War. As mecânicas são as mesmas;
  o nome e o visual são próprios.
- Rodar travado ou esquentar o celular.
- Precisar de build para rodar ou publicar.

## Restrições

- PWA exige HTTPS. O GitHub Pages resolve, mas exige repo público (ou plano pago) e o
  site fica acessível para quem tiver o link.
- iPhone: sem vibração, instalação manual pelo menu Compartilhar, sem trava de orientação.
- Sem passo de build: o que está no repositório é exatamente o que roda.

## Abordagens

1. **Arquivos estáticos sem build (escolhida).** HTML, módulos JS, Three.js copiado no
   repositório, manifest e service worker escritos à mão. Publicar é dar push. O risco é o
   celular ficar com versão velha em cache; resolvido com cache que se atualiza sozinho.
2. **Vite com plugin de PWA.** Gera o service worker sozinho, mas exige build e uma
   GitHub Action para publicar. Mais peças para manter num jogo pequeno.
3. **App nativo (Capacitor/APK).** Descartado: exige Android Studio e deixa de ser PWA.

## Regras do jogo

Vindas do vídeo:

- O esquadrão começa com 1 soldado, corre sozinho por uma estrada e atira para a frente o
  tempo todo. O jogador arrasta para a esquerda e para a direita.
- Barris têm um número, que é a vida deles. Cada tiro tira vida.
  - Barril com soldados em cima: destruído, os soldados correm e entram no esquadrão.
  - Barril com uma arma em cima: destruído, o esquadrão inteiro troca para essa arma.
- Hordas de zumbis andam em direção ao esquadrão. Zumbi que encosta mata soldado.
- Portões vermelhos com número negativo (-5, -20) tiram soldados de quem passa por eles.
  Cada portão ocupa metade da estrada; quem decide é o centro do esquadrão.
- As fases são numeradas ("Operação N") e ficam mais difíceis.

Escolhas nossas (o vídeo não mostra):

- Barril não destruído que bate no esquadrão mata os soldados na coluna dele e se quebra.
- Portões azuis com número positivo dão soldados. Cada tiro num portão aumenta o número
  dele aos poucos, então um -5 pode virar +3 (e o portão fica azul).
- Armas: fuzil (inicial), metralhadora (cadência alta), sniper (dano alto, atravessa
  inimigos) e bazuca (dano em área).
- Zumbis: comum, corredor (rápido, pouca vida) e grandalhão (muita vida, mata vários).
- A estrada tem tamanho fixo. No fim, o esquadrão para e um zumbi chefão vem andando.
  Matar o chefão vence a fase. Ficar sem soldados é derrota.
- A fase alcançada fica salva no aparelho.

## Visual e som

- Low-poly próprio, feito com formas geométricas no código (sem arquivos de modelo).
- Estrada no deserto ao entardecer (no lugar da ponte do vídeo). Soldados azuis com
  capacete, zumbis verdes, tambores amarelos com o número na frente.
- Câmera atrás e acima do esquadrão, olhando a estrada à frente, como no vídeo.
- Efeitos sonoros gerados no código (WebAudio), com opção de desligar.

## Celular

- Retrato. Em telas largas (PC), o jogo fica numa coluna 9:16 no centro.
- Arrastar em qualquer lugar da tela, com movimento relativo ao toque. Setas e A/D no
  teclado servem só para testes no PC.
- A tela não apaga durante a partida (Wake Lock) e o jogo pausa ao sair do app.
- Vibração (Android) em explosões, perda de soldados e portões vermelhos, com opção de
  desligar.
- Desempenho: desenho em lote (instancing), resolução limitada, sombra em disco em vez de
  sombra real.

## PWA

- Manifest com nome, ícones (192, 512 e maskable), retrato e tela cheia; apple-touch-icon e
  metas para o iPhone.
- Service worker: guarda tudo em cache na instalação; depois responde do cache e atualiza
  em segundo plano, então a versão nova entra na abertura seguinte.
- Botão "Instalar" no Android; dica do menu Compartilhar no iPhone.
- Em localhost o service worker fica desligado por padrão, para não servir arquivo velho
  durante o desenvolvimento.

## Técnico

- Three.js com versão fixa, copiado em `vendor/`. Módulos ES em `src/`.
- A simulação (regras) fica separada da renderização e é testada com `node --test`.
- Servidor local simples em Node para desenvolver.
- Ícones PNG gerados por script, sem dependências.

## Deixado para quem constrói

Números de balanceamento, tamanho das fases, detalhes de arte e efeitos, e textos da
interface.
