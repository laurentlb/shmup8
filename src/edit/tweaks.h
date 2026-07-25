#pragma once

namespace EditUI
{
	// Editor-only support for TWEAK()/TWEAKC() shader constants.
	//
	// scan() discovers the tweaks in a preprocessed shader source, the editor
	// injects uniformDeclarations() into the source it compiles, drawAndApply()
	// renders the ImGui controls and pushes the live uniform values, and bake()
	// writes the current values back into the shader source as literals.
	namespace Tweaks
	{
		// Parse TWEAK/TWEAKC occurrences from a preprocessed shader source.
		// Existing values are preserved across reloads (merge by name).
		void scan(const char* source);

		// GLSL 'uniform' declarations for the scanned tweaks, to be injected
		// into the editor shader (valid until the next scan()).
		const char* uniformDeclarations();

		// Render an ImGui control per tweak and upload the values to the program.
		void drawAndApply(int shaderProgram);

		// Rewrite the current values back into the shader source files.
		void bake();
	}
}
