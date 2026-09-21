#!/usr/bin/env node
// Runner de testes de browser via Chrome DevTools Protocol (sem npm)
// Requer: Chrome instalado + servidor HTTP rodando em localhost:8080

const { spawn } = require('child_process');
const http = require('http');
const BASE = 'http://localhost:8080';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DEBUG_PORT = 9333;

// Páginas HTML standalone (têm seu próprio estado mock)
const HTML_PAGES = [
    'tests/browser/test_abilities.html',
    'tests/browser/test_fix.html',
];

// Scripts de console (precisam de game.html carregado)
const CONSOLE_SCRIPTS = [
    'tests/browser/test_ui_state.js',
    'tests/browser/test_features.js',
    'tests/browser/test_all_protections.js',
    'tests/browser/test_attack_calculation.js',
    'tests/browser/test_mago_arcano.js',
    'tests/browser/test_tobinha.js',
    'tests/browser/test_deck_count.js',
    'tests/browser/test_dice_roll.js',
    'tests/browser/test_tlantidu_death.js',
];

// Scripts de console PVP (precisam de pvp.html carregado)
const PVP_CONSOLE_SCRIPTS = [
    'tests/browser/test_pvp_protocol.js',
    'tests/browser/test_pvp_session.js',
    'tests/browser/test_pvp_state.js',
    'tests/browser/test_pvp_draw.js',
    'tests/browser/test_field_card_size.js',
    'tests/browser/test_pvp_game_over.js',
    'tests/browser/test_pvp_deck_count.js',
    'tests/browser/test_pvp_dice_state.js',
];

// Scripts de console do lobby (precisam de pvp-lobby.html carregado)
const LOBBY_CONSOLE_SCRIPTS = [
    'tests/browser/test_pvp_lobby_rules.js',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${DEBUG_PORT}${path}`, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function cdp(ws, method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 1e9);
        const timeout = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
        function handler(event) {
            const msg = JSON.parse(event.data);
            if (msg.id === id) {
                ws.removeEventListener('message', handler);
                clearTimeout(timeout);
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
            }
        }
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function runPage(wsUrl, label, scriptToInject, pageUrl = 'game.html') {
    const logs = [];
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
        ws.addEventListener('open', res);
        ws.addEventListener('error', rej);
    });

    ws.addEventListener('message', event => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
            logs.push({ type: msg.params.type, text });
        }
    });

    await cdp(ws, 'Runtime.enable');
    await cdp(ws, 'Page.enable');

    let domLog = null;

    if (scriptToInject) {
        await cdp(ws, 'Page.navigate', { url: `${BASE}/${pageUrl}` });
        await sleep(3000);
        const fs = require('fs');
        const code = fs.readFileSync(require('path').join(__dirname, '..', '..', scriptToInject), 'utf8');
        await cdp(ws, 'Runtime.evaluate', {
            expression: `(function() { try { ${code} } catch(e) { console.error('ERRO: ' + e.message); } })()`,
            awaitPromise: false
        });
        await sleep(1000);
    } else {
        await cdp(ws, 'Page.navigate', { url: `${BASE}/${label}` });
        await sleep(2500);
        // Ler DOM #log para páginas standalone
        const domResult = await cdp(ws, 'Runtime.evaluate', {
            expression: `(function(){ const el = document.getElementById('log'); return el ? el.innerText : null; })()`,
            returnByValue: true
        });
        if (domResult && domResult.result && domResult.result.value) {
            domLog = domResult.result.value;
        }
    }

    ws.close();
    return { logs, domLog };
}

let browserWsUrl = null;

function cdpBrowser(method, params = {}) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(browserWsUrl);
        const id = 1;
        ws.addEventListener('open', () => {
            ws.send(JSON.stringify({ id, method, params }));
        });
        ws.addEventListener('message', event => {
            const msg = JSON.parse(event.data);
            if (msg.id === id) {
                ws.close();
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
            }
        });
        ws.addEventListener('error', reject);
    });
}

async function openNewTab() {
    const result = await cdpBrowser('Target.createTarget', { url: 'about:blank' });
    const targetId = result.targetId;
    const targets = await fetchJson('/json/list');
    const target = targets.find(t => t.id === targetId);
    if (!target) throw new Error('Target não encontrado: ' + targetId);
    return target.webSocketDebuggerUrl;
}

async function main() {
    console.log('Iniciando Chrome headless...');
    const chrome = spawn(CHROME, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        'about:blank'
    ], { stdio: 'ignore' });

    // Aguarda Chrome iniciar
    let started = false;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
            await fetchJson('/json/version');
            started = true;
            break;
        } catch (_) {}
    }
    if (!started) { chrome.kill(); throw new Error('Chrome não iniciou'); }
    const version = await fetchJson('/json/version');
    browserWsUrl = version.webSocketDebuggerUrl;
    console.log('Chrome pronto.\n');

    let passed = 0;
    let failed = 0;

    function printLogs(logs) {
        logs.forEach(l => {
            const icon = l.type === 'error' ? '  ✗' : '  ·';
            console.log(`${icon} ${l.text}`);
        });
    }

    async function runAndReport(label, wsUrl) {
        const { logs, domLog } = await runPage(wsUrl, label, null);
        const errors = logs.filter(l => l.type === 'error');
        console.log(`\n=== ${label} ===`);
        printLogs(logs);
        if (domLog) {
            const domLines = domLog.split('\n').filter(l => l.trim());
            domLines.forEach(l => console.log(`  DOM> ${l}`));
        }
        const domHasError = domLog && domLog.includes('❌');
        const domHasSuccess = domLog && domLog.includes('✅');
        const pass = errors.length === 0 && !domHasError && (domHasSuccess || logs.length > 0);
        console.log(pass ? `→ PASS` : `→ FAIL (${errors.length} erros console${domHasError ? ', erro no DOM' : ''})`);
        pass ? passed++ : failed++;
    }

    async function runConsoleAndReport(scriptPath, wsUrl, pageUrl = 'game.html') {
        const { logs } = await runPage(wsUrl, null, scriptPath, pageUrl);
        const errors = logs.filter(l => l.type === 'error');
        console.log(`\n=== ${scriptPath} (via ${pageUrl}) ===`);
        printLogs(logs);
        const pass = errors.length === 0;
        console.log(pass ? `→ PASS` : `→ FAIL (${errors.length} erros)`);
        pass ? passed++ : failed++;
    }

    // Rodar páginas HTML standalone
    for (const page of HTML_PAGES) {
        const wsUrl = await openNewTab();
        await runAndReport(page, wsUrl);
    }

    // Rodar scripts de console contra game.html
    for (const script of CONSOLE_SCRIPTS) {
        const wsUrl = await openNewTab();
        await runConsoleAndReport(script, wsUrl, 'game.html');
    }

    // Rodar scripts de console PVP contra pvp.html
    for (const script of PVP_CONSOLE_SCRIPTS) {
        const wsUrl = await openNewTab();
        await runConsoleAndReport(script, wsUrl, 'pvp.html');
    }

    // Rodar scripts de console do lobby contra pvp-lobby.html
    for (const script of LOBBY_CONSOLE_SCRIPTS) {
        const wsUrl = await openNewTab();
        await runConsoleAndReport(script, wsUrl, 'pvp-lobby.html');
    }

    chrome.kill();
    console.log(`\n${passed + failed} testes: ${passed} PASS / ${failed} FAIL`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(e => {
    console.error(e.message);
    process.exit(1);
});
