vec2 sceneSDF(vec3 p)
{
    return MinDist(MinDist(MinDist(MinDist(MinDist(MinDist(
        motoShape(p),
        driverShape(p)),
        terrainShape(p)),
        treesShape(p)),
        blood(p)),
        panelWarning(p)),
        sheep(p, true));
}

float fastAO(vec3 pos, vec3 nor, float maxDist, float falloff) {
    float i_occ1 = .5*maxDist - sceneSDF(pos + nor*maxDist *.5).x;
    float i_occ2 = .95*(maxDist - sceneSDF(pos + nor*maxDist).x);
    return clamp(1. - falloff*1.5*(i_occ1 + i_occ2), 0., 1.);
}

float shadow(vec3 ro, vec3 rd)
{
    float res = 1.0;
    float t = 0.08;
    for(int i = 0; i < 64; i++)
    {
        float h = sceneSDF(ro + rd*t).x;
        res = min(res, 10.*h / t);
        t += h;
        
        if(res < 0.0001 || t > 40.) break;
        
    }
    return clamp( res, 0.0, 1.0 );
}

vec3 sky(vec3 V, vec3 fogColor)
{
    float cloud = noise(V/(0.05 + V.y));
    cloud = pow(smoothstep(0.5, 0.51, cloud+1.), 0.2);
    cloud = mix(1., cloud, 0.2);

    return 
        mix(
            fogColor,
            mix(vec3(0.7, 0.7, 0.7), vec3(0.2, 0.2, 0.6), cloud),
            pow(smoothstep(0., 1., V.y), 0.4));
}

float trace(vec3 ro, vec3 rd) {
    float t = 0.1;
    for(int i = 0; i < MAX_RAY_MARCH_STEPS; i++) {
        float d = sceneSDF(ro + rd*t).x;
        t += d;
        if (t > MAX_RAY_MARCH_DIST || abs(d) < 0.001) break;
    }
    
    return t;
}

// Specular light effect for the eyes envmap.
float specular(vec3 v, vec3 l, float size)
{
    float spe = max(dot(v, normalize(l + v)), 0.);
    float a = 2000./size;
    float b = 3./size;
    return (pow(spe, a)*(a+2.) + pow(spe, b)*(b+2.)*2.)*0.008;
}

vec3 rayMarchScene(vec3 ro, vec3 rd)
{
    // Trace : intersection point + normal
    float t = trace(ro, rd);
    vec3 p = ro + rd * t;

    vec2 dmat = sceneSDF(p);
    vec2 eps = vec2(0.0001,0.0);
    vec3 n = normalize(vec3(dmat.x - sceneSDF(p - eps.xyy).x, dmat.x - sceneSDF(p - eps.yxy).x, dmat.x - sceneSDF(p - eps.yyx).x));

    // ----------------------------------------------------------------
    // Shade
    // ----------------------------------------------------------------
    vec3 sunDir = normalize(vec3(3.5,3.,-1.));
    vec3 fogColor = vec3(0.3,0.5,0.6);
    vec3 skyColor = sky(rd, fogColor);

    float ao = fastAO(p, n, .15, 1.) * fastAO(p, n, 1., .1)*.5;
    float material = dmat.y;
    
    float shad =
        (material == SKIN_ID || material == TEARS_ID) ?
        1.0 : shadow(p, sunDir);
    float fre = 1.0+dot(rd,n);
    
    vec3 diff = vec3(1.,.8,.7) * max(dot(n,sunDir), 0.) * pow(vec3(shad), vec3(1.,1.2,1.5));
    vec3 bnc = vec3(1.,.8,.7)*.1 * max(dot(n,-sunDir), 0.) * ao;
    vec3 sss = vec3(.5) * mix(fastAO(p, rd, .3, .75), fastAO(p, sunDir, .3, .75), 0.5);
    vec3 spe = vec3(1.) * max(dot(reflect(rd,n), sunDir),0.);
    vec3 envm = vec3(0.);
    
    //sss = vec3(1.) * calcSSS(p,rd);
    vec3 amb = vec3(.4,.45,.5)*1. * ao;
    vec3 emi = vec3(0.);
    
    vec3 albedo = vec3(0.);
    if (t >= MAX_RAY_MARCH_DIST) {
        return skyColor;
    }

    if (material-- == 0.) { // MOTO_ID
        albedo *= 0.;
        spe *= pow(spe, vec3(80.))*fre*15.;
        sss *= 0.;
    } else if (material-- == 0.) { // MOTO_WHEEL_ID
        albedo = vec3(.01);
        spe *= 0.02;
        sss *= 0.;
    } else if (material-- == 0.) { // TREE_ID
        albedo = vec3(.2, .3, .2);
        sss *= 0.2;
        spe *= 0.;
    } else if(material-- == 0.) { // GROUND_ID
        const float laneWidth = 3.5;
        if (abs(p.x) < laneWidth) { // road
            vec2 laneUV = p.xz / laneWidth;
            float tireTrails = sin((laneUV.x+0.2) * 7.85) * 0.5 + 0.5;
            tireTrails = mix(tireTrails, smoothstep(0., 1., tireTrails), 0.25);
            float highFreqNoise = noise(vec3(laneUV * vec2(50., 2),0));
            tireTrails = mix(tireTrails, highFreqNoise, 0.2) * .3;
            vec3 color = vec3(mix(vec3(0.2,0.2,0.3), vec3(0.3,0.4,0.5), tireTrails));

            sss *= 0.;
            albedo = color;
            spe *= mix(0., 0.1, tireTrails);
        } else { // grass
            sss *= 0.3;
            albedo = vec3(.2, .3, .2);
            spe *= 0.;
        }
    } else if (material-- == 0.) { // WOOL_ID
        albedo = vec3(.4);
        sss *= fre*.5+.5;
        emi = vec3(.35);
        spe = pow(spe, vec3(4.))*fre*.25;
    } else if (material-- == 0.) { // SKIN_ID
        albedo = vec3(1.,.7,.5)*1.;
        amb *= vec3(1.,.75,.75);
        sss = pow(sss, vec3(.5,2.5,4.0)+2.)*3.;
        spe = pow(spe, vec3(4.))*fre*.02;
    } else if (material-- == 0.) { // EYE_ID
        sss *= .5;
        vec3 dir = normalize(eyeDir + (noise(vec3(iTime,iTime*.5,iTime*1.5))*2.-1.)*.01);
        
        // compute eye space -> mat3(eyeDir, t, b)
        vec3 t = cross(dir, vec3(0.,1.,0.));
        vec3 b = cross(dir,t);
        t = cross(b, dir);
        
        vec3 ne = n.z * dir + n.x * t + n.y * b;
        
        // parallax mapping
        vec3 v = rd.z * eyeDir + rd.x * t + rd.y * b;
        vec2 offset = v.xy / v.z * length(ne.xy) / length(ro-p) * .4;
        ne.xy -= offset * smoothstep(0.01,.0, dot(ne,rd));
        
        const float i_irisSize = .3;
        
        // polar coordinate
        float er = length(ne.xy);
        float theta = atan(ne.x, ne.y);
        
        // iris
        vec3 c = mix(vec3(.5,.3,.1) , vec3(.0,.8,1), smoothstep(0.16,i_irisSize,er)*.3+cos(theta*15.)*.04);
        float filaments = smoothstep(-.9,1.,noise(vec3(er*10.,theta*30.+cos(er*50.+noise(vec3(theta))*50.)*1.,0.)))
            + smoothstep(-.9,1.,noise(vec3(er*10.,theta*40.+cos(er*30.+noise(vec3(theta))*50.)*2.,0.)));
        float pupil = smoothstep(pupilSize,pupilSize+0.02, er);
        albedo = c * (filaments*.5+.5) * (smoothstep(i_irisSize,i_irisSize-.01, er)); // brown to green
        albedo *= vec3(1.,.8,.7) * pow(max(0.,dot(normalize(vec3(3.,1.,-1.)), ne)),8.)*300.+.5; // retro reflection
        albedo *= pupil; // pupil
        albedo += pow(spe,vec3(800.))*3; // specular light
        albedo = mix(albedo, vec3(.8), smoothstep(i_irisSize-0.01,i_irisSize, er)); // white eye
        albedo = mix(c*.3, albedo, smoothstep(0.0,0.05, abs(er-i_irisSize-0.0)+0.01)); // black edge
        
        // fake envmap reflection
        n = mix(normalize(n + (eyeDir + n)*4.), n, smoothstep(i_irisSize,i_irisSize+0.02, er));

        v = reflect(rd, n);
        vec3 l1 = normalize(vec3(1., 1.5, -1.));
        vec3 l2 = vec3(-l1.x, l1.y*.5, l1.z);
        float spot =
            + specular(v, l1, .1)
            + specular(v, l2, 2.) * .1
            + specular(v, normalize(l1 + vec3(0.2, 0., 0.)), .3)
            + specular(v, normalize(l1 + vec3(0.2, 0., 0.2)), .5)
            + specular(v, normalize(l2 + vec3(0.1, 0., 0.2)), 8.) * .5;

        envm = (mix(
            mix(vec3(.3,.3,0.), vec3(.1), smoothstep(-.7, .2, v.y)),
            vec3(0.3, 0.65, 1.), smoothstep(-.0, 1., v.y)) + spot * vec3(1., 0.9, .8)) * mix(.15, .2, pupil) *sqrt(fre)*2.5;
        
        // shadow on the edges of the eyes
        sceneSDF(p);
        albedo *= smoothstep(0.,0.015, headDist)*.4+.6;
        spe *= 0.;
    } else if (material-- == 0.) { // CLOGS_ID
        albedo = vec3(.025);
        sss *= 0.;
        spe = pow(spe, vec3(15.))*fre*10.;
    } else if(material-- == 0.) { // METAL_ID - for the road signs
        albedo = vec3(.6);
        sss *= 0.;
        spe = pow(spe, vec3(8.))*fre*2.;
    }  else if(material-- == 0.) { // BLOOD_ID
        albedo = vec3(1.,.01,.01)*.3;
        diff *= vec3(3.);
        amb *= vec3(2.)*fre*fre;
        sss *= 0.;
        spe = vec3(1.,.3,.3) * pow(spe, vec3(500.))*5.;
    } else if (material-- == 0.) { // PANEL_ID
       vec3 p = p - panelWarningPos;
        sss *= 0.;
        spe = pow(spe, vec3(8.))*fre*20.;

        if (n.z > .5) {
            vec3 pp = p - vec3(-0.3,warningHeight - 0.25,0.);

            float symbol;
            if (sceneID==SCENE_MOTO) {
                pp.xy *= 0.9;
                float dist = 5.;
                headRot = vec2(0., -0.3);
                animationSpeed = vec3(0);
                for (float x = -0.2; x <= 0.2; x += 0.08) {
                    vec3 point = vec3(x, pp.y, pp.x);
                    point.xz *= Rotation(0.1);
                    dist = min(dist, sheep(point, false).x);
                }
                symbol = 1. - smoothstep(0.001, 0.01, dist);
            } else {
                symbol = smoothstep(0.13,0.1295, distance(p, vec3(0.,warningHeight-.45,-4.9)));
                symbol += smoothstep(0.005,0.,UnevenCapsule2d(p.xy-vec2(0.,warningHeight-0.15), .06,.14,0.8));
            }
            float tri = Triangle(p-vec3(0.,warningHeight,-5.), vec2(1.3,.2), .01);
            albedo = vec3(1.5,0.,0.);
            albedo = mix(albedo, vec3(2.), smoothstep(0.005,.0, tri));
            albedo = mix(albedo, vec3(0.), symbol);
        } else {
            albedo = vec3(.85,.95,1.);
        }
    } else if (material-- == 0.) { // TEARS_ID
        albedo = vec3(1., .8, .65);
        amb *= vec3(1.0, 0.85, 0.85);
        sss = pow(sss, vec3(0.8, 1.8, 3.0) + 2.) * 2.;
        spe = pow(spe, vec3(32.0)) * fre * fre * 40.;
    }

    // fog
    vec3 radiance = albedo * (amb*1. + diff*.5 + bnc*2. + sss*2. ) + envm + spe + emi;
    float fogAmount = 1.0 - exp(-t*0.005);
    vec3 col = mix(radiance, fogColor, fogAmount);

    return col;
}
