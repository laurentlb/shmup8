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

	GameInput autoInput(float t)
	{
		// walk forward while turning slowly, strafe, shoot, jump now and then
		GameInput in = {};
		in.y = 1;
		in.x = (float)((sinf(t * 0.7f) > 0.5f) - (sinf(t * 0.7f) < -0.5f));
		in.buttons = (float)((fmodf(t, 2.f) < 1.f) + 2 * (fmodf(t, 3.f) < 0.1f));
		in.yaw = 0.4f * sinf(t * 0.3f);
		in.pitch = 0.1f * sinf(t * 0.5f);
		return in;
	}

	// Plays like a person would (for screenshots and videos): runs along the
	// track and shoots the nearest enemy in view. Reads "pos", "yawBase",
	// "enemy" and "enemyInfo" in the state.
	static GameInput botInput(const Host& host, float dt)
	{
		// the track's points (x, z, floor): keep in sync with src/shaders/world.glsl
		static const float track[][3] = { // x, z, floor
			{ 3, 0, 0 }, { 38, 0, 0 }, { 42, 0, 0 }, { 51, 0, -4 }, { 59, 0, -4 }, { 77, 0, -4 },
			{ 87, 0, -4 }, { 87, 11, 1 }, { 87, 13.5f, 1 }, { 53, 13.5f, 1 }, { 50, 17, 1 }, { 45, 17, 1 }, { 45, 23, 1 },
			{ 33, 23, 1 }, { 33, 29, 1 }, { 22, 29, 1 }, { 15, 30, 1 }, { 10, 31, -3 }, { -4, 30, -3 },
			{ -5, 18, -3 }, { -5, 12, -3 }, { -5, 4, 0 }, { -5, 0, 0 } };
		const int count = sizeof(track) / sizeof(track[0]);
		static GameInput in;
		auto getBufferSubData = (PFNGLGETBUFFERSUBDATAPROC)wglGetProcAddress("glGetBufferSubData");
		auto read = [&](const char* name, void* out, int size) {
			int offset = StateView::offset(host.gameProgram, host.sceneProgram, name);
			if (offset >= 0) getBufferSubData(GL_SHADER_STORAGE_BUFFER, offset, size, out);
			return offset >= 0;
		};
		float pos[3] = {}, yawBase = 0, enemy[10][4] = {};
		read("pos", pos, 12);
		read("yawBase", &yawBase, 4);
		read("enemy", enemy, sizeof(enemy));

		// the closest point on the route (the floor is 0.5 m below the center)
		int best = 0;
		float bestDist = 1e9f, bestH = 0;
		for (int i = 0; i < count; i++)
		{
			const float* a = track[i];
			const float* b = track[(i + 1) % count];
			float bx = b[0] - a[0], bz = b[1] - a[1], px = pos[0] - a[0], pz = pos[2] - a[1];
			float h = max(0.f, min(1.f, (px * bx + pz * bz) / (bx * bx + bz * bz)));
			float dx = px - bx * h, dz = pz - bz * h, dy = pos[1] - 0.5f - (a[2] + (b[2] - a[2]) * h);
			float d = dx * dx + dz * dz + dy * dy;
			if (d < bestDist) bestDist = d, best = i, bestH = h;
		}
		// then 4 m ahead along the route
		float left = 4, tx = pos[0], tz = pos[2];
		for (int i = best, n = 0; n < count; i = (i + 1) % count, n++)
		{
			const float* a = track[i];
			const float* b = track[(i + 1) % count];
			float bx = b[0] - a[0], bz = b[1] - a[1], l = sqrtf(bx * bx + bz * bz);
			float h = i == best ? bestH : 0;
			float rest = (1 - h) * l;
			if (rest >= left)
			{
				h += left / max(l, 1e-3f);
				tx = a[0] + bx * h, tz = a[1] + bz * h;
				break;
			}
			left -= rest;
			tx = b[0], tz = b[1];
		}
		float runYaw = atan2f(tz - pos[2], tx - pos[0]);

		// aim at the nearest enemy in front
		float aimYaw = runYaw, aimPitch = 0, nearest = 30;
		for (int i = 0; i < 10; i++)
		{
			if (enemy[i][3] <= 0) continue;
			float dx = enemy[i][0] - pos[0], dy = enemy[i][1] - pos[1] - 0.9f, dz = enemy[i][2] - pos[2];
			float d = sqrtf(dx * dx + dy * dy + dz * dz);
			float y = atan2f(dz, dx), off = fabsf(remainderf(y - runYaw, 6.2831853f));
			if (d < nearest && off < 1.3f)
				nearest = d, aimYaw = y, aimPitch = atan2f(dy, sqrtf(dx * dx + dz * dz));
		}

		// turn smoothly toward the target; the game adds yawBase to the input
		float want = aimYaw - yawBase;
		float diff = remainderf(want - in.yaw, 6.2831853f);
		// at most 5 radians per second, easing in: like a hand on a mouse
		in.yaw += max(-5.f * dt, min(5.f * dt, diff * 6.f * dt));
		in.pitch += max(-3.f * dt, min(3.f * dt, (aimPitch - in.pitch) * 5.f * dt));
		// move toward the running direction, whatever the view direction
		float rel = runYaw - (in.yaw + yawBase);
		in.y = cosf(rel) > 0.38f ? 1.f : cosf(rel) < -0.38f ? -1.f : 0.f;
		in.x = sinf(rel) > 0.38f ? 1.f : sinf(rel) < -0.38f ? -1.f : 0.f;
		in.buttons = (float)(nearest < 30);
		return in;
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
		printf("renderer: %s\n", (const char*)glGetString(GL_RENDERER));
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
			GameInput input = {};
			if (nextShot < times.size() && t >= times[nextShot] - 0.001f)
				glFinish(); // measure this frame only
			QueryPerformanceCounter(&start);
			if (!recorded.empty())
			{
				// one step at a time: the inputs can change at every step
				for (int s = (i - 1) * stepsPerFrame; s < i * stepsPerFrame; s++)
				{
					if (s < (int)recorded.size()) input = History::decode(recorded[s]);
					else input = GameInput();
					host.step(input, 1);
				}
			}
			else
			{
				if (keys == "auto")
					input = autoInput(t);
				else if (keys == "bot")
					input = History::decode(History::encode(botInput(host, 1.f / fps)));
				host.step(input, stepsPerFrame);
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
