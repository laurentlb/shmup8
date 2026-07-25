#pragma once

namespace EditUI
{
	// Editor-only tweakable shader uniforms.
	//
	// Renders an ImGui slider for each registered uniform and uploads the
	// current values to the given shader program. Values are intentionally
	// transient (not persisted across runs).
	//
	// To expose a new tweakable uniform, add an entry to the table in tweaks.cpp.
	namespace Tweaks
	{
		void drawAndApply(int shaderProgram);
	}
}
