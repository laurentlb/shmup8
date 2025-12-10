
#define _CRT_SECURE_NO_WARNINGS 1
#define WIN32_LEAN_AND_MEAN
#define WIN32_EXTRA_LEAN
#include "windows.h"
#include "mmsystem.h"
#include "mmreg.h"
#include "stdio.h"

#define FLOAT_32BIT

////////////////////////////////////////////////
// sound
////////////////////////////////////////////////

// some song information
#include "../music/music.h"

SUsample sound_buffer[SU_LENGTH_IN_SAMPLES * SU_CHANNEL_COUNT];
HWAVEOUT	wave_out_handle;
WAVEFORMATEX wave_format = {
#ifdef SU_SAMPLE_FLOAT
	WAVE_FORMAT_IEEE_FLOAT,
#else
	WAVE_FORMAT_PCM,
#endif
	SU_CHANNEL_COUNT,
	SU_SAMPLE_RATE,
	SU_SAMPLE_RATE * SU_SAMPLE_SIZE * SU_CHANNEL_COUNT,
	SU_SAMPLE_SIZE * SU_CHANNEL_COUNT,
	SU_SAMPLE_SIZE * 8,
	0
};
WAVEHDR wave_header = {
	(LPSTR)sound_buffer,
	SU_LENGTH_IN_SAMPLES * SU_SAMPLE_SIZE * SU_CHANNEL_COUNT,
	0,
	0,
	WHDR_PREPARED,
	0,
	0,
	0
};
MMTIME mmtime = {
	TIME_SAMPLES,
	0
};

// entry point
/////////////////////////////////////////////////////////////////////////////////
int main()
{
	exec_test();
	fprintf(stdout, "calculating sound. please wait ...\n");

#ifdef SU_LOAD_GMDLS
	su_load_gmdls();
#endif // SU_LOAD_GMDLS

	// fill the sound buffer
	su_render_song(sound_buffer);

	fprintf(stdout, "writing wav file ...\n");

	// init wave header
	char WaveHeader[44] =
	{
		'R', 'I', 'F', 'F',
		0, 0, 0, 0,				// filled below
		'W', 'A', 'V', 'E',
		'f', 'm', 't', ' ',
		16, 0, 0, 0,
		1, 0,
		2, 0,
		0x44, 0xac, 0, 0,
		0x10, 0xB1, 0x02, 0,
		4, 0,
		16, 0,
		'd', 'a', 't', 'a',
		0, 0, 0, 0				// filled below
	};
	*((DWORD*)(&WaveHeader[4])) = SU_LENGTH_IN_SAMPLES * SU_CHANNEL_COUNT * 2 + 36;	// size of the rest of the file in bytes
	*((DWORD*)(&WaveHeader[40])) = SU_LENGTH_IN_SAMPLES * SU_CHANNEL_COUNT * 2;		// size of raw sample data to come

	// write wave file
	FILE* file = fopen("themusic.wav", "wb");
	if (file)
	{
		fwrite(WaveHeader, 1, 44, file);
		for (int i = 0; i < SU_LENGTH_IN_SAMPLES * SU_CHANNEL_COUNT; i++)
		{
			// convert and clip each sample
#ifdef FLOAT_32BIT				
			int iin = (int)(sound_buffer[i] * 32767);
#else
			int iin = (int)(sound_buffer[i]);
#endif			
			if (iin > 32767) iin = 32767;
			if (iin < -32767) iin = -32767;
			short iout = iin;
			fwrite(&iout, 2, 1, file);
		}
		fclose(file);
	}

	fprintf(stdout, "wav export done!\n");
	Sleep(2000);
}
