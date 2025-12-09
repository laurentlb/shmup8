// Generated with Shader Minifier 1.5.1 (https://github.com/laurentlb/Shader_Minifier/)
#ifndef SHADERS_INL_
# define SHADERS_INL_
# define VAR_fragColor "y"

const char *preprocessed_scene_frag =
 "#version 150\n"
 "out vec4 y;"
 "void main()"
 "{"
   "vec2 A=vec2(1920,1080),l=gl_FragCoord.xy/A.xy;"
   "A=(l*2.-1.)*vec2(1,A.y/A.x);"
   "y.xyz=vec3(.5);"
   "y/=1.+pow(length(A),4.)*.6;"
   "l=vec2(ARR[0],ARR[1])*.1;"
   "y*=smoothstep(.05,.26,length(A-l));"
   "int m=int(ARR[2]);"
   "for(int l=0;l<m;l++)"
     "{"
       "vec2 v=vec2(ARR[3+2*l],ARR[4+2*l])*.5;"
       "y*=smoothstep(.05,.26,length(A-v));"
     "}"
   "m=int(ARR[8]);"
   "for(int l=0;l<m;l++)"
     "{"
       "vec2 v=vec2(ARR[9+2*l],ARR[9+2*l+1])*.1;"
       "y.x*=smoothstep(.05,.06,length(A-v));"
     "}"
 "}";

#endif // SHADERS_INL_
