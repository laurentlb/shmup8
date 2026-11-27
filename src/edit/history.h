#pragma once

#include <string>
#include <vector>

#include "../input.h"

// Editor only: records the inputs of every game step and keeps a copy of the
// game state every second, to go back in time and replay.
//
// The game state is a GPU buffer, so a snapshot is a copy of that buffer. Going
// to step N restores the last snapshot before N, then simulates the remaining
// steps with the recorded inputs.
//
// After a shader change, the snapshots after the current step are dropped:
// replaying from an earlier point uses the new code with the same inputs.
namespace History
{
	// The input of a step: keys (1 left, 2 right, 4 forward, 8 back, 16 fire,
	// 32 jump, 64 rocket) and the view angles, quantized (live inputs are quantized too,
	// so that a replay gives the same game).
	struct Input
	{
		unsigned char keys;
		short yaw, pitch; // yaw: a turn is 65536; pitch: 1/20000 radian
		bool operator==(const Input& o) const { return keys == o.keys && yaw == o.yaw && pitch == o.pitch; }
		bool operator!=(const Input& o) const { return !(*this == o); }
	};
	Input encode(const GameInput& input);
	GameInput decode(Input input);

	// step: advances the game (see stepGame). events: the counters read back by the host,
	// at the beginning of the state.
	void init(void (*step)(GameInput input, int steps), int* events, int eventCount, int stateSize);

	// The state was reset (restart or new layout): go to step 0, keep the inputs.
	void restart();

	// Advance the game. While replaying, the recorded inputs are used (until the
	// end of the recording), otherwise 'live' is recorded and replaces what was
	// recorded after the current step.
	void advance(Input live, int steps);

	// Go to a recorded step (clamped).
	void seek(int step);

	// The code or the state was changed by hand: snapshots after the current step are wrong.
	void invalidate();

	int position();
	int length(); // recorded steps
	bool& replaying();

	// The input of the previous step (zero at step 0).
	Input last();

	// Text file, one line per run of identical inputs: "count keys yaw pitch".
	bool save(const std::string& path);
	bool load(const std::string& path, std::vector<Input>& inputs);
	bool load(const std::string& path); // into the history, and restart

	const std::vector<Input>& inputs();
}
