"""Banda sonora del reel Cumbre30 — síntesis pura con numpy.

28 s, 44.1 kHz estéreo, 110 BPM, progresión Am–F–C–G.
Capas: pad de acordes (saw suave), bajo, kick 4/4, hi-hat offbeat,
arpegio pluck con eco y riser final. Salida: /tmp/kit/musica.wav
"""
import numpy as np
import wave

SR = 44100
BPM = 110.0
BEAT = 60.0 / BPM          # 0.545 s
COMPAS = BEAT * 4          # 2.18 s
DUR = 28.0
N = int(SR * DUR)
t_all = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)

def env_ad(n, a, d, sustain=0.0, rel=None):
    """Ataque/caída con sustain (a,d en segundos)."""
    e = np.ones(n) * sustain
    na, nd = int(a * SR), int(d * SR)
    if na > 0:
        e[:na] = np.linspace(0, 1, na) if sustain == 0 else np.linspace(0, sustain, na)
    if nd > 0:
        seg = e[na:na + nd]
        if len(seg):
            e[na:na + nd] = np.linspace(e[na] if na < n else 1, sustain, len(seg))
    return e

def nota(freq, dur, amp=0.2, timbre="saw", pan=0.0, t0=0.0, detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if timbre == "saw":
        f1 = 2 * (t * (freq + detune) % 1) - 1
        f2 = 2 * (t * (freq - detune) % 1) - 1
        w = 0.5 * (f1 + f2)
    elif timbre == "square":
        w = np.sign(np.sin(2 * np.pi * freq * t))
    else:  # sine / sub
        w = np.sin(2 * np.pi * freq * t)
    atk = min(0.01, dur * 0.3)
    atkn = min(len(w), max(1, int(atk * SR)))
    w[:atkn] *= np.linspace(0, 1, atkn)
    decay = np.exp(-t * (3.5 / dur))
    w = w * decay
    i0 = int(t0 * SR)
    i0 = min(i0, max(0, N - len(w)))
    seg = min(len(w), N - i0)
    gl = amp * (1 - pan) / 1.4
    gr = amp * (1 + pan) / 1.4
    L[i0:i0 + seg] += w[:seg] * gl
    R[i0:i0 + seg] += w[:seg] * gr

def kick(t0, amp=0.5):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 150 * np.exp(-t * 28) + 42
    w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18)
    i0 = int(t0 * SR)
    seg = min(n, N - i0)
    L[i0:i0 + seg] += w[:seg] * amp
    R[i0:i0 + seg] += w[:seg] * amp

def hat(t0, amp=0.09):
    n = int(0.05 * SR)
    rng = np.random.default_rng(7)
    w = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 90)
    i0 = int(t0 * SR)
    seg = min(n, N - i0)
    g = amp if i0 % 2 == 0 else amp * 0.9
    L[i0:i0 + seg] += w[:seg] * g * 0.8
    R[i0:i0 + seg] += w[:seg] * g

# Acordes Am F C G (raíz en Hz, octava 3): A2=110 F2=87.3 C3=130.8 G2=98
RAICES = [110.0, 87.31, 130.81, 97.999]
TERCERAS = [261.63, 261.63, 261.63, 392.0]  # C4 o E4 según acorde (simplificado)
ACORDES = [
    [220.0, 261.63, 329.63],        # Am (A3 C4 E4)
    [174.61, 220.0, 261.63],        # F  (F3 A3 C4)
    [261.63, 329.63, 392.0],        # C  (C4 E4 G4)
    [196.0, 246.94, 293.66],        # G  (G3 B3 D4)
]

n_compases = int(DUR / COMPAS)  # 12
print("compases:", n_compases)

for c in range(n_compases):
    t0 = c * COMPAS
    ch = ACORDES[c % 4]
    raiz = RAICES[c % 4]
    # Pad: nota larga por compás, entra suave (fade global de intro)
    g_intro = min(1.0, (c + 1) / 2)
    for j, fnote in enumerate(ch):
        nota(fnote, COMPAS * 0.98, amp=0.045 * g_intro, timbre="saw",
             pan=(-0.3 if j == 0 else 0.3 if j == 2 else 0.0), t0=t0, detune=0.4)
    # Bajo: sub en negras 1 y 3
    nota(raiz / 2, BEAT * 1.7, amp=0.22, timbre="sub", t0=t0)
    nota(raiz / 2, BEAT * 1.7, amp=0.18, timbre="sub", t0=t0 + BEAT * 2)
    # Batería: desde el compás 2
    if c >= 1:
        for b in range(4):
            kick(t0 + b * BEAT)
        for b in range(4):
            hat(t0 + b * BEAT + BEAT / 2)
    # Arpegio pluck: corcheas, compás 3+ (build)
    if c >= 2:
        for k, b in enumerate(range(8)):
            fnote = ch[k % 3] * (2 if k % 4 >= 2 else 1)
            nota(fnote, BEAT * 0.5, amp=0.10 * g_intro, timbre="square",
                 pan=(-0.5 if k % 2 else 0.5), t0=t0 + b * BEAT / 2)

# Riser final (últimos 2 s) y golpe final
riser_n = int(2.0 * SR)
tr = np.arange(riser_n) / SR
rw = np.sin(2 * np.pi * (200 + 900 * tr ** 1.6) * tr) * np.linspace(0, 0.14, riser_n)
L[-riser_n:] += rw
R[-riser_n:] += rw

# Fade out global (últimos 2.5 s) + soft clip
fade = np.ones(N)
fn = int(2.5 * SR)
fade[-fn:] = np.linspace(1, 0, fn)
L *= fade
R *= fade
L = np.tanh(L * 1.1)
R = np.tanh(R * 1.1)
stereo = np.stack([L, R], axis=1)
pcm = (stereo * 32767 * 0.92).astype(np.int16)

with wave.open("/tmp/kit/musica.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("MUSICA_OK", DUR, "s")
