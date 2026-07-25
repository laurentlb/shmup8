#include "tweaks.h"

#include "definitions.h"
#include "glext.h"

#include "../thirdparty/imgui/imgui.h"

namespace EditUI
{
	namespace Tweaks
	{
		enum Type { Float, Vec3 };

		struct Tweak
		{
			const char* name;   // uniform name in the shader (also the slider label)
			Type        type;
			float       minValue;
			float       maxValue;
			float       value[3];
			int         location;   // cached uniform location for 'cachedProgram'
		};

		// Add or edit entries here to expose new tweakable uniforms to the editor.
		static Tweak tweaks[] = {
			{ "u_camPos",  Vec3, -10.0f, 10.0f, { 0, 0, 0 }, -1 },
			{ "u_camVar1", Vec3, -10.0f, 10.0f, { 0, 0, 0 }, -1 },
			{ "u_camVar2", Vec3, -10.0f, 10.0f, { 0, 0, 0 }, -1 },
		};
		static const int tweakCount = sizeof(tweaks) / sizeof(tweaks[0]);

		// Uniform locations belong to a program; re-resolve them whenever the
		// program id changes (e.g. a hot reload creates a fresh program).
		static int cachedProgram = 0;

		void drawAndApply(int shaderProgram)
		{
			auto glGetUniformLocation = (PFNGLGETUNIFORMLOCATIONPROC)wglGetProcAddress("glGetUniformLocation");
			auto glUniform3f = (PFNGLUNIFORM3FPROC)wglGetProcAddress("glUniform3f");
			auto glUniform1f = (PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f");

			const bool refreshLocations = shaderProgram != cachedProgram;
			cachedProgram = shaderProgram;

			for (int i = 0; i < tweakCount; ++i)
			{
				Tweak& t = tweaks[i];
				if (refreshLocations)
					t.location = glGetUniformLocation(shaderProgram, t.name);

				// Always show the slider; only upload if the shader uses the uniform.
				switch (t.type)
				{
				case Vec3:
					ImGui::SliderFloat3(t.name, t.value, t.minValue, t.maxValue);
					if (t.location >= 0)
						glUniform3f(t.location, t.value[0], t.value[1], t.value[2]);
					break;
				case Float:
					ImGui::SliderFloat(t.name, t.value, t.minValue, t.maxValue);
					if (t.location >= 0)
						glUniform1f(t.location, t.value[0]);
					break;
				}
			}
		}
	}
}
