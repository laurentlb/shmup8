#include "editor.h"
#include "song.h"

#include "stdio.h"
#include "glext.h"

using namespace Leviathan;

#define USE_MESSAGEBOX 0

Editor::Editor() : lastFrameStart(0), lastFrameStop(0), trackPosition(0.0), trackEnd(0.0), state(Playing)
{
	printf("Editor opened...\n");
}

void Editor::beginFrame(const unsigned long time)
{
	lastFrameStart = time;
}

void Editor::endFrame(const unsigned long time)
{
	lastFrameStop = time;
}

void Editor::printFrameStatistics()
{
	const int frameTime = lastFrameStop - lastFrameStart;

	// calculate average fps over 'windowSize' of frames
	float fps = 0.0f;
	for (int i = 0; i < windowSize - 1; ++i)
	{
		timeHistory[i] = timeHistory[i + 1];
		fps += 1.0f / static_cast<float>(timeHistory[i]);
	}
	timeHistory[windowSize - 1] = frameTime;
	fps += 1.0f / static_cast<float>(frameTime);
	fps *= 1000.0f / static_cast<float>(windowSize);

	printf("%s: %0.2i:%0.2i (%i%%), frame duration: %i ms (running fps average: %2.2f) \r",
		state == Playing ? "Playing" : " Paused",
		// assuming y'all won't be making intros more than an hour long
		int(trackPosition/60.0), int(trackPosition) % 60, int(100.0f*trackPosition/trackEnd),
		frameTime, fps);
}

double Editor::handleEvents(Leviathan::Song* track, double position)
{
	if (GetAsyncKeyState(VK_MENU) & 0x8000)
	{
		double seek = 0.0;
		if (GetAsyncKeyState(VK_DOWN) & 0x8000)
		{
			state = Paused;
			track->pause();
		}
		if (GetAsyncKeyState(VK_UP) & 0x8000)
		{
			state = Playing;
			track->play();
		}
		bool shift = GetAsyncKeyState(VK_SHIFT) & 0x8000;
		if (GetAsyncKeyState(VK_RIGHT) & 0x8000 && !shift) seek += 1.0;
		if (GetAsyncKeyState(VK_LEFT) & 0x8000 && !shift) seek -= 1.0;
		if (GetAsyncKeyState(VK_RIGHT) & 0x8000 && shift) seek += 0.1;
		if (GetAsyncKeyState(VK_LEFT) & 0x8000 && shift) seek -= 0.1;
		if (position + seek != position)
		{
			position += seek;
			track->seek(position);
		}
	}

	if (GetAsyncKeyState(VK_CONTROL) && GetAsyncKeyState('S'))
		shaderUpdatePending = true;

	trackPosition = position;
	trackEnd = track->getLength();

	return position;
}

void Editor::updateShaders(int* mainShaderPID, int* ppShaderPID, bool force_update)
{
	if (shaderUpdatePending || force_update)
	{
		// make sure the file has finished writing to disk
		if (timeGetTime() - previousUpdateTime > 200)
		{
			// only way i can think of to clear the line without "status line" residue
			printf("Refreshing shaders...                                                   \n");

			Sleep(100);
			system("preprocess_shaders.bat");

			reloadShaderSource(mainShaderPID, ppShaderPID);
		}

		previousUpdateTime = timeGetTime();
		shaderUpdatePending = false;
	}
}

void Editor::reloadShaderSource(int* mainShaderPID, int* postShaderPID)
{
	char* sourceVS = textFileRead("src/shaders/preprocessed.scene.vert");
	char* sourcePS = textFileRead("src/shaders/preprocessed.scene.frag");
	if (!sourceVS || !sourcePS) return;

	int shaderVS = compileShader(sourceVS, GL_VERTEX_SHADER);
	int shaderPS = compileShader(sourcePS, GL_FRAGMENT_SHADER);
	if (!shaderVS || !shaderPS) return;

	int newMainShaderPID = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
	((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(newMainShaderPID, shaderVS);
	((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(newMainShaderPID, shaderPS);
	((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(newMainShaderPID);

	((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(shaderVS);
	((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(shaderPS);

	if (newMainShaderPID > 0) {
		((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(*mainShaderPID);
		*mainShaderPID = newMainShaderPID;
	}

	// Postprocess shader
	if (postShaderPID != nullptr)
	{
		char* sourcePPS = textFileRead("src/shaders/preprocessed.postprocess.frag");
		if (!sourcePPS) return;
		int shaderPPS = compileShader(sourcePPS, GL_FRAGMENT_SHADER);
		if (!shaderPPS) return;
		int newPostShaderPID = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
		((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(newPostShaderPID, shaderPPS);
		((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(newPostShaderPID);

		((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(shaderPPS);
		if (newPostShaderPID > 0) {
			((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(*postShaderPID);
			*postShaderPID = newPostShaderPID;
		}
	}
}


int Editor::compileShader(char* source, GLenum shaderType) {
	int pid = ((PFNGLCREATESHADERPROC)wglGetProcAddress("glCreateShader"))(shaderType);
	((PFNGLSHADERSOURCEPROC)wglGetProcAddress("glShaderSource"))(pid, 1, &source, 0);
	((PFNGLCOMPILESHADERPROC)wglGetProcAddress("glCompileShader"))(pid);

	int result = 0;
	((PFNGLGETSHADERIVPROC)wglGetProcAddress("glGetShaderiv"))(pid, GL_COMPILE_STATUS, &result);
	if (result == GL_FALSE)
	{
		// display compile log on failure
		static char errorBuffer[shaderErrorBufferLength];
		((PFNGLGETSHADERINFOLOGPROC)wglGetProcAddress("glGetShaderInfoLog"))(pid, shaderErrorBufferLength - 1, NULL, static_cast<char*>(errorBuffer));

#if USE_MESSAGEBOX
		MessageBox(NULL, errorBuffer, "", 0x00000000L);
#endif
		printf("Compilation errors in %s\n", errorBuffer);
		return 0;
	}
	return pid;
}
char* Editor::textFileRead(const char* filename)
{
	long inputSize = 0;
	// we're of course opening a text file, but should be opened in binary ('b')
	// longer shaders are known to cause problems by producing garbage input when read
	FILE* file = fopen(filename, "rb");

	if (!file) {
		printf("Input shader file at \"%s\" not found, shader not reloaded\n", filename);
		return NULL;
	}

	fseek(file, 0, SEEK_END);
	inputSize = ftell(file);
	rewind(file);

	char* shaderString = static_cast<char*>(calloc(inputSize + 1, sizeof(char)));
	fread(shaderString, sizeof(char), inputSize, file);
	fclose(file);

	shaderString[inputSize] = '\0';

	return shaderString;
}