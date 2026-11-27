"""Builds the music and sound effects: song.py -> song.yml -> music.asm -> music.obj

    python song.py             (needs sointu-compile 0.6+; set SOINTU_DIR if not in the default place)

Sointu's stock player renders a whole song in one call. The game needs to react to
events, so the generated player is turned into a streaming one:

    su_tick(row)        triggers the notes of a song row
    su_block(out, n)    renders n stereo float samples
    su_synth()          the synth state, used by the host to trigger the SFX voices

Instruments are laid out as: one voice per music track, then the SFX, then Global.
SFX have no track: the host triggers them, see src/audio.h.
"""
import json
import math
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SOINTU = os.environ.get("SOINTU_DIR", os.path.expanduser(r"~\Downloads\sointu-0.6.0\sointu-Windows"))
BPM = 150  # 4410 samples per row

_id = 0


def unit(type_, varargs=None, **p):
    global _id
    _id += 1
    p.setdefault("stereo", 0)
    u = dict(type=type_, id=_id, parameters=p)
    if varargs:
        u["varargs"] = varargs
    return u


def env(d, a=0, s=0, r=0, gain=128):
    return unit("envelope", attack=a, decay=d, sustain=s, release=r, gain=gain)


def osc(type_, transpose=64, gain=128, color=128, shape=64, detune=64):
    return unit("oscillator", type=type_, transpose=transpose, detune=detune, gain=gain,
                color=color, shape=shape, phase=0, lfo=0, unison=0)


def noise(gain=128):
    return unit("noise", gain=gain, shape=64)


def mulp():
    return unit("mulp")


def addp():
    return unit("addp")


def lowpass(freq, res=128):
    return unit("filter", frequency=freq, resonance=res, lowpass=1, bandpass=0, highpass=0)


def highpass(freq, res=128):
    return unit("filter", frequency=freq, resonance=res, lowpass=0, bandpass=0, highpass=1)


def send(target, amount, port=0):
    return unit("send", target=target["id"], amount=amount, port=port, sendpop=1, voice=0, unit=0)


def out(gain, aux, pan=64):
    return [unit("pan", panning=pan), unit("outaux", outgain=gain, auxgain=aux, stereo=1)]


def swept(osc_, sweep_decay, amount, amp_decay, extra=()):
    """An oscillator whose pitch and volume decay."""
    return [env(amp_decay), env(sweep_decay), send(osc_, amount), osc_, mulp(), *extra]


def instrument(name, units):
    return dict(name=name, numvoices=1, units=units)


MUSIC = [
    instrument("Kick", swept(osc(0, 52), 48, 96, 64) + out(56, 0)),
    instrument("Hat", [env(48), noise(), mulp(), highpass(100)] + out(10, 12, 80)),
    instrument("Bass", [env(70, r=60), osc(1, 64, color=100), mulp(), lowpass(34, 50)] + out(48, 0)),
    instrument("Arp", [env(60, r=64), osc(2, 64, color=30), mulp(), lowpass(46, 100)] + out(10, 40, 48)),
]
SFX = [  # same order as the event counters in src/shaders/state.glsl
    # shot: a zap falling fast, with a breath of noise
    instrument("Shot", swept(osc(1, 84, color=90), 38, 110, 52, [lowpass(80, 90)])
               + [env(36), noise(), mulp(), highpass(90), addp()] + out(30, 24)),
    # enemy hit: a short metallic tick
    instrument("Hit", [env(40), noise(), mulp(), highpass(100)]
               + swept(osc(0, 96), 40, 90, 44) + [addp()] + out(30, 10)),
    # kill: a bell over a low burst
    instrument("Kill", [env(78), osc(0, 79, gain=100), osc(0, 97, gain=44), addp(), mulp()]
               + swept(osc(1, 50, color=60), 60, 100, 70, [lowpass(50)]) + [addp()] + out(44, 70)),
    # hurt: a low, dirty thud
    instrument("Hurt", swept(osc(1, 40, color=20), 64, 90, 76, [lowpass(46, 60)]) + out(80, 30)),
    # jump: a soft thump
    instrument("Jump", swept(osc(0, 46), 44, 84, 48) + out(40, 0)),
    # lap: two bright tones, a fifth apart
    instrument("Lap", [env(90), osc(0, 84, gain=90), osc(0, 91, gain=70), addp(), mulp()] + out(30, 90)),
]
GLOBAL = instrument("Global", [
    unit("in", channel=2, stereo=1),
    unit("delay", [13230, 17640], stereo=1, pregain=80, dry=128, feedback=70, damp=60, notetracking=0),
    unit("out", gain=60, stereo=1),
])

H = 1  # hold
_ = 0  # release


def every(step, note, offset=0):
    return [note if i % step == offset else H for i in range(16)]


def bass(root):
    return [root, H, _, root, H, _, root, H, root + 12, H, _, root, H, _, root + 7, H]


def arp(chord):
    return [chord[i % 4] if i % 2 == 0 else H for i in range(16)]


ROOTS = [50, 46, 53, 48]  # D Bb F C, low and minor
CHORDS = [(74, 77, 81, 86), (74, 77, 82, 86), (72, 77, 81, 84), (72, 76, 79, 84)]
TRACKS = [
    dict(numvoices=1, order=[0] * 8, patterns=[every(4, 60)]),
    dict(numvoices=1, order=[-1] * 4 + [0] * 4, patterns=[every(4, 72, 2)]),
    dict(numvoices=1, order=[0, 0, 1, 1, 2, 2, 3, 3], patterns=[bass(r) for r in ROOTS]),
    dict(numvoices=1, order=[0, 0, 1, 1, 2, 2, 3, 3], patterns=[arp(c) for c in CHORDS]),
]
SONG = dict(bpm=BPM, rowsperbeat=4,
            score=dict(tracks=TRACKS, rowsperpattern=16, length=8),
            patch=MUSIC + SFX + [GLOBAL])


def streaming(asm):
    """Replace su_render_song by the streaming entry points."""
    begin = asm.index("section .su_render_song code")
    end = asm.index(";----", begin)
    body = asm[begin:end]
    # Per-sample code: between the sample loop label and its loop condition, unchanged.
    inner = re.search(r"su_render_sampleloop:.*?\n(.*?inc     eax\n)\s+cmp     eax, (\d+)", body, re.S)
    code, samples_per_row = inner.group(1), int(inner.group(2))
    # The stock player keeps [output pointer] at a fixed depth; "Row" is replaced by a dummy push.
    depth = re.search(r"mov     edi, \[esp \+ (\d+)\]", code).group(1)
    rows = re.search(r"cmp     eax, (\d+)\s+jl      su_render_rowloop", body).group(1)
    return asm[:begin] + f"""section .su_stream_state data align=1
su_globaltick: dd 0
su_randseed: dd 1
section .su_synth code align=1
global _su_synth@0
_su_synth@0:
    mov     eax, dword su_synth_obj
    ret
section .su_tick code align=1
global _su_tick@4
_su_tick@4:
    pushad
    mov     eax, [esp + 36]
    call    su_update_voices
    popad
    ret     4
section .su_block code align=1
global _su_block@8
_su_block@8:
    pushad
    push    dword [su_randseed]
    push    dword [su_globaltick]
    push    eax                 ; stands for Row
    xor     eax, eax
su_render_sampleloop:
{code}            cmp     eax, [esp + {depth}]
            jl      su_render_sampleloop
    pop     eax
    pop     dword [su_globaltick]
    pop     dword [su_randseed]
    popad
    ret     8
""" + asm[end:], samples_per_row, int(rows)


def main():
    yml = os.path.join(HERE, "song.yml")
    with open(yml, "w") as f:
        json.dump(SONG, f, indent=1)  # JSON is valid YAML
    subprocess.run([os.path.join(SOINTU, "sointu-compile.exe"), "-arch", "386", "-os", "windows",
                    "-e", "asm", "-o", os.path.join(HERE, "music"), yml], check=True)
    path = os.path.join(HERE, "music.asm")
    asm, spr, rows = streaming(open(path).read())
    open(path, "w").write(asm)
    with open(os.path.join(HERE, "music.h"), "w") as f:
        f.write(f"""// Generated by song.py
#pragma once
#define SU_SAMPLE_RATE 44100
#define SU_SAMPLES_PER_ROW {spr}
#define SU_ROWS {rows}
#define SU_FIRST_SFX_VOICE {len(MUSIC)}
#define SU_SFX_COUNT {len(SFX)}

extern "C" {{
	void __stdcall su_tick(int row);
	void __stdcall su_block(float* out, int samples);
	char* __stdcall su_synth();
}}

// Layout of the synth state (su_synthworkspace, su_voice)
#define SU_VOICES_OFFSET 64
#define SU_VOICE_SIZE 4096
""")
    subprocess.run([os.path.join(HERE, "nasm.exe"), "-f", "win32", "-o", os.path.join(HERE, "music.obj"), path], check=True)
    print(f"{spr} samples per row, {rows} rows")


if __name__ == "__main__":
    main()
