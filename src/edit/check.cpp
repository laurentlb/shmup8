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
	GLFN(PFNGLBUFFERSUBDATAPROC, BufferSubData)
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
			History::advance(History::encode(Capture::autoInput(pos / 120.f)), chunk);
		}
		const std::vector<char> straight = readState(host.stateSize);
		const std::vector<History::Input> inputs = History::inputs();

		History::seek(437);
		History::seek(1200);
		History::seek(30);
		History::replaying() = true;
		for (int pos = 30; pos < total; pos += 7)
			History::advance(History::Input(), pos + 7 > total ? total - pos : 7);
		const std::vector<char> replayed = readState(host.stateSize);

		// The event counters are kept when seeking (no sound), skip them.
		const int skip = host.eventCount * 4;
		int diff = 0, first = -1;
		for (int i = skip; i < host.stateSize; i++)
			if (straight[i] != replayed[i])
			{
				diff++;
				if (first < 0) first = i;
			}
		bool ok = diff == 0 && History::inputs() == inputs && History::position() == total;
		printf("history: %s (%d bytes differ after seeking and replaying", ok ? "ok" : "FAILED", diff);
		if (first >= 0) printf(", the first at offset %d", first);
		printf(")\n");

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
		std::vector<int> events;
	};

	// Play with the scripted inputs at 60 fps, drawing every frame.
	static Run play(const Capture::Host& host, int game, int scene, unsigned fbo, float seconds)
	{
		host.setPrograms(game, scene);
		host.init(XRES, YRES);
		for (int i = 1; i <= (int)(seconds * 60); i++)
		{
			host.step(History::decode(History::encode(Capture::autoInput(i / 60.f))), 2);
			host.draw(XRES, YRES, 1.f / 60, fbo);
		}
		Run run;
		run.state = readState(host.stateSize);
		run.events.assign(host.events, host.events + host.eventCount);
		return run;
	}

	// Draws the state with a scene shader and reads the image.
	static std::vector<unsigned char> draw(const Capture::Host& host, int scene, const std::vector<char>& state, unsigned fbo)
	{
		host.setPrograms(host.gameProgram, scene);
		BufferSubData()(GL_SHADER_STORAGE_BUFFER, 0, (GLsizeiptr)state.size(), &state[0]);
		host.draw(XRES, YRES, 1.f / 60, fbo);
		std::vector<unsigned char> pixels(XRES * YRES * 4);
		glReadPixels(0, 0, XRES, YRES, GL_RGBA, GL_UNSIGNED_BYTE, &pixels[0]);
		return pixels;
	}

	// Floats may differ a little: the minifier folds constants, and the editor's
	// tweaks are uniforms. Ints (tiny when read as floats) must be equal.
	static bool close(const char* a, const char* b)
	{
		float x, y;
		memcpy(&x, a, 4);
		memcpy(&y, b, 4);
		if (memcmp(a, b, 4) == 0) return true;
		if (fabsf(x) < 1e-30f || fabsf(y) < 1e-30f) return false;
		return fabsf(x - y) <= 1e-3f * max(1.f, max(fabsf(x), fabsf(y)));
	}

	// The minified shaders (shaders.inl, used by the release) compile and behave
	// like the editor's version. A game may be chaotic (tiny float differences
	// grow), so the gameplay is compared over a short time, and the rendering
	// on the same state.
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

		// gameplay
		const float seconds = 3;
		Run editor = play(host, host.gameProgram, host.sceneProgram, fbo, seconds);
		Run minified = play(host, game, scene, fbo, seconds);
		int words = 0, firstWord = -1;
		for (int i = 0; i < host.stateSize; i += 4)
			if (!close(&editor.state[i], &minified.state[i]))
			{
				words++;
				if (firstWord < 0) firstWord = i;
			}
		const bool gameOk = editor.events == minified.events && words == 0;
		printf("minified game: %s after %.0f s (events", gameOk ? "ok" : "FAILED", seconds);
		for (int i = 0; i < host.eventCount; i++) printf(" %d", editor.events[i]);
		printf(" vs");
		for (int i = 0; i < host.eventCount; i++) printf(" %d", minified.events[i]);
		printf(", %d state words differ", words);
		if (firstWord >= 0) printf(", the first at offset %d", firstWord);
		printf(")\n");

		// rendering, on a state after a longer game
		const float drawSeconds = 30;
		Run later = play(host, host.gameProgram, host.sceneProgram, fbo, drawSeconds);
		const std::vector<unsigned char> image = draw(host, host.sceneProgram, later.state, fbo);
		const std::vector<unsigned char> image2 = draw(host, scene, later.state, fbo);
		host.setPrograms(host.gameProgram, host.sceneProgram);
		int pixels = 0, maxDiff = 0;
		for (size_t i = 0; i < image.size(); i += 4)
		{
			int d = 0;
			for (int c = 0; c < 3; c++)
				d = max(d, abs(image[i + c] - image2[i + c]));
			pixels += d > 8;
			maxDiff = max(maxDiff, d);
		}
		const bool drawOk = pixels * 100 <= XRES * YRES;
		printf("minified scene: %s after %.0f s (%d pixels differ by more than 8, max %d)\n",
			drawOk ? "ok" : "FAILED", drawSeconds, pixels, maxDiff);

		// frame time at 2560x1440 (the editor's tweaks are uniforms: it can be slower)
		{
			const int w = 2560, h = 1440, frames = 30;
			const unsigned big = Capture::offscreenFramebuffer(w, h);
			double ms[2];
			for (int k = 0; k < 2; k++)
			{
				host.setPrograms(host.gameProgram, k ? scene : host.sceneProgram);
				host.init(w, h);
				BufferSubData()(GL_SHADER_STORAGE_BUFFER, 0, (GLsizeiptr)later.state.size(), &later.state[0]);
				host.draw(w, h, 1.f / 60, big);
				glFinish();
				LARGE_INTEGER freq, start, stop;
				QueryPerformanceFrequency(&freq);
				QueryPerformanceCounter(&start);
				for (int i = 0; i < frames; i++)
					host.draw(w, h, 1.f / 60, big);
				glFinish();
				QueryPerformanceCounter(&stop);
				ms[k] = 1000.0 * (stop.QuadPart - start.QuadPart) / freq.QuadPart / frames;
			}
			printf("frame time at %dx%d: editor %.2f ms, minified %.2f ms\n", w, h, ms[0], ms[1]);
			host.setPrograms(host.gameProgram, host.sceneProgram);
			host.init(XRES, YRES);
		}
		if (!drawOk)
		{
			// raw RGBA, bottom-up, XRES x YRES: to look at where they differ
			const std::vector<unsigned char>* images[2] = { &image, &image2 };
			const char* paths[2] = { "out/check-editor.rgba", "out/check-minified.rgba" };
			for (int r = 0; r < 2; r++)
				if (FILE* out = fopen(paths[r], "wb"))
				{
					fwrite(&(*images[r])[0], 1, images[r]->size(), out);
					fclose(out);
				}
			printf("minified scene: images written to out/check-editor.rgba and out/check-minified.rgba\n");
		}
		return gameOk && drawOk;
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
