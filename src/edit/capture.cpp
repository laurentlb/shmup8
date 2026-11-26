#include "capture.h"
#include "tweaks.h"
#include "history.h"
#include "stateview.h"

#include "definitions.h"
#include "glext.h"

#include <objidl.h>
#include <gdiplus.h>
#pragma comment(lib, "gdiplus.lib")

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace Capture
{
	// Built-in GDI+ PNG encoder.
	static const CLSID pngClsid = { 0x557cf406, 0x1a04, 0x11d3, { 0x9a, 0x73, 0x00, 0x00, 0xf8, 0x1e, 0xf3, 0x2e } };

	struct Frame
	{
		float time;
		std::string path;
	};

	static std::wstring widen(const std::string& s)
	{
		std::wstring w(s.size(), L'\0');
		int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], (int)w.size());
		w.resize(n > 0 ? n : 0);
		return w;
	}

	// Create a directory and its missing parents.
	static void makeDirs(const std::string& path)
	{
		for (size_t i = 1; i <= path.size(); ++i)
			if (i == path.size() || path[i] == '\\' || path[i] == '/')
				CreateDirectoryA(path.substr(0, i).c_str(), NULL);
	}

	static int usage()
	{
		printf(
			"usage: cat-debug.exe --capture [options] t1 [t2 ...]\n"
			"  --out DIR          output directory (default: capture)\n"
			"  --sheet FILE       also write a contact sheet of all frames\n"
			"  --trace SECONDS    print the game state at this interval\n"
			"  --cols N           contact sheet columns (default: 3)\n"
			"\n"
			"usage: cat-debug.exe --capture --video OUT.mp4 [options]\n"
			"  --end S            duration in seconds (default: %d)\n"
			"  --crf N            x264 quality, lower is better (default: 12)\n"
			"  --ffmpeg PATH      ffmpeg executable (default: ffmpeg)\n"
			"\n"
			"common options:\n"
			"  --width W          render width (default: %d)\n"
			"  --set NAME=VALUE   override a _TV value (repeatable)\n"
			"  --fps N            frame rate: 30, 60 or 120 (default: 60)\n"
			"  --keys bot|auto|none|FILE  a bot that watches the ball, scripted inputs,\n"
			"                     or inputs saved by the editor (default: bot)\n"
			"  --wav FILE         also save the sound (60 fps only)\n", DEMO_LENGTH_IN_S, XRES);
		return 2;
	}

	bool requested(int argc, char* argv[])
	{
		return argc > 1 && strcmp(argv[1], "--capture") == 0;
	}

	void resolution(int argc, char* argv[], int& w, int& h)
	{
		for (int i = 2; i + 1 < argc; ++i)
			if (!strcmp(argv[i], "--width") && atoi(argv[i + 1]) >= 16)
			{
				w = atoi(argv[i + 1]) & ~1;
				h = (int)((long long)YRES * w / XRES) & ~1;
			}
	}

	// 16-bit stereo, 44.1 kHz
	static bool saveWav(const std::string& path, const std::vector<float>& samples)
	{
		std::vector<short> pcm(samples.size());
		for (size_t i = 0; i < samples.size(); ++i)
		{
			float v = samples[i];
			pcm[i] = (short)(32767 * (v > 1 ? 1 : v < -1 ? -1 : v));
		}
		const unsigned bytes = (unsigned)(pcm.size() * 2);
		const unsigned header[] = {
			0x46464952 /* RIFF */, 36 + bytes, 0x45564157 /* WAVE */, 0x20746d66 /* fmt */, 16,
			1 | 2 << 16, 44100, 44100 * 4, 4 | 16 << 16, 0x61746164 /* data */, bytes };
		FILE* f = fopen(path.c_str(), "wb");
		if (!f) return false;
		bool ok = fwrite(header, sizeof(header), 1, f) == 1 && (!bytes || fwrite(&pcm[0], bytes, 1, f) == 1);
		return fclose(f) == 0 && ok;
	}

	// Save the BGRA, bottom-up GL readback as a PNG.
	static bool savePng(const std::vector<unsigned char>& pixels, const std::string& path, int width, int height)
	{
		const int stride = width * 4;
		// A negative stride starting at the last row flips GL's bottom-up rows.
		Gdiplus::Bitmap full(width, height, -stride, PixelFormat32bppRGB,
			const_cast<BYTE*>(&pixels[(height - 1) * stride]));
		return full.Save(widen(path).c_str(), &pngClsid, NULL) == Gdiplus::Ok;
	}

	static bool saveSheet(const std::vector<Frame>& frames, const std::string& path, int cols)
	{
		if (frames.empty()) return false;
		Gdiplus::Bitmap first(widen(frames[0].path).c_str());
		const int tw = first.GetWidth(), th = first.GetHeight();
		if (cols > (int)frames.size()) cols = (int)frames.size();
		const int rows = ((int)frames.size() + cols - 1) / cols;

		Gdiplus::Bitmap sheet(cols * tw, rows * th, PixelFormat32bppRGB);
		Gdiplus::Graphics g(&sheet);
		g.Clear(Gdiplus::Color(255, 40, 40, 40));
		Gdiplus::Font font(L"Consolas", 14.0f, Gdiplus::FontStyleBold, Gdiplus::UnitPixel);
		Gdiplus::SolidBrush shade(Gdiplus::Color(160, 0, 0, 0));
		Gdiplus::SolidBrush text(Gdiplus::Color(255, 255, 255, 0));

		for (size_t i = 0; i < frames.size(); ++i)
		{
			const int x = (int)(i % cols) * tw, y = (int)(i / cols) * th;
			Gdiplus::Bitmap tile(widen(frames[i].path).c_str());
			g.DrawImage(&tile, x, y, tw, th);

			wchar_t label[32];
			swprintf(label, 32, L"t=%.2f", frames[i].time);
			g.FillRectangle(&shade, x, y, 80, 20);
			g.DrawString(label, -1, &font, Gdiplus::PointF((float)x + 3, (float)y + 2), &text);
		}
		return sheet.Save(widen(path).c_str(), &pngClsid, NULL) == Gdiplus::Ok;
	}

	void autoInput(float t, float& x, float& y, float& fire)
	{
		// pinball: flip now and then, pull the plunger for 1 s every 10 s
		x = (float)(sinf(t * 2.3f) > 0.6f);
		y = (float)(sinf(t * 1.9f + 1.f) > 0.6f);
		fire = (float)(fmodf(t, 10.f) < 1.f);
	}

	// Plays like a person would (for videos): flips when the ball comes near a
	// flipper, pulls the plunger when the ball is in the shooter lane. Reads
	// the "ball" and "vel" fields of the state; the table's coordinates are
	// those of src/shaders/world.glsl.
	static void botInput(const Host& host, float dt, float& x, float& y, float& fire)
	{
		static float hold[2], plunge;
		x = y = fire = 0;
		const int ballOffset = StateView::offset(host.gameProgram, host.sceneProgram, "ball");
		const int velOffset = StateView::offset(host.gameProgram, host.sceneProgram, "vel");
		if (ballOffset < 0 || velOffset < 0) return;
		float ball[2], vel[2];
		auto getBufferSubData = (PFNGLGETBUFFERSUBDATAPROC)wglGetProcAddress("glGetBufferSubData");
		getBufferSubData(GL_SHADER_STORAGE_BUFFER, ballOffset, 8, ball);
		getBufferSubData(GL_SHADER_STORAGE_BUFFER, velOffset, 8, vel);

		const float cx = -0.019f;
		if (ball[0] > 0.226f && ball[1] < -0.45f)
		{
			// pull for 0.8 s, then release
			plunge += dt;
			fire = (float)(plunge > 0.4f && plunge < 1.2f);
			if (plunge > 2.f) plunge = 0;
		}
		else
			plunge = 0;

		for (int i = 0; i < 2; i++)
		{
			const float side = i ? ball[0] - cx : cx - ball[0];
			// the ball is above the flipper and close: flip, keep it up a moment
			if (hold[i] == 0 && side > -0.01f && side < 0.11f && ball[1] < -0.36f && ball[1] > -0.47f && vel[1] < 0.2f)
				hold[i] = 0.2f;
			if (hold[i] > 0)
			{
				hold[i] -= dt;
				(i ? y : x) = 1;
				if (hold[i] <= 0) hold[i] = -0.15f; // down for a moment before the next flip
			}
			else if (hold[i] < 0)
				hold[i] = min(hold[i] + dt, 0.f);
		}
	}

	unsigned offscreenFramebuffer(int width, int height)
	{
		#define GLFN(type, name) auto name = (type)wglGetProcAddress(#name)
		GLFN(PFNGLGENFRAMEBUFFERSPROC, glGenFramebuffers);
		GLFN(PFNGLBINDFRAMEBUFFERPROC, glBindFramebuffer);
		GLFN(PFNGLGENRENDERBUFFERSPROC, glGenRenderbuffers);
		GLFN(PFNGLBINDRENDERBUFFERPROC, glBindRenderbuffer);
		GLFN(PFNGLRENDERBUFFERSTORAGEPROC, glRenderbufferStorage);
		GLFN(PFNGLFRAMEBUFFERRENDERBUFFERPROC, glFramebufferRenderbuffer);
		GLFN(PFNGLCHECKFRAMEBUFFERSTATUSPROC, glCheckFramebufferStatus);
		#undef GLFN
		GLuint fbo, rbo;
		glGenFramebuffers(1, &fbo);
		glBindFramebuffer(GL_FRAMEBUFFER, fbo);
		glGenRenderbuffers(1, &rbo);
		glBindRenderbuffer(GL_RENDERBUFFER, rbo);
		glRenderbufferStorage(GL_RENDERBUFFER, GL_RGBA8, width, height);
		glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, rbo);
		return glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE ? fbo : 0;
	}

	int run(int argc, char* argv[], const Host& host, int width, int height, bool compileFailed)
	{
		if (compileFailed)
		{
			printf("capture: shader compilation failed\n");
			return 1;
		}

		std::string outDir = "capture", sheetPath, videoPath, wavPath, keys = "bot", ffmpeg = "ffmpeg";
		int cols = 3, fps = 60, crf = 12;
		std::vector<float> times;
		float end = (float)DEMO_LENGTH_IN_S;
		bool endSet = false;
		float trace = 0;

		for (int i = 2; i < argc; ++i)
		{
			const char* a = argv[i];
			const bool hasValue = i + 1 < argc;
			if (!strcmp(a, "--out") && hasValue) outDir = argv[++i];
			else if (!strcmp(a, "--width") && hasValue) ++i; // see resolution()
			else if (!strcmp(a, "--sheet") && hasValue) sheetPath = argv[++i];
			else if (!strcmp(a, "--cols") && hasValue) cols = atoi(argv[++i]);
			else if (!strcmp(a, "--video") && hasValue) videoPath = argv[++i];
			else if (!strcmp(a, "--wav") && hasValue) wavPath = argv[++i];
			else if (!strcmp(a, "--fps") && hasValue) fps = atoi(argv[++i]);
			else if (!strcmp(a, "--end") && hasValue) end = (float)atof(argv[++i]), endSet = true;
			else if (!strcmp(a, "--crf") && hasValue) crf = atoi(argv[++i]);
			else if (!strcmp(a, "--keys") && hasValue) keys = argv[++i];
			else if (!strcmp(a, "--trace") && hasValue) trace = (float)atof(argv[++i]);
			else if (!strcmp(a, "--ffmpeg") && hasValue) ffmpeg = argv[++i];
			else if (!strcmp(a, "--set") && hasValue)
			{
				std::string kv = argv[++i];
				size_t eq = kv.find('=');
				if (eq == std::string::npos) return usage();
				std::string name = kv.substr(0, eq);
				if (!EditUI::Tweaks::set(name.c_str(), kv.substr(eq + 1).c_str()))
				{
					printf("capture: unknown _TV '%s'\n", name.c_str());
					return 2;
				}
			}
			else if (a[0] == '-') return usage();
			else times.push_back((float)atof(a));
		}
		const bool video = !videoPath.empty();
		if ((times.empty() && !video && trace <= 0) || cols < 1 || (fps != 30 && fps != 60 && fps != 120) || end <= 0)
			return usage();
		if (!wavPath.empty() && fps != 60)
		{
			printf("capture: --wav needs 60 fps\n");
			return 2;
		}
		const int stepsPerFrame = 120 / fps;
		std::vector<History::Input> recorded;
		if (keys != "auto" && keys != "bot" && keys != "none")
		{
			if (!History::load(keys, recorded))
			{
				printf("capture: cannot read the inputs in %s\n", keys.c_str());
				return 2;
			}
			if (video && !endSet) end = recorded.size() / 120.f;
		}

		std::sort(times.begin(), times.end());
		if (!video && !times.empty()) end = endSet ? max(end, times.back()) : times.back();

		auto glUseProgram = (PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram");

		// Render offscreen so the result doesn't depend on the window's size,
		// visibility or position on screen.
		const GLuint fbo = offscreenFramebuffer(width, height);
		if (!fbo)
		{
			printf("capture: cannot create the offscreen framebuffer\n");
			return 1;
		}

		glUseProgram(host.gameProgram);
		EditUI::Tweaks::apply(host.gameProgram);
		glUseProgram(host.sceneProgram);
		EditUI::Tweaks::apply(host.sceneProgram);

		Gdiplus::GdiplusStartupInput gdiplusInput;
		ULONG_PTR gdiplusToken;
		Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusInput, NULL);

		FILE* pipe = NULL;
		const std::string rawVideo = video ? videoPath + ".silent.mp4" : "";
		if (video)
		{
			char cmd[2048];
			// GL rows are bottom-up.
			snprintf(cmd, sizeof(cmd),
				"\"\"%s\" -y -loglevel warning -f rawvideo -vcodec rawvideo -s %dx%d -pix_fmt bgra -r %d -i - "
				"-vf vflip -c:v libx264 -crf %d -preset slow -pix_fmt yuv420p \"%s\"\"",
				ffmpeg.c_str(), width, height, fps, crf, fps == 60 ? rawVideo.c_str() : videoPath.c_str());
			pipe = _popen(cmd, "wb");
			if (!pipe)
			{
				printf("capture: cannot start ffmpeg\n");
				return 1;
			}
		}
		else
			makeDirs(outDir);

		std::vector<unsigned char> pixels(width * height * 4);
		std::vector<float> sound;
		std::vector<Frame> frames;
		size_t nextShot = 0;
		int result = 0;
		LARGE_INTEGER freq, start, stop;
		QueryPerformanceFrequency(&freq);

		const int frameCount = (int)ceilf(end * fps);
		for (int i = 1; i <= frameCount; ++i)
		{
			const float t = (float)i / fps;
			float x = 0, y = 0, fire = 0;
			QueryPerformanceCounter(&start);
			if (!recorded.empty())
			{
				// one step at a time: the inputs can change at every step
				for (int s = (i - 1) * stepsPerFrame; s < i * stepsPerFrame; s++)
				{
					if (s < (int)recorded.size()) History::decode(recorded[s], x, y, fire);
					else x = y = fire = 0;
					host.step(x, y, fire, 1);
				}
			}
			else
			{
				if (keys == "auto")
					autoInput(t, x, y, fire);
				else if (keys == "bot")
					botInput(host, 1.f / fps, x, y, fire);
				host.step(x, y, fire, stepsPerFrame);
			}
			host.draw(width, height, 1.f / fps, fbo);
			if (trace > 0 && i % max(1, (int)(trace * fps + .5f)) == 0)
				printf("t=%.2f %s\n", t, StateView::values(host.gameProgram, host.sceneProgram, host.stateSize).c_str());

			if (fps == 60)
			{
				sound.resize(sound.size() + 735 * 2);
				host.audio(&sound[sound.size() - 735 * 2], host.events);
			}

			if (video)
			{
				glReadPixels(0, 0, width, height, GL_BGRA_EXT, GL_UNSIGNED_BYTE, &pixels[0]);
				if (fwrite(&pixels[0], 1, pixels.size(), pipe) != pixels.size())
				{
					printf("capture: ffmpeg stopped reading at frame %d\n", i);
					result = 1;
					break;
				}
			}
			bool read = false;
			while (nextShot < times.size() && t >= times[nextShot] - 0.001f)
			{
				if (!read)
				{
					glFinish();
					QueryPerformanceCounter(&stop);
					glReadPixels(0, 0, width, height, GL_BGRA_EXT, GL_UNSIGNED_BYTE, &pixels[0]);
					read = true;
				}
				char name[64];
				snprintf(name, sizeof(name), "/t%06.2f.png", times[nextShot]);
				Frame frame = { times[nextShot++], outDir + name };
				if (!savePng(pixels, frame.path, width, height))
				{
					printf("capture: cannot write %s\n", frame.path.c_str());
					result = 1;
					continue;
				}
				frames.push_back(frame);
				printf("t=%7.2f  %7.2f ms  events: %d %d %d %d  %s\n", frame.time,
					1000.0 * (stop.QuadPart - start.QuadPart) / freq.QuadPart,
					host.events[0], host.events[1], host.events[2], host.events[3], frame.path.c_str());
			}
		}

		if (video && fps == 60 && wavPath.empty())
			wavPath = videoPath + ".wav";
		if (!wavPath.empty() && !saveWav(wavPath, sound))
		{
			printf("capture: cannot write %s\n", wavPath.c_str());
			result = 1;
		}
		if (video)
		{
			if (_pclose(pipe) != 0) result = 1;
			if (result == 0 && fps == 60)
			{
				char cmd[2048];
				snprintf(cmd, sizeof(cmd), "\"\"%s\" -y -loglevel warning -i \"%s\" -i \"%s\" -c:v copy -c:a aac -b:a 256k \"%s\"\"",
					ffmpeg.c_str(), rawVideo.c_str(), wavPath.c_str(), videoPath.c_str());
				result = system(cmd) != 0;
				DeleteFileA(rawVideo.c_str());
				if (wavPath == videoPath + ".wav") DeleteFileA(wavPath.c_str());
			}
			printf(result ? "capture: ffmpeg failed\n" : "video: %s\n", videoPath.c_str());
		}
		if (!sheetPath.empty() && !saveSheet(frames, sheetPath, cols))
		{
			printf("capture: cannot write %s\n", sheetPath.c_str());
			result = 1;
		}

		Gdiplus::GdiplusShutdown(gdiplusToken);
		return result;
	}
}
