#version 150
out vec4 fragColor;
#include "shared.h"
vec2 iResolution = vec2(XRES, YRES);
uniform sampler2D tex;

void main(void)
{
    vec2 rcpFrame = 1./iResolution;
    vec2 texcoord = gl_FragCoord.xy * rcpFrame;
    vec2 uv = texcoord;
    vec2 st = texcoord - (rcpFrame * 0.5);
    
    vec4 rgbNW = texture(tex, st);
    vec4 rgbNE = texture(tex, st + vec2(1,0)*rcpFrame.xy);
    vec4 rgbSW = texture(tex, st + vec2(0,1)*rcpFrame.xy);
    vec4 rgbSE = texture(tex, st + rcpFrame.xy);
    vec4 rgbM  = texture(tex, uv);

    vec4 luma = vec4(.299, .587, .114,0);
    float lumaNW = dot(rgbNW, luma);
    float lumaNE = dot(rgbNE, luma);
    float lumaSW = dot(rgbSW, luma);
    float lumaSE = dot(rgbSE, luma);
    float lumaM  = dot(rgbM,  luma);

    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    vec2 dir = vec2( -((lumaNW + lumaNE) - (lumaSW + lumaSE)), ((lumaNW + lumaSW) - (lumaNE + lumaSE)));
    float rcpDirMin = 1.0/(min(abs(dir.x), abs(dir.y)) + (1./128.));
    
    dir = min(vec2( 8.,  8.),
          max(vec2(-8., -8.),
          dir * rcpDirMin)) * rcpFrame.xy;

    vec4 rgbA = (1.0/2.0) * (
        texture(tex, uv + dir * (1.0/3.0 - 0.5)) +
        texture(tex, uv + dir * (2.0/3.0 - 0.5)));
    vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (
        texture(tex, uv + dir * (0.0/3.0 - 0.5)) +
        texture(tex, uv + dir * (3.0/3.0 - 0.5)));
    
    float lumaB = dot(rgbB, luma);

    if((lumaB < lumaMin) || (lumaB > lumaMax))
        fragColor = rgbA;
    else
        fragColor = rgbB;
}