#include "editor.h"
#include "tweaks.h"
#include "editui.h"

#include "thirdparty/imgui/imgui.h"

#include "stdio.h"
#include <cstring>
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

		// Editor-only preamble: define EDITOR (guards editor-only code), then the
		// scanned _TV uniform declarations. Inserted right after the mandatory
		// #version line.
		std::string preamble = "#define EDITOR 1\n";
		preamble += uniformDecls;

		size_t nl = s.find('\n');
		size_t insertAt = (nl == std::string::npos) ? 0 : nl + 1;
		s.insert(insertAt, preamble);
	}
	return s;
}

// The interface block of the game state, to detect layout changes.
static std::string findStateDeclaration(const std::string& source)
{
	size_t begin = source.find("buffer State");
	size_t end = source.find("};", begin);
	if (begin == std::string::npos || end == std::string::npos) return "";
	// include the constants (array sizes)
	std::string decl = source.substr(begin, end - begin);
	for (size_t p = source.find("#define MAX_"); p < begin; p = source.find("#define MAX_", p + 1))
		decl += source.substr(p, source.find(char(10), p) - p);
	return decl;
}

Editor::Editor()
{
	printf("Editor opened...\n");
}

// Time of the last change in the shader sources.
static unsigned long long lastShaderChange()
{
	unsigned long long last = 0;
	const char* patterns[] = { "src/shaders/*.frag", "src/shaders/*.comp", "src/shaders/*.glsl", "src/shaders/*.h" };
	for (const char* pattern : patterns)
	{
		WIN32_FIND_DATAA fd;
		HANDLE h = FindFirstFileA(pattern, &fd);
		if (h == INVALID_HANDLE_VALUE) continue;
		do
		{
			if (strncmp(fd.cFileName, "preprocessed.", 13) == 0 || strstr(fd.cFileName, ".min.")) continue;
			unsigned long long t = (unsigned long long)fd.ftLastWriteTime.dwHighDateTime << 32 | fd.ftLastWriteTime.dwLowDateTime;
			if (t > last) last = t;
		} while (FindNextFileA(h, &fd));
		FindClose(h);
	}
	return last;
}

void Editor::handleEvents()
{
	// Reload when a source file changes.
	if (timeGetTime() - lastCheck > 250)
	{
		lastCheck = timeGetTime();
		unsigned long long t = lastShaderChange();
		if (t != shaderTime)
		{
			shaderUpdatePending = shaderTime != 0;
			shaderTime = t;
		}
	}

	if ((GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState('S') & 0x8000))
		shaderUpdatePending = true;
}

bool Editor::takeStateChanged()
{
	bool r = stateChanged;
	stateChanged = false;
	return r;
}

void Editor::updateShaders(int* gamePID, int* scenePID, bool force_update)
{
	if (!shaderUpdatePending && !force_update)
		return;

	// make sure the file has finished writing to disk
	if (timeGetTime() - previousUpdateTime > 200)
	{
		printf("Refreshing shaders...\n");
		EditUI::setShaderStatus("Compiling...", 0);

		Sleep(100);
		lastCompileFailed = false;
		if (system(".\\preprocess_shaders.bat") != 0)
		{
			printf("Shader preprocessing failed\n");
			EditUI::setShaderStatus("Shader preprocessing failed", 2);
			lastCompileFailed = true;
		}
		else
		{
			DWORD compileStart = timeGetTime();
			reloadShaderSource(gamePID, scenePID);
			if (!lastCompileFailed)
			{
				char msg[64];
				snprintf(msg, sizeof(msg), "Compiled in %lu ms", (unsigned long)(timeGetTime() - compileStart));
				EditUI::setShaderStatus(msg, 1);
			}
		}
	}

	previousUpdateTime = timeGetTime();
	shaderUpdatePending = false;
}

void Editor::reloadShaderSource(int* gamePID, int* scenePID)
{
	char* sourceGame = textFileRead("src/shaders/preprocessed.game.comp");
	char* sourceScene = textFileRead("src/shaders/preprocessed.scene.frag");
	if (!sourceGame || !sourceScene) { free(sourceGame); free(sourceScene); lastCompileFailed = true; return; }

	// Discover the _TV() constants of both shaders and turn them into live uniforms.
	EditUI::Tweaks::scan((std::string(sourceGame) + sourceScene).c_str());
	std::string game = makeEditorSource(sourceGame, EditUI::Tweaks::uniformDeclarations());
	std::string scene = makeEditorSource(sourceScene, EditUI::Tweaks::uniformDeclarations());
	free(sourceGame);
	free(sourceScene);

	// Both programs must agree on the state layout: replace both or none.
	int newGame = linkProgram(game.c_str(), GL_COMPUTE_SHADER);
	int newScene = newGame ? linkProgram(scene.c_str(), GL_FRAGMENT_SHADER) : 0;
	auto glDeleteProgram = (PFNGLDELETEPROGRAMPROC)wglGetProcAddress("glDeleteProgram");
	if (!newScene)
	{
		if (newGame) glDeleteProgram(newGame);
		lastCompileFailed = true;
		return;
	}
	if (*gamePID) glDeleteProgram(*gamePID);
	if (*scenePID) glDeleteProgram(*scenePID);
	*gamePID = newGame;
	*scenePID = newScene;

	std::string declaration = findStateDeclaration(game);
	if (!stateDeclaration.empty() && declaration != stateDeclaration)
	{
		printf("The state declaration changed, restarting the game\n");
		stateChanged = true;
	}
	stateDeclaration = declaration;
}

int Editor::linkProgram(const char* source, GLenum shaderType)
{
	int shader = compileShader(source, shaderType);
	if (!shader) return 0;

	int pid = ((PFNGLCREATEPROGRAMPROC)wglGetProcAddress("glCreateProgram"))();
	((PFNGLATTACHSHADERPROC)wglGetProcAddress("glAttachShader"))(pid, shader);
	((PFNGLLINKPROGRAMPROC)wglGetProcAddress("glLinkProgram"))(pid);
	((PFNGLDELETESHADERPROC)wglGetProcAddress("glDeleteShader"))(shader);

	int result = 0;
	((PFNGLGETPROGRAMIVPROC)wglGetProcAddress("glGetProgramiv"))(pid, GL_LINK_STATUS, &result);
	if (result == GL_FALSE)
	{
		static char errorBuffer[shaderErrorBufferLength];
		((PFNGLGETPROGRAMINFOLOGPROC)wglGetProcAddress("glGetProgramInfoLog"))(pid, shaderErrorBufferLength - 1, NULL, errorBuffer);
		printf("Link errors in %s\n", errorBuffer);
		EditUI::setShaderStatus(errorBuffer, 2);
		((PFNGLDELETEPROGRAMPROC)wglGetProcAddress("glDeleteProgram"))(pid);
		return 0;
	}
	return pid;
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
		lastCompileFailed = true;
		EditUI::setShaderStatus(errorBuffer, 2);
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