
#include "windows.h"
#include "GL/gl.h"
namespace Leviathan
{
	// forward declaration
	class Song;
}

namespace Leviathan
{
	// simpler wrapper class for the editor functionality
	class Editor
	{
	public:
		Editor();

		void beginFrame(const unsigned long time);

		void endFrame(const unsigned long time);

		void printFrameStatistics();

		double handleEvents(Song* track, double position);

		void updateShaders(int* mainShaderPID, int* ppShaderPID, bool force_update = false);

		// Compile the shaders for a w x h framebuffer instead of XRES x YRES.
		void setResolution(int w, int h) { resolutionX = w; resolutionY = h; }

		// Whether the last shader (re)compile failed.
		bool compileFailed() const { return lastCompileFailed; }

	private:
		void reloadShaderSource(int* mainShaderPID, int* ppShaderPID);
		char* textFileRead(const char* filename);
		int compileShader(const char *source, GLenum shaderType);

		enum PlayState {Playing, Paused};
		PlayState state;

		unsigned long lastFrameStart;
		unsigned long lastFrameStop;

		static const int shaderErrorBufferLength = 4096;
		static const int windowSize = 10;
		int timeHistory[windowSize] = {};

		bool shaderUpdatePending = false;
		int previousUpdateTime = 0;
		bool lastCompileFailed = false;
		int resolutionX = 0; // 0: keep the shader's XRES/YRES
		int resolutionY = 0;

		double trackPosition;
		double trackEnd;
	};
}
