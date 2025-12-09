#include "definitions.h"
#include "glext.h"

#include "thirdparty/imgui/imgui.h"
#include "thirdparty/imgui/imgui_impl_win32.h"
#include "thirdparty/imgui/imgui_impl_opengl2.h"

#include <windows.h>
#include <mmsystem.h>

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

	void draw(float& time) {
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
		ImGui::End();

		ImGui::Render();
	}

	void render()
	{
		((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(0);
		ImGui_ImplOpenGL2_RenderDrawData(ImGui::GetDrawData());
	}
}
