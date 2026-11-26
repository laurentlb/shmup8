#pragma once

// Headless capture (editor build only): play the game with scripted inputs,
// offscreen and with a fixed time step, then save PNGs, a video or the audio.
// Two runs give the same simulation.
//
//   cat-debug.exe --capture [options] t1 [t2 ...]
//     Plays until the last time and saves a PNG at each time (in seconds).
//     --out DIR          output directory (default: capture)
//     --sheet FILE       also write all frames into one contact sheet
//     --cols N           contact sheet columns (default: 3)
//
//   cat-debug.exe --capture --video OUT.mp4 [--end S] [options]
//     Saves a video with its sound, see usage() for options.
//
//   Common options:
//     --width W          render width, the height keeps the aspect (default: XRES)
//     --set NAME=VALUE   override a _TV value (repeatable)
//     --fps N            frame rate, a divisor or multiple of 60 (default: 60)
//     --keys auto|none|FILE  scripted inputs (default: auto, move and fire),
//                        or inputs saved by the editor (the video then lasts as long)
//     --wav FILE         also save the sound (60 fps only)
//
// Exit code: 0 on success, 1 on failure, 2 on bad usage.
namespace Capture
{
	// The functions of the game, which are static in main.cpp.
	struct Host
	{
		void (*step)(float x, float y, float fire, int steps);
		void (*draw)(int width, int height, float frameTime, int target);
		void (*audio)(float* out, const volatile int* events);
		int* events;
		int gameProgram, sceneProgram;
		void (*init)(int width, int height); // initEngine
		void (*setPrograms)(int game, int scene);
		int eventCount, stateSize;
	};

	// The default scripted inputs, at time t (in seconds).
	void autoInput(float t, float& x, float& y, float& fire);

	// Offscreen RGBA8 framebuffer, 0 on failure.
	unsigned offscreenFramebuffer(int width, int height);

	bool requested(int argc, char* argv[]);

	// Render size, from --width.
	void resolution(int argc, char* argv[], int& w, int& h);

	// argv[1] must be "--capture".
	int run(int argc, char* argv[], const Host& host, int width, int height, bool compileFailed);
}
