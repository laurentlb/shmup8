// _TV(name, value) / _TVC(name, value): a value that is edited live in the
// editor but compiles to a plain literal (no uniform, zero overhead) in release.
// The editor rewrites these bodies to expand to a uniform 'name'; use _TVC and
// a vec3 for a color picker. _TV must be used in a function body, not to
// initialise a global (a uniform is not a constant expression).
#define _TV(name, value)  (value)
#define _TVC(name, value) (value)
