#include "check.h"
#include "history.h"
#include "tweaks.h"
#include "stateview.h"

#include "definitions.h"
#include "glext.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace Check
{
	#define GLFN(type, name) static type name() { return (type)wglGetProcAddress("gl" #name); }
	GLFN(PFNGLGETBUFFERSUBDATAPROC, GetBufferSubData)
	GLFN(PFNGLCREATESHADERPROGRAMVPROC, CreateShaderProgramv)
	GLFN(PFNGLGETPROGRAMIVPROC, GetProgramiv)
	GLFN(PFNGLGETPROGRAMINFOLOGPROC, GetProgramInfoLog)
	GLFN(PFNGLUSEPROGRAMPROC, UseProgram)
	#undef GLFN

	bool requested(int argc, char* argv[])
	{
		return argc > 1 && strcmp(argv[1], "--check") == 0;
	}

	static std::vector<char> readState(int size)
	{
		std::vector<char> state(size);
		GetBufferSubData()(GL_SHADER_STORAGE_BUFFER, 0, size, &state[0]);
		return state;
	}

	// Going back in time and replaying gives the same state as playing straight.
	static bool checkHistory(const Capture::Host& host)
	{
		const int total = 1500;
		host.init(XRES, YRES);
		History::init(host.step, host.events, host.eventCount, host.stateSize);
		History::replaying() = false;
		for (int pos = 0, chunk = 1; pos < total; pos += chunk, chunk = chunk % 5 + 1)
		{
			if (pos + chunk > total) chunk = total - pos;
			float x, y, fire;
			Capture::autoInput(pos / 120.f, x, y, fire);
			History::advance(History::encode(x, y, fire), chunk);
		}
		const std::vector<char> straight = readState(host.stateSize);
		const std::vector<History::Input> inputs = History::inputs();

		History::seek(437);
		History::seek(1200);
		History::seek(30);
		History::replaying() = true;
		for (int pos = 30; pos < total; pos += 7)
			History::advance(0, pos + 7 > total ? total - pos : 7);
		const std::vector<char> replayed = readState(host.stateSize);

		// The event counters are kept when seeking (no sound), skip them.
		const int skip = host.eventCount * 4;
		int diff = 0;
		for (int i = skip; i < host.stateSize; i++)
			diff += straight[i] != replayed[i];
		bool ok = diff == 0 && History::inputs() == inputs && History::position() == total;
		printf("history: %s (%d bytes differ after seeking and replaying)\n", ok ? "ok" : "FAILED", diff);

		// save and load the inputs
		char path[MAX_PATH], dir[MAX_PATH];
		GetTempPathA(MAX_PATH, dir);
		GetTempFileNameA(dir, "inp", 0, path);
		std::vector<History::Input> loaded;
		bool io = History::save(path) && History::load(path, loaded) && loaded == inputs;
		DeleteFileA(path);
		printf("inputs file: %s\n", io ? "ok" : "FAILED");
		return ok && io;
	}

	// The shaders as they are in the release: the string literals of shaders.inl.
	static std::string readShader(const std::string& inl, const char* name)
	{
		size_t p = inl.find(std::string("const char *") + name + " =");
		if (p == std::string::npos) return "";
		std::string out;
		for (p = inl.find('=', p) + 1; p < inl.size() && inl[p] != ';'; p++)
		{
			if (inl[p] != '"') continue;
			for (p++; p < inl.size() && inl[p] != '"'; p++)
			{
				char c = inl[p];
				if (c == '\\')
				{
					c = inl[++p];
					if (c == 'n') c = '\n';
					else if (c == 't') c = '\t';
				}
				out += c;
			}
		}
		return out;
	}

	static int compile(GLenum type, const std::string& source, const char* name)
	{
		const char* s = source.c_str();
		int program = CreateShaderProgramv()(type, 1, &s);
		int linked = 0;
		GetProgramiv()(program, GL_LINK_STATUS, &linked);
		if (!linked)
		{
			char log[4096] = "";
			GetProgramInfoLog()(program, sizeof(log), NULL, log);
			printf("%s does not compile:\n%s\n", name, log);
			return 0;
		}
		return program;
	}

	struct Run
	{
		std::vector<char> state;
		std::vector<unsigned char> pixels;
		std::vector<int> events;
	};

	// Play with the scripted inputs at 60 fps, drawing every frame.
	static Run play(const Capture::Host& host, int game, int scene, unsigned fbo, float seconds)
	{
		host.setPrograms(game, scene);
		host.init(XRES, YRES);
		for (int i = 1; i <= (int)(seconds * 60); i++)
		{
			float x, y, fire;
			Capture::autoInput(i / 60.f, x, y, fire);
			host.step(x, y, fire, 2);
			host.draw(XRES, YRES, 1.f / 60, fbo);
		}
		Run run;
		run.state = readState(host.stateSize);
		run.events.assign(host.events, host.events + host.eventCount);
		run.pixels.resize(XRES * YRES * 4);
		glReadPixels(0, 0, XRES, YRES, GL_RGBA, GL_UNSIGNED_BYTE, &run.pixels[0]);
		return run;
	}

	// The minified shaders (shaders.inl, used by the release) compile and behave
	// like the editor's version.
	static bool checkMinified(const Capture::Host& host)
	{
		FILE* f = fopen("src/shaders/shaders.inl", "rb");
		if (!f)
		{
			printf("minified: cannot read src/shaders/shaders.inl\n");
			return false;
		}
		std::string inl;
		char buf[4096];
		for (size_t n; (n = fread(buf, 1, sizeof(buf), f)) > 0;) inl.append(buf, n);
		fclose(f);

		int game = compile(GL_COMPUTE_SHADER, readShader(inl, "preprocessed_game_comp"), "minified game.comp");
		int scene = compile(GL_FRAGMENT_SHADER, readShader(inl, "preprocessed_scene_frag"), "minified scene.frag");
		if (!game || !scene)
			return false;

		const unsigned fbo = Capture::offscreenFramebuffer(XRES, YRES);
		UseProgram()(host.gameProgram);
		EditUI::Tweaks::apply(host.gameProgram);
		UseProgram()(host.sceneProgram);
		EditUI::Tweaks::apply(host.sceneProgram);

		const float seconds = 30;
		Run editor = play(host, host.gameProgram, host.sceneProgram, fbo, seconds);
		Run minified = play(host, game, scene, fbo, seconds);
		host.setPrograms(host.gameProgram, host.sceneProgram);

		int words = 0;
		for (int i = 0; i < host.stateSize; i += 4)
			words += memcmp(&editor.state[i], &minified.state[i], 4) != 0;
		int pixels = 0, maxDiff = 0;
		for (size_t i = 0; i < editor.pixels.size(); i += 4)
		{
			int d = 0;
			for (int c = 0; c < 3; c++)
				d = max(d, abs(editor.pixels[i + c] - minified.pixels[i + c]));
			pixels += d > 8;
			maxDiff = max(maxDiff, d);
		}
		const int pixelCount = XRES * YRES;
		const bool ok = editor.events == minified.events && pixels * 100 <= pixelCount;
		printf("minified: %s after %.0f s (events %d/%d/%d vs %d/%d/%d, %d state words differ, "
			"%d pixels differ by more than 8, max %d)\n",
			ok ? "ok" : "FAILED", seconds,
			editor.events[0], editor.events[1], editor.events[2],
			minified.events[0], minified.events[1], minified.events[2], words, pixels, maxDiff);
		return ok;
	}

	int run(int argc, char* argv[], const Capture::Host& host, bool compileFailed)
	{
		if (compileFailed)
		{
			printf("check: the editor shaders don't compile\n");
			return 1;
		}
		printf("state layout:\n");
		bool ok = StateView::print(host.gameProgram, host.sceneProgram) > 0;
		ok = checkHistory(host) && ok;
		ok = checkMinified(host) && ok;
		GLenum error = glGetError();
		if (error != GL_NO_ERROR)
		{
			printf("check: GL error 0x%x\n", error);
			ok = false;
		}
		printf(ok ? "check: all ok\n" : "check: FAILED\n");
		return ok ? 0 : 1;
	}
}
