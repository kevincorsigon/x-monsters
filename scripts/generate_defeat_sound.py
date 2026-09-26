"""Gera `assets/audio/defeat.wav` - a vinheta de derrota do jogo.

Tres notas descendentes com timbre de metal abafado (o classico "wah-wah-wah"
de derrota). Sintetizado com a stdlib (sem ffmpeg/numpy) para o asset nascer
reproduzivel no repositorio: rodar da raiz com
`python scripts/generate_defeat_sound.py`.

O arquivo final e PCM 16-bit mono (WAV), que qualquer navegador toca sem
encoder externo. Para trocar por um MP3 proprio, basta substituir o arquivo e
o `<source>` de `defeatSound` em `game.html`/`pvp.html`.
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22050
# Bb3 -> Ab3 -> Eb3: a queda que o ouvido le como "perdeu".
NOTES = (233.08, 207.65, 155.56)
NOTE_SECONDS = 0.5
RELEASE_SECONDS = 0.35
HARMONICS = ((1, 1.0), (2, 0.45), (3, 0.22), (4, 0.1))
VIBRATO_HZ = 5.2
VIBRATO_CENTS = 18.0
ATTACK_SECONDS = 0.02
DECAY = 1.1
PEAK = 0.85
OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "audio" / "defeat.wav"


def synth_note(frequency: float, note_index: int) -> list[float]:
    """Envelope por nota: ataque curto, decaimento suave e release no fim."""
    duration = NOTE_SECONDS + RELEASE_SECONDS
    samples = int(duration * SAMPLE_RATE)
    note = []
    for index in range(samples):
        t = index / SAMPLE_RATE
        vibrato = VIBRATO_CENTS * math.sin(2 * math.pi * VIBRATO_HZ * t + note_index)
        freq = frequency * 2 ** (vibrato / 1200.0)
        timbre = sum(
            weight * math.sin(2 * math.pi * freq * harmonic * t)
            for harmonic, weight in HARMONICS
        )
        attack = min(1.0, t / ATTACK_SECONDS)
        release = min(1.0, max(0.0, (duration - t) / RELEASE_SECONDS))
        decay = math.exp(-DECAY * t / duration)
        note.append(timbre * attack * release * decay)
    return note


def render() -> list[float]:
    """Soma as notas com sobreposicao (a cauda de uma entra na seguinte)."""
    total = int((NOTE_SECONDS * len(NOTES) + RELEASE_SECONDS) * SAMPLE_RATE)
    buffer = [0.0] * total
    for note_index, frequency in enumerate(NOTES):
        offset = int(note_index * NOTE_SECONDS * SAMPLE_RATE)
        for index, sample in enumerate(synth_note(frequency, note_index)):
            if offset + index < total:
                buffer[offset + index] += sample

    peak = max(abs(value) for value in buffer) or 1.0
    return [value / peak * PEAK for value in buffer]


def main() -> None:
    samples = render()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, value)) * 32767))
        for value in samples
    )
    with wave.open(str(OUTPUT), "wb") as arquivo:
        arquivo.setnchannels(1)
        arquivo.setsampwidth(2)
        arquivo.setframerate(SAMPLE_RATE)
        arquivo.writeframes(frames)
    print(f"{OUTPUT} ({OUTPUT.stat().st_size} bytes, {len(samples) / SAMPLE_RATE:.2f}s)")


if __name__ == "__main__":
    main()
