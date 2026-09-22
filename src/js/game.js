// Constantes do jogo
        const INITIAL_PV = 300;
        const INITIAL_ENERGY = 6;
        const MAX_ENERGY = 20;
        // Cada turno dura no máximo 45s: no hotseat o cliente passa a vez sozinho;
        // no PvP quem manda é o servidor (o cliente só desenha o contador).
        const TURN_SECONDS = 45;
        window.gameConfig = { initialPv: INITIAL_PV, initialEnergy: INITIAL_ENERGY, turnSeconds: TURN_SECONDS };
        const gameState = window.GameStateModel.createInitialGameState(window.gameConfig);
        window.gameState = gameState;
        window.gameEngine = window.GameEngine.createEngine(gameState);
        if (window.cardAbilities?.attachEngine) {
            window.cardAbilities.attachEngine(window.gameEngine);
        }
        // Flag que indica se a partida já terminou
        window.gameOver = false;
        // Garante uma única vinheta de vitória por partida finalizada
        window.victorySoundPlayed = false;
        // Geração da partida: invalida callbacks (setTimeout) da partida anterior
        window.matchGeneration = 0;

        // ── Ponte com a sessão PvP ───────────────────────────────────────────
        // Em PvP os handlers de UI interceptam a ação e enviam o comando; durante
        // a aplicação remota a sessão devolve false, e o corpo do handler roda
        // normalmente (o autor também aplica pelo broadcast do servidor).
        function pvpGuard(request) {
            const sessao = window.PvpSession?.PvpSession;
            if (!sessao || typeof sessao.intercept !== 'function') return false;
            return sessao.intercept(request);
        }

        function pvpAplicando() {
            const sessao = window.PvpSession?.PvpSession;
            return Boolean(sessao && typeof sessao.isApplying === 'function' && sessao.isApplying());
        }

        function pvpReveal(cardId, fromZone) {
            const reveal = window.PvpGame?.buildReveal?.(cardId, fromZone);
            return reveal ? [reveal] : [];
        }

        // Assento local marcado por `pvp-game.js` no corpo da página.
        function assentoLocal() {
            return document.body?.dataset?.seat || null;
        }

        // Contagem de cartas na mão publicada pelo servidor (websocket). Em PvP
        // o número exibido é este, não a recontagem do estado local: os dois
        // navegadores mostram o mesmo valor mesmo se um replay divergir.
        function pvpContagemDoServidor(player) {
            const sessao = window.PvpSession?.PvpSession?.current;
            return sessao && typeof sessao.handSizeOf === 'function' ? sessao.handSizeOf(player) : null;
        }

        /**
         * Publica no servidor a contagem local quando ela divergiu da publicada
         * (`null` = o servidor ainda não mandou nenhuma: bootstrap/fora do PvP).
         * Só fora do replay/aplicação: no meio deles o estado local está parcial.
         */
        function publicarContagemDivergente(player, local, doServidor) {
            if (player !== assentoLocal()) return;
            if (!Number.isFinite(doServidor) || doServidor === local) return;
            const sessao = window.PvpSession?.PvpSession?.current;
            if (!sessao || sessao.isApplying?.() || sessao.isReplaying?.()) return;
            sessao.publicarContagemDeMao?.();
        }

        // Sistema de cartas será carregado do JSON
        let cardsDatabase = null;
        let deckBuilder = null;

        function renderPlayerStat(stat, player) {
            const element = document.getElementById(`${stat}-${player}`);
            if (!element) return;

            const value = window.GameStateModel.getPlayerStat(gameState, stat, player);
            element.innerText = value;

            if (stat === 'pv') {
                element.classList.toggle('pv-zero', value <= 0);
            }
        }

        function renderPlayerStats() {
            ['p1', 'p2'].forEach(player => {
                renderPlayerStat('pv', player);
                renderPlayerStat('energy', player);
            });
        }
        window.renderPlayerStats = renderPlayerStats;

        // Habilita/desabilita a interatividade da partida inteira. O fim de jogo
        // trava os controles e o reset precisa devolvê-los ao estado inicial.
        function setMatchButtonsEnabled(enabled) {
            document.querySelectorAll('button').forEach(btn => {
                btn.disabled = !enabled;
            });
        }

        // Funções de controle de stats (do contador original)
        function endGame(vencedor) {
            // Em PvP quem sentencia o fim é o servidor: aqui só informamos o
            // resultado e esperamos o GAME_OVER oficial (mesmo vencedor nos dois).
            if (typeof window.sendGameOver === 'function') {
                window.gameOver = true;
                playVictorySound();
                window.sendGameOver(vencedor);
                return;
            }
            // Define que o jogo terminou
            window.gameOver = true;
            // Vinheta de vitória: cobre o fim disparado pelo motor
            // (game-engine.js -> window.endGame); idempotente por partida
            playVictorySound();
            // Desabilita todos os botões para evitar novas interações
            setMatchButtonsEnabled(false);

            // O motor pode detectar o PV <= 0 mais de uma vez (pacotes de dano
            // diferentes): não empilhar overlays quando já existe um
            if (document.getElementById('game-over-overlay')) return;

            // Cria sobreposição informando o vencedor
            const overlay = document.createElement('div');
            overlay.id = 'game-over-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '1000';
            // Organizar o conteúdo em um container para que o botão fique abaixo do texto
            overlay.innerHTML = `<div style="text-align:center;">
                <h1 style="color:white; font-size:3rem;">${vencedor} venceu!</h1>
                <div style="margin-top:1rem;">
                    <button class="action-button" onclick="resetGame()">Nova partida</button>
                </div>
            </div>`;
            document.body.appendChild(overlay);
        }
        // Exponha a função de fim de jogo para o GameEngine
        window.endGame = endGame;

        function changeStat(stat, player, amount) {
            // Se a partida já terminou, não faz nada
            if (window.gameOver) return;

            const newValue = window.GameStateModel.changePlayerStat(
                gameState,
                stat,
                player,
                amount,
                { energyCap: MAX_ENERGY }
            );

            // Sons
            if (stat === 'pv' && amount < 0) playSound('punchSound');
            if (stat === 'pv' && amount > 0) playSound('healingSound');
            if (stat === 'energy' && amount > 0) playSound('energySound');
            if (stat === 'energy' && amount < 0) playSound('wasteSound');

            renderPlayerStat(stat, player);
            const element = document.getElementById(`${stat}-${player}`);

            // Efeito visual para energia ganha automaticamente no turno
            if (stat === 'energy' && amount > 0) {
                element.style.transform = 'scale(1.3)';
                element.style.boxShadow = '0 0 20px var(--energy-color)';
                setTimeout(() => {
                    element.style.transform = '';
                    element.style.boxShadow = '';
                }, 600);
            }

            // Verificar vitória
            if (stat === 'pv' && newValue <= 0) {
                element.classList.add('pv-zero');
                playVictorySound();
                const vencedor = player === 'p1' ? 'Jogador 2' : 'Jogador 1';
                showTurnNotification(`🏆 ${vencedor} venceu!`, 2500);
                const generation = window.matchGeneration;
                setTimeout(() => {
                    // Ignorar se a partida foi reiniciada neste intervalo
                    if (generation !== window.matchGeneration) return;
                    endGame(vencedor);
                }, 2500);
            } else if (stat === 'pv') {
                element.classList.remove('pv-zero');
                // PV voltou a ser positivo: libera a vinheta para um próximo fim
                window.victorySoundPlayed = false;
            }
        }

        function editName(player) {
            if (window.PvpSession?.PvpSession && player !== document.body.dataset.seat) {
                showMessage('Apenas o jogador local pode alterar nomes.', 'warning');
                return;
            }
            const nameElement = document.querySelector(`.player${player === 'p1' ? '1' : '2'}-stats .player-name`);
            const newName = prompt('Digite o novo nome do jogador:', nameElement.innerText);
            if (newName && newName.trim()) {
                // Em PvP o nome é comando do ledger: o broadcast atualiza os
                // dois clientes (autor incluído) na mesma ordem.
                if (pvpGuard({ cmd: 'SET_NAME', args: { name: newName.trim() } })) return;
                // Atualiza visualmente o nome no painel de stats
                nameElement.innerText = newName;
                // Persiste o nome no estado canônico
                window.GameStateModel.setPlayerName(gameState, player, newName);
                // Atualiza o título da mão para refletir o novo nome
                const handTitle = document.getElementById(`hand-title-${player}`);
                if (handTitle) {
                    handTitle.innerText = `Mão - ${newName}`;
                }
            }
        }

        function editStatValue(stat, player) {
            if (window.PvpSession && player !== document.body.dataset.seat) {
                showMessage('Apenas o jogador local pode alterar estatísticas.', 'warning');
                return;
            }
            const element = document.getElementById(`${stat}-${player}`);
            const newValue = prompt(`Digite o novo valor para ${stat}:`, element.innerText);
            if (newValue !== null && newValue !== '' && !isNaN(newValue)) {
                let parsedValue = parseInt(newValue);
                parsedValue = window.GameStateModel.setPlayerStat(
                    gameState,
                    stat,
                    player,
                    parsedValue,
                    { energyCap: MAX_ENERGY }
                );
                renderPlayerStat(stat, player);
                
                if (stat === 'pv') {
                    if (parsedValue <= 0) {
                        element.classList.add('pv-zero');
                        playVictorySound();
                    } else {
                        element.classList.remove('pv-zero');
                        // PV voltou a ser positivo: libera a vinheta para um próximo fim
                        window.victorySoundPlayed = false;
                    }
                }
            }
        }

        // Faces do dado: o ícone é `assets/dice/dice-N.svg` (`dice-face-N` no CSS)
        // e o valor fica também no `data-face`, porque o "+N" flutuante é filho do
        // botão e `textContent` leria "5+5".
        const DICE_FACES = ['1', '2', '3', '4', '5', '6'];

        function marcarFaceDoDado(diceButton, valor) {
            DICE_FACES.forEach(face => diceButton.classList.remove(`dice-face-${face}`));
            diceButton.classList.add(`dice-face-${valor}`);
            diceButton.textContent = '';
            diceButton.dataset.face = String(valor);
        }

        function limparFaceDoDado(diceButton) {
            DICE_FACES.forEach(face => diceButton.classList.remove(`dice-face-${face}`));
            diceButton.textContent = '🎲';
            delete diceButton.dataset.face;
        }

        // Um só lugar decide o "já jogado": face conhecida (quando houver) e botão
        // desabilitado a partir do estado (`gameState.diceUsed`). No PvP o mesmo
        // comando do ledger é aplicado nos dois navegadores, então o visual precisa
        // ser idempotente: replay/F5 repinta sem recontabilizar a energia.
        function marcarDadoComoUsado(diceButton, player, valor) {
            const face = Number.isFinite(valor) ? Number(valor) : null;
            if (face !== null) marcarFaceDoDado(diceButton, face);
            diceButton.dataset.diceRolled = '1';
            diceButton.disabled = true;
            gameState.diceUsed[player] = true;
            diceButton.title = face !== null
                ? `Dado da sorte: ${face} (já usado nesta partida)`
                : 'Dado da sorte já usado nesta partida';
        }

        // O dado "sorteia" na tela: as faces trocam até o resultado oficial chegar.
        // Um timer por botão (WeakMap), porque os dois lados podem rolar em PvP.
        const girosDeFace = new WeakMap();

        function iniciarGiroDeFaces(diceButton) {
            pararGiroDeFaces(diceButton);
            // Face imediata: o intervalo só viria 90ms depois e o dado passaria
            // um instante sem ícone na tela.
            const sortearFace = () => marcarFaceDoDado(
                diceButton,
                DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)]
            );
            sortearFace();
            const timer = setInterval(sortearFace, 90);
            girosDeFace.set(diceButton, timer);
        }

        function pararGiroDeFaces(diceButton) {
            const timer = girosDeFace.get(diceButton);
            if (!timer) return;
            clearInterval(timer);
            girosDeFace.delete(diceButton);
        }

        // Dado de volta ao estado de partida nova: emoji, habilitado e sem giro.
        // `resetGame` e o remount do PvP (`montarPartida`) passam por aqui: o
        // `dataset.diceRolled` sobrevive no DOM e engoliria o dado da partida
        // seguinte (o botão ficava "usado" numa partida que ainda não usou).
        function resetDiceUI() {
            ['p1', 'p2'].forEach(player => {
                const diceButton = document.getElementById(`dice-${player}`);
                if (!diceButton) return;
                pararGiroDeFaces(diceButton);
                delete diceButton.dataset.diceRolled;
                diceButton.classList.remove('dice-rolling', 'dice-settled');
                limparFaceDoDado(diceButton);
                diceButton.disabled = false;
                diceButton.title = 'Dado da Sorte (2 energia)';
            });
        }
        window.resetDiceUI = resetDiceUI;

        // Feedback do resultado do dado: pulso dourado na energia + o "+N" subindo
        // do botão. Tudo local e fora do fluxo — o overlay central (`showMessage`)
        // cobria o tabuleiro e o "+N" em fluxo empurrava a pílula de energia.
        function animarResultadoDoDado(diceButton, player, diceResult) {
            const energyElement = document.getElementById(`energy-${player}`);
            if (energyElement) {
                // Reflow entre as classes: sem ele a animação não reinicia em usos
                // seguidos (o dado de p1 e o de p2 no mesmo turno).
                energyElement.classList.remove('energy-gain-dice');
                void energyElement.offsetWidth;
                energyElement.classList.add('energy-gain-dice');
                setTimeout(() => energyElement.classList.remove('energy-gain-dice'), 900);
            }

            const flutuante = document.createElement('div');
            flutuante.textContent = `+${diceResult}`;
            flutuante.className = 'dice-result-floating';
            flutuante.setAttribute('aria-hidden', 'true');
            diceButton.appendChild(flutuante);
            setTimeout(() => flutuante.remove(), 1500);
        }

        function rollDice(player, forcedValue = null) {
            // Em PvP o dado é do servidor: pedimos e só aplicamos no DICE_RESULT.
            if (forcedValue === null && pvpGuard({ cmd: 'ROLL_DICE', args: { player } })) {
                return;
            }

            const diceButton = document.getElementById(`dice-${player}`);
            if (!diceButton) return;

            if (gameState.diceUsed[player]) {
                // Valor vindo do ledger de um dado já contabilizado neste cliente
                // (F5/replay, MATCH_START repetido): a energia não se paga duas
                // vezes — só o visual volta ao "já jogado" com a face sorteada.
                if (forcedValue !== null) {
                    marcarDadoComoUsado(diceButton, player, Number(forcedValue));
                    return;
                }
                showMessage('Você já usou o dado da sorte nesta partida!', 'warning');
                return;
            }

            const currentEnergy = window.GameStateModel.getPlayerStat(gameState, 'energy', player);
            if (currentEnergy < 2) {
                showMessage('Você precisa de 2 de energia para usar o dado da sorte!', 'warning');
                return;
            }

            changeStat('energy', player, -2);

            diceButton.classList.remove('dice-settled');
            diceButton.classList.add('dice-rolling');
            diceButton.title = 'Rolando o dado da sorte…';
            // As faces trocam enquanto o resultado não chega: aí o dado parece
            // realmente sendo sorteado, e não um giro à toa.
            iniciarGiroDeFaces(diceButton);
            // Rede de segurança: se o resultado não voltar (queda no meio do roll
            // no PvP), o dado para de girar em vez de rodar para sempre.
            setTimeout(() => {
                pararGiroDeFaces(diceButton);
                diceButton.classList.remove('dice-rolling');
            }, 5000);

            const aplicarResultado = (diceResult) => {
                // Guarda contra aplicação dupla (físico + remoto/DICE_RESULT no PvP).
                if (diceButton.dataset.diceRolled === '1') return;
                diceButton.dataset.diceRolled = '1';
                changeStat('energy', player, diceResult);

                // O resultado fica no próprio dado (face sorteada) com o "+N" e o
                // pulso da energia: nada de overlay no meio do tabuleiro.
                pararGiroDeFaces(diceButton);
                diceButton.classList.remove('dice-rolling');
                diceButton.classList.add('dice-settled');
                marcarDadoComoUsado(diceButton, player, diceResult);
                animarResultadoDoDado(diceButton, player, diceResult);
                // O estado "já jogado" é o `:disabled` do CSS: a classe do quique
                // sai depois da animação para não manter destaque no botão.
                setTimeout(() => diceButton.classList.remove('dice-settled'), 500);
            };

            // Valor do servidor (PvP) aplica na hora; no modo local anima 800ms.
            const generation = window.matchGeneration;
            if (forcedValue !== null) {
                aplicarResultado(Number(forcedValue));
                return;
            }

            setTimeout(() => {
                // Partida reiniciada durante o giro: o dado da partida antiga não
                // pode cair na nova (mesmo guard do `endGame`/`drawCardFromDeck`).
                if (generation !== window.matchGeneration) return;
                aplicarResultado(Math.floor(Math.random() * 6) + 1);
            }, 800);
        }

        function playSound(soundId) {
            const sound = document.getElementById(soundId);
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Erro ao tocar som:', e));
            }
        }

        // Vinheta de vitória: toca uma única vez por partida finalizada, seja o
        // fim disparado pelo motor (game-engine.js -> window.endGame) ou pelo
        // caminho legado (changeStat / edição manual de PV).
        function playVictorySound() {
            if (window.victorySoundPlayed) return;
            window.victorySoundPlayed = true;
            playSound('victorySound');
        }
        window.playVictorySound = playVictorySound;

        // Funções do jogo
        function nextPhase() {
            const phases = ['energy', 'invocation', 'combat'];
            const currentIndex = phases.indexOf(gameState.currentPhase);
            
            // Limpar estado de combate ao sair da fase
            if (gameState.currentPhase === 'combat') {
                clearCombatHighlights();
            }
            
            if (currentIndex < phases.length - 1) {
                setPhase(phases[currentIndex + 1]);
            } else {
                endTurn();
                return;
            }

            if (gameState.currentPhase === 'energy') {
                changeStat('energy', gameState.currentPlayer, 1);
            }

            updateUI();
        }

        function updateAttackedCardsVisual() {
            document.querySelectorAll('.card').forEach(card => {
                card.classList.remove('already-attacked');
            });

            Object.values(gameState.cardInstances).forEach(card => {
                if (card.zone !== 'field') return;
                if (window.gameEngine.getAttackCount(card.instanceId) >=
                    window.gameEngine.getAttackLimit(card.instanceId)) {
                    card.element?.classList.add('already-attacked');
                }
            });
        }

        // ── Relógio de turno ────────────────────────────────────────────────
        // Limite do turno: `gameConfig.turnSeconds` (45s). Os dois modos usam o
        // mesmo contador, mas só o hotseat decide sozinho — em PvP a transição é
        // do servidor (`END_TURN` no ledger), então o contador aqui é só leitura.
        let contadorDeTurno = null;
        let fimDoTurnoEm = 0;

        function limiteDeTurno() {
            const valor = Number(window.gameConfig?.turnSeconds);
            return Number.isFinite(valor) && valor > 0 ? valor : 0;
        }

        function pintaContadorDeTurno(segundos) {
            const alvo = document.getElementById('turn-timer');
            if (!alvo) return;
            const inteiros = Math.max(0, Math.ceil(segundos));
            alvo.textContent = `${inteiros}s`;
            alvo.classList.toggle('turn-timer-warning', inteiros > 0 && inteiros <= 10);
            alvo.classList.toggle('turn-timer-over', inteiros === 0);
        }
        window.pintaContadorDeTurno = pintaContadorDeTurno;

        function pararTempoDeTurno() {
            if (contadorDeTurno !== null) clearInterval(contadorDeTurno);
            contadorDeTurno = null;
        }
        window.pararTempoDeTurno = pararTempoDeTurno;

        /**
         * Reinicia o contador do turno. Sem argumento usa o limite do jogo; o PvP
         * passa o `prazoTurno` que o servidor publicou (relógio dele é a
         * autoridade). `0` (ou limite desligado) esconde o contador.
         */
        function reiniciarTempoDeTurno(segundos = null) {
            pararTempoDeTurno();
            const limite = segundos === null
                ? limiteDeTurno()
                : Math.max(0, Number(segundos) || 0);
            const alvo = document.getElementById('turn-timer');
            if (!limite) {
                if (alvo) alvo.textContent = '--';
                return;
            }

            fimDoTurnoEm = Date.now() + limite * 1000;
            pintaContadorDeTurno(limite);
            // Guarda a geração da partida: um intervalo pendente não pode passar a
            // vez da partida seguinte (mesmo cuidado dos outros timers).
            const generation = window.matchGeneration;
            contadorDeTurno = setInterval(() => {
                if (generation !== window.matchGeneration) {
                    pararTempoDeTurno();
                    return;
                }
                const restante = (fimDoTurnoEm - Date.now()) / 1000;
                pintaContadorDeTurno(Math.max(0, restante));
                if (restante > 0) return;
                pararTempoDeTurno();
                // Em PvP o servidor passa a vez; o cliente só espera o comando.
                if (window.PvpSession?.PvpSession) return;
                if (typeof endTurn === 'function') endTurn();
            }, 250);
        }
        window.reiniciarTempoDeTurno = reiniciarTempoDeTurno;

        function endTurn() {
            if (pvpGuard({ cmd: 'END_TURN', args: {} })) return;
            const endingPlayer = gameState.currentPlayer;
            const endingPhase = gameState.currentPhase;
            const endingTurn = gameState.turn;
            const nextPlayer = endingPlayer === 'p1' ? 'p2' : 'p1';
            const result = window.gameEngine.resolveAction({
                type: 'END_TURN',
                actorId: endingPlayer,
                requiresTurn: true,
                effects: [
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.PHASE_ENDING,
                        payload: { playerId: endingPlayer, phase: endingPhase, turnNumber: endingTurn },
                        immediate: true
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.TURN_ENDING,
                        payload: { playerId: endingPlayer, turnNumber: endingTurn },
                        immediate: true
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.SET_TURN_STATE,
                        changes: {
                            currentPlayer: nextPlayer,
                            currentPhase: 'energy',
                            turn: endingTurn + 1
                        }
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.TURN_ENDED,
                        payload: { playerId: endingPlayer, turnNumber: endingTurn },
                        immediate: true
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.TURN_STARTED,
                        payload: { playerId: nextPlayer, turnNumber: endingTurn + 1 },
                        immediate: true
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.PHASE_STARTED,
                        payload: { playerId: nextPlayer, phase: 'energy', turnNumber: endingTurn + 1 },
                        immediate: true
                    }
                ]
            });

            if (result.status !== 'resolved') {
                showMessage(result.reason, 'warning');
                return;
            }
            
            // Processar efeitos temporários das habilidades
            if (window.cardAbilities) {
                window.cardAbilities.processTurnEffects();
            }
            
            // Limpar lista de cartas que atacaram
            gameState.attackedThisTurn = [];
            updateAttackedCardsVisual();
            
            // Obter nome do jogador atual a partir do estado canônico
            const currentPlayerName = window.GameStateModel.getPlayerName(gameState, gameState.currentPlayer);
            
            // Aumentar o máximo de energia do jogador atual em 1 (até o limite)
            if (gameState.maxEnergy[gameState.currentPlayer] < MAX_ENERGY) {
                gameState.maxEnergy[gameState.currentPlayer]++;
            }

            // Restaurar energia para o novo máximo (igual ao index.html)
            const newEnergy = gameState.maxEnergy[gameState.currentPlayer];
            window.GameStateModel.setPlayerStat(
                gameState,
                'energy',
                gameState.currentPlayer,
                newEnergy,
                { energyCap: MAX_ENERGY }
            );
            renderPlayerStat('energy', gameState.currentPlayer);

            // Mostrar notificação de energia
            showTurnNotification(`⚡ ${currentPlayerName}<br/>Energia: ${newEnergy}`, 1000);
            
            updateUI();

            // O turno virou: o novo assento da vez ganha o relógio cheio (no PvP o
            // servidor publica o `prazoTurno` dele na sequência e o contador é
            // reajustado — assim os dois navegadores mostram o mesmo número).
            reiniciarTempoDeTurno();
            
            // Em PvP a compra e a troca de fase do novo turno são comandos
            // próprios (o servidor replica nos dois), então o encadeamento local
            // por setTimeout não vale aqui.
            if (window.PvpSession) {
                showTurnNotification(` ${currentPlayerName}<br/>Preparando o turno…`, 1500);
                return;
            }

            // Automaticamente mudar para fase de invocação após delay
            const generation = window.matchGeneration;
            setTimeout(() => {
                // Ignorar callbacks de uma partida que já foi reiniciada
                if (generation !== window.matchGeneration) return;
                addCardToHand(gameState.currentPlayer);
                setPhase('invocation');

                // Mostrar segunda notificação da fase
                showTurnNotification(`🃏 ${currentPlayerName}<br/>Fase de Invocação`, 1500);
            }, 1000);
        }

        function setPhase(phase) {
            if (pvpGuard({ cmd: 'SET_PHASE', args: { phase } })) return;
            console.log('Mudando para fase:', phase);
            const previousPhase = gameState.currentPhase;
            if (previousPhase === phase) return;
            if (previousPhase === 'combat') clearCombatHighlights();
            const result = window.gameEngine.resolveAction({
                type: 'CHANGE_PHASE',
                actorId: gameState.currentPlayer,
                effects: [
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.PHASE_ENDING,
                        payload: {
                            playerId: gameState.currentPlayer,
                            phase: previousPhase,
                            turnNumber: gameState.turn
                        },
                        immediate: true
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.SET_TURN_STATE,
                        changes: { currentPhase: phase }
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.EMIT_EVENT,
                        type: window.GameEngine.EVENT_TYPES.PHASE_STARTED,
                        payload: {
                            playerId: gameState.currentPlayer,
                            phase,
                            turnNumber: gameState.turn
                        },
                        immediate: true
                    }
                ]
            });
            if (result.status !== 'resolved') {
                showMessage(result.reason, 'warning');
                return;
            }
            updateUI();
            
            // Tocar som de confirmação
            playSound('energySound');
        }

        function updateUI() {
            const turnoElement = document.getElementById('current-player');
            if (turnoElement) {
                turnoElement.textContent = gameState.currentPlayer === 'p1' ? 'Jogador 1' : 'Jogador 2';
            }

            const faseElement = document.getElementById('current-phase');
            if (faseElement) {
                const phaseNames = { energy: 'Energia', invocation: 'Invocação', combat: 'Combate' };
                faseElement.textContent = phaseNames[gameState.currentPhase] || gameState.currentPhase;
            }

            // Atualizar botões de fase (semáforo)
            document.querySelectorAll('.phase-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Mapear fases para IDs dos botões
            const phaseButtonIds = {
                'energy': 'energy-phase',
                'invocation': 'invocation-phase',
                'combat': 'combat-phase'
            };

            const activeButtonId = phaseButtonIds[gameState.currentPhase];
            const activeButton = document.getElementById(activeButtonId);
            if (activeButton) {
                activeButton.classList.add('active');
            }

            // Atualizar campo ativo
            const field1 = document.getElementById('field-p1');
            const field2 = document.getElementById('field-p2');
            const currentField = document.getElementById(`field-${gameState.currentPlayer}`);
            if (field1) field1.classList.remove('field-active');
            if (field2) field2.classList.remove('field-active');
            if (currentField) currentField.classList.add('field-active');

            // Controlar visibilidade das mãos baseado no turno
            updateHandVisibility();

            // Mostrar/ocultar informações de combate e botão de ataque direto
            const combatInfo = document.getElementById('combat-info');
            const directAttackBtn = document.getElementById('direct-attack-btn');

            if (gameState.currentPhase === 'combat') {
                if (combatInfo) combatInfo.style.display = 'block';
                if (directAttackBtn) directAttackBtn.style.display = 'block';
                updateCombatInstructions();
            } else {
                if (combatInfo) combatInfo.style.display = 'none';
                if (directAttackBtn) directAttackBtn.style.display = 'none';
            }

            // Atualizar instruções baseadas na fase
            updatePhaseInstructions();

            // Destacar cartas invocáveis na fase de invocação
            if (gameState.currentPhase === 'invocation') {
                highlightSummonableCards();
            } else {
                clearSummonHighlights();
            }

            // Contadores de zona entram em qualquer repaint: uma carta que puxa do
            // deck para a mão (Zol) muda o saldo sem passar pelos renderers.
            ['p1', 'p2'].forEach(player => updateDeckCounter(player));
        }

        function updatePhaseInstructions() {
            const instruction = document.getElementById('combat-instruction');
            if (!instruction) return;

            switch (gameState.currentPhase) {
                case 'energy':
                    instruction.textContent = 'Fase de Energia - Ganhe energia e use habilidades';
                    break;
                case 'invocation':
                    instruction.textContent = 'Fase de Invocação - Baixe cartas da mão para o campo';
                    break;
                case 'combat':
                    instruction.textContent = 'Fase de Combate - Selecione cartas para atacar';
                    break;
            }
        }

        function updateCombatInstructions() {
            const instruction = document.getElementById('combat-instruction');
            if (gameState.attackingCard) {
                instruction.textContent = 'Selecione um alvo para atacar ou clique em Ataque Direto';
            } else {
                instruction.textContent = 'Selecione uma carta sua para atacar';
            }
        }

        function updateInvocationInfo(message) {
            const instruction = document.getElementById('combat-instruction');
            if (instruction) {
                instruction.textContent = message;
            }
        }

        function highlightSummonableCards() {
            const currentPlayer = gameState.currentPlayer;
            const currentEnergy = window.GameStateModel.getPlayerStat(gameState, 'energy', currentPlayer);
            const playerHand = gameState.cards[currentPlayer].hand;
            
            // Destacar cartas que podem ser invocadas
            playerHand.forEach(card => {
                const cardElement = document.getElementById(card.id);
                if (!cardElement) return;

                const hasEnergy = getEffectiveCardCost(card.id, card.data) <= currentEnergy;
                const evolutionCheck = window.CardRules?.validateEvolutionSummon
                    ? window.CardRules.validateEvolutionSummon(gameState, card.data.id, currentPlayer)
                    : { valid: true };

                if (hasEnergy && evolutionCheck.valid) {
                    cardElement.classList.add('can-be-summoned');
                } else {
                    cardElement.classList.remove('can-be-summoned');
                }
            });
        }

        function clearSummonHighlights() {
            document.querySelectorAll('.can-be-summoned').forEach(card => {
                card.classList.remove('can-be-summoned');
            });
        }

        function updateHandVisibility() {
            // Em PvP a mao alheia e sempre N versos + contagem (renderHandsFromState):
            // o esconderijo de hotseat por turno nao se aplica.
            if (window.PvpSession) return;
            const player1Hand = document.querySelector('.player1-hand');
            const player2Hand = document.querySelector('.player2-hand');
            
            // Remover classes anteriores
            player1Hand.classList.remove('player-hand-hidden', 'player-hand-peeking');
            player2Hand.classList.remove('player-hand-hidden', 'player-hand-peeking');
            
            // Esconder a mão do jogador que não está no turno
            if (gameState.currentPlayer === 'p1') {
                player2Hand.classList.add('player-hand-hidden');
                console.log('🎮 Turno do Player 1 - Escondendo mão do Player 2');
            } else {
                player1Hand.classList.add('player-hand-hidden');
                console.log('🎮 Turno do Player 2 - Escondendo mão do Player 1');
            }
        }

        function peekHand(player) {
            // Em PvP a mão alheia é segredo: nunca há o que espiar.
            if (window.PvpSession && player !== assentoLocal()) {
                showMessage('A mão do oponente é secreta nesta partida.', 'warning');
                return;
            }
            // Só permite espiar se não for o turno do jogador
            if (gameState.currentPlayer !== player) {
                const handElement = document.querySelector(`.player${player === 'p1' ? '1' : '2'}-hand`);
                handElement.classList.add('player-hand-peeking');
                console.log(`👁️ Espiando mão do ${player}`);
            }
        }

        function stopPeeking(player) {
            const handElement = document.querySelector(`.player${player === 'p1' ? '1' : '2'}-hand`);
            handElement.classList.remove('player-hand-peeking');
            console.log(`🙈 Parando de espiar mão do ${player}`);
        }
        
        function setupCombatPhase() {
            clearCombatHighlights();
            
            const myCards = gameState.cards[gameState.currentPlayer].field
                .filter(card => ['criatura', 'evolução'].includes(card.data.type));
            
            if (myCards.length === 0) {
                updateCombatInfo('Você não tem cartas no campo para atacar!');
                return;
            }
            
            let availableAttackers = 0;
            myCards.forEach(card => {
                const element = document.getElementById(card.id);
                const attackCheck = window.gameEngine.canAttack(card.id);
                if (element && attackCheck.canAttack) {
                    element.classList.add('can-attack');
                    availableAttackers++;
                }
            });

            updateCombatInfo(availableAttackers > 0
                ? 'Selecione uma de suas cartas (destacadas em laranja) para atacar'
                : 'Todas as suas criaturas já usaram seus ataques neste turno');
        }

        function highlightTargets() {
            const opponent = gameState.currentPlayer === 'p1' ? 'p2' : 'p1';
            const opponentCards = gameState.cards[opponent].field;
            const attackerId = gameState.attackingCard;
            
            console.log('Destacando alvos para', opponent, 'cartas:', opponentCards.length);
            
            let validTargets = 0;
            
            // Verificar e destacar apenas cartas que podem ser atacadas
            opponentCards.forEach(card => {
                const element = document.getElementById(card.id);
                if (element) {
                    // Verificar se o atacante pode atacar este alvo
                    const attackCheck = canAttackTarget(attackerId, card.id);
                    
                    if (attackCheck.canAttack) {
                        element.classList.add('can-be-targeted');
                        validTargets++;
                        console.log('✅ Destacando carta válida:', card.id);
                    } else {
                        element.classList.add('cannot-be-targeted');
                        console.log('❌ Carta protegida:', card.id, '-', attackCheck.reason);
                    }
                } else {
                    console.log('Elemento não encontrado:', card.id);
                }
            });

            // Controlar botão de ataque direto
            const directAttackBtn = document.getElementById('direct-attack-btn');
            const protectedCards = opponentCards.length - validTargets;
            const canAttackDirectly = window.CardRules.canDirectAttack(gameState, attackerId);

            if (opponentCards.length === 0) {
                if (directAttackBtn) directAttackBtn.style.display = 'inline-block';
                updateCombatInfo('Campo inimigo vazio! Use "Ataque Direto"');
            } else if (validTargets === 0 && canAttackDirectly) {
                if (directAttackBtn) directAttackBtn.style.display = 'inline-block';
                updateCombatInfo(`Todas as cartas inimigas estão protegidas! Use "Ataque Direto"`);
            } else {
                if (directAttackBtn) directAttackBtn.style.display = canAttackDirectly ? 'inline-block' : 'none';
                let message = `Clique em uma carta inimiga (vermelha) para atacar`;
                if (protectedCards > 0) {
                    message += ` - ${protectedCards} carta(s) protegida(s) 🛡️`;
                }
                if (canAttackDirectly) message += ` ou use "Ataque Direto"`;
                updateCombatInfo(message);
            }
        }

        function updateCombatInfo(message) {
            const instruction = document.getElementById('combat-instruction');
            if (instruction) instruction.textContent = message;
        }

        function isCardInField(cardId) {
            console.log('🏟️ Verificando se carta está em campo:', cardId);
            
            // Verificar no gameState primeiro
            for (let player of ['p1', 'p2']) {
                const found = gameState.cards[player].field.find(c => c.id === cardId);
                console.log(`🏟️ Player ${player} field:`, gameState.cards[player].field.length, 'cartas');
                if (found) {
                    console.log('🏟️ Carta encontrada em gameState campo:', player);
                    return true;
                }
            }
            
            // Verificar no DOM também (para cartas equipadas ou outras situações)
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                const fieldP1 = document.getElementById('field-p1');
                const fieldP2 = document.getElementById('field-p2');
                
                const isInP1Field = fieldP1.contains(cardElement);
                const isInP2Field = fieldP2.contains(cardElement);
                
                if (isInP1Field || isInP2Field) {
                    console.log('🏟️ Carta encontrada no DOM campo:', isInP1Field ? 'p1' : 'p2');
                    console.log('🏟️ Elemento da carta:', cardElement);
                    console.log('🏟️ Classes da carta:', cardElement.className);
                    return true;
                }
            }
            
            console.log('🏟️ Carta NÃO encontrada em campo');
            return false;
        }

        function clearCombatHighlights() {
            console.log('🧹 Limpando highlights de combate');
            document.querySelectorAll('.card').forEach(card => {
                card.classList.remove('attacking', 'can-attack', 'can-be-targeted', 'cannot-be-targeted', 'direct-attack');
            });
            
            // Ocultar botão de ataque direto
            const directAttackBtn = document.getElementById('direct-attack-btn');
            if (directAttackBtn) {
                directAttackBtn.style.display = 'none';
            }
            
            gameState.attackingCard = null;
            gameState.targetCard = null;
        }

        function canAttackTarget(attackerId, targetId, options = {}) {
            const attacker = findCardData(attackerId);
            const target = findCardData(targetId);
            
            if (!attacker || !target) {
                return { canAttack: false, reason: 'Cartas não encontradas' };
            }

            if (!options.skipEngine) {
                const baseCheck = window.gameEngine.validateCombat({ attackerId, targetId });
                if (!baseCheck.valid) {
                    return { canAttack: false, reason: baseCheck.reason };
                }
            }

            const migratedCheck = window.CardRules.validateAttackTarget(
                gameState,
                attackerId,
                targetId
            );
            if (!migratedCheck.valid) {
                return { canAttack: false, reason: migratedCheck.reason };
            }

            return { canAttack: true, reason: 'Ataque permitido' };
        }

        // Snapshot da mão dos dois jogadores. O motor move cartas do deck para a
        // mão (Tlantidu ao morrer, Zol, ETC) sem passar pelo bloco `returnedToHand`
        // do combate, então a UI compara antes/depois para reprojetar a mão e
        // explicar o que entrou.
        function instantaneoDasMaos() {
            return {
                p1: gameState.players.p1.zones.hand.map(carta => carta.instanceId),
                p2: gameState.players.p2.zones.hand.map(carta => carta.instanceId)
            };
        }

        function sincronizarMaosDoCombate(maosAntes) {
            const mudou = ['p1', 'p2'].some(player => {
                const agora = gameState.players[player].zones.hand;
                return agora.length !== maosAntes[player].length
                    || agora.some(carta => !maosAntes[player].includes(carta.instanceId));
            });
            if (mudou) renderHandsFromState();
        }

        /**
         * Disclaimer do Tlantidu (card_038, "ao morrer pode procurar um monstro
         * aquático no deck"): a busca é do motor — a UI só anuncia o que aconteceu,
         * com a carta trazida ou o aviso de que não havia aquática no deck.
         */
        function anunciarBuscaDoTlantidu(destruidas, maosAntes) {
            if (!window.cardAbilities?.showAbilityFeedback) return;

            (destruidas || []).forEach(cardId => {
                const instancia = gameState.cardInstances[cardId];
                if (instancia?.definitionId !== 'card_038') return;

                const dono = instancia.ownerId;
                const nova = gameState.players[dono].zones.hand
                    .find(carta => !maosAntes[dono].includes(carta.instanceId));

                if (!nova) {
                    window.cardAbilities.showAbilityFeedback(
                        cardId,
                        'Tlantidu: não havia monstro aquático no deck.'
                    );
                    return;
                }

                // Identidade só para quem pode ver a mão: em PvP a mão alheia é
                // contagem, então a carta buscada pelo oponente continua oculta.
                const podeRevelar = !window.PvpSession || dono === assentoLocal();
                if (podeRevelar && !(nova.data?.traits || []).includes('aquatico')) return;

                window.cardAbilities.showAbilityFeedback(cardId, podeRevelar
                    ? `Tlantidu: ${nova.data?.name || 'uma carta'} foi buscada no deck e entrou na mão.`
                    : 'Tlantidu: uma carta do deck entrou na mão.');
            });
        }

        function performAttack(attackerId, targetId) {
            if (pvpGuard({ cmd: 'ATTACK', args: { attackerId, targetId } })) return;
            const attacker = findCardData(attackerId);
            if (window.PvpSession && !pvpAplicando()) {
                const localSeat = document.body.dataset.seat || gameState.currentPlayer;
                if (!attacker || attacker.ownerId !== localSeat) {
                    showMessage('Ataque inválido: só pode atacar com suas próprias cartas.', 'warning');
                    return;
                }
            }
            const target = findCardData(targetId);
            if (!attacker || !target) return;

            const attackCheck = canAttackTarget(attackerId, targetId);
            if (!attackCheck.canAttack) {
                showMessage(attackCheck.reason, 'warning');
                clearCombatHighlights();
                setupCombatPhase();
                return;
            }

            if (window.cardAbilities?.onCombatDeclared) {
                window.cardAbilities.onCombatDeclared(attackerId, targetId);
            }

            const maosAntes = instantaneoDasMaos();
            const result = window.gameEngine.resolveCombat({
                attackerId,
                targetId,
                targetValidator: () => {
                    const legacyCheck = canAttackTarget(attackerId, targetId, { skipEngine: true });
                    return legacyCheck.canAttack || legacyCheck.reason;
                }
            });

            if (result.status !== 'resolved') {
                showMessage(result.reason, 'warning');
                clearCombatHighlights();
                setupCombatPhase();
                return;
            }

            if (result.cancelled) {
                updateCardDisplay(attackerId, {
                    ...attacker.data,
                    attack: window.gameEngine.getEffectiveStat(attackerId, 'attack'),
                    defense: window.gameEngine.getRemainingDefense(attackerId)
                });
                updateCardDisplay(targetId, {
                    ...target.data,
                    attack: window.gameEngine.getEffectiveStat(targetId, 'attack'),
                    defense: window.gameEngine.getRemainingDefense(targetId)
                });
                showMessage(`O ataque de ${attacker.data.name} foi anulado.`, 'info');
                if (window.cardAbilities?.onCombatResolved) {
                    window.cardAbilities.onCombatResolved(result);
                }
                updateAttackedCardsVisual();
                clearCombatHighlights();
                setupCombatPhase();
                return;
            }

            const returnedToHand = [attacker, target]
                .filter(card => card.zone === 'hand');
            if (returnedToHand.length > 0) {
                returnedToHand.forEach(card => {
                    const cardElement = document.getElementById(card.instanceId);
                    if (cardElement && !cardElement.classList.contains('destroying')) {
                        cardElement.classList.add('destroying');
                        cardElement.style.animation = 'cardReturnToHand 0.3s ease-out forwards';
                        // Fantom (e qualquer retorno à mão) precisa SAIR do campo depois
                        // da animação: sem isto o elemento ficava preso com `.destroying`
                        // para sempre, e o `renderFieldsFromState` nunca o removia (o
                        // guard de animação tratava a carta como se ainda estivesse
                        // morrendo). Espelha a limpeza do `destroyCard`.
                        const aoTerminar = () => {
                            if (!cardElement.isConnected) return;
                            cardElement.remove();
                            renderFieldsFromState();
                        };
                        cardElement.addEventListener('animationend', aoTerminar, { once: true });
                        const generation = window.matchGeneration;
                        setTimeout(() => {
                            if (generation !== window.matchGeneration) return;
                            aoTerminar();
                        }, 400);
                    }
                });
                renderHandsFromState();
                // O Fantom não morre: nenhum `destroyCard` roda, então o campo é
                // reprojetado aqui para tirar o verso do Fantom que voltou à mão.
            }

            // Efeitos de morte que puxam carta do deck para a mão (Tlantidu) mudam o
            // estado sem passar pelo bloco acima: reprojetar a mão é o que faz a
            // carta comprada aparecer para o jogador.
            sincronizarMaosDoCombate(maosAntes);
            anunciarBuscaDoTlantidu(result.defeated, maosAntes);

            updateCardDisplay(attackerId, {
                ...attacker.data,
                attack: window.gameEngine.getEffectiveStat(attackerId, 'attack'),
                defense: result.attackerRemainingDefense
            });
            updateCardDisplay(targetId, {
                ...target.data,
                attack: window.gameEngine.getEffectiveStat(targetId, 'attack'),
                defense: result.targetRemainingDefense
            });
            renderPlayerStats();
            if (result.penetratingDamage > 0) playSound('punchSound');

            let message = `${attacker.data.name} causou ${result.damageToTarget} de dano em ${target.data.name}.`;
            if (result.targetDestroyed) message += ` ${target.data.name} foi destruída.`;
            if (result.attackerDestroyed) message += ` ${attacker.data.name} foi destruída no contra-ataque.`;
            if (result.penetratingDamage > 0) {
                message += ` ${result.penetratingDamage} de dano penetrante.`;
            }
            showMessage(message, result.defeated.length > 0 ? 'success' : 'info');

            if (window.cardAbilities?.onCombatResolved) {
                window.cardAbilities.onCombatResolved(result);
            }

            result.defeated.forEach(cardId => {
                // Em PvP o combate é determinístico: os dois clientes aplicam o
                // ATTACK do ledger e chegam à mesma lista de defeated. Durante
                // a aplicação remota o pvpGuard está bloqueado (applying), então
                // o descarte é feito direto aqui — sempre na mesma ordem.
                if (window.PvpSession) {
                    if (pvpAplicando()) {
                        destroyCard(cardId);
                    } else {
                        pvpGuard({ cmd: 'DESTROY', args: { cardId } });
                    }
                    return;
                }
                setTimeout(() => destroyCard(cardId), 500);
            });
            
            updateAttackedCardsVisual();
            clearCombatHighlights();
            setupCombatPhase();
        }

        function directAttack() {
            if (pvpGuard({ cmd: 'DIRECT_ATTACK', args: { attackerId: gameState.attackingCard } })) return;
            if (!gameState.attackingCard) {
                showMessage('Primeiro selecione uma carta sua para atacar!');
                return;
            }

            const attacker = findCardData(gameState.attackingCard);
            if (window.PvpSession?.PvpSession && !pvpAplicando()) {
                const localSeat = document.body.dataset.seat || gameState.currentPlayer;
                if (!attacker || attacker.ownerId !== localSeat) {
                    showMessage('Ataque direto inválido: só pode usar cartas próprias.', 'warning');
                    return;
                }
            }
            if (!attacker) return;

            const opponent = gameState.currentPlayer === 'p1' ? 'p2' : 'p1';
            const allowDirectAttack = window.CardRules.canDirectAttack(
                gameState,
                gameState.attackingCard
            );
            const result = window.gameEngine.resolveCombat({
                attackerId: gameState.attackingCard,
                defenderPlayerId: opponent,
                isDirect: true,
                allowDirectAttack
            });
            if (result.status !== 'resolved') {
                showMessage(result.reason, 'warning');
                return;
            }

            renderPlayerStat('pv', opponent);
            playSound('punchSound');
            showMessage(
                `${attacker.data.name} atacou diretamente por ${result.directDamage} de dano.`,
                'success'
            );
            if (window.cardAbilities?.onCombatResolved) {
                window.cardAbilities.onCombatResolved(result);
            }
            updateAttackedCardsVisual();
            clearCombatHighlights();
            setupCombatPhase();
        }

        function updateCardDisplay(cardId, cardData) {
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                const statsElement = cardElement.querySelector('.card-stats');
                if (statsElement) {
                    statsElement.innerHTML = `
                        <span class="attack">${cardData.attack}</span>
                        <span>/</span>
                        <span class="defense">${cardData.defense}</span>
                    `;
                }
            }
        }

        function destroyCard(cardId) {
            console.log('💥 DESTROY CARD CHAMADA para:', cardId);
            
            const cardData = gameState.cardInstances[cardId] || findCardData(cardId);
            if (!cardData) {
                console.log('💥 ERRO: Dados da carta não encontrados para:', cardId);
                return;
            }

            if (cardData.zone === 'field') {
                cardData.attachments.forEach(attachmentId => {
                    const attachment = gameState.cardInstances[attachmentId];
                    if (attachment) {
                        window.GameStateModel.moveCard(gameState, attachmentId, 'discard', attachment.ownerId);
                        attachment.attachedTo = null;
                    }
                });
                cardData.attachments = [];
                window.GameStateModel.moveCard(gameState, cardId, 'discard', cardData.ownerId);
            }
            updateDiscardCount(cardData.ownerId);
            // Uma única reprojeção do campo, após a animação: o render remove
            // qualquer .card fora do campo e mataria o efeito se rodasse antes.

            // Remover do DOM com animação
            const cardElement = document.getElementById(cardId);
            const hasElement = !!cardElement;
            
            if (hasElement) {
                console.log('💥 Elemento DOM encontrado, iniciando animação');
                
                // Efeito visual de destruição
                cardElement.style.animation = 'cardDestroy 0.5s ease-out forwards';
                cardElement.addEventListener('animationend', () => {
                    cardElement.remove();
                    renderFieldsFromState();
                }, { once: true });
                
                // Mostrar feedback visual de descarte
                showMessage(`${cardData.data?.name || 'Carta'} foi para o descarte!`, 'info');
            } else {
                console.log('💥 Elemento DOM não encontrado (provavelmente já removido), apenas atualizando campo');
            }
            
            // Renderização imediata apenas se não houver elemento (sem animação)
            if (!hasElement) {
                renderFieldsFromState();
            }
        }

        function initFirstTurn() {
            if (gameState.maxEnergy['p1'] < MAX_ENERGY) {
                gameState.maxEnergy['p1'] += 1;
            }
            window.GameStateModel.setPlayerStat(gameState, 'energy', 'p1',
                Math.min(window.GameStateModel.getPlayerStat(gameState, 'energy', 'p1') + 1, MAX_ENERGY),
                { energyCap: MAX_ENERGY }
            );
            renderPlayerStat('energy', 'p1');
            addCardToHand('p1');
            // O primeiro turno também tem relógio (e é ele que o boot/Reset inicia).
            reiniciarTempoDeTurno();
        }

        function resetGame(escolha) {
            document.getElementById('hand-p1').innerHTML = '';
            document.getElementById('hand-p2').innerHTML = '';
            document.getElementById('field-p1').innerHTML = '';
            document.getElementById('field-p2').innerHTML = '';

            if (window.cardAbilities?.reset) window.cardAbilities.reset();
            // Remover todos os overlays de fim de jogo (pode haver mais de um)
            document.querySelectorAll('#game-over-overlay').forEach(node => node.remove());
            window.gameOver = false;
            // Nova geração invalida os setTimeout pendentes da partida anterior
            window.matchGeneration += 1;
            // Libera a vinheta de vitória para a nova partida
            window.victorySoundPlayed = false;
            // Devolve a interatividade travada pelo fim de jogo (fases, Fim Turno,
            // Espiar Mão, botão de opções etc.) antes de remontar a partida
            setMatchButtonsEnabled(true);
            // Fecha modais que possam estar abertos com dados da partida anterior
            closeCardModal();
            closeDiscardModal();
            if (typeof startNewMatch === 'function') {
                // `startNewMatch` é assíncrono, mas não tem nenhum `await` interno:
                // a mesa é montada no mesmo tick, então o Reset continua síncrono
                // (os testes e o gear contam com o estado pronto logo em seguida).
                // Sem argumento ele reusa a escolha da partida atual (Reset mantém o
                // deck); `trocarDeck` passa um id explícito.
                startNewMatch(escolha);
            }
            initFirstTurn();

            // Dado da sorte volta ao estado de partida nova (emoji + habilitado).
            resetDiceUI();

            ['p1', 'p2'].forEach(player => {
                // Reset names
                const nameElement = document.querySelector(`.player${player === 'p1' ? '1' : '2'}-stats .player-name`);
                if (nameElement) {
                    nameElement.innerText = player === 'p1' ? 'Jogador 1' : 'Jogador 2';
                }
                updateHandCounter(player);
                updateDiscardCount(player);
            });

            updateUI();
            
            // Inicializar visibilidade das mãos
            setTimeout(() => {
                updateHandVisibility();
            }, 100);
        }

        // Funções de cartas
                function createCard(cardData, player) {
            const cardInstance = cardData.instanceId && cardData.data
                ? cardData
                : window.GameStateModel.createCardInstance(cardData, player, { zone: 'hand' });
            const cardId = cardInstance.instanceId;
            const card = document.createElement('div');
            
            // --- Fallback: se a definição é nula (placeholder em estado transitório),
            // renderiza um card mínimo seguro para a mão local sem quebrar a UI. ---
            if (!cardInstance.data) {
                card.className = 'card';
                card.draggable = true;
                card.setAttribute('draggable', 'true');
                card.id = cardId;
                card.innerHTML = '<div class="card-name" style="pointer-events: none;">???</div>';
                cardInstance.element = card;
                cardInstance.player = cardInstance.controllerId;
                gameState.cardInstances[cardInstance.instanceId] = cardInstance;
                return cardInstance;
            }

            // Mapear tipos em português para inglês para as classes CSS
            const typeMapping = {
                'suporte': 'support',
                'criatura': 'monster',
                'monster': 'monster',
                'support': 'support'
            };
            const cssType = typeMapping[cardInstance.data.type] || cardInstance.data.type;
            
            card.className = `card ${cssType}`;
            card.draggable = true;
            card.setAttribute('draggable', 'true');
            card.id = cardId;
            card.onclick = () => selectCard(cardId);
            card.ondragstart = (e) => {
                console.log('🔥 DRAGSTART CALLED!', cardId);
                dragStart(e);
            };
            card.ondragend = (e) => dragEnd(e);
            card.onmousedown = (e) => console.log('🖱️ Mouse down on card:', cardId);
            
            // Adicionar duplo clique para criaturas equipadas
            card.ondblclick = () => handleCardDoubleClick(cardId, cardInstance.data);
            
            // Adicionar tooltip para criaturas equipadas
            card.onmouseenter = () => updateTooltipForEquippedCard(cardId);
            card.onmouseleave = () => clearTooltip(cardId);
            
            console.log('🃏 Card created:', cardId, 'draggable:', card.draggable);

            // Criar cópia dos dados da carta para evitar modificação do original
            const cardDataCopy = cardInstance.data;

            // Usar apenas imagem real, sem fallback de ícone
            const cardImage = cardDataCopy.image ? 
                `<img src="${cardDataCopy.image}" alt="${cardDataCopy.name}" class="card-image-real" style="pointer-events: none;">` :
                `<div class="card-image" style="pointer-events: none;"></div>`;

            card.innerHTML = `
                <div class="card-cost" style="pointer-events: none;">${getEffectiveCardCost(cardId, cardDataCopy)}</div>
                ${cardImage}
                <div class="card-name" style="pointer-events: none;">${cardDataCopy.name}</div>
                <div class="card-stats" style="pointer-events: none;">
                    <span class="attack">${cardDataCopy.attack}</span>
                    <span>/</span>
                    <span class="defense">${cardDataCopy.defense}</span>
                </div>
            `;

            cardInstance.element = card;
            cardInstance.player = cardInstance.controllerId;
            gameState.cardInstances[cardInstance.instanceId] = cardInstance;
            return cardInstance;
        }

        function renderHandsFromState() {
            ['p1', 'p2'].forEach(player => {
                const handElement = document.getElementById(`hand-${player}`);
                if (!handElement) return;
                handElement.innerHTML = '';

                const isLocalHand = player === assentoLocal();
                const emPvp = Boolean(window.PvpSession);

                gameState.cards[player].hand.forEach(cardInstance => {
                    // Mão do jogador local: nunca é card-back (perspectiva PvP).
                    // Só o verso do oponente é oculto — a sua própria mão, mesmo
                    // saindo de um estado transitório, sempre mostra a identidade.
                    //
                    // No PvP a mão alheia é SEMPRE verso, mesmo que a instância
                    // local tenha identidade (reveal pendente de movimento,
                    // retorno à mão por efeito de combate/turno): contagem sim,
                    // identidade nunca (spec parte 3).
                    if (emPvp && !isLocalHand) {
                        handElement.appendChild(createCardBack(cardInstance));
                        return;
                    }
                    if (!isLocalHand && (cardInstance.definitionId === null || cardInstance.definitionId === undefined)) {
                        handElement.appendChild(createCardBack(cardInstance));
                        return;
                    }
                    const renderedCard = createCard(cardInstance, player);
                    handElement.appendChild(renderedCard.element);
                });

                // A área de saque anda junto: mão e deck são as duas metades do
                // mesmo movimento (a compra tira 1 do deck e põe 1 na mão).
                updateHandCounter(player);
                updateDeckCounter(player);
            });
        }

        // Verso de carta: mantém a contagem da mão alheia sem revelar nada.
        function createCardBack(cardInstance) {
            const card = document.createElement('div');
            card.className = 'card card-back';
            card.id = cardInstance.instanceId;
            card.setAttribute('aria-label', 'Carta oculta do oponente');
            return card;
        }

        // Slot da carta na mão: a identidade da carta oculta viaja só no reveal.
        function getHandSlot(cardId, player) {
            const mao = gameState.players?.[player]?.zones?.hand || [];
            return mao.findIndex(carta => carta && carta.instanceId === cardId);
        }
        window.renderHandsFromState = renderHandsFromState;
        // O PvP repinta só os contadores quando o servidor publica `handSizes`.
        window.updateHandCounter = updateHandCounter;

        function renderFieldsFromState() {
            ['p1', 'p2'].forEach(player => {
                const fieldContainer = document.getElementById(`field-${player}`);
                if (!fieldContainer) return;
                
                // Primeiro, garantir que todas as cartas do gameState estejam no DOM
                gameState.cards[player].field.forEach(card => {
                    const existingElement = document.getElementById(card.instanceId);
                    if (!existingElement) {
                        // Carta no gameState mas não no DOM - criar
                        const cardInstance = gameState.cardInstances[card.instanceId];
                        if (cardInstance) {
                            const newCard = createCard(cardInstance, player);
                            fieldContainer.appendChild(newCard.element);
                        }
                    }
                });
                
                // Remover cartas que não estão mais no estado (exceto se estiverem em animação)
                Array.from(fieldContainer.children).forEach(child => {
                    if (child.classList.contains('card')) {
                        const instanceId = child.id;
                        const cardInState = gameState.cards[player].field.find(c => c.instanceId === instanceId);
                        // Só remove se não estiver em animação e não estiver no estado
                        const isAnimating = child.classList.contains('destroying') || 
                                           child.style.animation && child.style.animation.includes('cardDestroy');
                        if (!cardInState && !isAnimating) {
                            child.remove();
                        }
                    }
                });

                // Atualizar cartas que estão no estado
                gameState.cards[player].field.forEach(card => {
                    updateCardDisplay(card.instanceId, {
                        ...card.data,
                        attack: window.gameEngine.getEffectiveStat(card.instanceId, 'attack'),
                        defense: window.gameEngine.getRemainingDefense(card.instanceId)
                    });
                });
            });
        }

        function getCardIcon(type) {
            const icons = {
                'criatura': '🦄',
                'suporte': '⚡',
                'evolução': '⭐',
                'monster': '🦄',
                'support': '⚡',
                'evolution': '⭐'
            };
            return icons[type] || '❓';
        }

        // Função para atualizar contador de cartas na mão
        function updateHandCounter(player) {
            const titleElement = document.getElementById(`hand-title-${player}`);
            if (!titleElement) return;
            const playerName = window.GameStateModel.getPlayerName(gameState, player) || (player === 'p1' ? 'Jogador 1' : 'Jogador 2');
            // Em PvP vale a contagem do servidor; sem ela (fora do PvP, ou antes
            // do MATCH_START) cai na contagem do estado local.
            const doServidor = pvpContagemDoServidor(player);
            const local = gameState.cards[player]?.hand?.length ?? 0;
            const count = Number.isFinite(doServidor) ? doServidor : local;
            titleElement.innerText = `Mão - ${playerName} (${count})`;
            // O badge "N cartas" do CSS vem do atributo (`content: attr(data-count)`).
            titleElement.setAttribute('data-count', String(count));
            publicarContagemDivergente(player, local, doServidor);
        }

        function addCardToHand(player) {
            // Mão cheia: o corte vem antes do `pvpGuard` porque em PvP o comando
            // que não pode ser aplicado aqui também não pode existir no ledger —
            // o oponente só conta a mão alheia e veria uma carta a mais que o dono.
            const currentCards = gameState.cards[player]?.hand?.length ?? 0;
            if (window.GameStateModel.handLimitReached(gameState, player)) {
                console.log(`❌ Não é possível sacar: limite de ${window.GameStateModel.HAND_LIMIT} cartas na mão atingido (atual: ${currentCards})`);
                showMessage(`Limite de ${window.GameStateModel.HAND_LIMIT} cartas na mão atingido!`, 'warning');
                return;
            }
            // Em PvP quem compra é o autor do comando DRAW: o oponente recebe o
            // comando replicado e só vê a contagem mudar.
            if (pvpGuard({ cmd: 'DRAW', args: { player } })) return;
            // A mão do oponente nunca é renderizada localmente: só o contador.
            if (window.PvpSession?.PvpSession && player !== assentoLocal()) {
                updateHandCounter(player);
                return;
            }
            if (typeof drawCardFromDeck === 'function') {
                const drawnCard = drawCardFromDeck(player);
                if (drawnCard) {
                    const newCard = createCard(drawnCard, player);
                    newCard.element.classList.add('new-card');
                    document.getElementById(`hand-${player}`).appendChild(newCard.element);
                    updateHandCounter(player);
                    updateDeckCounter(player);
                    setTimeout(() => { newCard.element.classList.remove('new-card'); }, 800);
                    console.log('📜 Card rendered from gameState:', newCard.id, 'Player:', player);
                    console.log('📜 Total cards in hand:', gameState.cards[player].hand.length);
                }
                return;
            }
            // Fallback para sistema antigo se deck system não estiver carregado
            const fallbackCards = [
                { id: 'fallback1', name: 'Criatura Básica', type: 'criatura', cost: 3, attack: 3, defense: 3, icon: '🦄' }
            ];
            const randomCard = fallbackCards[0];
            const newCard = createCard(randomCard, player);

            window.GameStateModel.registerCard(gameState, newCard, 'hand', player);
            document.getElementById(`hand-${player}`).appendChild(newCard.element);
            updateHandCounter(player);
        }

        function toggleGearMenu() {
            document.getElementById('gearDropdown').classList.toggle('open');
        }

        function showMessage(text, type = 'info') {
            // Criar elemento de mensagem
            const messageElement = document.createElement('div');
            messageElement.textContent = text;
            messageElement.style.position = 'fixed';
            messageElement.style.top = '50%';
            messageElement.style.left = '50%';
            messageElement.style.transform = 'translate(-50%, -50%)';
            messageElement.style.padding = '15px 25px';
            messageElement.style.borderRadius = '10px';
            messageElement.style.color = 'white';
            messageElement.style.fontWeight = 'bold';
            messageElement.style.fontSize = '16px';
            messageElement.style.zIndex = '1000';
            messageElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            
            // Definir cor baseada no tipo
            if (type === 'warning') {
                messageElement.style.backgroundColor = '#ff6b6b';
            } else if (type === 'success') {
                messageElement.style.backgroundColor = '#5abf7a';
            } else {
                messageElement.style.backgroundColor = '#4b586e';
            }
            
            // Adicionar ao body
            document.body.appendChild(messageElement);
            
            // Remover após 2 segundos
            setTimeout(() => {
                // jsdom (used em testes unitários) não implementa Element.contains.
                // Use parentNode check para garantir compatibilidade.
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 2000);
        }

        function selectCard(cardId) {
            console.log('Carta clicada:', cardId, 'Fase atual:', gameState.currentPhase);
            const cardData = findCardData(cardId);
            if (!cardData) {
                console.log('Dados da carta não encontrados');
                return;
            }

            console.log('Dados da carta:', cardData);

            // Se estamos na fase de combate
            if (gameState.currentPhase === 'combat') {
                console.log('Entrando no modo de combate');
                handleCombatCardClick(cardId, cardData);
                return;
            }

            // Remove seleção anterior
            document.querySelectorAll('.card.selected').forEach(card => {
                card.classList.remove('selected');
            });

            // Seleciona nova carta
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.classList.add('selected');
                gameState.selectedCard = cardId;
            }
        }

        function handleCombatCardClick(cardId, cardData) {
            console.log('🗡️ ===== CLIQUE EM COMBATE =====');
            console.log('🗡️ Carta clicada:', cardId);
            console.log('🗡️ Dados da carta:', cardData);
            console.log('🗡️ Player da carta:', cardData.player, 'Current Player:', gameState.currentPlayer);
            console.log('🗡️ Atacante atual:', gameState.attackingCard);
            console.log('🗡️ É carta em campo?', isCardInField(cardId));
            console.log('🗡️ É carta inimiga?', cardData.player !== gameState.currentPlayer);
            console.log('🗡️ Tem atacante selecionado?', !!gameState.attackingCard);
            console.log('🗡️ Estado do gameState:', {
                currentPlayer: gameState.currentPlayer,
                currentPhase: gameState.currentPhase,
                attackingCard: gameState.attackingCard,
                attackedThisTurn: gameState.attackedThisTurn
            });
            
            const cardElement = document.getElementById(cardId);
            
            // Se clicou em uma carta inimiga e já tem atacante selecionado
            if (gameState.attackingCard && cardData.player !== gameState.currentPlayer && isCardInField(cardId)) {
                console.log('✅ CONDIÇÕES ATENDIDAS - Atacando carta inimiga!');
                console.log('🔄 Atacante:', gameState.attackingCard, '→ Alvo:', cardId);
                
                // Verificar se o atacante ainda existe e pode atacar
                const attackerData = findCardData(gameState.attackingCard);
                if (!attackerData) {
                    console.log('❌ Atacante não encontrado');
                    clearCombatHighlights();
                    gameState.attackingCard = null;
                    updateCombatInfo('Selecione uma carta para atacar');
                    return;
                }
                
                const attackerCheck = window.gameEngine.canAttack(gameState.attackingCard);
                if (!attackerCheck.canAttack) {
                    console.log('❌ Atacante não pode atacar:', attackerCheck.reason);
                    showMessage(attackerCheck.reason, 'warning');
                    clearCombatHighlights();
                    gameState.attackingCard = null;
                    return;
                }

                // Verificar se o alvo pode ser atacado
                const attackCheck = canAttackTarget(gameState.attackingCard, cardId);
                if (!attackCheck.canAttack) {
                    console.log('❌ Ataque impedido:', attackCheck.reason);
                    showMessage(attackCheck.reason, 'warning');
                    return;
                }
                
                performAttack(gameState.attackingCard, cardId);
                return;
            } else {
                console.log('❌ Condições não atendidas para ataque:');
                console.log('   - Tem atacante?', !!gameState.attackingCard);
                console.log('   - É inimiga?', cardData.player !== gameState.currentPlayer);
                console.log('   - Está em campo?', isCardInField(cardId));
                if (gameState.attackingCard) {
                    console.log('   - Dados do atacante:', findCardData(gameState.attackingCard));
                }
            }
            
            // Se não há carta atacante selecionada OU clicou em outra carta sua
            if (!gameState.attackingCard || (cardData.player === gameState.currentPlayer && isCardInField(cardId))) {
                // Só pode selecionar cartas do jogador atual que estão em campo
                if (cardData.player === gameState.currentPlayer && isCardInField(cardId)) {
                    const attackCheck = window.gameEngine.canAttack(cardId);
                    if (!attackCheck.canAttack) {
                        console.log('❌ Carta não pode atacar:', cardId, attackCheck.reason);
                        showMessage(attackCheck.reason, 'warning');
                        updateCombatInfo(`${attackCheck.reason} Selecione outra carta.`);
                        return;
                    }
                    
                    console.log('Selecionando nova carta atacante');
                    // Limpar highlights visuais sem resetar o atacante
                    document.querySelectorAll('.card').forEach(card => {
                        card.classList.remove('attacking', 'can-attack', 'can-be-targeted', 'cannot-be-targeted', 'direct-attack');
                    });
                    
                    gameState.attackingCard = cardId;
                    if (cardElement) {
                        cardElement.classList.add('attacking');
                    }
                    highlightTargets();
                    
                    const attackerName = cardData.data.name;
                    updateCombatInfo(`${attackerName} selecionada! Clique em uma carta inimiga para atacar ou use "Ataque Direto"`);
                    return;
                } else {
                    updateCombatInfo('Selecione uma de suas cartas no campo para atacar');
                    return;
                }
            }
            
            // Caso padrão
            updateCombatInfo('Selecione uma de suas cartas primeiro, depois o alvo');
        }

        function dragStart(e) {
            // Garantir que temos o elemento carta correto
            let cardElement = e.target;
            while (cardElement && !cardElement.classList.contains('card')) {
                cardElement = cardElement.parentElement;
            }
            
            if (!cardElement || !cardElement.id) {
                console.log('❌ Elemento carta não encontrado ou sem ID');
                return;
            }
            
            const cardId = cardElement.id;
            console.log('🎯 Drag started for card:', cardId);
            console.log('🎯 Element draggable:', cardElement.draggable);
            console.log('🎯 Current phase:', gameState.currentPhase);
            
            e.dataTransfer.setData('text/plain', cardId);
            e.dataTransfer.effectAllowed = 'move';
            cardElement.classList.add('dragging');
            
            // Sempre destacar que o drag começou, independente da fase
            const cardData = findCardData(cardId);
            console.log('🎯 Card data found:', cardData ? 'Yes' : 'No');
            
            if (cardData) {
                console.log('🎯 Card player:', cardData.player);
                console.log('🎯 Current player:', gameState.currentPlayer);
                const effectiveCost = getEffectiveCardCost(cardId, cardData.data);
                console.log('🎯 Card cost:', effectiveCost);
                
                if (gameState.currentPhase === 'invocation' && cardData.player === gameState.currentPlayer) {
                    const currentEnergy = window.GameStateModel.getPlayerStat(gameState, 'energy', gameState.currentPlayer);
                    console.log('🎯 Current energy:', currentEnergy);
                    
                    if (cardData.data.type === 'suporte') {
                        highlightEquippableCreatures(cardData, currentEnergy >= effectiveCost);
                        if (currentEnergy >= effectiveCost) {
                            updateInvocationInfo(`Arraste para uma criatura para equipar (Custo: ${effectiveCost})`);
                        } else {
                            updateInvocationInfo(`Energia insuficiente para equipar! Precisa de ${effectiveCost}, você tem ${currentEnergy}`);
                        }
                        console.log('🎯 Support card - highlighting equippable creatures');
                        return;
                    }

                    // Destacar campos válidos para drop
                    const playerField = document.getElementById(`field-${gameState.currentPlayer}`);
                    if (playerField) {
                        if (currentEnergy >= effectiveCost) {
                            playerField.classList.add('field-drop-zone');
                            updateInvocationInfo(`Arraste para o campo para invocar (Custo: ${effectiveCost})`);
                            console.log('🎯 Field marked as valid drop zone');
                        } else {
                            playerField.classList.add('field-invalid-drop');
                            updateInvocationInfo(`Energia insuficiente! Precisa de ${effectiveCost}, você tem ${currentEnergy}`);
                            console.log('🎯 Field marked as invalid - insufficient energy');
                        }
                    }
                } else {
                    console.log('🎯 Not in invocation phase or not current player');
                }
            }
        }

        function dragEnd(e) {
            // Garantir que temos o elemento carta correto
            let cardElement = e.target;
            while (cardElement && !cardElement.classList.contains('card')) {
                cardElement = cardElement.parentElement;
            }
            
            if (cardElement) {
                cardElement.classList.remove('dragging');
            }
            
            // Limpar highlights
            document.querySelectorAll('.field-drop-zone, .field-invalid-drop').forEach(field => {
                field.classList.remove('field-drop-zone', 'field-invalid-drop');
            });
            
            // Limpar highlights de equipamento
            clearEquipmentHighlights();
            
            // Restaurar informações de fase
            updatePhaseInstructions();
        }

        function allowDrop(e) {
            e.preventDefault();
        }

        function dragOver(e) {
            e.preventDefault();
        }

        function dropCard(e) {
            e.preventDefault();
            // Em PvP a invocação vira o comando SUMMON: o slot identifica o
            // placeholder e o reveal leva a identidade da carta.
            const cardIdArrastado = e?.dataTransfer?.getData?.('text/plain') || '';
            const playerAlvo = e?.currentTarget?.dataset?.player;
            const ehCampo = e?.currentTarget && !e.currentTarget.classList.contains('card');
            if (ehCampo && playerAlvo === assentoLocal() &&
                pvpGuard({
                    cmd: 'SUMMON',
                    args: { handSlot: getHandSlot(cardIdArrastado, playerAlvo) },
                    reveals: pvpReveal(cardIdArrastado, 'hand')
                })) {
                return;
            }

            const cardId = e.dataTransfer.getData('text/plain');
            const cardElement = document.getElementById(cardId);

            if (!cardElement) return;

            // Verificar se é drop em campo ou em criatura
            const isCreatureDrop = e.currentTarget.classList.contains('card');

            if (isCreatureDrop) {
                e.stopPropagation();
                handleEquipmentDrop(e, cardId);
                return;
            }

            const targetPlayer = e.currentTarget.dataset.player;
            // PvP: impedir que o jogador arraste cartas do oponente
            if (window.PvpSession?.PvpSession && !pvpAplicando()) {
                const localSeat = document.body.dataset.seat || gameState.currentPlayer;
                if (targetPlayer !== localSeat) {
                    // Não permite drop em mãos ou campo do adversário
                    return;
                }
            }
            const cardData = findCardData(cardId);

            if (!cardData || cardData.player !== targetPlayer) return;

            if (cardData.data.type === 'suporte') {
                const supportRejection = getSupportEquipRejection(cardData);
                showMessage(
                    supportRejection || 'Cartas de suporte devem ser equipadas em uma criatura, não no campo.',
                    'warning'
                );
                return;
            }

            // Verificar se é a fase correta
            if (gameState.currentPhase !== 'invocation') {
                showMessage('Você só pode invocar cartas na Fase de Invocação!');
                return;
            }

            // Verificar se é o turno do jogador
            if (gameState.currentPlayer !== targetPlayer) {
                showMessage('Não é o seu turno!');
                return;
            }

            // Verificar energia
            const currentEnergy = window.GameStateModel.getPlayerStat(gameState, 'energy', targetPlayer);
            const summonCost = getEffectiveCardCost(cardId, cardData.data);
            if (currentEnergy < summonCost) {
                showMessage('Energia insuficiente para invocar esta carta!');
                return;
            }

            let evolutionBaseInstanceId = null;
            let evolutionBaseAttachmentIds = [];
            if (cardData.data.type === 'evolução') {
                const evolutionCheck = window.CardRules.validateEvolutionSummon(
                    gameState, cardData.data.id, targetPlayer
                );
                if (!evolutionCheck.valid) {
                    showMessage(evolutionCheck.reason, 'warning');
                    return;
                }
                evolutionBaseInstanceId = evolutionCheck.baseInstanceId;
                evolutionBaseAttachmentIds = (
                    gameState.cardInstances[evolutionBaseInstanceId]?.attachments || []
                ).map(attachmentId => ({
                    instanceId: attachmentId,
                    ownerId: gameState.cardInstances[attachmentId]?.ownerId || targetPlayer
                }));
            }

            const summonResult = window.gameEngine.resolveAction({
                type: 'SUMMON_CARD',
                actorId: targetPlayer,
                sourceId: cardId,
                sourceZone: 'hand',
                requiredPhase: 'invocation',
                requiresTurn: true,
                costs: [{
                    kind: 'PLAYER_STAT',
                    stat: 'energy',
                    playerId: targetPlayer,
                    amount: summonCost
                }],
                effects: [
                    ...evolutionBaseAttachmentIds.map(attachment => ({
                        kind: window.GameEngine.EFFECT_KINDS.MOVE_CARD,
                        instanceId: attachment.instanceId,
                        destinationZone: 'discard',
                        destinationPlayerId: attachment.ownerId
                    })),
                    ...(evolutionBaseInstanceId ? [{
                        kind: window.GameEngine.EFFECT_KINDS.MOVE_CARD,
                        instanceId: evolutionBaseInstanceId,
                        destinationZone: 'discard',
                        destinationPlayerId: targetPlayer
                    }] : []),
                    {
                        kind: window.GameEngine.EFFECT_KINDS.MOVE_CARD,
                        instanceId: cardId,
                        destinationZone: 'field',
                        destinationPlayerId: targetPlayer
                    }
                ],
                events: [
                    {
                        type: window.GameEngine.EVENT_TYPES.CARD_MOVED,
                        payload: { cardId, playerId: targetPlayer, from: 'hand', to: 'field' }
                    },
                    {
                        type: window.GameEngine.EVENT_TYPES.CARD_PLAYED,
                        payload: { cardId, playerId: targetPlayer, definitionId: cardData.definitionId }
                    },
                    ...(['criatura', 'evolução'].includes(cardData.data.type) ? [{
                        type: window.GameEngine.EVENT_TYPES.CREATURE_SUMMONED,
                        payload: { cardId, playerId: targetPlayer, definitionId: cardData.definitionId }
                    }] : [])
                ]
            });

            if (summonResult.status === 'resolved') {
                renderPlayerStat('energy', targetPlayer);
                playSound('energySound');
                
                // Remover da mão e adicionar ao campo.
                // PvP: na mão alheia a carta era um verso (identidade oculta);
                // o campo é público, então o verso é trocado pelo card de frente.
                const ehVerso = cardElement.classList.contains('card-back');
                cardElement.remove();
                const cardNoCampo = ehVerso
                    ? createCard(gameState.cardInstances[cardId], targetPlayer).element
                    : cardElement;
                // A seleção é estado da mão: o destaque do clique não viaja para
                // o campo (senão a carta invocada fica marcada como selecionada
                // na mesa, com o brilho que ninguém pediu).
                cardNoCampo.classList.remove('selected');
                if (gameState.selectedCard === cardId) gameState.selectedCard = null;
                e.currentTarget.appendChild(cardNoCampo);
                
                // Atualizar contador de cartas na mão
                updateHandCounter(targetPlayer);
                
                // Animação de invocação
                cardNoCampo.classList.add('card-play-animation');
                cardNoCampo.classList.remove('can-be-summoned', 'dragging');
                
                setTimeout(() => {
                    cardNoCampo.classList.remove('card-play-animation');
                    if (gameState.currentPhase === 'invocation') {
                        highlightSummonableCards();
                    }
                }, 500);
                
                // Ativar habilidades da carta invocada
                if (
                    window.cardAbilities &&
                    window.cardAbilities.onCardSummoned &&
                    ['criatura', 'evolução'].includes(cardData.data.type)
                ) {
                    window.cardAbilities.onCardSummoned(cardId, cardData.data, targetPlayer);
                }

                renderHandsFromState();
                renderFieldsFromState();
                renderPlayerStats();
                
                // Feedback visual
                updateInvocationInfo(`${cardData.data.name} foi invocada com sucesso!`);
                setTimeout(() => {
                    if (gameState.currentPhase === 'invocation') {
                        updatePhaseInstructions();
                    }
                }, 2000);
            } else {
                showMessage(summonResult.reason, 'warning');
            }
        }

        function findCardData(cardId) {
            const registeredCard = gameState.cardInstances[cardId];
            if (registeredCard) return registeredCard;

            console.log('🔍 Looking for card:', cardId);
            console.log('🔍 GameState cards:', gameState.cards);
            
            for (let player of ['p1', 'p2']) {
                console.log(`🔍 Checking ${player} hand:`, gameState.cards[player].hand.length, 'cards');
                let card = gameState.cards[player].hand.find(c => c.id === cardId || c.instanceId === cardId);
                if (card) {
                    console.log('🔍 Found in hand:', card);
                    return card;
                }
                
                console.log(`🔍 Checking ${player} field:`, gameState.cards[player].field.length, 'cards');
                card = gameState.cards[player].field.find(c => c.id === cardId || c.instanceId === cardId);
                if (card) {
                    console.log('🔍 Found in field:', card);
                    return card;
                }
            }
            console.log('🔍 Card not found anywhere!');
            return null;
        }

        function getEffectiveCardCost(cardId, cardData) {
            if (window.gameEngine && gameState.cardInstances[cardId]) {
                try {
                    return window.gameEngine.getEffectiveStat(cardId, 'cost');
                } catch (e) {
                    // Instância desconhecida do motor: cai para o custo bruto abaixo.
                }
            }
            return cardData.cost;
        }

        function showCardModal(cardData) {
            const modal = document.getElementById('cardModal');
            if (!modal) return;
            const modalCard = modal.querySelector('.modal-card');
            if (!modalCard) return;
            
            // Limpar conteúdo anterior
            const existingContent = modalCard.querySelector('.modal-card-content');
            if (existingContent) {
                existingContent.remove();
            }
            
            // Criar conteúdo do modal
            const cardContent = document.createElement('div');
            cardContent.className = 'modal-card-content';
            
            const typeMapping = {
                'suporte': 'support',
                'criatura': 'monster',
                'monster': 'monster',
                'support': 'support'
            };
            const cssType = typeMapping[cardData.type] || cardData.type;
            
            const cardImage = cardData.image ? 
                `<img src="${cardData.image}" alt="${cardData.name}" class="card-image-real" style="width: 100%; height: auto; border-radius: 8px;">` :
                `<div class="card-image" style="width: 100%; height: 200px; background: var(--secondary-color); border-radius: 8px;"></div>`;

            // Traits da carta: vêm do catálogo (fonte de verdade) com o mapa do
            // motor como fallback, e são rotuladas em pt-BR pelo seletor de decks.
            // Suportes não têm traits no catálogo — a seção simplesmente não aparece.
            const traitsDaCarta = window.DeckSelect?.traitsDaCarta?.(cardData) || [];
            const blocoDeTraits = traitsDaCarta.length > 0 ? `
                <div class="modal-card-traits">
                    <h3 class="modal-card-section-title">Características:</h3>
                    <div class="deck-traits modal-traits">${window.DeckSelect.chipsDeTraits(traitsDaCarta)}</div>
                </div>` : '';

            cardContent.innerHTML = `
                <div class="card ${cssType}" style="width: 300px; height: 420px; margin: 0 auto; position: relative;">
                    <div class="card-cost">${cardData.cost}</div>
                    ${cardImage}
                    <div class="card-name">${cardData.name}</div>
                    <div class="card-stats">
                        <span class="attack">${cardData.attack}</span>
                        <span>/</span>
                        <span class="defense">${cardData.defense}</span>
                    </div>
                </div>
                ${blocoDeTraits}
                <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 10px; text-align: center;">Habilidade:</h3>
                    <p style="font-size: 16px; line-height: 1.4; text-align: center; color: var(--text-color);">${cardData.hability || cardData.ability || 'Sem habilidade especial.'}</p>
                </div>
            `;
            
            // Adicionar conteúdo ao modal
            modalCard.appendChild(cardContent);
            
            // Mostrar modal
            modal.classList.add('visible');
        }

        function closeCardModal() {
            const modal = document.getElementById('cardModal');
            if (modal) modal.classList.remove('visible');
        }

        // ===== SISTEMA DE DESCARTE =====
        
        function viewDiscard(player) {
            const discardPile = gameState.cards[player].discard;
            const modal = document.getElementById('discardModal');
            if (!modal) return;
            const title = document.getElementById('discardModalTitle');
            const grid = document.getElementById('discardCardsGrid');
            
            // Configurar título
            const playerName = player === 'p1' ? 'Jogador 1' : 'Jogador 2';
            title.textContent = `Pilha de Descarte - ${playerName} (${discardPile.length} cartas)`;
            
            // Limpar grid
            grid.innerHTML = '';
            
            if (discardPile.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--secondary-color); padding: 40px;">Nenhuma carta descartada</div>';
            } else {
                // Mostrar cartas descartadas (mais recentes primeiro)
                const sortedDiscard = [...discardPile].reverse();
                
                sortedDiscard.forEach((cardData, index) => {
                    const renderedCard = createCard(cardData, player);
                    const cardElement = renderedCard.element;
                    cardElement.classList.add('discard-card-item');
                    
                    // Adicionar indicador de ordem
                    const orderBadge = document.createElement('div');
                    orderBadge.textContent = discardPile.length - index;
                    orderBadge.style.cssText = `
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: var(--pv-zero-color);
                        color: white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: bold;
                    `;
                    cardElement.appendChild(orderBadge);
                    
                    // Clique para ver carta em detalhe
                    cardElement.addEventListener('click', () => {
                        closeDiscardModal();
                        showCardModal(renderedCard.data);
                    });
                    
                    grid.appendChild(cardElement);
                });
            }
            
            // Mostrar modal
            modal.classList.add('visible');
        }

        function closeDiscardModal() {
            const modal = document.getElementById('discardModal');
            if (modal) modal.classList.remove('visible');
        }

        function addToDiscard(player, cardData) {
            console.log(`📥 Tentando adicionar carta ao descarte de ${player}:`, cardData ? cardData.name : 'CARTA UNDEFINED');
            
            if (!player || !cardData || !gameState.cards[player] || !gameState.cards[player].discard) {
                console.log('💥 ERRO: Parâmetros inválidos em addToDiscard');
                return;
            }
            
            let cardInstance = cardData;
            if (!cardData.instanceId) {
                cardInstance = window.GameStateModel.createCardInstance(cardData, player, {
                    zone: 'discard'
                });
            }

            const locations = window.GameStateModel.findCardLocations(
                gameState,
                cardInstance.instanceId
            );
            if (locations.length === 0) {
                window.GameStateModel.registerCard(gameState, cardInstance, 'discard', player);
            } else {
                window.GameStateModel.moveCard(gameState, cardInstance.instanceId, 'discard', player);
            }
            updateDiscardCount(player);
            console.log(`📥 ✅ Carta adicionada com sucesso ao descarte de ${player}`);
        }

        function updateDiscardCount(player) {
            if (!player || !gameState.cards[player] || !gameState.cards[player].discard) {
                console.log('💥 ERRO em updateDiscardCount: parâmetros inválidos', {player, gameState: gameState.cards});
                return;
            }
            
            const count = gameState.cards[player].discard.length;
            const countElement = document.getElementById(`discard-count-${player}`);
            if (countElement) {
                countElement.textContent = `${count} cartas`;
                
                // Efeito visual de atualização
                if (count > 0) {
                    countElement.style.color = 'var(--pv-zero-color)';
                    setTimeout(() => {
                        countElement.style.color = 'var(--primary-color)';
                    }, 1000);
                }
            }
        }

        // Contagem da área de saque: quantas cartas ainda restam no deck para
        // comprar. O número sai do estado (a zona `deck` é a mesma que o reset
        // local e o ledger PvP movem em cada compra), então não existe contador
        // paralelo para divergir do tabuleiro.
        function updateDeckCounter(player) {
            const countElement = document.getElementById(`deck-count-${player}`);
            if (!countElement) return;

            const deck = gameState?.players?.[player]?.zones?.deck;
            const restantes = Array.isArray(deck) ? deck.length : 0;
            countElement.textContent = `${restantes} cartas`;
            countElement.setAttribute('data-count', String(restantes));
            // Deck vazio muda de cor: é o que decide se ainda dá para comprar.
            countElement.setAttribute('data-empty', restantes === 0 ? '1' : '0');
        }
        window.updateDeckCounter = updateDeckCounter;

        function handleCardDoubleClick(cardId, cardData) {
            if (gameState.currentPhase === 'combat') {
                console.log('🚫 Duplo clique desabilitado durante a fase de combate');
                return;
            }
            
            const cardElement = document.getElementById(cardId);
            
            // Feedback visual de duplo clique
            if (cardElement) {
                cardElement.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    cardElement.style.transform = '';
                }, 200);
            }
            
            // Verificar se a carta está equipada
            if (cardElement && cardElement.classList.contains('equipped')) {
                const equipmentCards = cardElement.querySelectorAll('.equipment-card');
                
                if (equipmentCards.length > 0) {
                    const latestEquipment = equipmentCards[equipmentCards.length - 1];
                    const supportCardData = JSON.parse(latestEquipment.getAttribute('data-support-card'));
                    
                    latestEquipment.style.transform = 'scale(1.1) rotate(0deg)';
                    setTimeout(() => {
                        latestEquipment.style.transform = '';
                    }, 300);
                    
                    showCardModal(supportCardData);
                    console.log('🔍 Showing equipment modal for:', supportCardData.name);
                } else {
                    console.log('⚠️ Creature is marked as equipped but no equipment cards found');
                }
            } else if (cardElement) {
                showCardModal(cardData);
                console.log('🔍 Showing creature modal for:', cardData.name);
            }
        }

        function updateTooltipForEquippedCard(cardId) {
            const cardElement = document.getElementById(cardId);
            if (cardElement && cardElement.classList.contains('equipped')) {
                const equipmentCards = cardElement.querySelectorAll('.equipment-card');
                if (equipmentCards.length > 0) {
                    cardElement.title = `Duplo-clique para ver equipamentos (${equipmentCards.length})`;
                }
            }
        }

        function clearTooltip(cardId) {
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.title = '';
            }
        }

        // Sistema de notificação para mudanças de turno
        function showTurnNotification(message, duration = 2000) {
            const notification = document.getElementById('turnNotification');
            const text = document.getElementById('notificationText');
            if (!notification || !text) return;
            
            text.innerHTML = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.add('hide');
                setTimeout(() => {
                    notification.classList.remove('show', 'hide');
                }, 400);
            }, duration);
        }

        // Gear "Decks" no PvP: estatistica so do proprio deck (spec parte 4, decisao 6).
        // O deck do oponente e segredo; exibir numeros dele seria vazamento.
        function mostrarInfoDeckProprio(assento) {
            const dono = assento || document.body?.dataset?.seat || 'p1';
            if (!gameState.decks || !window.deckBuilder) {
                showMessage('Sistema de deck não carregado!');
                return;
            }
            const stats = window.deckBuilder.getDeckStats(gameState.decks[dono]);
            const restantes = gameState.decks[dono].length;
            const nomeDeck = gameState.deckSelections?.[dono]?.nome || 'Deck aleatório';
            showMessage(
                `SEU DECK (${dono === 'p1' ? 'Jogador 1' : 'Jogador 2'}) — ${nomeDeck}:\n` +
                `• Total: ${stats.total} cartas\n` +
                `• Criaturas: ${stats.criaturas}\n` +
                `• Suportes: ${stats.suportes}\n` +
                `• Evoluções: ${stats.evolucoes}\n` +
                `• Custo médio: ${stats.custoMedio}\n\n` +
                `Cartas restantes: ${restantes}`
            );
        }
        window.mostrarInfoDeckProprio = mostrarInfoDeckProprio;

        // Gear "Trocar deck": reabre o seletor e remonta a partida com a nova
        // escolha (trocar de deck implica mesa nova, igual ao Reset).
        async function trocarDeck() {
            if (window.PvpSession?.PvpSession) {
                showMessage('Em PvP o deck é escolhido no lobby antes de entrar na sala.', 'warning');
                return;
            }
            if (!window.DeckSelect?.abrir) {
                showMessage('Seletor de decks indisponível.', 'warning');
                return;
            }
            const escolha = await window.DeckSelect.abrir();
            if (!escolha) {
                showMessage('Catálogo de decks indisponível: a partida segue com o deck aleatório.', 'warning');
                return;
            }
            resetGame(escolha);
        }
        window.trocarDeck = trocarDeck;

        // Função para mostrar informações dos decks
        function showDeckInfo() {
            // Em PvP o deck do oponente é secreto (spec parte 4, decisão 6):
            // a estatística de deck alheio seria vazamento de informação.
            if (window.PvpSession?.PvpSession) {
                showMessage('O deck do oponente é secreto nesta partida.', 'warning');
                return;
            }
            if (!gameState.decks || !window.deckBuilder) {
                showMessage('Sistema de deck não carregado!');
                return;
            }
            
            const stats1 = window.deckBuilder.getDeckStats(gameState.decks.p1);
            const stats2 = window.deckBuilder.getDeckStats(gameState.decks.p2);
            const nomeDeck = player => gameState.deckSelections?.[player]?.nome || 'Deck aleatório';
            
            const info = `DECK PLAYER 1 (${nomeDeck('p1')}):
• Total: ${stats1.total} cartas
• Criaturas: ${stats1.criaturas}
• Suportes: ${stats1.suportes}  
• Evoluções: ${stats1.evolucoes}
• Custo médio: ${stats1.custoMedio}

DECK PLAYER 2 (${nomeDeck('p2')}):
• Total: ${stats2.total} cartas
• Criaturas: ${stats2.criaturas}
• Suportes: ${stats2.suportes}
• Evoluções: ${stats2.evolucoes}
• Custo médio: ${stats2.custoMedio}

Cartas restantes:
• Player 1: ${gameState.decks.p1.length}
• Player 2: ${gameState.decks.p2.length}`;
            
            showMessage(info);
        }

        function getSupportEquipRejection(supportCardData) {
            if (!supportCardData) return 'Carta não encontrada.';
            if (gameState.currentPhase !== 'invocation') {
                return 'Você só pode equipar cartas na Fase de Invocação!';
            }
            if (gameState.currentPlayer !== supportCardData.player) {
                return 'Não é o seu turno!';
            }
            const effectiveCost = getEffectiveCardCost(supportCardData.instanceId, supportCardData.data);
            const currentEnergy = window.GameStateModel.getPlayerStat(gameState, 'energy', supportCardData.player);
            if (currentEnergy < effectiveCost) {
                return `Energia insuficiente para equipar ${supportCardData.data.name}: precisa de ${effectiveCost}, você tem ${currentEnergy}.`;
            }
            return null;
        }

        function handleEquipmentDrop(e, supportCardId) {
            const targetCreature = e.currentTarget;
            const targetCreatureId = targetCreature.id;
            
            const supportCardData = findCardData(supportCardId);
            const creatureCardData = findCardData(targetCreatureId);
            
            if (!supportCardData || !creatureCardData) return;
            
            if (supportCardData.data.type !== 'suporte') {
                showMessage('Apenas cartas de suporte podem ser equipadas!');
                return;
            }

            const handOnlyRule = window.CardRules?.getActivatedRule(supportCardData.data.id);
            if (handOnlyRule?.sourceZone === 'hand') {
                showMessage(
                    `${supportCardData.data.name} não pode ser equipada — ative-a direto da mão no painel de habilidades.`,
                    'warning'
                );
                return;
            }
            
            if (creatureCardData.data.type !== 'criatura') {
                showMessage('Cartas de suporte só podem ser equipadas em criaturas!');
                return;
            }

            const migratedTargetCheck = window.CardRules.validateEquipmentTarget(
                supportCardData,
                creatureCardData
            );
            if (!migratedTargetCheck.valid) {
                showMessage(migratedTargetCheck.reason, 'warning');
                return;
            }

            const equipRejection = getSupportEquipRejection(supportCardData);
            if (equipRejection) {
                showMessage(equipRejection, 'warning');
                return;
            }

            equipSupportCard(supportCardId, targetCreatureId);
        }

        function equipSupportCard(supportCardId, creatureCardId) {
            if (pvpGuard({
                cmd: 'EQUIP',
                args: { cardId: supportCardId, creatureId: creatureCardId },
                reveals: pvpReveal(supportCardId, 'hand')
            })) return;
            const supportCardData = findCardData(supportCardId);
            const creatureCardData = findCardData(creatureCardId);
            
            if (!supportCardData || !creatureCardData) return;
            
            if (window.PvpSession?.PvpSession && !pvpAplicando()) {
                const localSeat = document.body.dataset.seat || gameState.currentPlayer;
                if (supportCardData.ownerId !== localSeat) {
                    showMessage('Não pode equipar suporte de outro jogador.', 'warning');
                    return;
                }
            }
            const migratedEquipmentEffects = window.CardRules
                ?.createEquipmentEffects(supportCardData, creatureCardId, gameState);
            const equipmentStatEffects = migratedEquipmentEffects || [
                ...(supportCardData.data.attack ? [{
                    kind: window.GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                    targetId: creatureCardId,
                    modifier: {
                        id: `${supportCardId}:attack`,
                        sourceId: supportCardId,
                        stat: 'attack',
                        operation: window.GameEngine.MODIFIER_OPERATIONS.ADD,
                        value: supportCardData.data.attack,
                        duration: {
                            kind: window.GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: supportCardId
                        }
                    }
                }] : []),
                ...(supportCardData.data.defense ? [{
                    kind: window.GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                    targetId: creatureCardId,
                    modifier: {
                        id: `${supportCardId}:defense`,
                        sourceId: supportCardId,
                        stat: 'defense',
                        operation: window.GameEngine.MODIFIER_OPERATIONS.ADD,
                        value: supportCardData.data.defense,
                        duration: {
                            kind: window.GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: supportCardId
                        }
                    }
                }] : [])
            ];

            const equipResult = window.gameEngine.resolveAction({
                type: 'EQUIP_CARD',
                actorId: supportCardData.player,
                sourceId: supportCardId,
                sourceZone: 'hand',
                requiredPhase: 'invocation',
                requiresTurn: true,
                costs: [{
                    kind: 'PLAYER_STAT',
                    stat: 'energy',
                    playerId: supportCardData.player,
                    amount: getEffectiveCardCost(supportCardId, supportCardData.data)
                }],
                validators: [() => {
                    const target = findCardData(creatureCardId);
                    return target?.data.type === 'criatura' || 'Alvo de equipamento inválido';
                }],
                effects: [
                    {
                        kind: window.GameEngine.EFFECT_KINDS.MOVE_CARD,
                        instanceId: supportCardId,
                        destinationZone: 'equipment',
                        destinationPlayerId: supportCardData.player
                    },
                    {
                        kind: window.GameEngine.EFFECT_KINDS.ATTACH_CARD,
                        equipmentId: supportCardId,
                        targetId: creatureCardId
                    },
                    ...equipmentStatEffects
                ],
                events: [
                    {
                        type: window.GameEngine.EVENT_TYPES.CARD_MOVED,
                        payload: {
                            cardId: supportCardId,
                            playerId: supportCardData.player,
                            from: 'hand',
                            to: 'equipment'
                        }
                    },
                    {
                        type: window.GameEngine.EVENT_TYPES.EQUIPMENT_ATTACHED,
                        payload: {
                            equipmentId: supportCardId,
                            targetId: creatureCardId,
                            playerId: supportCardData.player
                        }
                    }
                ]
            });

            if (equipResult.status !== 'resolved') {
                showMessage(equipResult.reason, 'warning');
                return;
            }

            renderPlayerStat('energy', supportCardData.player);
            playSound('energySound');
            
            if (!creatureCardData.data.equipment) {
                creatureCardData.data.equipment = [];
            }
            creatureCardData.data.equipment.push(supportCardData.data);
            
            const creatureElement = document.getElementById(creatureCardId);
            if (!creatureElement) return;
            
            creatureElement.classList.add('equipped');
            createEquipmentVisual(creatureElement, supportCardData.data);
            
            if (window.cardAbilities) {
                window.cardAbilities.onCardEquipped(supportCardId, supportCardData.data, creatureCardId);
            }

            renderFieldsFromState();
            
            const supportElement = document.getElementById(supportCardId);
            if (supportElement) {
                supportElement.remove();
            }
            
            showMessage(`${supportCardData.data.name} foi equipada em ${creatureCardData.data.name}!`);
            clearEquipmentHighlights();
            
            if (gameState.currentPhase === 'invocation') {
                highlightSummonableCards();
            }
        }

        function highlightEquippableCreatures(supportCardData, canEquip = true) {
            const allCreatures = [...gameState.cards.p1.field, ...gameState.cards.p2.field];

            allCreatures.forEach(creature => {
                if (creature.data.type !== 'criatura') return;
                const creatureElement = document.getElementById(creature.id);
                if (!creatureElement) return;
                const targetCheck = window.CardRules?.validateEquipmentTarget
                    ? window.CardRules.validateEquipmentTarget(supportCardData, creature)
                    : { valid: true };
                creatureElement.classList.add(targetCheck.valid && canEquip ? 'can-be-equipped' : 'cannot-be-equipped');
                creatureElement.ondrop = (e) => dropCard(e);
                creatureElement.ondragover = (e) => allowDrop(e);
            });
        }

        function clearEquipmentHighlights() {
            ['p1', 'p2'].forEach(player => {
                gameState.cards[player].field.forEach(creature => {
                    const creatureElement = document.getElementById(creature.id);
                    if (!creatureElement) return;
                    creatureElement.classList.remove('can-be-equipped', 'cannot-be-equipped');
                    creatureElement.ondrop = null;
                    creatureElement.ondragover = null;
                });
            });
            document.querySelectorAll('.can-be-equipped, .cannot-be-equipped').forEach(card => {
                card.classList.remove('can-be-equipped', 'cannot-be-equipped');
                card.ondrop = null;
                card.ondragover = null;
            });
        }

        function createEquipmentVisual(creatureElement, supportCardData) {
            const existingEquipments = creatureElement.querySelectorAll('.equipment-card');
            const equipmentCount = existingEquipments.length;
            
            const equipmentCard = document.createElement('div');
            equipmentCard.className = 'card equipment-card support';
            
            const baseOffsetX = -3;
            const baseOffsetY = -3;
            const offsetIncrement = 1;
            const rotationVariation = [-2, 1, -1, 1.5, -0.5];
            const opacityLevels = [0.7, 0.6, 0.5, 0.4, 0.3];
            
            const offsetX = baseOffsetX - (equipmentCount * offsetIncrement);
            const offsetY = baseOffsetY - (equipmentCount * offsetIncrement);
            const rotation = rotationVariation[equipmentCount % rotationVariation.length];
            const opacity = opacityLevels[equipmentCount] || 0.3;
            
            equipmentCard.style.top = `${offsetY}px`;
            equipmentCard.style.left = `${offsetX}px`;
            equipmentCard.style.transform = `rotate(${rotation}deg)`;
            equipmentCard.style.zIndex = `${-1 - equipmentCount}`;
            equipmentCard.style.opacity = opacity;
            
            equipmentCard.setAttribute('data-support-card', JSON.stringify(supportCardData));
            
            const cardImageClickable = supportCardData.image ? 
                `<img src="${supportCardData.image}" alt="${supportCardData.name}" class="card-image-real">` :
                `<div class="card-image"></div>`;

            equipmentCard.innerHTML = `
                <div class="card-cost">${supportCardData.cost}</div>
                ${cardImageClickable}
                <div class="card-name">${supportCardData.name}</div>
                <div class="card-stats">
                    <span class="attack">${supportCardData.attack}</span>
                    <span>/</span>
                    <span class="defense">${supportCardData.defense}</span>
                </div>
            `;
            
            equipmentCard.onclick = (e) => {
                e.stopPropagation();
                if (gameState.currentPhase === 'combat') {
                    selectCard(creatureElement.id);
                    return;
                }
                showCardModal(supportCardData);
                console.log('🔍 Clicked on equipment card:', supportCardData.name);
            };
            
            creatureElement.appendChild(equipmentCard);
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', async function() {
            updateUI();
            
            let cardsLoaded = false;
            if (typeof loadCardSystem === 'function') {
                cardsLoaded = await loadCardSystem();
            }
            
            // Em PvP o estado nasce do `MATCH_START` e a abertura (mão inicial +
            // energia do primeiro turno) é do ledger: sem esta guarda o
            // `startNewMatch`/fallback local e o `initFirstTurn` mandavam um
            // `DRAW` extra ao servidor a cada load e a mão crescia fora dele.
            if (window.PvpSession) return;

            // Seletor de decks do hotseat: a mesa só é montada depois da escolha.
            // Sem catálogo (fetch bloqueado/file://) `abrir()` resolve null e a
            // partida segue com o deck aleatório, como antes.
            const escolhaDeDeck = window.DeckSelect?.abrir
                ? await window.DeckSelect.abrir()
                : null;

            if (cardsLoaded && typeof startNewMatch === 'function') {
                await startNewMatch(escolhaDeDeck);
                console.log('Jogo iniciado com cartas reais!');
            } else {
                console.log('Usando cartas básicas (fallback)');
                for (let i = 0; i < 5; i++) {
                    addCardToHand('p1');
                    addCardToHand('p2');
                }
            }
            initFirstTurn();
        });