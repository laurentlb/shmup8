#pragma once

namespace EditUI {
	HWND createEditorWindow();
	void init();
	void drawStart(float& time);
	void drawEnd();
	void updateManualCamera(int shaderProgram);
	void render();

	// Whether the ImGui control panel is currently shown (toggled with F1).
	bool panelOpen();

	// Current audio volume as a linear 0..1 amplitude (from the volume slider).
	float volume();

	// Report the latest shader (re)compile result for display in the panel.
	// level: 0 = info/in-progress, 1 = success, 2 = error (shown in red).
	void setShaderStatus(const char* message, int level);

	// --- transport ----------------------------------------------------------
	// Playback action requested from the transport row, consumed by the editor.
	enum class Transport { None, Toggle };

	// Return and clear the pending transport request (call once per frame).
	Transport takeTransport();

	// Push the current playback state so the transport label/button can reflect it.
	void setPlaying(bool playing);
}
