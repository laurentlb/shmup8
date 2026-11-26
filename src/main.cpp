// custom build and feature flags
#ifdef DEBUG
	#define FULLSCREEN          0
#else
	#define FULLSCREEN          1
#endif

#include <windows.h>

#include "engine.h"
#include "audio.h"

#ifndef EDITOR_CONTROLS
#pragma data_seg(".shader")
#include "shaders/shaders.inl"
#pragma data_seg()
#else
#include "thirdparty/imgui/imgui.h"
#include "edit/editor.h"
#include "edit/editui.h"
#include "edit/tweaks.h"
#include "edit/capture.h"
#include "edit/check.h"
#include "edit/history.h"
#include "edit/stateview.h"
#include <cstdio>
#endif

static float key(int vk)
{
	return (float)((GetAsyncKeyState(vk) >> 15) & 1);
}

#ifndef EDITOR_CONTROLS

#pragma code_seg(".main")
void entrypoint(void)
{
	#if FULLSCREEN
		// Cover the screen at the desktop resolution (no display mode change).
		#define xres GetSystemMetrics(SM_CXSCREEN)
		#define yres GetSystemMetrics(SM_CYSCREEN)
		ShowCursor(0);
		HWND hwnd = CreateWindow((LPCSTR)0xC018, 0, WS_POPUP | WS_VISIBLE | WS_MAXIMIZE, 0, 0, 0, 0, 0, 0, 0, 0);
	#else
		#define xres XRES
		#define yres YRES
		HWND hwnd = CreateWindow((LPCSTR)0xC018, 0, WS_POPUP | WS_VISIBLE, 0, 0, XRES, YRES, 0, 0, 0, 0);
	#endif

	timeBeginPeriod(1); // precise timeGetTime and Sleep
	HDC hDC = GetDC(hwnd);
	SetPixelFormat(hDC, ChoosePixelFormat(hDC, &pfd), &pfd);
	wglMakeCurrent(hDC, wglCreateContext(hDC));
	GLCALL(PFNWGLSWAPINTERVALEXTPROC, "wglSwapIntervalEXT")(1);

	gameProgram = GLCALL(PFNGLCREATESHADERPROGRAMVPROC, "glCreateShaderProgramv")(GL_COMPUTE_SHADER, 1, &preprocessed_game_comp);
	sceneProgram = GLCALL(PFNGLCREATESHADERPROGRAMVPROC, "glCreateShaderProgramv")(GL_FRAGMENT_SHADER, 1, &preprocessed_scene_frag);
	initEngine(xres, yres);

	CreateThread(0, 0, audioThread, stateCopy, 0, 0);

	long previousTime = timeGetTime(); // ms
	int remainder = 0; // elapsed time that wasn't simulated yet, in 1/(1000 * STEPS_PER_SECOND) s
	do
	{
		// minimal message handling so Windows doesn't consider the application as frozen
		PeekMessage(0, 0, 0, 0, PM_REMOVE);

		long elapsed = timeGetTime() - previousTime;
		previousTime += elapsed;
		if (elapsed > 1000 * MAX_STEPS / STEPS_PER_SECOND)
			elapsed = 1000 * MAX_STEPS / STEPS_PER_SECOND;
		remainder += elapsed * STEPS_PER_SECOND;

		stepGame(key(VK_LEFT), key(VK_RIGHT), key(VK_DOWN) - key(VK_UP), remainder / 1000);
		remainder %= 1000;
		drawGame(xres, yres, elapsed * 0.001f, 0);
		SwapBuffers(hDC);
		limitFrameRate(hDC, previousTime);
	} while (!GetAsyncKeyState(VK_ESCAPE));

	ExitProcess(0);
}

#else

int __cdecl main(int argc, char* argv[])
{
	setvbuf(stdout, NULL, _IONBF, 0); // the log may be redirected
	const bool check = Check::requested(argc, argv);
	const bool capture = Capture::requested(argc, argv) || check;
	HWND hwnd = EditUI::createEditorWindow(!capture);
	timeBeginPeriod(1); // precise timeGetTime and Sleep
	HDC hDC = GetDC(hwnd);
	SetPixelFormat(hDC, ChoosePixelFormat(hDC, &pfd), &pfd);
	wglMakeCurrent(hDC, wglCreateContext(hDC));
	GLCALL(PFNWGLSWAPINTERVALEXTPROC, "wglSwapIntervalEXT")(capture ? 0 : 1);

	Leviathan::Editor editor;
	editor.updateShaders(&gameProgram, &sceneProgram, true);

	if (capture)
	{
		int width = XRES, height = YRES;
		Capture::resolution(argc, argv, width, height);
		initEngine(width, height);
		Capture::Host host = { stepGame, drawGame, renderAudio, stateCopy, gameProgram, sceneProgram,
			initEngine, [](int game, int scene) { gameProgram = game; sceneProgram = scene; },
			EVENT_COUNT, STATE_SIZE };
		if (check)
			return Check::run(argc, argv, host, editor.compileFailed());
		return Capture::run(argc, argv, host, width, height, editor.compileFailed());
	}

	initEngine(XRES, YRES);
	EditUI::init();
	CreateThread(0, 0, audioThread, stateCopy, 0, 0);
	History::init(stepGame, stateCopy, EVENT_COUNT, STATE_SIZE);

	DWORD previousTime = timeGetTime();
	float remainder = 0; // in steps
	for (;;)
	{
		DWORD now = timeGetTime();
		float elapsed = (now - previousTime) * 0.001f;
		previousTime = now;

		EditUI::drawStart();
		if (audioDevice)
		{
			DWORD v = EditUI::playing() ? (DWORD)(EditUI::volume() * 0xFFFF) : 0;
			waveOutSetVolume(audioDevice, v | v << 16);
		}

		if (editor.takeStateChanged() || EditUI::takeRestart())
		{
			resetState();
			History::restart();
		}
		else if (editor.takeCodeChanged())
			History::invalidate();

		// gameplay
		ImGuiIO& io = ImGui::GetIO();
		const bool focus = GetForegroundWindow() == hwnd && !io.WantTextInput && !io.KeyCtrl;
		float x = 0, y = 0, fire = 0;
		if (focus)
		{
			x = key(VK_LEFT);
			y = key(VK_RIGHT);
			fire = key(VK_DOWN) - key(VK_UP);
		}
		float gameElapsed = EditUI::playing() ? elapsed * EditUI::speed() : 0.f;
		remainder += gameElapsed * STEPS_PER_SECOND;
		int steps = (int)remainder;
		remainder -= steps;
		if (EditUI::takeFrameStep())
		{
			steps = STEPS_PER_SECOND / 60;
			gameElapsed = 1.f / 60;
		}
		if (steps > MAX_STEPS) steps = MAX_STEPS;

		GLCALL(PFNGLUSEPROGRAMPROC, "glUseProgram")(gameProgram);
		EditUI::Tweaks::apply(gameProgram);
		History::Input live = History::encode(x, y, fire);
		if (live && History::replaying())
			History::replaying() = false; // the player takes over
		History::advance(live, steps);

		EditUI::drawTimeline();
		GLCALL(PFNGLUSEPROGRAMPROC, "glUseProgram")(sceneProgram);
		EditUI::Tweaks::drawAndApply(sceneProgram);
		if (EditUI::panelOpen() && StateView::draw(gameProgram, sceneProgram, STATE_SIZE))
			History::invalidate();
		EditUI::drawEvents(stateCopy, SU_SFX_COUNT);
		EditUI::drawEnd();
		drawGame(XRES, YRES, gameElapsed, 0);

		EditUI::pickColor();
		EditUI::render();
		SwapBuffers(hDC);
		limitFrameRate(hDC, (long)now);

		editor.handleEvents();
		editor.updateShaders(&gameProgram, &sceneProgram, false);
	}
}

#endif
