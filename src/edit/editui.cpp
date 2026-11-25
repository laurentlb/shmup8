#include "definitions.h"
#include "glext.h"
#include "editui.h"

#include "thirdparty/imgui/imgui.h"
#include "thirdparty/imgui/imgui_impl_win32.h"
#include "thirdparty/imgui/imgui_impl_opengl2.h"

#include <windows.h>
#include <mmsystem.h>
#include <cstdio>

HWND hwnd;

extern IMGUI_IMPL_API LRESULT ImGui_ImplWin32_WndProcHandler(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);

namespace EditUI {

	// --- editor UI state -----------------------------------------------------
	static bool  s_panelOpen = true;   // toggled with F1
	static bool  s_windowBegun = false; // was ImGui::Begin issued this frame?
	static float s_volume = 0.5f;      // linear 0..1, default 50%
	static char  s_status[256] = "";   // last shader compile message
	static int   s_statusLevel = 0;    // 0 info, 1 success, 2 error

	static bool  s_playing = true;
	static float s_speed = 1.f;
	static bool  s_restart = false;
	static bool  s_frameStep = false;

	static unsigned char s_pickedColor[4] = { 0, 0, 0, 0 }; // last pipette sample (RGBA 0..255)

	bool panelOpen() { return s_panelOpen; }
	float volume() { return s_volume; }

	bool playing() { return s_playing; }
	float speed() { return s_speed; }

	static bool take(bool& flag) {
		bool r = flag;
		flag = false;
		return r;
	}
	bool takeRestart() { return take(s_restart); }
	bool takeFrameStep() { return take(s_frameStep); }

	void setShaderStatus(const char* message, int level) {
		if (!message) message = "";
		size_t i = 0;
		for (; message[i] && i < sizeof(s_status) - 1; ++i) s_status[i] = message[i];
		s_status[i] = '\0';
		s_statusLevel = level;
	}

	LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam)
	{
		ImGui_ImplWin32_WndProcHandler(hWnd, msg, wParam, lParam);

		switch (msg)
		{
		case WM_DESTROY:
			PostQuitMessage(0);
			ExitProcess(0);
			return 0;
		default:
			return DefWindowProc(hWnd, msg, wParam, lParam);
		}
	}

	HWND createEditorWindow(bool visible) {
		WNDCLASSEX wc = { sizeof(WNDCLASSEX), CS_CLASSDC, WndProc, 0L, 0L,
					GetModuleHandle(NULL), NULL, NULL, NULL, NULL,
					"DemoWindowClass", NULL };
		RegisterClassEx(&wc);
		const DWORD style = WS_CAPTION | WS_SYSMENU | (visible ? WS_VISIBLE : 0);
		RECT rect = { 0, 0, XRES, YRES }; // client area
		AdjustWindowRect(&rect, style, FALSE);
		hwnd = CreateWindowA(wc.lpszClassName, "Shmup8 editor", style, 0, 0,
			rect.right - rect.left, rect.bottom - rect.top, NULL, NULL, wc.hInstance, NULL);
		return hwnd;
	}

	void init() {
		IMGUI_CHECKVERSION();
		ImGui::CreateContext();
		ImGui_ImplWin32_Init(hwnd);
		ImGui_ImplOpenGL2_Init();
		ImGui::StyleColorsDark();
	}

	void drawStart() {
		MSG msg;
		while (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
		{
			TranslateMessage(&msg);
			DispatchMessage(&msg);
		}

		ImGui_ImplOpenGL2_NewFrame();
		ImGui_ImplWin32_NewFrame();
		ImGui::NewFrame();

		// F1 toggles the whole control panel (uniforms still update when hidden).
		if (ImGui::IsKeyPressed(ImGuiKey_F1, false))
			s_panelOpen = !s_panelOpen;

		if (!ImGui::GetIO().WantCaptureKeyboard)
		{
			if (ImGui::IsKeyPressed(ImGuiKey_P, false)) s_playing = !s_playing;
			if (ImGui::IsKeyPressed(ImGuiKey_R, false)) s_restart = true;
			if (ImGui::IsKeyPressed(ImGuiKey_O)) { s_playing = false; s_frameStep = true; }
		}

		s_windowBegun = false;
		if (!s_panelOpen)
			return;

		ImGui::Begin("Demo", nullptr, ImGuiWindowFlags_AlwaysAutoResize);
		s_windowBegun = true;

		ImGuiIO& io = ImGui::GetIO();
		ImGui::Text("%.1f FPS (%.3f ms/frame)", io.Framerate, 1000.0f / io.Framerate);

		if (s_status[0])
		{
			ImVec4 col = s_statusLevel == 2 ? ImVec4(1.0f, 0.4f, 0.4f, 1.0f)
			           : s_statusLevel == 1 ? ImVec4(0.4f, 1.0f, 0.4f, 1.0f)
			                                : ImVec4(1.0f, 1.0f, 0.4f, 1.0f);
			ImGui::TextColored(col, "%s", s_status);
		}

		if (ImGui::Button(s_playing ? "Pause (P)" : "Play (P) "))
			s_playing = !s_playing;
		ImGui::SameLine();
		if (ImGui::Button("Step (O)")) { s_playing = false; s_frameStep = true; }
		ImGui::SameLine();
		if (ImGui::Button("Restart (R)")) s_restart = true;
		ImGui::SliderFloat("Speed", &s_speed, 0.f, 4.f);
		ImGui::SliderFloat("Volume", &s_volume, 0.0f, 1.0f);

		// Pipette: hold the left mouse button over the render to sample a pixel.
		if (ImGui::CollapsingHeader("Pipette"))
		{
			ImGui::TextUnformatted("Hold left mouse button over the image.");
			float r = s_pickedColor[0] / 255.0f;
			float g = s_pickedColor[1] / 255.0f;
			float b = s_pickedColor[2] / 255.0f;

			ImGui::ColorButton("##picked", ImVec4(r, g, b, 1.0f),
				ImGuiColorEditFlags_NoTooltip, ImVec2(48, 48));
			ImGui::SameLine();
			ImGui::BeginGroup();
			ImGui::Text("RGB %d %d %d", s_pickedColor[0], s_pickedColor[1], s_pickedColor[2]);
			ImGui::Text("vec3(%.2f, %.2f, %.2f)", r, g, b);
			char buf[64];
			snprintf(buf, sizeof(buf), "vec3(%.2f, %.2f, %.2f)", r, g, b);
			if (ImGui::Button("Copy")) ImGui::SetClipboardText(buf);
			ImGui::EndGroup();
		}
	}

	void drawEnd() {
		if (s_windowBegun)
			ImGui::End();
		ImGui::Render();
	}

	void drawEvents(const int* events, int count) {
		if (!s_windowBegun || !ImGui::CollapsingHeader("Events")) return;
		for (int i = 0; i < count; i++)
			ImGui::Text("%d: %d", i, events[i]);
	}

	void pickColor()
	{
		ImGuiIO& io = ImGui::GetIO();

		// Only sample while the left button is held and the cursor is over the
		// render (not hovering an ImGui widget/panel).
		if (io.WantCaptureMouse || !ImGui::IsMouseDown(ImGuiMouseButton_Left))
			return;

		int x = (int)io.MousePos.x;
		int y = (int)io.MousePos.y;
		if (x < 0 || x >= XRES || y < 0 || y >= YRES)
			return;

		// GL's origin is bottom-left; ImGui's is top-left, so flip Y.
		glReadBuffer(GL_BACK);
		glReadPixels(x, YRES - 1 - y, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, s_pickedColor);
	}

	void render()
	{
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(0);
		ImGui_ImplOpenGL2_RenderDrawData(ImGui::GetDrawData());
	}
}
