#pragma once

namespace EditUI {
	HWND createEditorWindow();
	void init();
	void drawStart(float& time);
	void drawEnd();
	void updateManualCamera(int shaderProgram);
	void render();
}
