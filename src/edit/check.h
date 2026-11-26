#pragma once

#include "capture.h"

// Self-test (editor build only), run by tools/check.ps1:
//
//   cat-debug.exe --check
//
// - going back in time and replaying gives the same state as playing straight;
// - the minified shaders of the release (src/shaders/shaders.inl) compile, and
//   play and render like the editor's shaders.
// Exit code: 0 if everything is ok.
namespace Check
{
	bool requested(int argc, char* argv[]);
	int run(int argc, char* argv[], const Capture::Host& host, bool compileFailed);
}
