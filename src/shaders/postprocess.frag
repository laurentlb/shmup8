#version 150
out vec4 fragColor;
#include "shared.h"
vec2 iResolution = vec2(XRES, YRES);
uniform sampler2D tex;

void main(void)
{
    vec2 uv = gl_FragCoord.xy/iResolution;
    fragColor = 1-(1-texture(tex, uv))*(1-textureLod(tex,uv,7))*(1-textureLod(tex,1-uv,5)*.2);
    fragColor *= max(1-pow(length(uv-.5),1.5)*1.5,0);
}