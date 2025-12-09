#version 150

const float INF = 1e6;
// Include begin: shared.h
// --------------------------------------------------------------------

const int XRES = 1920;
const int YRES = 1080;
const int DEMO_LENGTH_IN_S = (60 + 47);
// --------------------------------------------------------------------
// Include end: shared.h


out vec4 fragColor;
uniform float ARR[200];

#define TIME ARR[0]
uniform sampler2D tex;

// Include begin: common.frag
// --------------------------------------------------------------------




float hash11(float x) { return fract(sin(x) * 43758.5453); }
float hash21(vec2 xy) { return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453); }
float hash31(vec3 xyz) { return hash21(vec2(hash21(xyz.xy), xyz.z)); }
vec2 hash22(vec2 xy) { return fract(sin(vec2(dot(xy, vec2(127.1,311.7)), dot(xy, vec2(269.5,183.3)))) * 43758.5453); }
vec2 hash12(float x) { float h = hash11(x); return vec2(h, hash11(h)); }


float noise(vec3 x) {

    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(mix(mix( hash31(i+vec3(0,0,0)), 
                        hash31(i+vec3(1,0,0)),f.x),
                   mix( hash31(i+vec3(0,1,0)), 
                        hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash31(i+vec3(0,0,1)), 
                        hash31(i+vec3(1,0,1)),f.x),
                   mix( hash31(i+vec3(0,1,1)), 
                        hash31(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;
}




float smin(float d1, float d2, float k)
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float cappedCone(vec3 p, float h, float r1, float r2)
{
  vec2 q = vec2( length(p.xz), p.y );
  vec2 k1 = vec2(r2,h);
  vec2 k2 = vec2(r2-r1,2.0*h);
  vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
  vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot(k2,k2), 0.0, 1.0 );
  float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
  return s*sqrt( min(dot(ca,ca),dot(cb,cb)) );
}

float smax(float a, float b, float k)
{
    k *= 1.4;
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*h/(6.0*k*k);
}

float Box3(vec3 p, vec3 size, float corner)
{
   p = abs(p) - size + corner;
   return length(max(p, 0.)) + min(max(max(p.x, p.y), p.z), 0.) - corner;
}

float Ellipsoid(in vec3 p, in vec3 r)
{
    float k0 = length(p / r);
    float k1 = length(p / (r*r));
    return k0 * (k0-1.0) / k1;
}

float Segment3(vec3 p, vec3 a, vec3 b, out float h)
{
	vec3 ap = p - a;
	vec3 ab = b - a;
	h = clamp(dot(ap, ab) / dot(ab, ab), 0., 1.);
	return length(ap - ab * h);
}


float capsule(vec3 p, vec3 a, vec3 b, float r)
{
  vec3 pa = p - a, ba = b - a;
  return length( pa - ba*clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 ) ) - r;
}

float Capsule(vec3 p, float h, float r)
{
    p.y += clamp(-p.y, 0., h);
    return length(p) - r;
}

float Torus(vec3 p, vec2 t)
{
    return length(vec2(length(p.xz) - t.x,p.y)) - t.y;
}

mat2 Rotation(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, s, -s, c);
}

float Triangle(vec3 p, vec2 h, float r)
{
  return max(
        abs(p.z) - h.y,
        smax(smax(p.x*0.9 + p.y*0.5, -p.x*0.9 + p.y*0.5, r),-p.y,r) - h.x*0.5);
}

float UnevenCapsule2d( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return length(p) - r1;
    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b) ) - r1;
}






vec2 MinDist(vec2 d1, vec2 d2)
{
    return d1.x < d2.x ? d1 : d2;
}
// --------------------------------------------------------------------
// Include end: common.frag



vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d)
{
    return a + b*cos(6.28318*(c*t+d));
}

vec3 palette(float t) {
  return pal(t, vec3(0.2),vec3(0.2),vec3(0.2),vec3(0.2,0.20,0.90));
  
}

float fbm(vec2 p) {
    return noise(p.xyx) * 0.5 + 0.5;
}

float fbm1d(float v_p)
{
      float pvpx = 2.0*v_p;
      vec2 V1 = vec2(0.5*floor(pvpx      ));
      vec2 V2 = vec2(0.5*floor(pvpx + 1.0));
      return mix(hash21(V1),hash21(V2),smoothstep(0.0,1.0,fract(pvpx)));
}

vec3 background(vec2 uv) {
    vec3 col = vec3(0);
    
    vec2 p = uv*5.;
    vec2 b;
    float cloud1 = fbm(uv*2. + vec2(0., ARR[3]*1.));
    vec3 c1 = cloud1 * palette(0.5);
    float cloud2 = fbm(uv*1.4 + vec2(10));
    vec3 c2 = cloud2 * palette(0.0);
    vec3 cloudCol = mix(c1, c2, 0.5);
    return cloudCol;
}

void main()
{
    vec2 iResolution = vec2(XRES, YRES);
    vec2 texCoord = gl_FragCoord.xy/iResolution.xy;
    vec2 uv = (texCoord * 2. - 1.) * vec2(1., iResolution.y / iResolution.x);

    fragColor.rgb = vec3(0.5);

    fragColor /= 1.+pow(length(uv),4.)*0.6;

    

    vec2 pos = vec2(ARR[0], ARR[1]);
    fragColor.rgb = background(uv);

    {
        float mask = smoothstep(0.05, 0.06, length(uv - pos));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,1), 1.0 - mask);
    }

    int n = int(ARR[2]);
    for (int i = 0; i < n; i++) {
        vec2 pos2 = vec2(ARR[3 + 2*i], ARR[4 + 2*i]) * 0.5;
        float mask = smoothstep(0.03, 0.04, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,0), 1.0 - mask);
    }


    

    int nMis = int(ARR[8]);
    for (int i = 0; i < nMis; i++) {
        vec2 pos2 = vec2(ARR[9 + 2*i], ARR[9 + 2*i + 1]);
        float mask = smoothstep(0.02,  0.03, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(1,0,0), 1.0 - mask);
    }
    

    float coef = hash21(uv + vec2(ARR[3])) * 0.8;
    texCoord += (vec2(hash21(uv+vec2(1)), hash21(uv+vec2(2))) * 2. - 1.)*0.001;
    fragColor.rgb = mix(fragColor.rgb, texture(tex, texCoord).rgb, coef);
}
