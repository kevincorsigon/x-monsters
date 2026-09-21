console.log('PROBE carregado');
// Sonda temporária: dois assentos PvP reais (CDP) para medir a consistência do
// dado da sorte entre p1 e p2 (usado em um lado, disponível no outro?).
const { spawn } = require('child_process');
const http = require('http');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9339;
const BASE = process.env.PVP_BASE || 'http://127.0.0.1:8092';
const sleep = ms => new Promise(r => setTimeout(r, ms));

process.on('unhandledRejection', erro => { console.log('ERRO:', erro.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT da sonda'); process.exit(1); }, 120000);

function fetchJson(url, options) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options || {}, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data.slice(0, 300))); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function conectar(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws));
        ws.addEventListener('error', reject);
    });
}

function makeCdp(ws, etiqueta) {
    const pendentes = new Map();
    let id = 0;
    ws.addEventListener('message', evento => {
        const msg = JSON.parse(evento.data);
        if (msg.id && pendentes.has(msg.id)) {
            const pend = pendentes.get(msg.id);
            pendentes.delete(msg.id);
            msg.error ? pend.reject(new Error(msg.error.message)) : pend.resolve(msg.result);
            return;
        }
        if (msg.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(msg.params.type)) {
            const texto = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
            console.log(`   [${etiqueta}/${msg.params.type}] ${texto.slice(0, 160)}`);
        }
    });
    return (method, params = {}) => new Promise((resolve, reject) => {
        id++;
        pendentes.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function avaliar(cdp, expression) {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);

const SNAPSHOT = [
    '(function(){',
    '    const gs = window.gameState || {};',
    '    const dado = player => {',
    "        const b = document.getElementById('dice-' + player);",
    '        if (!b) return null;',
    '        const cs = getComputedStyle(b);',
    '        return {',
    '            disabled: b.disabled,',
    '            face: b.dataset.face || null,',
    "            classes: [...b.classList].filter(c => c.startsWith('dice-')).join(',') || '-',",
    "            glyph: b.textContent.trim().slice(0, 2) || '(svg)',",
    '            fundo: cs.backgroundColor,',
    '            opacidade: cs.opacity,',
    '            filtro: cs.filter',
    '        };',
    '    };',
    '    return JSON.stringify({',
    "        seat: document.body.dataset.seat,",
    '        turno: gs.currentPlayer, fase: gs.currentPhase,',
    '        diceUsed: gs.diceUsed,',
    '        energia: { p1: gs.players && gs.players.p1.energy, p2: gs.players && gs.players.p2.energy },',
    '        pv: { p1: gs.players && gs.players.p1.pv, p2: gs.players && gs.players.p2.pv },',
    "        dice: { p1: dado('p1'), p2: dado('p2') },",
    '        seq: { last: window.PvpSession?.current?.lastSeq, next: window.PvpSession?.current?.nextSeq }',
    '    }, null, 1);',
    '})()'
].join('\n');

const CLICAR_DADO = player => `document.getElementById('dice-${player}').click(), 'ok'`;

const FIM_TURNO = [
    "[...document.querySelectorAll('.control-section .action-button')]",
    "    .find(b => b.textContent.includes('Fim Turno')).click(), 'ok'"
].join('\n');

console.log('ANTES do IIFE');
(async () => {
    console.log('iniciando sonda');
    const sala = await fetchJson(`${BASE}/api/matches`, { method: 'POST', headers: { 'Content-Length': 0 } });
    console.log('sala:', sala.roomId, '\n');

    const chrome = spawn(CHROME, [
        `--remote-debugging-port=${DEBUG_PORT}`, '--headless=new', '--disable-gpu',
        '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1200,900', 'about:blank'
    ], { stdio: 'ignore' });

    let pronto = false;
    for (let i = 0; i < 30 && !pronto; i++) {
        await sleep(500);
        try { await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`); pronto = true; } catch (_) {}
    }
    if (!pronto) throw new Error('Chrome nao iniciou');

    const versao = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const browserWs = await conectar(versao.webSocketDebuggerUrl);
    const navegador = makeCdp(browserWs, 'browser');

    const assentos = {};
    for (const seat of ['p1', 'p2']) {
        const alvo = await navegador('Target.createTarget', { url: 'about:blank' });
        await sleep(300);
        const info = (await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).find(t => t.id === alvo.targetId);
        const ws = await conectar(info.webSocketDebuggerUrl);
        const cdp = makeCdp(ws, seat);
        await cdp('Runtime.enable');
        await cdp('Page.enable');
        assentos[seat] = { ws, cdp };
        await cdp('Page.navigate', { url: `${BASE}/pvp/${sala.roomId}/${seat}` });
    }

    const esperarMontagem = async (seat, limite = 20000) => {
        const inicio = Date.now();
        while (Date.now() - inicio < limite) {
            await sleep(400);
            const montada = await avaliar(assentos[seat].cdp, 'Boolean(window.__pvpPartidaMontada)').catch(() => false);
            if (montada) return true;
        }
        return false;
    };
    console.log('p1 montou:', await esperarMontagem('p1'));
    console.log('p2 montou:', await esperarMontagem('p2'));
    await sleep(1200);

    const foto = async (rotulo, lados = ['p1', 'p2']) => {
        console.log(`\n===== ${rotulo} =====`);
        for (const seat of lados) {
            console.log(`-- ${seat} --`);
            console.log(await avaliar(assentos[seat].cdp, SNAPSHOT));
        }
    };

    await foto('0. inicio');

    console.log('\n>>> p1 rola o dado');
    await avaliar(assentos.p1.cdp, CLICAR_DADO('p1'));
    await sleep(2500);
    await foto('1. depois do dado do p1');

    console.log('\n>>> p1 passa o turno');
    await avaliar(assentos.p1.cdp, FIM_TURNO);
    await sleep(2500);
    await foto('2. turno do p2');

    console.log('\n>>> p2 rola o dado');
    await avaliar(assentos.p2.cdp, CLICAR_DADO('p2'));
    await sleep(2500);
    await foto('3. depois do dado do p2');

    console.log('\n>>> p2 passa o turno (volta para o p1)');
    await avaliar(assentos.p2.cdp, FIM_TURNO);
    await sleep(2500);
    await foto('4. turno do p1 de novo');

    console.log('\n>>> F5 no p1');
    await assentos.p1.cdp('Page.reload');
    await sleep(3500);
    await esperarMontagem('p1');
    await sleep(1500);
    await foto('5. p1 depois do F5', ['p1']);

    console.log('\n>>> p1 tenta clicar no dado ja usado');
    console.log(await avaliar(assentos.p1.cdp, [
        '(function(){',
        "    const b = document.getElementById('dice-p1');",
        '    const antes = { disabled: b.disabled, energia: window.gameState.players.p1.energy };',
        '    b.click();',
        '    return JSON.stringify({ antes, depois: { disabled: b.disabled, energia: window.gameState.players.p1.energy } });',
        '})()'
    ].join('\n')));
    await sleep(1500);
    await foto('6. depois do clique no dado usado', ['p1']);

    for (const seat of ['p1', 'p2']) assentos[seat].ws.close();
    browserWs.close();
    chrome.kill();
    process.exit(0);
})();


    return r.result.value;
}
