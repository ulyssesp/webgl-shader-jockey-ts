uniform vec2 resolution;
uniform float time;
uniform float loudness;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  vec2 z, c;
  c.x = 1.333333 * (uv.x - 0.5) * 2.5  - 0.5;
  c.y = (uv.y - 0.5) * 2.5;

  z = c;
  float restrictedLoudness = 1.0 - (loudness * loudness);
  int iter = 10 + int(100.0 * sin(restrictedLoudness * 3.1415));
  int endi = iter;
  for(int i=0; i<=110; i++) {
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
