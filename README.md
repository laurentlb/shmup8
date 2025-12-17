# Shmup8

In the last few days, I built a shoot ’em up game by embedding a tiny custom bytecode VM and rendering the graphics using a fullscreen pixel shader. The result is a 3kB Windows executable.

Released at https://laurentlb.itch.io/shmup8

Created for https://langjamgamejam.com

> A 7-day hackathon where you build a programming language and then make a game using it.

---

A detailed write-up will come later.

High-level plan:
* Design a language.
* Implement a compiler to compile it to bytecode, using F#.
* Write a bytecode interpreter, using C++.
* Create a shoot’em up game, using the custom language.
* Render the graphics, using a single GLSL shader.

---

The C++ code setup comes from https://github.com/ctrl-alt-test/engine8.
