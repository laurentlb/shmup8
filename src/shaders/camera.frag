void motoFaceImpactShot(float t_in_shot) {
        sceneID = SCENE_MOTO;
        float shift = t_in_shot*.1;
        float impact = smoothstep(9.7,10., t_in_shot);
        camPos = vec3(3. - impact - shift*1.2, 0.5, 0.);
        camPos.xz += valueNoise2(500.*t_in_shot)*shift*.1;
        camTa = vec3(0., 1. + shift*.2, 0.);
        camProjectionRatio = 1.5 + impact*5. + shift;

        globalFade *= 1. - impact;
}

void sheepScaredShot(float t_in_shot) {
    animationSpeed *= 0.;
    eyeDir = vec3(0.,-0.1,1.);
    vec2 noise = valueNoise2(100.*t_in_shot)*smoothstep(0., 5., t_in_shot);
    if (t_in_shot > 2.)
        sheepTears = t_in_shot;
    if (t_in_shot >= 5.) {
        noise *= 0.3;
        sheepTears = 4.*(t_in_shot - 4.);
    }

    headRot = vec2(0., -0.1) + noise*.1;
    camPos = vec3(1., 0.9, 6. - t_in_shot*.2);
    camTa = vec3(1., 0.8, 7.);
    sheepPos = 7.;
    camProjectionRatio = 1.5 + t_in_shot*.4;
    pupilSize = 0.2;
}

bool get_shot(inout float time, float duration) {
    if (time < duration) {
        return true;
    }
    time -= duration;
    return false;
}

void selectShot() {
    float time = iTime;
    float verticalBump = valueNoise2(6.*iTime).x;
    blink = max(fract(iTime*.333), fract(iTime*.123+.1));

    if (get_shot(time, 10.)) {
        globalFade *= smoothstep(0., 7., time);

        // intro shot, sheep face
        float motion = time*.1;
        float vshift = smoothstep(6., 0., time);
        camPos = vec3(1., 0.9 + vshift*.5, 6. - motion);
        camTa = vec3(1., 0.8 + vshift*1., 7. - motion);
        sheepPos = 7. - motion;
        camProjectionRatio = 1.5;

        float headShift =
            smoothstep(6., 6.5, time) * smoothstep(9., 8.5, time);
        headRot = vec2(0., 0.4 - headShift*.5);
        eyeDir = vec3(0.,0.1-headShift*0.2,1.);

    } else if (get_shot(time, 5.)) {
        sceneID = SCENE_MOTO;
        camTa = vec3(1., 1., 0.);
        camPos = vec3(-2. - 2.5*time, .5+0.2*time, sin(time));

    } else if (get_shot(time, 5.)) {
        // sheep walking
        float motion = time*.1;
        camPos = vec3(2.5, 0.5, 3. - motion);
        sheepPos = 5. - motion;
        camTa = vec3(0., 1., 4.8 - motion);
        camProjectionRatio = 1.5;
        headRot = vec2(0., 0.2);
        eyeDir = vec3(0.,0.1,1.);

    } else if (get_shot(time, 5.)) { // moto
        sceneID = SCENE_MOTO;
        float xnoise = mix(-1., 1., valueNoise2(0.5*iTime).y) +
            + mix(-0.01, 0.01, valueNoise2(600.*iTime).y);
        float ynoise = 0.05 * verticalBump;
        vec2 p = vec2(0.95 + xnoise, 0.55 + ynoise);
        camPos = vec3(p, -2);
        camTa = vec3(p, 0.);
        camProjectionRatio = 1.5;

    } else if (get_shot(time, 5.)) {
        // shot from back, sheep walking + /!\ warning
        float shift = smoothstep(3.5, 3.8, time)*.5;
        float motion = time*.1;
        camPos = vec3(2.5, 1., 6.);
        sheepPos = 5. - motion;
        panelWarningPos = vec3(4., 0., 2.5);
        camTa = mix(vec3(1,1,5), vec3(1., 1.5, 1), shift*2.);
        headRot = vec2(0., 0.5);

    } else if (get_shot(time, 5.)) {
        sceneID = SCENE_MOTO;
        // moto + sheep sign
        float bump = 0.02 * verticalBump;
        camPos = vec3(-0.2 - 0.3 * time, 0.88 + 0.17*time + bump, 0.42);
        camTa = vec3(0.5, 1. + 0.1 * time + bump, 0.25);
        panelWarningPos = vec3(4, 0., -40.);
        camProjectionRatio = 1.5;

    } else if (get_shot(time, 3.)) {
        // sheep face, looking down
        float shift = smoothstep(0., 5., time) + time*.1;
        headRot = vec2(sin(time*2.)*.2, 0.5);
        eyeDir = vec3(sin(time*2.)*.2,0.3,1.);

        camPos = vec3(1., 0.6, 6. - shift);
        camTa = vec3(1., 0.8, 7.);
        sheepPos = 7. - shift;

    } else if (get_shot(time, 2.)) {
        sceneID = SCENE_MOTO;
        // moto face scary
        camPos = vec3(4. - time*.2, 0.8, 0.);
        camTa = vec3(-10., 0., 0.);
        camProjectionRatio = 1.5 + time*.2;

    } else if (get_shot(time, 5.)) {
        // sheep face looking up

        float motion = time*.1;
        float shift = smoothstep(3.5, 4., time);
        float headShift = smoothstep(2.5, 3., time);
        headRot = vec2(0., 0.4 - headShift*.5);
        eyeDir = vec3(
            .18-smoothstep(4.3, 4.5, time)*.18-smoothstep(3., 1., time)*.4,
            0.1-headShift*0.2,
            1.);
        camPos = vec3(1., 0.9, 6. - shift - motion);
        camTa = vec3(1., 0.8, 7. - motion);
        sheepPos = 7. - motion;
        camProjectionRatio = 1.5 + shift*2.;
        squintEyes = smoothstep(3.3, 3.5, time);

    } else if (get_shot(time, 3.)) {
        sceneID = SCENE_MOTO;
        // moto face scary 2
        float shift = time/10.;
        vec2 noise = valueNoise2(500.*time);
        camPos = vec3(3. - shift*1.2, 0.5, noise.y*.05);
        float shiftLeft = smoothstep(0.5, 0., time);
        float shiftUp = smoothstep(2., 2.5, time);
        camTa = vec3(0., 0.5 + shiftUp*.5, shiftLeft*0.5);
        camProjectionRatio = 2.;

    } else if (get_shot(time, 1.6)) {
        sheepScaredShot(time);
        pupilSize = .1+smoothstep(0., 1., time)*.1;

    } else if (get_shot(time, 1.4)) {
        motoFaceImpactShot(time);

    } else if (get_shot(time, 1.4)) {
        sheepScaredShot(time+1.5);
        // shake head
        blink = time*2.;
        headRot += vec2(sin(time*40.)*.15, -0.1+time*.5);

    } else if (get_shot(time, 1.4)) {
        motoFaceImpactShot(time+3.);
        lightFalloff /= 3.;

    } else if (get_shot(time, 1.6)) {
        sheepScaredShot(time+3.4);

    } else if (get_shot(time, 1.)) {
        motoFaceImpactShot(time+5.);
        lightFalloff /= 9.;

    } else if (get_shot(time, 1.6)) {
        sheepScaredShot(time+5.);
        camProjectionRatio++;
        //camProjectionRatio = 5.5;
        blink = 1.6 - time;

    } else if (get_shot(time, 2.)) {
        motoFaceImpactShot(time+8.);
        lightFalloff /= 30.;
        // boom!

    } else if (get_shot(time, 10.)) {
        sceneID = SCENE_BLOOD;
        globalFade *= smoothstep(2., 5., time)
            	* smoothstep(9., 7., time);

        // looking at ground
        camPos = vec3(2.5, 1.5, -6. + time*.5);
        camTa = vec3(1., 0., -9. + time*.5);


    } else if (get_shot(time, 5.)) {
        sceneID = SCENE_MOUTARD;
        globalFade *= smoothstep(0., 1., time);
        float xnoise = mix(-1., 1., valueNoise2(0.5*time).y)
                + mix(-0.01, 0.01, valueNoise2(600.*time).y);
        float ynoise = 0.05 * verticalBump;
        vec2 p = vec2(0.95 + xnoise, 0.5 + ynoise);
        camPos = vec3(p, -1.5);
        camTa = vec3(p.x, p.y - 0.4, 0.);
        camProjectionRatio = 1.2;

    } else if (get_shot(time, 5.)) {
        sceneID = SCENE_MOUTARD;
        // sheep driving
        float trans = smoothstep(3., 0., time);
        camTa = vec3(3., 1. - trans*.8, 0.);
        camPos = vec3(5. - 0.1*time, 1. + 0.02 * verticalBump, 0.);
        headRot = vec2(0., 0.3);
        camProjectionRatio = 2. - smoothstep(0., 6., time);
        camProjectionRatio = 3. - time/5.;

    } else if (get_shot(time, 10.)) {
        sceneID = SCENE_MOUTARD;
        // sheep driving + wheelie
        vec3 shift = mix(vec3(0), vec3(-3.5, 0, -3.5), smoothstep(7, 9, time));
        wheelie = smoothstep(4.2, 4.6, time)*(1+sin(time*2.)*.2);

        camTa = vec3(0., 1. - wheelie*.2, 0) + shift;
        camPos = vec3(5. - 0.1*time, 0.4-0.3*wheelie, -1.-0.4*time) + shift;
        headRot = vec2(0., 0.6);
        camProjectionRatio = 2.;
        camTa.xy += valueNoise2(500.*time)*.01;

        globalFade *= smoothstep(10., 8., time);

    } else {
        sceneID = SCENE_MOUTARD;
        camTa = vec3(0., 1., .7);
        camPos = vec3(4. - 0.1*time, 1., -3.-0.5*time);
        headRot = vec2(0., 0.3);
        camProjectionRatio = 3.;

        shouldDrawLogo = smoothstep(0., 1., time) * smoothstep(15., 9., time);
        globalFade = float(time < 15.);
    }

    if (sceneID == SCENE_MOUTARD) {
        headRot.y += abs(sin(iTime*4.)*.1);
        animationSpeed = vec3(0.);
    }

    float shotStartTime = iTime - time;

    // Use mix to skip the beginning/end of the road.
    float t = mod(shotStartTime, 14.)
        + (iTime - shotStartTime);
    if (sceneID == SCENE_SHEEP || sceneID == SCENE_BLOOD) {
        t = 0.;
    }

    motoPos = vec3(0, 0.3 + 0.43 * wheelie, 300. - 50.*t);
    motoPos.xz += 0.5*sin(iTime);
}
