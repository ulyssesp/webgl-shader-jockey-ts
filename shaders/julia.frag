void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec2 c = vec2(cos(.25 * time), sin(.25 * time * 1.423));

  vec2 z = uv *

  int iter = 10 + int(200.0 * sin(loudness * 3.1415) / 2.0);
  int endi = iter;
  for(int i=0; i<210; i++) {
    if (i > iter) break;

    float x= (z.x * z.x - z.y * z.y) + c.x;
    float y = (z.y * z.x + z.x * z.y) + c.y;

    if ((x * x + y * y) > 4.0) break;
    z.x = x;
    z.y = y;

    endi = i;
  }

  gl_FragColor = vec4(vec3(endi == iter ? 0.0 : float(endi)/float(iter)), 1.0);
}
