#include "definitions.h"
#include "glext.h"

#include "thirdparty/imgui/imgui.h"
#include "thirdparty/imgui/imgui_impl_win32.h"
#include "thirdparty/imgui/imgui_impl_opengl2.h"

#include <windows.h>
#include <mmsystem.h>
#include <cmath>

HWND hwnd;

extern IMGUI_IMPL_API LRESULT ImGui_ImplWin32_WndProcHandler(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam);

namespace EditUI {

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

	HWND createEditorWindow() {
		WNDCLASSEX wc = { sizeof(WNDCLASSEX), CS_CLASSDC, WndProc, 0L, 0L,
					GetModuleHandle(NULL), NULL, NULL, NULL, NULL,
					"DemoWindowClass", NULL };
		RegisterClassEx(&wc);
		hwnd = CreateWindowA(wc.lpszClassName, "Demo",
			WS_CAPTION | WS_SYSMENU | WS_VISIBLE, 0, 0, XRES, YRES,
			NULL, NULL, wc.hInstance, NULL);
		return hwnd;
	}

	void init() {
		IMGUI_CHECKVERSION();
		ImGui::CreateContext();
		ImGui_ImplWin32_Init(hwnd);
		ImGui_ImplOpenGL2_Init();
		ImGui::StyleColorsDark();
	}

	void drawStart(float& time) {
		MSG msg;
		while (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
		{
			TranslateMessage(&msg);
			DispatchMessage(&msg);
		}

		ImGui_ImplOpenGL2_NewFrame();
		ImGui_ImplWin32_NewFrame();
		ImGui::NewFrame();

		static float slider = 0.0f;
		ImGui::Begin("Demo", nullptr, ImGuiWindowFlags_AlwaysAutoResize);
		ImGui::SliderFloat("Time", &time, 0.0f, DEMO_LENGTH_IN_S);
	}

	void drawEnd() {
		ImGui::End();
		ImGui::Render();
	}

	// Free-fly (FPS-style) manual camera, editor only. Reads mouse/keyboard via
	// ImGui and pushes the iCamPos/iCamTarget/iCamDir uniforms the shader reads
	// when its manual-camera checkbox is enabled. Uses relative drag (right mouse
	// button) so the cursor stays available for the ImGui widgets.
	void updateManualCamera(int shaderProgram) {
		ImGuiIO& io = ImGui::GetIO();

		static float px = 0.f, py = 1.f, pz = -3.f; // position
		static float yaw = 0.f, pitch = 0.f;        // orientation (radians)
		static float speed = 5.f;                   // units per second

		// Look: hold the right mouse button and drag.
		if (!io.WantCaptureMouse && ImGui::IsMouseDown(ImGuiMouseButton_Right)) {
			yaw   -= io.MouseDelta.x * 0.005f;
			pitch -= io.MouseDelta.y * 0.005f;
			const float lim = 1.55f;
			if (pitch >  lim) pitch =  lim;
			if (pitch < -lim) pitch = -lim;
		}

		const float cp = cosf(pitch), sp = sinf(pitch);
		const float cy = cosf(yaw),   sy = sinf(yaw);
		const float fx = sy * cp, fy = sp, fz = cy * cp; // forward
		const float rx = -cy,     rz = sy;               // right (horizontal)

		if (!io.WantCaptureKeyboard) {
			float v = speed * io.DeltaTime * (io.KeyShift ? 4.f : 1.f);
			if (ImGui::IsKeyDown(ImGuiKey_W)) { px += fx * v; py += fy * v; pz += fz * v; }
			if (ImGui::IsKeyDown(ImGuiKey_S)) { px -= fx * v; py -= fy * v; pz -= fz * v; }
			if (ImGui::IsKeyDown(ImGuiKey_D)) { px += rx * v;               pz += rz * v; }
			if (ImGui::IsKeyDown(ImGuiKey_A)) { px -= rx * v;               pz -= rz * v; }
			if (ImGui::IsKeyDown(ImGuiKey_E)) { py += v; }
			if (ImGui::IsKeyDown(ImGuiKey_Q)) { py -= v; }
			if (io.MouseWheel != 0.f) speed *= (io.MouseWheel > 0.f ? 1.1f : 0.9f);
		}

		auto glGetUniformLocation = (PFNGLGETUNIFORMLOCATIONPROC)wglGetProcAddress("glGetUniformLocation");
		auto glUniform3f = (PFNGLUNIFORM3FPROC)wglGetProcAddress("glUniform3f");

		int lp = glGetUniformLocation(shaderProgram, "iCamPos");
		int lt = glGetUniformLocation(shaderProgram, "iCamTarget");
		int ld = glGetUniformLocation(shaderProgram, "iCamDir");
		if (lp >= 0) glUniform3f(lp, px, py, pz);
		if (lt >= 0) glUniform3f(lt, px + fx, py + fy, pz + fz);
		if (ld >= 0) glUniform3f(ld, fx, fy, fz);
	}

	void render()
	{
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(0);
		ImGui_ImplOpenGL2_RenderDrawData(ImGui::GetDrawData());
	}
}
