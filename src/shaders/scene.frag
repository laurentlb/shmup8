#version 150

const float INF = 1e6;
#include "shared.h"

out vec4 fragColor;
uniform float ARR[200];

#include "common.frag"

void main()
{
    vec2 iResolution = vec2(XRES, YRES);
    vec2 texCoord = gl_FragCoord.xy/iResolution.xy;
    vec2 uv = (texCoord * 2. - 1.) * vec2(1., iResolution.y / iResolution.x);

    fragColor.rgb = vec3(0.5);

    fragColor /= 1.+pow(length(uv),4.)*0.6;

    // fragColor += ARR[0] * 0.1;

    vec2 pos = vec2(ARR[0], ARR[1]);
    fragColor *= smoothstep(0.05, 0.06, length(uv - pos));

    int n = int(ARR[2]);
    for (int i = 0; i < n; i++) {
        vec2 pos2 = vec2(ARR[3 + 2*i], ARR[4 + 2*i]) * 0.5;
        fragColor *= smoothstep(0.03, 0.04, length(uv - pos2));
    }

   

   /*
   {
        int i = 6; // int(ARR[8]) - 1;
        vec2 pos2 = vec2(ARR[9 + 2*i], ARR[9 + 2*i + 1]) * 0.2;
        fragColor.r *= smoothstep(0.05, 0.06, length(uv - pos2));
   }
    vec2 pos2 = vec2(ARR[8], ARR[9]) * 0.1;
    fragColor.b *= smoothstep(0.05, 0.06, length(uv - pos2));
    */

    int nMis = int(ARR[8]);
    for (int i = 0; i < nMis; i++) {
        vec2 pos2 = vec2(ARR[9 + 2*i], ARR[9 + 2*i + 1]);
        fragColor.r *= smoothstep(0.02,  0.03, length(uv - pos2));
    }
    // fragColor.b = 0.5;

}
