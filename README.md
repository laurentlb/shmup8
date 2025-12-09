# Shmup8

Work in progress.

The goal is to make something for https://langjamgamejam.com/

> A 7-day hackathon where you build a programming language and then make a game using it.

A write-up will come later, if the project is successful.

High-level plan:
- Design a small language.
- Write a compiler (using F#) that compiles that language to a bytecode.
- Write a bytecode interpreter in C++.
- Use the language to write the game mechanics
- Use a GLSL shader to render the game

It is possible that the bytecode will be more compact than writing the engine in C++, even after counting the bytecode interpreter (to be confirmed).

Goal: get a game (shoot'em up) in approximately 4kB-8kB.

--

The C++ code setup comes from https://github.com/ctrl-alt-test/engine8.
