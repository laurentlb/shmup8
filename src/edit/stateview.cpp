#include "stateview.h"

#include "definitions.h"
#include "glext.h"

#include "thirdparty/imgui/imgui.h"

#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>

namespace StateView
{
	struct Field
	{
		std::string name; // without "[0]"
		GLenum type;
		int offset, arraySize, arrayStride;
	};

	static std::vector<Field> fields;
	static int cachedGame = -1, cachedScene = -1;
	static std::vector<char> data;

	#define GLFN(name, type) static type name = 0
	GLFN(glGetProgramInterfaceiv, PFNGLGETPROGRAMINTERFACEIVPROC);
	GLFN(glGetProgramResourceName, PFNGLGETPROGRAMRESOURCENAMEPROC);
	GLFN(glGetProgramResourceiv, PFNGLGETPROGRAMRESOURCEIVPROC);
	GLFN(glGetBufferSubData, PFNGLGETBUFFERSUBDATAPROC);
	GLFN(glBufferSubData, PFNGLBUFFERSUBDATAPROC);
	#undef GLFN

	static void loadFunctions()
	{
		if (glGetProgramInterfaceiv) return;
		#define LOAD(name) name = (decltype(name))wglGetProcAddress(#name)
		LOAD(glGetProgramInterfaceiv);
		LOAD(glGetProgramResourceName);
		LOAD(glGetProgramResourceiv);
		LOAD(glGetBufferSubData);
		LOAD(glBufferSubData);
		#undef LOAD
	}

	// A variable unused by a shader may be missing from its program: merge both.
	static void addFields(int program)
	{
		GLint count = 0;
		glGetProgramInterfaceiv(program, GL_BUFFER_VARIABLE, GL_ACTIVE_RESOURCES, &count);
		for (int i = 0; i < count; i++)
		{
			char name[256];
			glGetProgramResourceName(program, GL_BUFFER_VARIABLE, i, sizeof(name), NULL, name);
			const GLenum props[] = { GL_TYPE, GL_OFFSET, GL_ARRAY_SIZE, GL_ARRAY_STRIDE };
			GLint v[4];
			glGetProgramResourceiv(program, GL_BUFFER_VARIABLE, i, 4, props, 4, NULL, v);

			Field f = { name, (GLenum)v[0], v[1], v[2], v[3] };
			size_t bracket = f.name.find('[');
			if (bracket != std::string::npos) f.name.resize(bracket);
			bool known = false;
			for (const Field& g : fields) known |= g.name == f.name;
			if (!known) fields.push_back(f);
		}
	}

	static void updateLayout(int gameProgram, int sceneProgram)
	{
		if (gameProgram == cachedGame && sceneProgram == cachedScene) return;
		cachedGame = gameProgram;
		cachedScene = sceneProgram;
		fields.clear();
		addFields(gameProgram);
		addFields(sceneProgram);
		std::sort(fields.begin(), fields.end(), [](const Field& a, const Field& b) { return a.offset < b.offset; });
	}

	// Edit one value; returns true if it changed.
	static bool editValue(const char* label, GLenum type, void* p)
	{
		ImGui::SetNextItemWidth(220);
		switch (type)
		{
		case GL_FLOAT:      return ImGui::DragFloat(label, (float*)p, 0.01f, 0, 0, "%.3f");
		case GL_FLOAT_VEC2: return ImGui::DragFloat2(label, (float*)p, 0.01f, 0, 0, "%.3f");
		case GL_FLOAT_VEC3: return ImGui::DragFloat3(label, (float*)p, 0.01f, 0, 0, "%.3f");
		case GL_FLOAT_VEC4: return ImGui::DragFloat4(label, (float*)p, 0.01f, 0, 0, "%.3f");
		case GL_INT:
		case GL_BOOL:
		case GL_UNSIGNED_INT: return ImGui::DragInt(label, (int*)p, 0.2f);
		case GL_INT_VEC2:   return ImGui::DragInt2(label, (int*)p, 0.2f);
		case GL_INT_VEC3:   return ImGui::DragInt3(label, (int*)p, 0.2f);
		case GL_INT_VEC4:   return ImGui::DragInt4(label, (int*)p, 0.2f);
		default:
			ImGui::Text("%s: (type 0x%x)", label, type);
			return false;
		}
	}

	static int typeSize(GLenum type)
	{
		switch (type)
		{
		case GL_FLOAT_VEC2: case GL_INT_VEC2: return 8;
		case GL_FLOAT_VEC3: case GL_INT_VEC3: return 12;
		case GL_FLOAT_VEC4: case GL_INT_VEC4: return 16;
		default: return 4;
		}
	}

	int print(int gameProgram, int sceneProgram)
	{
		loadFunctions();
		updateLayout(gameProgram, sceneProgram);
		for (const Field& f : fields)
			printf("  %-12s offset %4d  type 0x%04x  size %2d  stride %2d\n", f.name.c_str(), f.offset, f.type, f.arraySize, f.arrayStride);
		return (int)fields.size();
	}

	int offset(int gameProgram, int sceneProgram, const char* name)
	{
		loadFunctions();
		updateLayout(gameProgram, sceneProgram);
		for (const Field& f : fields)
			if (f.name == name) return f.offset;
		return -1;
	}

	std::string values(int gameProgram, int sceneProgram, int stateSize)
	{
		loadFunctions();
		updateLayout(gameProgram, sceneProgram);
		data.resize(stateSize);
		glGetBufferSubData(GL_SHADER_STORAGE_BUFFER, 0, stateSize, &data[0]);
		std::string out;
		for (const Field& f : fields)
		{
			const int size = typeSize(f.type);
			if (f.arraySize > 1 || f.offset + size > stateSize) continue;
			const bool isFloat = f.type == GL_FLOAT || f.type == GL_FLOAT_VEC2 || f.type == GL_FLOAT_VEC3 || f.type == GL_FLOAT_VEC4;
			const int n = size / 4;
			std::string v;
			for (int i = 0; i < n; i++)
			{
				char buf[32];
				const char* p = &data[f.offset + i * 4];
				if (isFloat) snprintf(buf, sizeof(buf), "%.3f", *(const float*)p);
				else snprintf(buf, sizeof(buf), "%d", *(const int*)p);
				v += (i ? "," : "") + std::string(buf);
			}
			out += (out.empty() ? "" : " ") + f.name + "=" + (n > 1 ? "(" + v + ")" : v);
		}
		return out;
	}

	bool draw(int gameProgram, int sceneProgram, int stateSize)
	{
		if (!ImGui::CollapsingHeader("Game state"))
			return false;
		loadFunctions();
		updateLayout(gameProgram, sceneProgram);

		data.resize(stateSize);
		glGetBufferSubData(GL_SHADER_STORAGE_BUFFER, 0, stateSize, &data[0]);

		bool edited = false;
		for (const Field& f : fields)
		{
			const int size = typeSize(f.type);
			if (f.arraySize <= 1)
			{
				if (f.offset + size > stateSize) continue;
				if (editValue(f.name.c_str(), f.type, &data[f.offset]))
				{
					glBufferSubData(GL_SHADER_STORAGE_BUFFER, f.offset, size, &data[f.offset]);
					edited = true;
				}
				continue;
			}

			if (!ImGui::TreeNode(f.name.c_str(), "%s[%d]", f.name.c_str(), f.arraySize))
				continue;
			for (int i = 0; i < f.arraySize; i++)
			{
				const int offset = f.offset + i * f.arrayStride;
				if (offset + size > stateSize) break;
				char label[64];
				snprintf(label, sizeof(label), "[%d]##%s", i, f.name.c_str());
				if (editValue(label, f.type, &data[offset]))
				{
					glBufferSubData(GL_SHADER_STORAGE_BUFFER, offset, size, &data[offset]);
					edited = true;
				}
			}
			ImGui::TreePop();
		}
		return edited;
	}
}
