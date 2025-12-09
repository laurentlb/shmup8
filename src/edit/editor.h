
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

	private:
		void reloadShaderSource(int* mainShaderPID, int* ppShaderPID);
		char* textFileRead(const char* filename);
		int compileShader(char *source, GLenum shaderType);

		enum PlayState {Playing, Paused};
		PlayState state;

		unsigned long lastFrameStart;
		unsigned long lastFrameStop;

		static const int shaderErrorBufferLength = 4096;
		static const int windowSize = 10;
		int timeHistory[windowSize] = {};

		bool shaderUpdatePending = false;
		int previousUpdateTime;

		double trackPosition;
		double trackEnd;
	};
}
