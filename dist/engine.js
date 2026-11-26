"use strict";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const rgbCache = new Map();

function color(value, factor = 1) {
  if (Array.isArray(value)) return value.map(channel => Math.min(1, channel * factor));
  if (!rgbCache.has(value)) {
    const number = Number.parseInt(value.replace("#", ""), 16);
    rgbCache.set(value, [number >> 16, number >> 8 & 255, number & 255].map(channel => channel / 255));
  }
  const channels = rgbCache.get(value);
  return factor === 1 ? channels : channels.map(channel => Math.min(1, channel * factor));
}

function randomStream(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function minus(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function unit(a) {
  const length = Math.hypot(...a) || 1;
  return a.map(value => value / length);
}
function lookAt(eye, target) {
  const back = unit(minus(eye, target));
  const right = unit(cross([0, 1, 0], back));
  const up = cross(back, right);
  const shift = axis => -axis.reduce((total, value, index) => total + value * eye[index], 0);
  return new Float32Array([
    right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0,
    shift(right), shift(up), shift(back), 1,
  ]);
}
function multiply(a, b) {
  const result = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let axis = 0; axis < 4; axis++) result[col * 4 + row] += a[axis * 4 + row] * b[col * 4 + axis];
    }
  }
  return result;
}
function perspective(fov, aspect, shiftX = 0, shiftY = 0) {
  const near = .09, far = 310, scale = 1 / Math.tan(fov / 2);
  return new Float32Array([
    scale / aspect, 0, 0, 0, 0, scale, 0, 0, shiftX, shiftY,
    (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0,
  ]);
}
function orthographic(size, near, far) {
  return new Float32Array([
    1 / size, 0, 0, 0, 0, 1 / size, 0, 0, 0, 0, -2 / (far - near), 0,
    0, 0, -(far + near) / (far - near), 1,
  ]);
}

class Mesh {
  constructor() { this.data = []; }
  triangle(a, b, c, tint, normal) {
    const n = normal || unit(cross(minus(b, a), minus(c, a)));
    const shade = typeof tint === "string" ? color(tint) : tint;
    this.data.push(...a, ...n, ...shade, ...b, ...n, ...shade, ...c, ...n, ...shade);
  }
  quad(a, b, c, d, tint, normal) {
    this.triangle(a, b, c, tint, normal);
    this.triangle(a, c, d, tint, normal);
  }
  box(x, y, z, w, h, d, tint, angle = 0) {
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const point = (u, v, q) => [x + u * cos + q * sin, y + v, z - u * sin + q * cos];
    const [a,b,c,e] = [[-w/2,-d/2],[-w/2,d/2],[w/2,d/2],[w/2,-d/2]].map(([u,q]) => point(u,0,q));
    const [at,bt,ct,et] = [a,b,c,e].map(p => [p[0],p[1]+h,p[2]]);
    this.quad(a,b,bt,at,tint);
    this.quad(b,c,ct,bt,tint);
    this.quad(c,e,et,ct,tint);
    this.quad(e,a,at,et,tint);
    this.quad(at,bt,ct,et,tint);
    this.quad(e,c,b,a,tint);
  }
  slabs(x, y, z, radius, height, top, tint, segments = 8, angle = 0, depth = radius) {
    for (let i = 0; i < segments; i++) {
      const a = angle + TAU * i / segments, b = angle + TAU * (i + 1) / segments;
      const lower = t => [x + Math.cos(t) * radius, y, z + Math.sin(t) * depth];
      const upper = t => [x + Math.cos(t) * top, y + height, z + Math.sin(t) * depth * top / radius];
      this.quad(lower(a), upper(a), upper(b), lower(b), tint);
      this.triangle([x,y+height,z], upper(b), upper(a), tint, [0,1,0]);
      this.triangle([x,y,z], lower(a), lower(b), tint, [0,-1,0]);
    }
  }
  gem(x, y, z, w, h, d, tint, sides = 6, angle = 0, variance = .07, rings = [[0,.58],[.23,1],[.72,.91],[1,.45]]) {
    const point = (ring, side) => {
      const [rise, size] = rings[ring], rad = side * TAU / sides + angle;
      return [x + Math.cos(rad) * w * size, y + rise * h, z + Math.sin(rad) * d * size];
    };
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < sides; i++) {
        const a = point(j,i), b = point(j+1,i), c = point(j+1,i+1), d = point(j,i+1);
        this.triangle(a,b,c,color(tint,1 + variance * Math.sin((i + 2) * 7 + j)));
        this.triangle(a,c,d,color(tint,1 + variance * Math.cos((i + 3) * 8 + j)));
      }
    }
    for (let i = 0; i < sides; i++) {
      this.triangle([x,y+h,z],point(rings.length-1,i+1),point(rings.length-1,i),tint,[0,1,0]);
      this.triangle([x,y,z],point(0,i),point(0,i+1),tint,[0,-1,0]);
    }
  }
  beam(a, b, width, tint, depth = width) {
    const along = unit(minus(b,a));
    const right = unit(cross(along, Math.abs(along[2]) > .94 ? [0,1,0] : [0,0,1]));
    const normal = cross(right,along);
    const p = (base, u, v) => base.map((value, index) => value + right[index] * u + normal[index] * v);
    const points = base => [[-1,-1],[-1,1],[1,1],[1,-1]].map(([u,v]) => p(base,u*width/2,v*depth/2));
    const aa = points(a), bb = points(b);
    for (let i = 0; i < 4; i++) this.quad(aa[i],bb[i],bb[(i+1)%4],aa[(i+1)%4],tint);
    this.quad(...aa,tint);
    this.quad(bb[3],bb[2],bb[1],bb[0],tint);
  }
  append(source, x, y, z, yaw = 0, scale = 1, pitch = 0) {
    const sin = Math.sin(yaw), cos = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const data = source.data;
    for (let i = 0; i < data.length; i += 9) {
      const px = data[i], py = data[i+1], pz = data[i+2];
      const nx = data[i+3], ny = data[i+4], nz = data[i+5];
      const pzr = py*sp+pz*cp, nzr = ny*sp+nz*cp;
      this.data.push(x+(px*cos+pzr*sin)*scale, y+(py*cp-pz*sp)*scale, z+(-px*sin+pzr*cos)*scale,
        nx*cos+nzr*sin, ny*cp-nz*sp, -nx*sin+nzr*cos, data[i+6],data[i+7],data[i+8]);
    }
  }
}

class Renderer {
  constructor(canvas, { portrait = false } = {}) {
    const gl = canvas.getContext("webgl2", { alpha: portrait, antialias: true, preserveDrawingBuffer: portrait });
    if (!gl) throw new Error("WebGL 2 is unavailable");
    this.gl = gl;
    this.canvas = canvas;
    this.portrait = portrait;
    this.staticBuffer = this.buffer();
    this.movingBuffer = this.buffer();
    this.glowBuffer = portrait ? null : this.buffer();
    this.scene = this.program(`#version 300 es
      layout(location=0) in vec3 point;
      layout(location=1) in vec3 normal;
      layout(location=2) in vec3 tint;
      uniform mat4 view, camera, lightView;
      out vec3 surface, paint, shadePoint;
      out float distanceToEye;
      void main() {
        gl_Position = camera * vec4(point,1.0);
        surface = normal;
        paint = tint;
        shadePoint = (lightView * vec4(point,1.0)).xyz * .5 + .5;
        distanceToEye = -(view * vec4(point,1.0)).z;
      }`, `#version 300 es
      precision highp float;
      uniform sampler2D shadowMap;
      uniform bool shadows, portrait, groundGlow;
      uniform float opacity;
      in vec3 surface, paint, shadePoint;
      in float distanceToEye;
      out vec4 outputColor;
      void main() {
        if (groundGlow) {
          float fade = 1. - smoothstep(19.,60.,distanceToEye);
          outputColor = vec4(paint,surface.x * fade);
          return;
        }
        vec3 sun = normalize(vec3(-.47,.81,.45));
        float facing = max(0.0,dot(normalize(surface),sun));
        float shadow = 0.;
        if (shadows && all(greaterThan(shadePoint,vec3(.0))) && all(lessThan(shadePoint,vec3(1.)))) {
          float bias = max(.00019, .00066*(1.-facing));
          for (int i=0; i<=1; i++) {
            for (int j=0; j<=1; j++) {
              vec2 offset = (vec2(i,j) - .5) * .00072;
              float depth = texture(shadowMap,shadePoint.xy + offset).r;
              shadow += float(shadePoint.z - bias > depth) * .25;
            }
          }
        }
        vec3 ambient = vec3(.62,.64,.61) + max(0.,surface.y)*vec3(.10,.085,.064);
        vec3 direct = vec3(.52,.44,.30) * facing * (1. - shadow*.86);
        vec3 lit = paint * (ambient + direct);
        if (portrait) lit = paint * (vec3(.69,.67,.63) + vec3(.63,.54,.42) * facing);
        float fog = portrait ? 0. : .64 * (1. - exp(-pow(max(distanceToEye - 10.,0.) * .010,1.36)));
        outputColor = vec4(mix(lit,vec3(.78,.74,.61),fog),opacity);
      }`, ["view","camera","lightView","shadowMap","shadows","portrait","groundGlow","opacity"]);
    if (!portrait) {
      this.depth = this.program(`#version 300 es
        layout(location=0) in vec3 point;
        uniform mat4 camera;
        void main() { gl_Position = camera * vec4(point,1.0); }`, `#version 300 es
        precision mediump float;
        void main() {}`, ["camera"]);
      this.sky = this.program(`#version 300 es
        out vec2 uv;
        void main() {
          vec2 p = vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2));
          uv = p;
          gl_Position = vec4(p * 2. - 1., .999, 1.);
        }`, `#version 300 es
        precision mediump float;
        in vec2 uv;
        uniform float pitch, yaw;
        out vec4 outputColor;
        float cloud(vec2 at, vec2 center, vec2 size) {
          vec2 p = abs((at - center) / size);
          return (1. - smoothstep(.73,1., p.x * .39 + p.y * .46 + max(p.x,p.y) * .32));
        }
        void main() {
          float altitude = uv.y - pitch*.52;
          vec3 sky = mix(vec3(.90,.82,.64),vec3(.50,.67,.70),smoothstep(.11,1.18,altitude));
          vec2 p = vec2(fract(uv.x*.52 + yaw*.16), altitude);
          float wisps = 0.;
          wisps += cloud(p,vec2(.19,.79),vec2(.13,.037))*.22;
          wisps += cloud(p,vec2(.15,.81),vec2(.055,.056))*.19;
          wisps += cloud(p,vec2(.47,.66),vec2(.095,.021))*.28;
          wisps += cloud(p,vec2(.74,.85),vec2(.16,.022))*.24;
          wisps += cloud(p,vec2(.89,.64),vec2(.083,.031))*.19;
          outputColor = vec4(mix(sky,vec3(.97,.87,.68),wisps),1.);
        }`, ["pitch","yaw"]);
      this.shadowSize = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      this.shadowTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.shadowFrame = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFrame);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadowTexture,0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.shadows = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      this.lightView = multiply(orthographic(63,1,200),lookAt([-53,94,45],[0,0,-8]));
    }
  }
  program(vertex, fragment, uniforms) {
    const gl = this.gl;
    const build = (kind, code) => {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader,code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    const vs = build(gl.VERTEX_SHADER,vertex), fs = build(gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return { program, uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program,name)])) };
  }
  buffer() {
    const gl = this.gl;
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);
    }
    gl.bindVertexArray(null);
    return { vao, vbo, count: 0 };
  }
  upload(buffer, mesh, streaming = false) {
    const gl = this.gl;
    buffer.count = mesh.data.length / 9;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),streaming ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  }
  geometry(buffer) {
    const gl = this.gl;
    gl.bindVertexArray(buffer.vao);
    gl.drawArrays(gl.TRIANGLES,0,buffer.count);
  }
  bake(mesh, casters, glow) {
    const gl = this.gl;
    this.upload(this.staticBuffer,mesh);
    if (glow && this.glowBuffer) this.upload(this.glowBuffer,glow);
    if (!this.shadows) return;
    const buffer = this.buffer();
    this.upload(buffer,casters);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFrame);
    gl.viewport(0,0,this.shadowSize,this.shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1,1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.depth.program);
    gl.uniformMatrix4fv(this.depth.uniforms.camera,false,this.lightView);
    this.geometry(buffer);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.deleteVertexArray(buffer.vao);
    gl.deleteBuffer(buffer.vbo);
  }
  draw(mesh, eye, target, options = {}) {
    const gl = this.gl, width = this.canvas.width, height = this.canvas.height;
    const view = lookAt(eye,target);
    const camera = multiply(perspective(options.fov || .84,width/height,options.shiftX,options.shiftY),view);
    gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.portrait) {
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(null);
      gl.useProgram(this.sky.program);
      gl.uniform1f(this.sky.uniforms.pitch,options.pitch || 0);
      gl.uniform1f(this.sky.uniforms.yaw,options.yaw || 0);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.scene.program);
    const u = this.scene.uniforms;
    gl.uniformMatrix4fv(u.view,false,view);
    gl.uniformMatrix4fv(u.camera,false,camera);
    gl.uniformMatrix4fv(u.lightView,false,this.lightView || view);
    gl.uniform1i(u.shadows,this.shadows ? 1 : 0);
    gl.uniform1i(u.portrait,this.portrait ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture || null);
    gl.uniform1i(u.shadowMap,0);
    gl.uniform1f(u.opacity,1);
    if (this.staticBuffer.count) this.geometry(this.staticBuffer);
    if (this.glowBuffer?.count || options.walkingGlow?.data.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1i(u.groundGlow,1);
      if (this.glowBuffer?.count) this.geometry(this.glowBuffer);
      if (options.walkingGlow?.data.length) {
        this.upload(this.movingBuffer,options.walkingGlow,true);
        this.geometry(this.movingBuffer);
      }
      gl.uniform1i(u.groundGlow,0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    this.upload(this.movingBuffer,mesh,true);
    this.geometry(this.movingBuffer);
    if (options.smoke?.data.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(u.opacity,.29);
      this.upload(this.movingBuffer,options.smoke,true);
      this.geometry(this.movingBuffer);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }
}
