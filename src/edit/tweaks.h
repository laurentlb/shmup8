#pragma once

namespace EditUI
{
	// Editor-only support for _TV()/_TVC() shader constants.
	//
	// scan() discovers the tweaks in a preprocessed shader source, the editor
	// injects uniformDeclarations() into the source it compiles, drawAndApply()
	// renders the ImGui controls and pushes the live uniform values, and bake()
	// writes the current values back into the shader source as literals.
	namespace Tweaks
	{
		// Parse _TV/_TVC occurrences from a preprocessed shader source.
		// Existing values are preserved across reloads (merge by name).
		void scan(const char* source);

		// GLSL 'uniform' declarations for the scanned tweaks, to be injected
		// into the editor shader (valid until the next scan()).
		const char* uniformDeclarations();

		// Render an ImGui control per tweak and upload the values to the program.
		void drawAndApply(int shaderProgram);

		// Upload the values to the program without any UI (headless capture).
		void apply(int shaderProgram);

		// Override a tweak from text, e.g. ("reflMax", "0.5") or
		// ("neonColor", "vec3(1,0,0)"). Returns false if no such tweak.
		bool set(const char* name, const char* valueText);

		// Rewrite the current values back into the shader source files.
		void bake();
	}
}
