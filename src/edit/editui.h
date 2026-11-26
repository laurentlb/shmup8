#pragma once

namespace EditUI {
	HWND createEditorWindow(bool visible = true);
	void init();
	void drawStart();
	void drawEnd();

	// Timeline: go back in time, replay the recorded inputs, save or load them.
	// Moving in time pauses the game.
	void drawTimeline();

	// Show the event counters of the game.
	void drawEvents(const int* events, int count);

	// Pipette: while the left mouse button is held (and not over the panel),
	// read the backbuffer pixel under the cursor. Call after the scene has been
	// drawn to the backbuffer but before the ImGui overlay is rendered.
	void pickColor();

	void render();

	// Whether the ImGui control panel is currently shown (toggled with F1).
	bool panelOpen();

	// Current audio volume as a linear 0..1 amplitude (from the volume slider).
	float volume();

	// Report the latest shader (re)compile result for display in the panel.
	// level: 0 = info/in-progress, 1 = success, 2 = error (shown in red).
	void setShaderStatus(const char* message, int level);

	// --- game clock ---------------------------------------------------------
	bool playing();        // toggled with P
	float speed();         // 1: real time
	bool takeRestart();    // the restart button was clicked (or R pressed)
	bool takeFrameStep();  // while paused, the step button was clicked (or O pressed)
}
