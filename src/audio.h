// Music and reactive sound effects, streamed by Sointu (see music/song.py).
#pragma once

#include <mmsystem.h>
#include <mmreg.h>
#include "music/music.h"

// One block per 60 Hz frame; a row is a whole number of blocks.
#define BLOCK_SAMPLES 735
#define BLOCKS_PER_ROW (SU_SAMPLES_PER_ROW / BLOCK_SAMPLES)
#define BLOCK_COUNT 4 // latency: 67 ms

// Render the next block. A sound effect is triggered when its event counter changes.
static void renderAudio(float* out, const volatile int* events)
{
	static int block;
	static int previous[SU_SFX_COUNT];

	if (block % BLOCKS_PER_ROW == 0)
		su_tick(block / BLOCKS_PER_ROW % SU_ROWS);
	block++;

	int* voice = (int*)(su_synth() + SU_VOICES_OFFSET + SU_FIRST_SFX_VOICE * SU_VOICE_SIZE);
	for (int i = 0; i < SU_SFX_COUNT; i++)
	{
		int count = events[i];
		if (count != previous[i])
		{
			previous[i] = count;
			// note, sustain, and a blank state
			for (int j = 0; j < SU_VOICE_SIZE / 4; j++)
				voice[j] = j < 2 ? 72 : 0;
		}
		voice += SU_VOICE_SIZE / 4;
	}

	su_block(out, BLOCK_SAMPLES);
}

static float audioBuffer[BLOCK_COUNT][BLOCK_SAMPLES * 2];
static WAVEHDR audioHeaders[BLOCK_COUNT];
static HWAVEOUT audioDevice;

#pragma data_seg(".wavefmt")
static WAVEFORMATEX audioFormat = {
	WAVE_FORMAT_IEEE_FLOAT, 2, SU_SAMPLE_RATE, SU_SAMPLE_RATE * 8, 8, 32, 0
};
#pragma data_seg()

static DWORD WINAPI audioThread(void* events)
{
	waveOutOpen(&audioDevice, WAVE_MAPPER, &audioFormat, 0, 0, CALLBACK_NULL);
	for (int i = 0;; i = (i + 1) % BLOCK_COUNT)
	{
		WAVEHDR* header = audioHeaders + i;
		// not queued (initially) or done playing
		while (header->dwFlags & WHDR_INQUEUE)
			Sleep(1);
		renderAudio(audioBuffer[i], (const volatile int*)events);
		header->lpData = (LPSTR)audioBuffer[i];
		header->dwBufferLength = sizeof(audioBuffer[i]);
		header->dwFlags = WHDR_PREPARED;
		waveOutWrite(audioDevice, header, sizeof(WAVEHDR));
	}
}
