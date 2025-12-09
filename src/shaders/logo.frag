float rect(vec2 p, float size, float r) {
  p = pow(max(abs(p) + r - size, 0.), vec2(4));
  return smoothstep(0., 0.00000001, p.x + p.y - pow(r, 4.));
}

float spacing = 0.15;

float base(vec2 p, float t) {
  float col = 1.;
  float size = .06* t;
  
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 3; j++) {
      col *= i == 3 && j == 1  ? 1. : rect(p - vec2(i, j) * spacing, size, .01);
    }
  }
  return col;
}

float holes(vec2 p, float t) {
  float col = 1.;
  float size = t * 0.0255;
  float r = 0.01;
  
  float h = 0.25;  // horizontal shift
  float v = 0.25;  // vertical shift
  float v2 = 0.19; // vertical shift for E and S

  // Ctrl
  col *= rect(p - vec2(0.+h, 2.) * spacing, size, r);
  col *= rect(p - vec2(1.-h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(1.+h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(2.+h, 2.-v) * spacing, size, r);
  col *= rect(p - vec2(3.+h, 2.+v) * spacing, size, r);

  // Alt
  col *= rect(p - vec2(0., 1.-v) * spacing, size, r);
  col *= rect(p - vec2(1.+h, 1.+v) * spacing, size, r);
  col *= rect(p - vec2(2.-h, 1.-v) * spacing, size, r);
  col *= rect(p - vec2(2.+h, 1.-v) * spacing, size, r);
  
  // Test
  col *= rect(p - vec2(-h, -v) * spacing, size, r);
  col *= rect(p - vec2(h, -v) * spacing, size, r);

  col *= rect(p - vec2(1.+h, v2) * spacing, size, r);
  col *= rect(p - vec2(1.+h, -v2) * spacing, size, r);

  col *= rect(p - vec2(2.-h, -v2) * spacing, size, r);
  col *= rect(p - vec2(2.+h, v2) * spacing, size, r);

  col *= rect(p - vec2(3.-h, -v) * spacing, size, r);
  col *= rect(p - vec2(3.+h, -v) * spacing, size, r);

  return col;
}

vec3 drawLogo(vec2 uv) {
  if (shouldDrawLogo <= 0.) return vec3(1.);

  uv = uv*0.6 + vec2(0.25, 0.15);
  float t1 = min(shouldDrawLogo*2., 1.);
  float t2 = min(shouldDrawLogo*2.-1., 1.);
  vec3 col = vec3(holes(uv, t2) - base(uv, t1));
  return col;
}

//-----------------

// had some brief spurt of inspiration when looking at this toy
// Simple 7-segment Numbers by Kamoshika https://shadertoy.com/view/ftsSzB
// but code is completely original by spalmer.  hope it's useful!

// returns local (non-Euclidean metric) distance to segment edge
float digit7(vec2 q, int n)
{ // could add a few more 'digit' glyphs for minus sign and decimal point
	const int digitsegs[10] = int[] ( 
		95,10,118,122,43,121,125,26,127,123
		);
	if (n < 0 || n >= digitsegs.length()) return -1.; // just in case, array bound check
	int segs = digitsegs[n];
	const ivec2 segpos[7] = ivec2[] ( 
		  ivec2(-1,1), ivec2(1,1), ivec2(-1,-1), ivec2(1,-1) // 4 vertical segments
		, ivec2(0,2), ivec2(0,0), ivec2(0,-2) // 3 horizontal segments
		// maybe a period TODO
		);
	float d = 1e9;
	for (int i = segpos.length(); i-- > 0; ) {
		if ((segs & (1 << i)) == 0) continue;
		vec2 p = vec2(segpos[i]); //vec2(.0, .0); 
		p *= vec2(.45, .45);
		p = q - p; //p -= q; // doesn't matter
		bool vertical = i < 4;
		//bool period = false;
		//bool minus = false;
		if (vertical) p = p.yx; // rotate some 90degrees
		p = abs(p);
		vec2 w = vec2(.35, .0); //vec2(period ? 0. : .35, 0.); //
		p -= w;
		p = max(p, vec2(0));
		float dx = (p.x + p.y);
		d = min(d, dx);
	}
	d *= sqrt(.5); // correct for metric
	return d - .05; // seg thickness
}

void digits7(inout vec4 o, vec4 c, vec2 q, vec2 R, uint value)
{
	float d = 1e9;
    //value %= 10000u;
	for (int i = 2; i-- > 0; ) {
		d = min(d, digit7(q, int(value%10u)));
		value = value / 10u;
		q.x += 1.25;
	}
	float a = clamp(.5 - .25 * R.y * d, 0., 1.); // antialias edge
    a = mix(a, 1., exp2(-2. * max(0., d)) * .3 * (1. - abs(sin(3.14*iTime)))); // glow effect added 2023-3-11
	o = mix(o, c, a);
}