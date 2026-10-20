#pragma once

// Headless capture (editor build only): render the shader at given times into
// an offscreen XRES x YRES buffer, save PNGs and report GPU time per frame.
// Useful for scripts, A/B comparisons and performance checks.
//
//   cat-debug.exe --capture [options] t1 [t2 ...]
//     --out DIR          output directory (default: capture)
//     --width W          saved image width, height keeps the aspect (default: XRES)
//     --set NAME=VALUE   override a _TV value, e.g. --set bodyPitch_=.2
//                        or --set "crossRoom=vec3(4,2,4)" (repeatable)
//     --cam px,py,pz,tx,ty,tz
//                        manual camera position and target (sets manualCam)
//     --repeat N         timed renders per frame, averaged (default: 3)
//     --sheet FILE       also write all frames into one contact sheet
//     --cols N           contact sheet columns (default: 3)
//
//   cat-debug.exe --capture --video OUT.mp4 [options]
//     Renders every frame and pipes them into ffmpeg; see usage() for options.
//
// Exit code: 0 on success, 1 if the shader failed to compile, 2 on bad usage.
namespace Capture
{
	bool requested(int argc, char* argv[]);

	// argv[1] must be "--capture". shaderProgram is the compiled editor program.
	int run(int argc, char* argv[], int shaderProgram, bool compileFailed);
}
