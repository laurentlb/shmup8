#pragma once

#include <string>

#include "windows.h"
#include "GL/gl.h"
namespace Leviathan
{
	// simpler wrapper class for the editor functionality
	class Editor
	{
	public:
		Editor();

		// Detect changes in the shaders (or Ctrl+S).
		void handleEvents();

		// Recompile the gameplay and scene programs if needed. A program that fails
		// to compile keeps its previous version.
		void updateShaders(int* gamePID, int* scenePID, bool force_update = false);

		// Whether the declaration of the game state changed in the last update.
		bool takeStateChanged();

		// Whether the programs were replaced by a successful reload since the last call.
		bool takeCodeChanged();

		// Whether the last shader (re)compile failed.
		bool compileFailed() const { return lastCompileFailed; }

	private:
		void reloadShaderSource(int* gamePID, int* scenePID);
		int linkProgram(const char* source, GLenum shaderType);
		char* textFileRead(const char* filename);
		int compileShader(const char *source, GLenum shaderType);

		static const int shaderErrorBufferLength = 4096;
		bool shaderUpdatePending = false;
		int previousUpdateTime = 0;
		bool lastCompileFailed = false;
		std::string stateDeclaration;
		bool stateChanged = false;
		bool codeChanged = false;
		unsigned long lastCheck = 0;
		unsigned long long shaderTime = 0;
	};
}
