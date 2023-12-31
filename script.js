/*********
 * made by Matthias Hurrle (@atzedent)
 */

/** @type {HTMLCanvasElement} */
const canvas = window.canvas
const gl = canvas.getContext('webgl')
const dpr = window.devicePixelRatio

const vertexSource = `
 #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
 
  attribute vec2 position;
 
  void main(void)
  {
    gl_Position = vec4(position, 0., 1.);
  }
`
const fragmentSource = `
/*********
 * made by Matthias Hurrle (@atzedent)
 */

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 resolution;
uniform float time;
uniform vec2 pointers[10];

#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST .001

#define T time * .25
#define mouse pointers[0]

mat2 Rot(float a) {
	float s = sin(a), c = cos(a);
  
	return mat2(c, -s, s, c);
}

float sdBoxFrame(vec3 p, vec3 b, float e, float r) {
       p = abs(p  ) - b;
  vec3 q = abs(p+e) - e;
  
  return min(min(
      length(
      	max(vec3(p.x, q.y, q.z), .0)) +
      	min(max(p.x, max(q.y, q.z)), .0) - r,
      length(
      	max(vec3(q.x, p.y, q.z), .0)) +
      	min(max(q.x, max(p.y, q.z)), .0) - r),
      length(
      	max(vec3(q.x, q.y, p.z), .0)) +
      	min(max(q.x, max(q.y, p.z)), .0) - r);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
	vec3 q = abs(p) - b;

	return length(
		max(q, .0)) +
		min(max(q.x, max(q.y, q.z)), .0)
		- r;
}

float sdOctahedron( vec3 p, float s) {
  p = abs(p);

  return (p.x + p.y + p.z - s) * .57735027;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
    
  return length(q) - t.y;
}

float sdSphere(vec3 p, float s) {
	return length(p) - s;
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(.5 + .5 * (d2 - d1) / k, .0, 1.);
    
  return mix(d2, d1, h) - k * h * (1. - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
  float h = clamp(.5 - .5 * (d2 + d1) / k, .0, 1.);
    
  return mix(d2, -d1, h) + k * h * (1. - h);
}

float opSmoothIntersection(float d1, float d2, float k) {
  float h = clamp(.5 - .5 * (d2 - d1) / k, .0, 1.);
    
  return mix(d2, d1, h) + k * h * (1. -h );
}

float opRep(in vec3 p, in vec3 c) {
	vec3 q = mod(p + .5 * c, c) - .5 * c;

    // Distribute different shapes on different axis.
    float fac = 2.;
    if (p.x < fac && p.y < fac) return opSmoothIntersection(sdTorus(q, vec2(1., .75)), sdSphere(q, 1.),  .05);
    if (p.x > fac && p.y < fac) return sdRoundBox(q, vec3(1.), .05);
    if (p.x < fac && p.y > fac) return opSmoothSubtraction(sdRoundBox(q, vec3(.5), .05), sdOctahedron(q, 1.25), .05);
    if (p.x > fac && p.y > fac) return sdTorus(q, vec2(1., .5));
	else return sdSphere(q, 1.);
  
  // Or just try a different SDF or boolean operation on all axis.
  //return 
		//sdSphere(q, 1.);
    //sdTorus(q, vec2(1., .5));
		//sdOctahedron(q, 1.);
    //sdRoundBox(q, vec3(.5), .05);
    //sdBoxFrame(q, vec3(1.), .25, .05);
    //opSmoothIntersection(sdBoxFrame(q, vec3(1.), .25, .125), sdSphere(q, 1.5), .05);
    //opSmoothUnion(sdSphere(q, .75), sdOctahedron(q, 1.), .05);
    //opSmoothSubtraction(sdRoundBox(q, vec3(.5), .05), sdOctahedron(q, 1.25), .05);
    //opSmoothIntersection(sdTorus(q, vec2(1., .75)), sdSphere(q, 1.),  .05);
}
	
float GetDist(vec3 p) {
  // Adjust the grid with a distance factor for each axis.
  // Higher values result in a less dense grid.
  vec3 spread = vec3(14. + 2. * (.5 + .5 * -cos(T)));
  float d = opRep(p, spread);

	return d; 		
}

float RayMarch(vec3 ro, vec3 rd) {
	float dO = .0;
	for(int i = 0; i < MAX_STEPS; i++) {
		vec3 p = ro + rd*dO;

		float dS = GetDist(p);
		
		dO += dS;

		if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
	}

	return dO;
}

vec3 GetNormal(vec3 p) {
	float d = GetDist(p);

	vec2 e = vec2(SURF_DIST, 0.);

	vec3 n = d - vec3(
		GetDist(p-e.xyy),
		GetDist(p-e.yxy),
		GetDist(p-e.yyx));

	return normalize(n);
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
	vec3 
	f = normalize(l - p),
	r = normalize(cross(vec3(.0, 1., .0), f)),
	u = cross(f, r),
	c = f * z,
	i = c + uv.x * r + uv.y * u,

	d = normalize(i);
  
	return d;
}

vec3 Render(inout vec3 ro, inout vec3 rd) {
	float d = RayMarch(ro, rd);

	vec3 col = vec3(.0);

	if(d < MAX_DIST) {
		vec3 p = ro + rd * d;
		vec3 n = GetNormal(p);
		vec3 r = reflect(rd, n);

		float diffuse = dot(
			n,
			vec3(.0)
		) * .5 + .5;

		vec3 light = normalize(r);
		float spot = clamp(
			dot(light, reflect(n, vec3(.0, .1, .0))),
			.0,
			1.
		);

    // by increasing the diffuse factor the scene gets brighter
		col = vec3(.1 * diffuse);
    // increase exponent to get a more focussed spot
		col += vec3(pow(spot, 16.));

		ro = p + n * SURF_DIST * 3.;
		rd = r;
  }

  // dim the object according to its distance
	return col * (1. - mix(.0, .01, d));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float mn = min(resolution.x, resolution.y);
  float mx = max(resolution.x, resolution.y);
	vec2 uv = (
		2. * fragCoord.xy - resolution.xy
	) / mix(mn, mx, .5 + .5 * sin(T));
	uv *= .5;

	vec2 m = mouse.xy / resolution.xy;

	vec3 ro = vec3(0., 3., -6.);
	ro.yz *= Rot(mouse.x > .0 ? -m.y * 3.14159 + 1. : cos(T));
	ro.xz *= Rot(mouse.x > .0 ? -m.x * 6.28318 : sin(T));

	vec3 rd = GetRayDir(uv, ro, vec3(.0), 1.);

	vec3 col = Render(ro, rd);
	vec3 bounce = Render(ro, rd);

	col += bounce;

	// gamma correction
	col = pow(col, vec3(.4545));

	// sun specular
	vec3 light = normalize(rd);
	vec3 sunlight = vec3(1., .95, .9);
	float sun = clamp(
		dot(light, reflect(rd, vec3(.0, 1., .0))),
		.0,
		1.
	);

  // higher exponent results in more haze 
	col += .2 * sunlight * pow(sun, 4.);
	col += .5 * sunlight * pow(sun, 64.);

	fragColor = vec4(
		vec3(1., .0, .95) - (1. - col),
		1.
	);	  	
}

void main() {
	vec4 fragment_color;
	
	mainImage(fragment_color, gl_FragCoord.xy);
 
	gl_FragColor = fragment_color;
}
`
const mouse = {
  /** @type {[number,number][]} */
  points: [],
  clear: function () {
    this.points = []
  },
  /** @param {[number,number]} point */
  add: function (point) {
    this.points.push(point)
  }
}

let time;
let buffer;
let program;
let resolution;
let pointers;
let vertices = []
let touches = [0, 0]

function resize() {
  const {
    innerWidth: width,
    innerHeight: height
  } = window

  canvas.width = width * dpr
  canvas.height = height * dpr

  gl.viewport(0, 0, width * dpr, height * dpr)
}

function compile(shader, source) {
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
  }
}

function setup() {
  const vs = gl.createShader(gl.VERTEX_SHADER)
  const fs = gl.createShader(gl.FRAGMENT_SHADER)

  program = gl.createProgram()

  compile(vs, vertexSource)
  compile(fs, fragmentSource)

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program))
  }

  vertices = [
    -1.0, -1.0,
    1.0, -1.0,
    -1.0, 1.0,
    -1.0, 1.0,
    1.0, -1.0,
    1.0, 1.0
  ]

  buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

  const position = gl.getAttribLocation(program, "position")

  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  time = gl.getUniformLocation(program, "time")
  resolution = gl.getUniformLocation(program, 'resolution')
  pointers = gl.getUniformLocation(program, 'pointers')
}

function draw(now) {
  gl.clearColor(0, 0, 0, 1.)
  gl.clear(gl.COLOR_BUFFER_BIT)

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

  gl.uniform1f(time, (now / 1000))
  gl.uniform2f(
    resolution,
    canvas.width,
    canvas.height
  )
  gl.uniform2fv(pointers, touches);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length * .5)
}

function loop(now) {
  draw(now)

  requestAnimationFrame(loop)
}

function init() {
  setup()
  resize()
  loop(0)
}

function clearTouches() {
  for (let i = 0; i < touches.length; i++) {
    touches[i] = .0
  }
}

/** @param {TouchEvent} e */
function handleTouch(e) {
  const { height } = canvas

  clearTouches()

  let i = 0
  for (let touch of e.touches) {
    const { clientX: x, clientY: y } = touch

    touches[i++] = x * dpr
    touches[i++] = height - y * dpr
  }
}

/** @param {{ clientX: number, clientY: number }[]} other */
function mergeMouse(other) {
  return [
    ...mouse.points.map(([clientX, clientY]) => { return { clientX, clientY } }),
    ...other]
}

init()

canvas.ontouchstart = handleTouch
canvas.ontouchmove = handleTouch
canvas.ontouchend = clearTouches

window.onresize = resize

function handleMouseMove(e) {
  handleTouch({
      touches: mergeMouse([{ clientX: e.clientX, clientY: e.clientY }])
    })
}

function handleMouseDown() {
  canvas.addEventListener("mousemove", handleMouseMove)
}

function handleMouseUp() {
  canvas.removeEventListener("mousemove", handleMouseMove)
  
  clearTouches()
  handleTouch({ touches: mergeMouse([]) })
}

if (!window.matchMedia("(pointer: coarse)").matches) {
  canvas.addEventListener("mousedown", handleMouseDown)
  canvas.addEventListener("mouseup", handleMouseUp)
}