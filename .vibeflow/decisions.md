# Decision Log
> Newest first. Updated by the architect during specs and audits.

## 2026-09-13 — Fase 5D2 reauditada PASS após fechar o gap de cobertura do Olho de Águia
O único gap do audit anterior (FAIL) — 5 asserts negativos ausentes contra
`card_018` (CP-2), `card_025` (Zé Mulherzinha), `card_044` (Grifo Real),
`card_059` (Licantropia) e `card_060` (Tranca Rua) no teste "Olho de Águia
ignora somente Evasão e Intocável, não outras restrições" — foi fechado
dentro do mesmo teste (sem novo bloco `test(...)`), suíte em 102/102. Cada
assert configura o gate correspondente para realmente disparar (aliado extra
para Zé Mulherzinha, custo do atacante ≤ 4 explicitamente ajustado para o
gate do Grifo Real, campo do atacante com uma única criatura para
Licantropia, campo defensor com 2+ criaturas para Tranca Rua), evitando o
risco apontado no ciclo anterior de um assert "passar" por motivo errado
(ex.: bloqueio pelo próprio gate de custo do Grifo em vez de por Olho não
ignorá-lo). Nenhuma mudança em `card-rules.js`, `manual_abilities.js` ou
`game-engine.js` neste ciclo — confirmado por timestamps de arquivo e
leitura direta do conteúdo de `validateAttackTarget`, já que não há commit
intermediário isolando o estado do audit anterior (todo o lote 5D2 segue não
commitado sobre o mesmo `HEAD`). Ver
[audits/motor-habilidades-fase-5d2-prevencao-bypass-audit.md](audits/motor-habilidades-fase-5d2-prevencao-bypass-audit.md).
Fase 5D2 encerrada.

## 2026-09-13 — Escopo do lote 5D2 e semântica de bypass defensivo
Para `092` Cajado da Ilusão, `097` Flecha de Prata e `101` Olho de Águia:
"Intocável" (092) é modelado como um efeito reativo `UNTOUCHABLE_SHIELD`,
igual em mecânica ao `MAGIC_SHIELD` de Estrela Mágica (002): consome o
próximo ataque contra o equipado e é removido. A ativação é 1x/turno,
sem seleção de alvo (o alvo é sempre o próprio hospedeiro), e a fonte da
habilidade é o equipamento na zona `equipment`, não uma criatura em campo —
isso exige que a ação ativada aceite uma zona de origem configurável e que
o painel manual descubra habilidades também nas zonas de equipamento dos
jogadores, não somente no campo.

"Evasão" (058, citado literalmente no texto de Sábio da Montanha) e
"Intocável" (092) são os dois únicos conceitos que Olho de Águia (101)
ignora, por serem os únicos nomeados literalmente com esses termos no
catálogo; Olho NÃO ignora Estrela Mágica (002), Zé Mulherzinha (025), Grifo
Real (044), CP-2 (018), O Lica (059), Tranca Rua (060) ou Licantropia,
porque nenhum desses textos usa "evasão" ou "intocável".

Flecha de Prata (097) ignora "todas as habilidades especiais defensivas do
monstro alvo", interpretado como o conjunto completo de restrições de alvo
migradas (014, 018, 025, 044, 058, 059, 060) mais os escudos reativos
migrados (002 MAGIC_SHIELD, 092 UNTOUCHABLE_SHIELD) — é estritamente mais
amplo que Olho de Águia.

Bilugação Astral (090, "intransponível") permanece bloqueada por decisão
de produto já registrada; seu termo não é literalmente "intocável" e não
entra no escopo de bypass desta fase.

## 2026-09-13 — Fase 5D4 reauditada PASS após pacote incremental de cobertura
Os 3 gaps de teste do FAIL anterior (mesmo dia) foram fechados só em
`tests/unit/run-tests.js`: um assert inline em "Estaca concede +10 apenas em
host elegível contra Vampiro/Lobisomem" (host sem trait rejeitado por
`validateEquipmentTarget`), um novo teste "Estaca não concede bônus contra
alvo sem trait Vampiro/Lobisomem", e um novo teste "Manto do mesmo
controlador do Iron Dragon não é bloqueado". Suíte em 95/95;
`src/js/card-rules.js` confirmado sem diff frente ao commit já auditado
(`git diff --stat` só mostra `run-tests.js`, 36 inserções). Ver
[audits/motor-habilidades-fase-5d4-matchups-trait-audit.md](audits/motor-habilidades-fase-5d4-matchups-trait-audit.md).
Fase 5D4 encerrada.

## 2026-09-13 — Fase 5D4 auditada FAIL por cobertura de teste, não por bug de lógica
Manto da Luz Solar (095), Estaca do Caçador (102) e Manoplas de Gelo (105)
estão implementados corretamente (proveniência composta com a infra do 5D1,
sem stats implícitos, traits só via `TRAITS_BY_DEFINITION`), mas 3 dos 6
cenários adversariais exigidos pelo lote não têm assert dedicado em
`tests/unit/run-tests.js`: Estaca equipando host sem trait válida (rejeição),
Estaca contra alvo sem trait vampiro/lobisomem (sem bônus), e Manto vs Iron
Dragon do mesmo controlador do Manto (não deveria bloquear). Ver
[audits/motor-habilidades-fase-5d4-matchups-trait-audit.md](audits/motor-habilidades-fase-5d4-matchups-trait-audit.md).
Pitfall para specs futuras do motor de habilidades: exigir que o DoD liste os
cenários negativos/adversariais explicitamente como "testes obrigatórios",
não só o comportamento positivo — este lote descrevia os matchups em prosa
mas não obrigava o caminho de rejeição.

## 2026-09-12 — Defaults conservadores aprovados para habilidades ambíguas
O usuário aprovou aplicar os defaults recomendados da spec durante as Fases 4
e 5, registrando cada interpretação. Para o lote 4B: o texto da habilidade é
canônico e substitui os campos numéricos de suporte; debuffs sem prazo duram
enquanto a fonte permanecer equipada; e “acabou de ser invocado” vale até o
fim do próximo turno do adversário da criatura invocada. Expirar no próprio
turno da invocação tornaria Garras Afiadas inutilizável no fluxo alternado.
Cartas que exigem UI de ativação/seleção
são separadas em lote próprio para manter testes e orçamento auditáveis.

Para o lote 4C: ataque direto sem habilidade só é permitido quando o oponente
não controla criaturas; CP-2 força ataques contra si; “enquanto houver aliados”
significa outro aliado além da própria fonte; Estrela Mágica consome e anula o
próximo ataque; Atravessava dura enquanto equipado e Rego Freitas até o fim do
turno em que for equipado.

O usuário autorizou inferir traits pelo nome quando o catálogo não os declarar.
A implementação deve materializar a inferência em um mapa explícito por ID,
sem procurar substrings em runtime. Para K-023 e Dispositivo de Sincronia,
havendo vários robôs aliados, o bônus se aplica a todos os robôs elegíveis.
Para `elite`, o mapa inicial usa apenas títulos inequivocamente hierárquicos:
Rei das Feras, Lorde Sanguinário, Alquimista Guardião, Paladinos, Condessa,
Imperial X, Sentinela Solar e Superior. O mapa é explícito e pode ser revisado
sem alterar o parser ou inferir por substring em runtime.

Para o lote 5A1: Paladar compara a DEF restante do alvo ao ATK efetivo da
fonte; Hipool compara a DEF restante do alvo à DEF restante da fonte; “primeiro
ataque” significa primeiro ataque de cada turno; “ignorar N DEF” transforma N
pontos adicionais em penetração sem impedir o dano normal à criatura; “ignorar
toda DEF” faz o ATK completo penetrar no PV se o ataque for contra criatura.

Para o lote 5B1: reflexão de metade arredonda para baixo; Fantom retorna
automaticamente à mão e remove todo dano quando substituir a morte; efeitos
opcionais benéficos de abate (novo ataque e drenagem) são aplicados
automaticamente; drenagem transfere até 10 PV, limitada pelo PV disponível do
oponente; Aura de Vingança usa o ATK efetivo imediatamente anterior à morte.

Para matchups de traits: Vampiros são Lorde Sanguinário, Alucard e Condessa
Carmilla; Lobisomens são O Lica e a família Lobo; fogo é Quimera de Fogo e
Lobo Omega Pyro. Guerreiro/humanoide inclui Goblin Mestre de Armas, Minotauro
Guerreiro, Paladinos e Superior. Esses valores ficam em mapa explícito por ID.

## 2026-09-12 — Complete root organization implemented and audited
The repository root now contains only the two HTML entry points, primary
README, requirements, and configuration. Runtime JavaScript moved to
`src/js/`, audio to `assets/audio/`, browser diagnostics to `tests/browser/`,
secondary documents to `docs/`, and Python tools remain canonical under
`scripts/`. The unused `embedded_cards.js` duplicate was removed. Validation
passed for 20 HTTP resources, 110 loaded cards, all 10 JavaScript files,
all Python scripts, Markdown links, and the existing coverage reports. See
[audits/complete-root-organization-audit.md](audits/complete-root-organization-audit.md).

## 2026-09-12 — Root cleanup will preserve static entry points and proceed in phases
The target structure keeps `game.html`, `index.html`, `README.md`,
`AGENTS.md`, `requirements_ocr.txt`, and configuration at the root. Audio
moves to `assets/audio/`, runtime JavaScript to `src/js/`, browser tests to
`tests/browser/`, secondary documentation to `docs/`, and canonical Python
tools remain in `scripts/`. Ten root Python files were verified SHA-256
identical to their canonical `scripts/` copies, so they will be deleted
rather than moved. Ignored `debug_*.png` files have no active references and
will be removed instead of retained as source assets. See
[specs/complete-root-organization.md](specs/complete-root-organization.md).

The work is phased because audio and JavaScript moves change paths consumed
by both entry points, browser tests, and Python validators. `game.html` keeps
loading the existing development scripts during relocation; removing those
production includes is a separate behavior change, not part of structural
cleanup.

## 2026-09-12 — Part 4 (final) of project-structure refactor audited PASS — spec-writing pitfall
`check_cards.py`, `final_check.py`, `analyze_json.py` moved to `scripts/`,
now reading `data/cards_database.json`; `card-abilities.js` stays at the
repo root, untouched. See
[audits/refactor-project-structure-part-4-audit.md](audits/refactor-project-structure-part-4-audit.md).
Pitfall for future specs: [specs/refactor-project-structure-part-4.md](specs/refactor-project-structure-part-4.md)'s
DoD item 3 suggested `../card-abilities.js` as the path from `scripts/`,
which actively contradicts the CWD-relative-to-repo-root convention the
same spec family established in Parts 2-3 (scripts run as
`python scripts/foo.py` from the repo root, so `card-abilities.js` is
already reachable unprefixed — `../` would escape the repo). Implemented as
unchanged `'card-abilities.js'`, verified correct by actually running the
script. Future specs should avoid parenthetical path examples that assume
`__file__`-relative resolution when the project's established convention is
CWD-relative — state the resolution rule once and let it apply, don't
re-derive a literal example that can silently contradict it.

With this part, the "refactor-project-structure" initiative (images →
`assets/cards/`, data → `data/cards_database.json`, Python tooling →
`scripts/`) is complete — Parts 1-4 all audited PASS.

## 2026-09-12 — Part 3 of project-structure refactor audited PASS; pre-existing bug found
`create_cards_front_back.py` and `card_printing_advanced.py` (now in
`scripts/`) load `cards_database.json` as the raw dict (`{cards, total_cards,
types}`) and then iterate `for card in cards_data`, which walks the dict's
*keys* instead of the card list — `cards_by_image` ends up empty and printed
card sheets can't match real names/art to images. Confirmed pre-existing
(same JSON shape existed before the Part 1 move) via real execution during
the Part 3 audit — not a regression from this refactor, out of its scope to
fix. See [audits/refactor-project-structure-part-3-audit.md](audits/refactor-project-structure-part-3-audit.md).
Worth a dedicated hotfix/spec: fix both scripts to read `data['cards']`
like `create_cards_high_quality.py` already does correctly.
Also noted: `create_cards_high_quality.py` requires a `verso_card_kevao.png`
that has never existed in this repo and aborts before generating any output
without it — pre-existing, unrelated to the reorg.

## 2026-09-12 — Part 1 of project-structure refactor audited PASS
Card images now live at `assets/cards/` and the card database at
`data/cards_database.json` (moved from repo root); `deck_system.js` updated
accordingly. See [specs/refactor-project-structure-part-1.md](specs/refactor-project-structure-part-1.md)
and [audits/refactor-project-structure-part-1-audit.md](audits/refactor-project-structure-part-1-audit.md).
Pitfall for future work: the files were moved with `Move-Item`, not `git mv`,
so `git status` shows them as delete+untracked-add rather than renames —
harmless for content/behavior, but stage with `git add -A` (not selective
`git mv`) to keep history clean, and prefer `git mv` in future relocations
so rename detection stays intact. Parts 2–4 (Python script relocation) are
still pending and depend on this part.
