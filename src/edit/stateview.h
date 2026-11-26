#pragma once

#include <string>

// Editor only: shows the game state (the shader storage buffer) in the panel,
// with the layout given by the shaders themselves (program introspection).
// Values can be edited; the change is written to the buffer at once.
namespace StateView
{
	// Call inside the panel window. Returns true if a value was edited.
	bool draw(int gameProgram, int sceneProgram, int stateSize);

	// Print the layout (for the self-test). Returns the number of fields.
	int print(int gameProgram, int sceneProgram);

	// The values of the fields that are not arrays, on one line ("ball=(0.244,-0.486) score=0").
	std::string values(int gameProgram, int sceneProgram, int stateSize);

	// Byte offset of a field in the state, or -1 if there is none.
	int offset(int gameProgram, int sceneProgram, const char* name);
}
