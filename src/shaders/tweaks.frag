// Tweakable constants.
//
// TWEAK(name, value) / TWEAKC(name, value) let a value be edited live in the
// editor while compiling to a plain literal (no uniform, zero overhead) in the
// released intro.
//
//   * Release (EDITOR undefined): the macro expands to the literal 'value'.
//   * Editor  (EDITOR defined):   the macro expands to 'name', a uniform that
//     the editor declares and drives from an ImGui control. Use "Bake to
//     source" to write the current values back here as the new literals.
//
// Use TWEAKC for colors so the editor shows a color picker instead of sliders.
// The value's form selects the ImGui control: a scalar -> DragFloat,
// vec3(...) -> DragFloat3 (or ColorEdit3 for TWEAKC).
//
// Note: in the editor a TWEAK expands to a uniform, which is not a constant
// expression, so it cannot be used to initialise a global variable. Use TWEAK
// inside a function body (assign the result to your global there).

#ifdef EDITOR
	#define TWEAK(name, value)  name
	#define TWEAKC(name, value) name
#else
	#define TWEAK(name, value)  (value)
	#define TWEAKC(name, value) (value)
#endif
