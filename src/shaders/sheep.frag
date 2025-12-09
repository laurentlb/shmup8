const float animationAmpX = 1.;
const float animationAmpY = .2;
const float animationAmpZ = .25;

float sunglasses(vec3 p) {
  if (sceneID != SCENE_MOUTARD) {
    return INF;
  }
  // Frame
  p -= vec3(0, 0.3, -0.9);
  vec3 framePos = p;
  float h;
  float middle = Segment3(p - vec3(0, -0.1, -0.4), vec3(-0.3,0,0), vec3(.3,0,0), h) - 0.04;
  framePos.x = abs(framePos.x) - 0.5;

  float frame = Segment3(framePos, vec3(0.3, 0., -0.), vec3(0.2, -0.1, -0.4), h) - 0.04;
  frame = min(frame, middle);

  // Lenses
  vec3 lensPos = p - vec3(0., -0.25, -0.4);
  lensPos.x = abs(lensPos.x) - 0.4;
  float lens = length(lensPos * vec3(0.3, 0.4, 1.)) - 0.1;

  float sunglasses = min(frame, lens);
  return sunglasses;
}

vec2 sheep(vec3 p, bool shiftPos) {
    const float SCALE = 0.15;

    if (shiftPos) {
      if (sceneID == SCENE_MOUTARD) { // sheep on moto
        p -= motoPos + vec3(0., 1.2, -0.3);
        p.yz *= Rotation(0.5);

        if (wheelie > 0.) { // wheelie
          p.yz *= Rotation(wheelie * 0.4);
          p.yz -= vec2(0.35, 0.2) * wheelie;
        }
      } else {
        p -= vec3(1, .46, sheepPos);
      }
    }
    p /= SCALE;

    float time = mod(iTime, 1.);
    time = smoothstep(0., 1., abs(time * 2. - 1.));
   
    // Body
    float tb = iTime*animationSpeed.x*3.14;
    vec3 bodyMove = vec3(cos(tb),cos(tb*2.)*.1,0.)*.025*animationAmpX;
    float body = length(p*vec3(1.,1.,.825)-vec3(0.,1.5,2.55)-bodyMove)-2.;
    
    if (body >= 3.) {
        return vec2(body * SCALE, WOOL_ID);
    }

    float n = pow(noise((p-bodyMove+vec3(0,0,0.*10.)+vec3(0,0,0.5))*2.)*.5+.5, .75)*2.-1.;
    if (sceneID == SCENE_MOUTARD) {
      n += noise(p-bodyMove+vec3(0,0,-iTime*10.)*2.)*.2;
    }
    body = body + .05 - n*.2;

    // Legs
    float t = mod(iTime*animationSpeed.x,2.);
    float l = smoothstep(0.,.5,t) * smoothstep(1.,.5,t);
    float a = smoothstep(0.,.5,t);
    float b = smoothstep(.5,1.,t);
    float c = smoothstep(1.,1.5,t);
    float d = smoothstep(1.5,2.,t);
    vec4 legsRot = vec4(b * (1.-b), d * (1.-d), a * (1.-a), c * (1.-c));
      
    vec4 legsPos = t*.5 - vec4(b, d, a, c);
    legsPos *= animationAmpX;
    
    vec3 pl = p;
    pl.x -= .8;
    pl.z -= 2. + legsPos.x;
    pl.yz = Rotation(legsRot.x) * pl.yz;
    float legs = cappedCone(pl-vec3(0.,0.,0.), .7, .3, .2);
    float clogs = cappedCone(pl-vec3(0.,-0.8,0.), .2, .35, .3);

    pl = p;
    pl.x += 1.;
    pl.z -= 2. + legsPos.y;
    pl.yz = Rotation(legsRot.y) * pl.yz;
    legs = min(legs, cappedCone(pl-vec3(0.,0.,0.), .7, .3, .2));
    clogs = min(clogs, cappedCone(pl-vec3(0.,-0.8,0.), .2, .35, .3));

    pl = p;
    pl.x -= 1.;
    pl.z -= 4. + legsPos.z;
    pl.yz = Rotation(legsRot.z) * pl.yz;
    legs = min(legs, cappedCone(pl-vec3(0.,0.,0.), .7, .3, .2));
    clogs = min(clogs, cappedCone(pl-vec3(0.,-0.8,0.), .2, .35, .3));

    pl = p;
    pl.x += 1.;
    pl.z -= 4. + legsPos.w;
    pl.yz = Rotation(legsRot.w) * pl.yz;
    legs = min(legs, cappedCone(pl-vec3(0.,0.,0.), .7, .3, .2));
    clogs = min(clogs, cappedCone(pl-vec3(0.,-0.8,0.), .2, .35, .3));

    // Head
    vec3 ph = p + vec3(0., -2., -1.2);
    ph.xz = Rotation((time*animationSpeed.y - 0.5)*0.25*animationAmpY+headRot.x) * ph.xz;
    ph.zy = Rotation(sin(iTime*animationSpeed.y)*0.25*animationAmpY-headRot.y) * ph.zy;

    float head = length(ph-vec3(0.,-1.3,-1.2)) - 1.;
    head = smin(head, length(ph-vec3(0.,0.,0.)) - .5, 1.8);

    float glasses = sunglasses(ph);

    // hair 
    vec3 pp = ph;
    pp *= vec3(.7,1.,.7);
    float hair = length(ph-vec3(0.,0.35,-0.1))-.55;
    hair -= (cos(ph.z*8.+ph.y*4.5+ph.x*4.)+cos(ph.z*4.+ph.y*6.5+ph.x*8.))*.05;
    //hair -= (pow(noise(ph*3.+1.)*.5+.5, .75)*2.-1.)*.1;
    hair = smin(hair, body, 0.1);
    
    // ears
    pp = ph;
    pp.yz = Rotation(-.6) * pp.yz;
    pp.x = abs(p.x)-.8;
    pp *= vec3(.3,1.,.4);
    pp -= vec3(0.,-0.05 - pow(pp.x,2.)*5.,-.1);
    float ears = length(pp)-.15;
    ears = smax(ears, -(length(pp-vec3(0.,-.1,0.))-.12), .01);
    pp.y *= .3;
    pp.y -= -.11;
    float earsClip =  length(pp)-.16;
    
    //eyes
    pp = ph;
    pp.x = abs(ph.x)-.4;
    float eyes = length(pp*vec3(1.)-vec3(0.,0.,-1.)) - .3;

    float eyeCap = abs(eyes)-.02;

    float blink = mix(smoothstep(0.95,0.96,blink)*.3 + cos(iTime*10.)*.02, 0.1, squintEyes);
    eyeCap = smax(eyeCap, smin(-abs(ph.y+ph.z*(.025))+.25-blink, -ph.z-1., .2), .01);
    eyeCap = smin(eyeCap, head, .02);
    head = min(head, eyeCap);

    // nostrils
    pp.x = abs(ph.x)-.2;
    pp.xz = Rotation(-.45) * pp.xz;
    head = smax(head, -length(pp-vec3(-0.7,-1.2,-2.05)) + .14, .1);
    head = smin(head, Torus(pp.xzy-vec3(-0.7,-1.94,-1.2), vec2(.14,.05)), .05);

    float tears;
    if (sheepTears < 0.) {
      tears = INF;
    } else {
      pp = ph;
      pp.x = abs(ph.x)-.25;
      float shift = sheepTears*.02;
      tears = length(pp-vec3(0.,-0.15-shift*0.5,-1.1-shift*1.)) - .01 - shift*.1;
      tears -= pow(noise(pp*10.)*.5+.5, 1.) *.1;
      tears = smin(tears, head+.01, 0.1);
    }

    // tail
    float tail = capsule(p-vec3(0.,-.1,cos(p.y-.7)*.5),vec3(cos(iTime*animationSpeed.z)*animationAmpZ,.2,5.), vec3(0.,2.,4.9), .2);
    tail -= (cos(p.z*8.+p.y*4.5+p.x*4.)+cos(p.z*4.+p.y*6.5+p.x*3.))*.02;
    tail = smin(body, tail, .1);
    
    // Union
    vec2 dmat = vec2( body, WOOL_ID);
    dmat = MinDist(dmat, vec2(tail, WOOL_ID));
    dmat = MinDist(dmat, vec2(hair, WOOL_ID));
    dmat.x = smax(dmat.x, -earsClip, .15);
    dmat = MinDist(dmat, vec2(legs, SKIN_ID));
    dmat = MinDist(dmat, vec2(head, SKIN_ID));
    dmat = MinDist(dmat, vec2(tears, TEARS_ID));
    dmat = MinDist(dmat, vec2(eyes, EYE_ID));
    dmat = MinDist(dmat, vec2(clogs, CLOGS_ID));
    dmat = MinDist(dmat, vec2(ears, SKIN_ID));
    dmat = MinDist(dmat, vec2(glasses, MOTO_DRIVER_HELMET_ID));
    
    headDist = head;
    dmat.x *= SCALE;
    return dmat;
}
