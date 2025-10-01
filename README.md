# X Monsters: Contador de PV e Energia

Um contador de pontos de vida (PV) e energia para o jogo de cartas de mesa "X Monsters". Esta é uma aplicação web simples e offline, ideal para ser usada em qualquer dispositivo móvel ou computador durante uma partida.

![Screenshot da aplicação](https://i.imgur.com/example.png) ---

### Funcionalidades

* **Contadores de PV e Energia:** Acompanhe os pontos de vida (PV) e a energia de dois jogadores.
* **Controles Simples:** Botões de `+` e `-` para ajustes rápidos de PV e energia.
* **Edição Direta:** Clique nos valores de PV, energia ou nos nomes dos jogadores para editá-los manualmente.
* **Animações:** Efeitos visuais para indicar o vencedor e o perdedor da partida.
* **Fase de Energia:** Um botão único que aumenta a energia de ambos os jogadores simultaneamente.
* **Dado da Sorte:** Cada jogador pode usar uma vez por jogo para gastar 2 energia e ganhar de 1 a 6 energia extra.
* **Reiniciar Jogo:** Reseta todos os contadores para os valores iniciais.
* **Regras do Jogo:** Um modal pop-up com todas as regras do jogo "X Monsters" para consulta rápida.
* **Efeitos Sonoros:** Sons para todas as ações (punch.mp3, healing.mp3, energy.mp3, waste.mp3, victory.mp3).

---

### Regras do Jogo X Monsters

Este aplicativo foi feito para acompanhar uma partida do jogo de cartas "X Monsters". Aqui estão as regras para sua referência:

#### 1. Objetivo e Condição de Vitória

O objetivo principal é ser o único jogador com monstros em campo e/ou reduzir os pontos de vida do seu oponente a zero. Cada jogador começa com **100 pontos de vida**.

#### 2. Energia

A energia é o recurso principal, usado para invocar monstros e usar habilidades.

* **Energia Inicial:** Cada jogador começa com **5 pontos de energia**.
* **Aumento:** Na sua Fase de Energia, sua energia total aumenta em **1 ponto**, até um limite de **12**.
* **Dado da Sorte:** Uma vez por jogo, cada jogador pode gastar **2 pontos de energia** para rolar um dado da sorte e ganhar de **1 a 6 pontos de energia** adicionais (sem ultrapassar o limite de 12).

#### 3. Fases do Turno

Cada turno é dividido em três fases:

* **Fase de Energia:** Sua energia aumenta em 1 ponto.
* **Fase de Invocação:** Gaste sua energia para jogar cartas da mão (monstros e suportes).
* **Fase de Combate:** Declare ataques com seus monstros contra os monstros do oponente.

#### 4. Combate e Dano

O dano é calculado subtraindo a Defesa do monstro do oponente do Ataque do seu monstro. O dano restante é aplicado aos pontos de vida do oponente.

---

### Como Rodar Localmente

Para usar o contador de PV e energia no seu próprio computador ou dispositivo, siga estes passos:

1.  Clone este repositório para sua máquina local.
    ```bash
    git clone [https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git](https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git)
    ```
2.  Abra a pasta do projeto.
3.  Abra o arquivo `index.html` em seu navegador web preferido (como Chrome, Firefox ou Edge).

Você não precisa de um servidor local ou de uma conexão com a internet para usá-lo!
