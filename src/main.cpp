// custom build and feature flags
#ifdef DEBUG
	#define FULLSCREEN          0
	#define DESPERATE           0
	#define BREAK_COMPATIBILITY 0
	// #define SOUND_ON
#else
	#define FULLSCREEN          1
	#define DESPERATE           0
	#define BREAK_COMPATIBILITY 0
	#define SOUND_ON
#endif

#include <windows.h>
#include <mmsystem.h>
#include <mmreg.h>

#include "definitions.h"

// Global defines
//#define USE_FXAA 1
#define USE_CREATE_SHADER_PROGRAM // Save almost 40 bytes, require OpenGL 4.1 (Anat : doesn't work on my emulated windows)
// #define USE_POSTPROCESS 1

// Relative path or absolute path to a wav file. Within VS, current path is `Intro`.
#define TRACK_AS_WAV_FILE L"themusic.wav"

#include "glext.h"
#pragma data_seg(".shader")
#include "shaders/shaders.inl"

#pragma data_seg(".pids")

// Shaders
static int shaderMain;
#ifdef USE_FXAA
static int shaderFXAA;
#endif
#ifdef USE_POSTPROCESS
static int shaderPostProcess;
#endif

// Sound 
#ifdef SOUND_ON
#include "music/music.h"
SUsample sound_buffer[SU_LENGTH_IN_SAMPLES * SU_CHANNEL_COUNT];
HWAVEOUT	wave_out_handle;
#pragma data_seg(".wavefmt")
WAVEFORMATEX wave_format = {
#ifdef SU_SAMPLE_FLOAT
	WAVE_FORMAT_IEEE_FLOAT,
#else
	WAVE_FORMAT_PCM,
#endif
	SU_CHANNEL_COUNT,
	SU_SAMPLE_RATE, // samples per sec
	SU_SAMPLE_RATE * SU_SAMPLE_SIZE * SU_CHANNEL_COUNT, // bytes per sec
	SU_SAMPLE_SIZE * SU_CHANNEL_COUNT, // block alignment
	SU_SAMPLE_SIZE * 8, // bits per sample
	0
};
#pragma data_seg(".wavehdr")
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
#endif

#include "game.cpp" // who said we can't include cpp files?

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


	void exec(char* tree);
	char testtree[] = {
		// '\00' /*print*/, '\00' /*int*/, 42, 0, 0, 0,         // PRINT
		'\00' /*print*/, 0x01 /*float*/, 0, 0, 0x28, 0x42,         // PRINT
		// 0x00, 0x00, 0x28, 0x42
	};
	exec(&testtree[0]);


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

#if defined(USE_VERTEX_SHADER) || defined(USE_FXAA) || defined(USE_POSTPROCESS)
	int f;
#endif

#ifdef USE_VERTEX_SHADER
	int v = ((PFNGLCREATESHADERPROC)wglGetProcAddress("glCreateShader"))(GL_VERTEX_SHADER);
	((PFNGLSHADERSOURCEPROC)wglGetProcAddress("glShaderSource"))(v, 1, &preprocessed_scene_vert, 0);
	((PFNGLCOMPILESHADERPROC)wglGetProcAddress("glCompileShader"))(v);
	f = ((PFNGLCREATESHADERPROC)wglGetProcAddress("glCreateShader"))(GL_FRAGMENT_SHADER);
	((PFNGLSHADERSOURCEPROC)wglGetProcAddress("glShaderSource"))(f, 1, &preprocessed_scene_frag, 0);
	((PFNGLCOMPILESHADERPROC)wglGetProcAddress("glCompileShader"))(f);
	//static char errorBuffer[1024];
	//int len = 0;
	//((PFNGLGETSHADERINFOLOGPROC)wglGetProcAddress("glGetShaderInfoLog"))(f, 1024 - 1, &len, static_cast<char*>(errorBuffer));

	shaderMain = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
	((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(shaderMain, v);
	((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(shaderMain, f);
	((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(shaderMain);
#else
	shaderMain = ((PFNGLCREATESHADERPROGRAMVPROC)wglGetProcAddress("glCreateShaderProgramv"))(GL_FRAGMENT_SHADER, 1, &preprocessed_scene_frag);
#endif

	// FXAA
#ifdef USE_FXAA
	#ifdef USE_CREATE_SHADER_PROGRAM
		shaderFXAA = ((PFNGLCREATESHADERPROGRAMVPROC)wglGetProcAddress("glCreateShaderProgramv"))(GL_FRAGMENT_SHADER, 1, &preprocessed_fxaa_frag);
	#else
		f = ((PFNGLCREATESHADERPROC)wglGetProcAddress("glCreateShader"))(GL_FRAGMENT_SHADER);
		((PFNGLSHADERSOURCEPROC)wglGetProcAddress("glShaderSource"))(f, 1, &preprocessed_fxaa_frag, 0);
		((PFNGLCOMPILESHADERPROC)wglGetProcAddress("glCompileShader"))(f);

		shaderFXAA = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
		((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(shaderFXAA, f);
		((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(shaderFXAA);
	#endif
#endif

#ifdef USE_POSTPROCESS
		f = ((PFNGLCREATESHADERPROC)wglGetProcAddress("glCreateShader"))(GL_FRAGMENT_SHADER);
		((PFNGLSHADERSOURCEPROC)wglGetProcAddress("glShaderSource"))(f, 1, &preprocessed_postprocess_frag, 0);
		((PFNGLCOMPILESHADERPROC)wglGetProcAddress("glCompileShader"))(f);

		shaderPostProcess = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
		((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(shaderPostProcess, f);
		((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(shaderPostProcess);
#endif

	// init sound
#ifndef EDITOR_CONTROLS
#ifdef SOUND_ON
	// Load gm.dls if necessary.
	#ifdef SU_LOAD_GMDLS
			su_load_gmdls();
	#endif // SU_LOAD_GMDLS
	CreateThread(0, 0, (LPTHREAD_START_ROUTINE)su_render_song, sound_buffer, 0, 0);

	// We render in the background while playing already. Fortunately,
	// Windows is slow with the calls below, so we're not worried that
	// we don't have enough samples ready before the track starts.
	waveOutOpen(&wave_out_handle, WAVE_MAPPER, &wave_format, 0, 0, CALLBACK_NULL);
	waveOutWrite(wave_out_handle, &wave_header, sizeof(wave_header));
#else
	long startTime = timeGetTime();
#endif
#else
	Leviathan::Editor editor = Leviathan::Editor();
#ifdef USE_POSTPROCESS
	editor.updateShaders(&shaderMain, &shaderPostProcess, true);
#else
	editor.updateShaders(&shaderMain, nullptr, true);
#endif

	#ifdef SOUND_ON
	Leviathan::Song track(TRACK_AS_WAV_FILE);
	#else
	Leviathan::NoSong track;
	#endif

	track.play();
	EditUI::init();
#endif

	// because all render passes need exactly the same input, we can do it once for all
#if USE_FXAA || USE_POSTPROCESS
	((PFNGLACTIVETEXTUREPROC)wglGetProcAddress("glActiveTexture"))(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, 1);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
#endif

	// main loop
	do
	{
#ifdef EDITOR_CONTROLS
		editor.beginFrame(timeGetTime());
		double position = track.getTime();
		float time = (float)position;
#else
#ifdef SOUND_ON
		waveOutGetPosition(wave_out_handle, &mmtime, sizeof(MMTIME));
		float time = ((float)mmtime.u.sample) / 44100.0f;
#else
		long currentTime = timeGetTime();
		float time = (float)(currentTime - startTime) * 0.001f;
#endif
#endif

		#if EDITOR_CONTROLS
			EditUI::draw(time);
			track.seek(time);

		#elif !(DESPERATE)
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
		game(time);
		// ((PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f"))(0, time);
		((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(1, 0); // Previous frame
		glRects(-1, -1, 1, 1);

		// FXAA
#ifdef USE_FXAA
		glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(shaderFXAA);
		((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(0, 0); // Set sampler ID
		glRects(-1, -1, 1, 1);

		// Optional second FXAA pass
		//glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
		//glRects(-1, -1, 1, 1);
#endif

#ifdef USE_POSTPROCESS
		//glBindTexture(GL_TEXTURE_2D, 1);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
		glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glGenerateMipmap"))(GL_TEXTURE_2D);
		//((PFNGLACTIVETEXTUREPROC)wglGetProcAddress("glActiveTexture"))(GL_TEXTURE0);
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(shaderPostProcess);
		((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(0, 0); // Set sampler ID
		glRects(-1, -1, 1, 1);
#endif


#ifdef EDITOR_CONTROLS
		EditUI::render();
#endif
		SwapBuffers(hDC);

		// handle functionality of the editor
#ifdef EDITOR_CONTROLS
		editor.endFrame(timeGetTime());
		position = editor.handleEvents(&track, position);
		editor.printFrameStatistics();

#ifdef USE_POSTPROCESS
		editor.updateShaders(&shaderMain, &shaderPostProcess, false);
#else
		editor.updateShaders(&shaderMain, nullptr, false);
#endif
#endif

#ifdef EDITOR_CONTROLS // disable escape in editor mode
	#define ESC false
#else
	#define ESC GetAsyncKeyState(VK_ESCAPE)
#endif

#ifdef SOUND_ON
	} while(mmtime.u.sample < DEMO_LENGTH_IN_S * SU_SAMPLE_RATE && !ESC);
#else
	} while (!ESC);
#endif


	ExitProcess(0);
}
