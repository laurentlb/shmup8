#pragma once

// Editor only: shows the game state (the shader storage buffer) in the panel,
// with the layout given by the shaders themselves (program introspection).
// Values can be edited; the change is written to the buffer at once.
namespace StateView
{
	// Call inside the panel window. Returns true if a value was edited.
	bool draw(int gameProgram, int sceneProgram, int stateSize);

	// Print the layout (for the self-test). Returns the number of fields.
	int print(int gameProgram, int sceneProgram);
}
