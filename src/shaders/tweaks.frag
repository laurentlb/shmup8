// TWEAK(name, value) / TWEAKC(name, value): a value that is edited live in the
// editor but compiles to a plain literal (no uniform, zero overhead) in release.
// The editor rewrites these bodies to expand to a uniform 'name'; use TWEAKC and
// a vec3 for a color picker. TWEAK must be used in a function body, not to
// initialise a global (a uniform is not a constant expression).
#define TWEAK(name, value)  (value)
#define TWEAKC(name, value) (value)
