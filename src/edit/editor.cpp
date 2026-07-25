#include "editor.h"
#include "song.h"
#include "tweaks.h"

#include "stdio.h"
#include "glext.h"

#include <string>

using namespace Leviathan;

#define USE_MESSAGEBOX 0

// Turn a preprocessed shader source into its editor variant.
//
// The shader preprocessor evaluates (and collapses) #ifdef blocks itself, so we
// cannot switch _TV's behaviour with a runtime '#define EDITOR'. Instead the
// release macro '#define _TV(name, value) (value)' survives preprocessing as a
// plain line, and here we rewrite its body to expand to the parameter 'name' so
// each _TV becomes the injected uniform of that name.
static void rewriteTweakMacro(std::string& s, const char* macro)
{
	std::string needle = std::string("#define ") + macro + "(";
	size_t p = s.find(needle);
	while (p != std::string::npos)
	{
		size_t open  = s.find('(', p);
		size_t comma = s.find(',', open);
		size_t close = s.find(')', open);
		size_t eol   = s.find('\n', p);
		if (open != std::string::npos && comma != std::string::npos &&
		    close != std::string::npos && comma < close &&
		    (eol == std::string::npos || close < eol))
		{
			std::string firstParam = s.substr(open + 1, comma - open - 1);
			// strip surrounding whitespace
			size_t a = firstParam.find_first_not_of(" \t");
			size_t b = firstParam.find_last_not_of(" \t");
			if (a != std::string::npos) firstParam = firstParam.substr(a, b - a + 1);

			size_t end = (eol == std::string::npos) ? s.size() : eol;
			s.replace(close + 1, end - (close + 1), " " + firstParam);
		}
		p = s.find(needle, p + 1);
	}
}

static std::string makeEditorSource(const char* source, const char* uniformDecls)
{
	std::string s = source ? source : "";

	// Rewrite the _TV/_TVC macros so they expand to their uniform name.
	if (uniformDecls)
	{
		rewriteTweakMacro(s, "_TV");
		rewriteTweakMacro(s, "_TVC");

		// Editor-only preamble: define EDITOR (guards editor-only code such as
		// the manual camera in selectShot), inject the manual-camera uniforms,
		// then the scanned _TV uniform declarations. Inserted right after the
		// mandatory #version line.
		std::string preamble =
			"#define EDITOR 1\n"
			"uniform vec3 iCamPos;\n"
			"uniform vec3 iCamTarget;\n"
			"uniform vec3 iCamDir;\n";
		preamble += uniformDecls;

		size_t nl = s.find('\n');
		size_t insertAt = (nl == std::string::npos) ? 0 : nl + 1;
		s.insert(insertAt, preamble);
	}
	return s;
}

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

	// keep a sliding window of the last 'windowSize' frame durations
	int totalTime = 0;
	for (int i = 0; i < windowSize - 1; ++i)
	{
		timeHistory[i] = timeHistory[i + 1];
		totalTime += timeHistory[i];
	}
	timeHistory[windowSize - 1] = frameTime;
	totalTime += frameTime;

	// average fps = frames / elapsed seconds
	const float fps = totalTime > 0 ? 1000.0f * windowSize / static_cast<float>(totalTime) : 0.0f;

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

	if ((GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState('S') & 0x8000))
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

			system("preprocess_shaders.bat");

			void exec_file(const char* filename);
			system("Compiler\\bin\\Release\\net9.0\\Compiler.exe game.source");
			Sleep(100);
			exec_file("game.bytes");


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
	if (!sourceVS || !sourcePS) { free(sourceVS); free(sourcePS); return; }

	// Discover the _TV() constants and turn them into live uniforms.
	EditUI::Tweaks::scan(sourcePS);
	std::string editorVS = makeEditorSource(sourceVS, nullptr);
	std::string editorPS = makeEditorSource(sourcePS, EditUI::Tweaks::uniformDeclarations());
	free(sourceVS);
	free(sourcePS);

	int shaderVS = compileShader(editorVS.c_str(), GL_VERTEX_SHADER);
	int shaderPS = compileShader(editorPS.c_str(), GL_FRAGMENT_SHADER);
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
		std::string editorPPS = makeEditorSource(sourcePPS, nullptr);
		free(sourcePPS);
		int shaderPPS = compileShader(editorPPS.c_str(), GL_FRAGMENT_SHADER);
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


int Editor::compileShader(const char* source, GLenum shaderType) {
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