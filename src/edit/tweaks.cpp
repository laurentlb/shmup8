#include "tweaks.h"

#include "definitions.h"
#include "glext.h"

#include "../thirdparty/imgui/imgui.h"

#include <string>
#include <cstdlib>
#include <cctype>
#include <cstdio>

namespace EditUI
{
	bool panelOpen(); // defined in editui.cpp

	namespace Tweaks
	{
		enum Type { TypeFloat, TypeVec2, TypeVec3, TypeVec4, TypeColor, TypeBool };

		struct Tweak
		{
			std::string name;
			Type        type           = TypeFloat;
			float       value[4]        = { 0.0f, 0.0f, 0.0f, 0.0f };
			float       original[4]     = { 0.0f, 0.0f, 0.0f, 0.0f };
			int         location        = -1;
		};

		// Number of float components a tweak type carries.
		static int compCount(Type t)
		{
			switch (t)
			{
			case TypeVec2: return 2;
			case TypeVec3: return 3;
			case TypeColor: return 3;
			case TypeVec4: return 4;
			default:       return 1;
			}
		}

		// GLSL uniform type name for a tweak type.
		static const char* glslTypeName(Type t)
		{
			switch (t)
			{
			case TypeVec2: return "vec2";
			case TypeVec3: return "vec3";
			case TypeColor: return "vec3";
			case TypeVec4: return "vec4";
			case TypeBool: return "bool";
			default:       return "float";
			}
		}

		// Classify a value expression by its leading vecN(...) constructor.
		static Type classify(const std::string& valueText, bool isColor)
		{
			if (isColor) return TypeColor;
			if (valueText == "true" || valueText == "false") return TypeBool;
			if (valueText.compare(0, 4, "vec2") == 0) return TypeVec2;
			if (valueText.compare(0, 4, "vec3") == 0) return TypeVec3;
			if (valueText.compare(0, 4, "vec4") == 0) return TypeVec4;
			return TypeFloat;
		}

		static const int MAX_TWEAKS = 64;
		static Tweak       tweaks[MAX_TWEAKS];
		static int         tweakCount = 0;
		static std::string declarations;

		// --- parsing helpers -------------------------------------------------

		static std::string trim(const std::string& s)
		{
			size_t a = s.find_first_not_of(" \t\r\n");
			if (a == std::string::npos) return "";
			size_t b = s.find_last_not_of(" \t\r\n");
			return s.substr(a, b - a + 1);
		}

		// A _TV token on a preprocessor (#...) or comment (//...) line is not a
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

		static void parseValue(const std::string& valueText, Type type, float out[4])
		{
			out[0] = out[1] = out[2] = out[3] = 0.0f;
			const int n = compCount(type);
			if (type == TypeBool)
			{
				out[0] = (valueText == "true") ? 1.0f : 0.0f;
				return;
			}
			if (type == TypeFloat)
			{
				out[0] = (float)atof(valueText.c_str());
				return;
			}
			// vecN(a, b, ...) or vecN(a)
			size_t a = valueText.find('(');
			size_t b = valueText.rfind(')');
			if (a == std::string::npos || b == std::string::npos || b <= a) return;
			std::string inner = valueText.substr(a + 1, b - a - 1);

			int count = 0;
			size_t start = 0;
			while (count < n)
			{
				size_t comma = inner.find(',', start);
				std::string tok = trim(inner.substr(start, comma - start));
				if (!tok.empty()) out[count++] = (float)atof(tok.c_str());
				if (comma == std::string::npos) break;
				start = comma + 1;
			}
			if (count == 1) // vecN(x) replicates the single component
				for (int i = 1; i < n; ++i) out[i] = out[0];
		}

		static bool alreadyKnown(const std::string& name)
		{
			for (int i = 0; i < tweakCount; ++i)
				if (tweaks[i].name == name) return true;
			return false;
		}

		// Locate a _TV/_TVC invocation starting at 'p'. On success fills the
		// name and the [open+1, valEnd) span covering the value argument(s), and
		// returns the index just past the closing paren. Returns npos if 'p' is
		// not a real usage (word boundary / macro-def / comment / malformed).
		static size_t parseInvocation(const std::string& src, size_t p,
		                              std::string& name, size_t& valStart, size_t& valEnd)
		{
			if (p > 0)
			{
				char before = src[p - 1];
				if (isalnum((unsigned char)before) || before == '_') return std::string::npos;
			}
			bool isColor = src.compare(p, 5, "_TVC(") == 0;
			bool isPlain = src.compare(p, 4, "_TV(") == 0;
			if (!isColor && !isPlain) return std::string::npos;
			if (ignoredLine(src, p)) return std::string::npos;

			size_t open = src.find('(', p);
			size_t comma = src.find(',', open);
			if (open == std::string::npos || comma == std::string::npos) return std::string::npos;

			int depth = 0;
			valEnd = std::string::npos;
			for (size_t i = open; i < src.size(); ++i)
			{
				if (src[i] == '(') ++depth;
				else if (src[i] == ')') { if (--depth == 0) { valEnd = i; break; } }
			}
			if (valEnd == std::string::npos) return std::string::npos;

			name = trim(src.substr(open + 1, comma - open - 1));
			valStart = comma + 1;
			return valEnd + 1;
		}

		static const Tweak* findTweak(const std::string& name)
		{
			for (int i = 0; i < tweakCount; ++i)
				if (tweaks[i].name == name) return &tweaks[i];
			return NULL;
		}

		static std::string formatValue(const Tweak& t)
		{
			char buf[160];
			const int n = compCount(t.type);
			if (t.type == TypeBool)
				return t.value[0] != 0.0f ? "true" : "false";
			if (n == 1)
			{
				snprintf(buf, sizeof(buf), "%g", t.value[0]);
				return buf;
			}
			switch (n)
			{
			case 2:  snprintf(buf, sizeof(buf), "vec2(%g, %g)",
			                  t.value[0], t.value[1]); break;
			case 4:  snprintf(buf, sizeof(buf), "vec4(%g, %g, %g, %g)",
			                  t.value[0], t.value[1], t.value[2], t.value[3]); break;
			default: snprintf(buf, sizeof(buf), "vec3(%g, %g, %g)",
			                  t.value[0], t.value[1], t.value[2]); break;
			}
			return buf;
		}

		void scan(const char* sourceCStr)
		{
			std::string src = sourceCStr ? sourceCStr : "";

			// Snapshot the previous set so live-edited values survive a rescan,
			// while tweaks whose _TV line was removed drop out.
			static Tweak previous[MAX_TWEAKS];
			int previousCount = tweakCount;
			for (int i = 0; i < previousCount; ++i) previous[i] = tweaks[i];
			tweakCount = 0;

			size_t p = 0;
			while ((p = src.find("_TV", p)) != std::string::npos)
			{
				std::string name;
				size_t valStart, valEnd;
				size_t next = parseInvocation(src, p, name, valStart, valEnd);
				if (next == std::string::npos) { p += 3; continue; }

				bool isColor = src.compare(p, 5, "_TVC(") == 0;
				std::string valueText = trim(src.substr(valStart, valEnd - valStart));
				p = next;

				if (name.empty() || alreadyKnown(name)) continue;
				if (tweakCount >= MAX_TWEAKS) continue;

				Tweak& t = tweaks[tweakCount++];
				t.name = name;
				t.type = classify(valueText, isColor);
				parseValue(valueText, t.type, t.value);
				for (int c = 0; c < 4; ++c) t.original[c] = t.value[c];
				t.location = -1;

				// Preserve the live value from a previous scan (if still same type).
				for (int j = 0; j < previousCount; ++j)
					if (previous[j].name == name && previous[j].type == t.type)
					{
						for (int c = 0; c < 4; ++c) t.value[c] = previous[j].value[c];
						break;
					}
			}

			// (re)build the uniform declarations for shader injection
			declarations.clear();
			for (int i = 0; i < tweakCount; ++i)
			{
				declarations += "uniform ";
				declarations += glslTypeName(tweaks[i].type);
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
			auto glUniform1f = (PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f");
			auto glUniform1i = (PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i");
			auto glUniform2f = (PFNGLUNIFORM2FPROC)wglGetProcAddress("glUniform2f");
			auto glUniform3f = (PFNGLUNIFORM3FPROC)wglGetProcAddress("glUniform3f");
			auto glUniform4f = (PFNGLUNIFORM4FPROC)wglGetProcAddress("glUniform4f");

			// Uniform locations belong to a program; re-resolve when it changes
			// (a hot reload creates a fresh program id).
			static int cachedProgram = 0;
			const bool refresh = shaderProgram != cachedProgram;
			cachedProgram = shaderProgram;

			// Uniforms must always be uploaded; the ImGui widgets are only issued
			// when the panel is visible (F1 toggle).
			const bool ui = panelOpen();

			for (int i = 0; i < tweakCount; ++i)
			{
				Tweak& t = tweaks[i];
				// Re-resolve on program change, and keep trying while unresolved
				// (guards against a first lookup against a not-yet-linked program).
				if (refresh || t.location < 0)
					t.location = glGetUniformLocation(shaderProgram, t.name.c_str());

				switch (t.type)
				{
				case TypeFloat:
					if (ui) ImGui::DragFloat(t.name.c_str(), &t.value[0], 0.01f);
					if (t.location >= 0) glUniform1f(t.location, t.value[0]);
					break;
				case TypeVec2:
					if (ui) ImGui::DragFloat2(t.name.c_str(), t.value, 0.01f);
					if (t.location >= 0) glUniform2f(t.location, t.value[0], t.value[1]);
					break;
				case TypeVec3:
					if (ui) ImGui::DragFloat3(t.name.c_str(), t.value, 0.01f);
					if (t.location >= 0) glUniform3f(t.location, t.value[0], t.value[1], t.value[2]);
					break;
				case TypeVec4:
					if (ui) ImGui::DragFloat4(t.name.c_str(), t.value, 0.01f);
					if (t.location >= 0) glUniform4f(t.location, t.value[0], t.value[1], t.value[2], t.value[3]);
					break;
				case TypeColor:
					if (ui) ImGui::ColorEdit3(t.name.c_str(), t.value);
					if (t.location >= 0) glUniform3f(t.location, t.value[0], t.value[1], t.value[2]);
					break;
				case TypeBool:
				{
					bool b = t.value[0] != 0.0f;
					if (ui) ImGui::Checkbox(t.name.c_str(), &b);
					t.value[0] = b ? 1.0f : 0.0f;
					if (t.location >= 0) glUniform1i(t.location, b ? 1 : 0);
					break;
				}
				}
			}

			if (ui && tweakCount > 0)
			{
				ImGui::Separator();
				if (ImGui::Button("Bake to source"))
					bake();
				ImGui::SameLine();
				if (ImGui::Button("Revert"))
				{
					for (int i = 0; i < tweakCount; ++i)
						for (int c = 0; c < 4; ++c)
							tweaks[i].value[c] = tweaks[i].original[c];
				}
			}
		}

		// --- baking ----------------------------------------------------------

		// Rewrite every _TV/_TVC value in one shader file with the current
		// live value. Reads/writes in binary so line endings are preserved.
		static void bakeFile(const std::string& path)
		{
			FILE* file = fopen(path.c_str(), "rb");
			if (!file) return;
			fseek(file, 0, SEEK_END);
			long size = ftell(file);
			rewind(file);
			std::string src(size, '\0');
			if (size > 0) fread(&src[0], 1, size, file);
			fclose(file);

			std::string out;
			out.reserve(src.size());
			size_t copied = 0;
			size_t p = 0;
			bool changed = false;
			while ((p = src.find("_TV", p)) != std::string::npos)
			{
				std::string name;
				size_t valStart, valEnd;
				size_t next = parseInvocation(src, p, name, valStart, valEnd);
				if (next == std::string::npos) { p += 3; continue; }

				const Tweak* t = findTweak(name);
				if (t)
				{
					out.append(src, copied, valStart - copied);
					out += ' ';
					out += formatValue(*t);
					copied = valEnd;
					changed = true;
				}
				p = next;
			}
			if (!changed) return;
			out.append(src, copied, std::string::npos);

			file = fopen(path.c_str(), "wb");
			if (!file) return;
			fwrite(out.data(), 1, out.size(), file);
			fclose(file);
		}

		void bake()
		{
			WIN32_FIND_DATAA fd;
			HANDLE h = FindFirstFileA("src/shaders/*.frag", &fd);
			if (h == INVALID_HANDLE_VALUE) return;
			do
			{
				if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) continue;
				std::string name = fd.cFileName;
				// skip generated / preprocessed / minified outputs
				if (name.compare(0, 13, "preprocessed.") == 0) continue;
				if (name.find(".min.") != std::string::npos) continue;
				bakeFile("src/shaders/" + name);
			} while (FindNextFileA(h, &fd));
			FindClose(h);

			// The written literals are now the source-of-truth baseline for Revert.
			for (int i = 0; i < tweakCount; ++i)
				for (int c = 0; c < 4; ++c)
					tweaks[i].original[c] = tweaks[i].value[c];
		}

	}
}
