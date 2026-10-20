#include "capture.h"
#include "tweaks.h"

#include "definitions.h"
#include "glext.h"

#include <objidl.h>
#include <gdiplus.h>
#pragma comment(lib, "gdiplus.lib")

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
			"  --width W          saved image width (default: %d)\n"
			"  --set NAME=VALUE   override a _TV value (repeatable)\n"
			"  --cam px,py,pz,tx,ty,tz  use the manual camera at this position/target\n"
			"  --repeat N         timed renders per frame (default: 3)\n"
			"  --sheet FILE       also write a contact sheet of all frames\n"
			"  --cols N           contact sheet columns (default: 3)\n", XRES);
		return 2;
	}

	bool requested(int argc, char* argv[])
	{
		return argc > 1 && strcmp(argv[1], "--capture") == 0;
	}

	// Save the BGRA, bottom-up GL readback as a PNG of the given width.
	static bool savePng(const std::vector<unsigned char>& pixels, const std::string& path, int width)
	{
		const int stride = XRES * 4;
		// A negative stride starting at the last row flips GL's bottom-up rows.
		Gdiplus::Bitmap full(XRES, YRES, -stride, PixelFormat32bppRGB,
			const_cast<BYTE*>(&pixels[(YRES - 1) * stride]));

		std::wstring wpath = widen(path);
		if (width == XRES)
			return full.Save(wpath.c_str(), &pngClsid, NULL) == Gdiplus::Ok;

		const int height = (int)((long long)YRES * width / XRES);
		Gdiplus::Bitmap scaled(width, height, PixelFormat32bppRGB);
		Gdiplus::Graphics g(&scaled);
		g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic);
		g.DrawImage(&full, 0, 0, width, height);
		return scaled.Save(wpath.c_str(), &pngClsid, NULL) == Gdiplus::Ok;
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

	int run(int argc, char* argv[], int shaderProgram, bool compileFailed)
	{
		if (compileFailed)
		{
			printf("capture: shader compilation failed\n");
			return 1;
		}

		std::string outDir = "capture";
		std::string sheetPath;
		int width = XRES;
		int repeat = 3;
		int cols = 3;
		std::vector<float> times;
		float cam[6];
		bool hasCam = false;

		for (int i = 2; i < argc; ++i)
		{
			const char* a = argv[i];
			const bool hasValue = i + 1 < argc;
			if (!strcmp(a, "--out") && hasValue) outDir = argv[++i];
			else if (!strcmp(a, "--width") && hasValue) width = atoi(argv[++i]);
			else if (!strcmp(a, "--repeat") && hasValue) repeat = atoi(argv[++i]);
			else if (!strcmp(a, "--sheet") && hasValue) sheetPath = argv[++i];
			else if (!strcmp(a, "--cols") && hasValue) cols = atoi(argv[++i]);
			else if (!strcmp(a, "--cam") && hasValue)
			{
				hasCam = sscanf(argv[++i], "%f,%f,%f,%f,%f,%f",
					&cam[0], &cam[1], &cam[2], &cam[3], &cam[4], &cam[5]) == 6;
				if (!hasCam || !EditUI::Tweaks::set("manualCam", "true"))
				{
					printf("capture: --cam needs px,py,pz,tx,ty,tz and a _TV(manualCam, ...) in the shader\n");
					return 2;
				}
			}
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
			else if (a[0] == '-' && !(a[1] >= '0' && a[1] <= '9')) return usage();
			else times.push_back((float)atof(a));
		}
		if (times.empty() || width <= 0 || width > XRES || repeat < 1 || cols < 1)
			return usage();

		#define GLFN(type, name) auto name = (type)wglGetProcAddress(#name)
		GLFN(PFNGLGENFRAMEBUFFERSPROC, glGenFramebuffers);
		GLFN(PFNGLBINDFRAMEBUFFERPROC, glBindFramebuffer);
		GLFN(PFNGLGENRENDERBUFFERSPROC, glGenRenderbuffers);
		GLFN(PFNGLBINDRENDERBUFFERPROC, glBindRenderbuffer);
		GLFN(PFNGLRENDERBUFFERSTORAGEPROC, glRenderbufferStorage);
		GLFN(PFNGLFRAMEBUFFERRENDERBUFFERPROC, glFramebufferRenderbuffer);
		GLFN(PFNGLCHECKFRAMEBUFFERSTATUSPROC, glCheckFramebufferStatus);
		GLFN(PFNGLUSEPROGRAMPROC, glUseProgram);
		GLFN(PFNGLGETUNIFORMLOCATIONPROC, glGetUniformLocation);
		GLFN(PFNGLUNIFORM1FPROC, glUniform1f);
		GLFN(PFNGLUNIFORM3FPROC, glUniform3f);
		#undef GLFN

		// Render offscreen so the result doesn't depend on the window's size,
		// visibility or position on screen.
		GLuint fbo, rbo;
		glGenFramebuffers(1, &fbo);
		glBindFramebuffer(GL_FRAMEBUFFER, fbo);
		glGenRenderbuffers(1, &rbo);
		glBindRenderbuffer(GL_RENDERBUFFER, rbo);
		glRenderbufferStorage(GL_RENDERBUFFER, GL_RGBA8, XRES, YRES);
		glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, rbo);
		if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
		{
			printf("capture: cannot create the offscreen framebuffer\n");
			return 1;
		}
		glViewport(0, 0, XRES, YRES);

		glUseProgram(shaderProgram);
		EditUI::Tweaks::apply(shaderProgram);
		if (hasCam)
		{
			float d[3] = { cam[3] - cam[0], cam[4] - cam[1], cam[5] - cam[2] };
			float len = sqrtf(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
			if (len > 0.f) { d[0] /= len; d[1] /= len; d[2] /= len; }
			glUniform3f(glGetUniformLocation(shaderProgram, "iCamPos"), cam[0], cam[1], cam[2]);
			glUniform3f(glGetUniformLocation(shaderProgram, "iCamTarget"), cam[3], cam[4], cam[5]);
			glUniform3f(glGetUniformLocation(shaderProgram, "iCamDir"), d[0], d[1], d[2]);
		}
		const int timeLocation = glGetUniformLocation(shaderProgram, "iTime");

		Gdiplus::GdiplusStartupInput gdiplusInput;
		ULONG_PTR gdiplusToken;
		Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusInput, NULL);
		makeDirs(outDir);

		LARGE_INTEGER freq;
		QueryPerformanceFrequency(&freq);

		std::vector<unsigned char> pixels(XRES * YRES * 4);
		std::vector<Frame> frames;
		int result = 0;
		for (float t : times)
		{
			glUniform1f(timeLocation, t);

			// One untimed render to warm up, then average 'repeat' timed ones.
			glRects(-1, -1, 1, 1);
			glFinish();
			LARGE_INTEGER start, stop;
			QueryPerformanceCounter(&start);
			for (int r = 0; r < repeat; ++r)
				glRects(-1, -1, 1, 1);
			glFinish();
			QueryPerformanceCounter(&stop);
			const double ms = 1000.0 * (stop.QuadPart - start.QuadPart) / freq.QuadPart / repeat;

			glReadPixels(0, 0, XRES, YRES, GL_BGRA_EXT, GL_UNSIGNED_BYTE, &pixels[0]);

			char name[64];
			snprintf(name, sizeof(name), "/t%06.2f.png", t);
			Frame frame = { t, outDir + name };
			if (!savePng(pixels, frame.path, width))
			{
				printf("capture: cannot write %s\n", frame.path.c_str());
				result = 1;
				continue;
			}
			frames.push_back(frame);
			printf("t=%7.2f  %7.2f ms  %s\n", t, ms, frame.path.c_str());
		}

		if (!sheetPath.empty())
		{
			if (saveSheet(frames, sheetPath, cols))
				printf("sheet: %s\n", sheetPath.c_str());
			else
			{
				printf("capture: cannot write %s\n", sheetPath.c_str());
				result = 1;
			}
		}

		Gdiplus::GdiplusShutdown(gdiplusToken);
		return result;
	}
}
