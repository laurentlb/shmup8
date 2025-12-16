// custom build and feature flags
#ifdef DEBUG
	#define FULLSCREEN          0
#else
	#define FULLSCREEN          1
#endif

#include <windows.h>
#include <mmsystem.h>
#include <mmreg.h>

#include "definitions.h"

// Global defines
#define USE_CREATE_SHADER_PROGRAM // Save almost 40 bytes, require OpenGL 4.1 (Anat : doesn't work on my emulated windows)

#include "glext.h"
#pragma data_seg(".shader")
#include "shaders/shaders.inl"

#pragma data_seg(".pids")

// Shaders
static int shaderMain;

#ifndef EDITOR_CONTROLS
#pragma code_seg(".main")
void entrypoint(void)
#else
#include "edit/editor.h"
#include "edit/song.h"
#include "edit/editui.h"
int __cdecl main(int argc, char* argv[])
#endif
{
	// initialize window
	#if FULLSCREEN
		ChangeDisplaySettings(&screenSettings, CDS_FULLSCREEN);
		ShowCursor(0);
		HWND hwnd = CreateWindow((LPCSTR)0xC018, 0, WS_POPUP | WS_VISIBLE | WS_MAXIMIZE, 0, 0, 0, 0, 0, 0, 0, 0);
	#elif EDITOR_CONTROLS
		HWND hwnd = EditUI::createEditorWindow();
	#else
		HWND hwnd = CreateWindow((LPCSTR)0xC018, 0, WS_POPUP | WS_VISIBLE, 0, 0, XRES, YRES, 0, 0, 0, 0);
	#endif

	HDC hDC = GetDC(hwnd);

	// initalize opengl context
	SetPixelFormat(hDC, ChoosePixelFormat(hDC, &pfd), &pfd);
	wglMakeCurrent(hDC, wglCreateContext(hDC));

	// create and compile shader programs
	// Main shader

	shaderMain = ((PFNGLCREATESHADERPROGRAMVPROC)wglGetProcAddress("glCreateShaderProgramv"))(GL_FRAGMENT_SHADER, 1, &preprocessed_scene_frag);

#ifndef EDITOR_CONTROLS
	long startTime = timeGetTime();
#else
	Leviathan::Editor editor = Leviathan::Editor();
	editor.updateShaders(&shaderMain, nullptr, true);

	Leviathan::NoSong track;

	track.play();
	EditUI::init();
#endif

	// main loop
	do
	{
#ifdef EDITOR_CONTROLS
		editor.beginFrame(timeGetTime());
		double position = track.getTime();
		float time = (float)position;
#else
		long currentTime = timeGetTime();
		float time = (float)(currentTime - startTime) * 0.001f;
#endif

		#if EDITOR_CONTROLS
			EditUI::draw(time);
			track.seek(time);
		#else
			// do minimal message handling so windows doesn't kill your application
			// not always strictly necessary but increases compatibility and reliability a lot
			// normally you'd pass an msg struct as the first argument but it's just an
			// output parameter and the implementation presumably does a NULL check
			PeekMessage(0, 0, 0, 0, PM_REMOVE);
		#endif

		// main renderer
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
		glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(shaderMain);
		
		// game logic
		static float previousTime = 0.0f;
		extern float variables[4][256];
		void exec();

		variables[1][0] = time - previousTime;
		exec();
		previousTime = time;

		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(0, 200, variables[1]);
		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(200, 200, variables[2]);
		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(400, 200, variables[3]);
		((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(600, 200, variables[4]);

		((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(1, 0); // Previous frame
		glRects(-1, -1, 1, 1);


#ifdef EDITOR_CONTROLS
		EditUI::render();
#endif
		SwapBuffers(hDC);

		// handle functionality of the editor
#ifdef EDITOR_CONTROLS
		editor.endFrame(timeGetTime());
		position = editor.handleEvents(&track, position);
		editor.printFrameStatistics();

		editor.updateShaders(&shaderMain, nullptr, false);
#endif

#ifdef EDITOR_CONTROLS // disable escape in editor mode
	#define ESC false
#else
	#define ESC GetAsyncKeyState(VK_ESCAPE)
#endif

	} while (!ESC);


	ExitProcess(0);
}
