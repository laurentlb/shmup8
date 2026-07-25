#include "tweaks.h"

#include "definitions.h"
#include "glext.h"

#include "../thirdparty/imgui/imgui.h"

#include <string>
#include <vector>
#include <cstdlib>
#include <cctype>

namespace EditUI
{
	namespace Tweaks
	{
		enum Type { TypeFloat, TypeVec3, TypeColor };

		struct Tweak
		{
			std::string name;
			Type        type;
			float       value[3];
			int         location;
		};

		static std::vector<Tweak> tweaks;
		static std::string        declarations;

		// --- parsing helpers -------------------------------------------------

		static std::string trim(const std::string& s)
		{
			size_t a = s.find_first_not_of(" \t\r\n");
			if (a == std::string::npos) return "";
			size_t b = s.find_last_not_of(" \t\r\n");
			return s.substr(a, b - a + 1);
		}

		// A TWEAK token on a preprocessor (#...) or comment (//...) line is not a
		// real usage (e.g. the macro definitions and doc in tweaks.frag).
		static bool ignoredLine(const std::string& s, size_t pos)
		{
			size_t ls = s.rfind('\n', pos);
			ls = (ls == std::string::npos) ? 0 : ls + 1;
			bool seenNonSpace = false;
			for (size_t i = ls; i < pos; ++i)
			{
				char c = s[i];
				if (c == '/' && i + 1 < s.size() && s[i + 1] == '/') return true;
				if (!seenNonSpace && c != ' ' && c != '\t')
				{
					seenNonSpace = true;
					if (c == '#') return true;
				}
			}
			return false;
		}

		static void parseValue(const std::string& valueText, Type type, float out[3])
		{
			out[0] = out[1] = out[2] = 0.0f;
			if (type == TypeFloat)
			{
				out[0] = out[1] = out[2] = (float)atof(valueText.c_str());
				return;
			}
			// vec3(a, b, c) or vec3(a)
			size_t a = valueText.find('(');
			size_t b = valueText.rfind(')');
			if (a == std::string::npos || b == std::string::npos || b <= a) return;
			std::string inner = valueText.substr(a + 1, b - a - 1);

			int n = 0;
			size_t start = 0;
			while (n < 3)
			{
				size_t comma = inner.find(',', start);
				std::string tok = trim(inner.substr(start, comma - start));
				if (!tok.empty()) out[n++] = (float)atof(tok.c_str());
				if (comma == std::string::npos) break;
				start = comma + 1;
			}
			if (n == 1) out[1] = out[2] = out[0]; // vec3(x) replicates
		}

		static bool alreadyKnown(const std::string& name)
		{
			for (size_t i = 0; i < tweaks.size(); ++i)
				if (tweaks[i].name == name) return true;
			return false;
		}

		void scan(const char* sourceCStr)
		{
			std::string src = sourceCStr ? sourceCStr : "";

			size_t p = 0;
			while ((p = src.find("TWEAK", p)) != std::string::npos)
			{
				// require a word boundary before the keyword
				if (p > 0)
				{
					char before = src[p - 1];
					if (isalnum((unsigned char)before) || before == '_') { p += 5; continue; }
				}

				bool isColor = src.compare(p, 7, "TWEAKC(") == 0;
				bool isPlain = src.compare(p, 6, "TWEAK(") == 0;
				if (!isColor && !isPlain) { p += 5; continue; }
				if (ignoredLine(src, p)) { p += 5; continue; }

				size_t open = src.find('(', p);
				size_t comma = src.find(',', open);
				if (open == std::string::npos || comma == std::string::npos) { p += 5; continue; }

				// value spans from the first comma to the matching close paren
				int depth = 0;
				size_t valEnd = std::string::npos;
				for (size_t i = open; i < src.size(); ++i)
				{
					if (src[i] == '(') ++depth;
					else if (src[i] == ')') { if (--depth == 0) { valEnd = i; break; } }
				}
				if (valEnd == std::string::npos) { p += 5; continue; }

				std::string name = trim(src.substr(open + 1, comma - open - 1));
				std::string valueText = trim(src.substr(comma + 1, valEnd - comma - 1));
				p = valEnd + 1;

				if (name.empty() || alreadyKnown(name)) continue;

				Tweak t;
				t.name = name;
				t.type = isColor ? TypeColor
				       : (valueText.compare(0, 4, "vec3") == 0 ? TypeVec3 : TypeFloat);
				parseValue(valueText, t.type, t.value);
				t.location = -1;
				tweaks.push_back(t);
			}

			// (re)build the uniform declarations for shader injection
			declarations.clear();
			for (size_t i = 0; i < tweaks.size(); ++i)
			{
				const char* glslType = (tweaks[i].type == TypeFloat) ? "float" : "vec3";
				declarations += "uniform ";
				declarations += glslType;
				declarations += ' ';
				declarations += tweaks[i].name;
				declarations += ";\n";
			}
		}

		const char* uniformDeclarations()
		{
			return declarations.c_str();
		}

		void drawAndApply(int shaderProgram)
		{
			auto glGetUniformLocation = (PFNGLGETUNIFORMLOCATIONPROC)wglGetProcAddress("glGetUniformLocation");
			auto glUniform3f = (PFNGLUNIFORM3FPROC)wglGetProcAddress("glUniform3f");
			auto glUniform1f = (PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f");

			// Uniform locations belong to a program; re-resolve when it changes
			// (a hot reload creates a fresh program id).
			static int cachedProgram = 0;
			const bool refresh = shaderProgram != cachedProgram;
			cachedProgram = shaderProgram;

			for (size_t i = 0; i < tweaks.size(); ++i)
			{
				Tweak& t = tweaks[i];
				if (refresh)
					t.location = glGetUniformLocation(shaderProgram, t.name.c_str());

				switch (t.type)
				{
				case TypeFloat:
					ImGui::DragFloat(t.name.c_str(), &t.value[0], 0.01f);
					if (t.location >= 0) glUniform1f(t.location, t.value[0]);
					break;
				case TypeVec3:
					ImGui::DragFloat3(t.name.c_str(), t.value, 0.01f);
					if (t.location >= 0) glUniform3f(t.location, t.value[0], t.value[1], t.value[2]);
					break;
				case TypeColor:
					ImGui::ColorEdit3(t.name.c_str(), t.value);
					if (t.location >= 0) glUniform3f(t.location, t.value[0], t.value[1], t.value[2]);
					break;
				}
			}
		}
	}
}
