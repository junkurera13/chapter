import { makeEmbossField } from "./emboss-field";
import {
  EMBOSS_FRAGMENT_SHADER,
  EMBOSS_VERTEX_SHADER,
} from "./emboss-shader";

export type BubblegumTone = "blue" | "pink" | "green";

const TONES: Record<BubblegumTone, [number, number, number]> = {
  blue: [0.45, 0.78, 1],
  pink: [1, 0.47, 0.72],
  green: [0.47, 0.9, 0.62],
};

const DEPTH = 1.3;
const HIGHLIGHT = 0.3;
const SHADOW = 0.34;
const GRAIN = 0.72;
const BASE_ANGLE = 72;
const BASE_ALTITUDE = 24;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Emboss shader is unavailable.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Emboss shader failed.");
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error("Emboss program is unavailable.");
  gl.attachShader(
    program,
    compileShader(gl, gl.VERTEX_SHADER, EMBOSS_VERTEX_SHADER),
  );
  gl.attachShader(
    program,
    compileShader(gl, gl.FRAGMENT_SHADER, EMBOSS_FRAGMENT_SHADER),
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Emboss program failed.");
  }
  return program;
}

export class BubblegumEmbossEngine {
  readonly ok: boolean;

  private readonly host: HTMLElement;
  private readonly number: string;
  private readonly tone: BubblegumTone;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext | null;
  private readonly program: WebGLProgram | null;
  private readonly locations: Record<string, WebGLUniformLocation | null> = {};
  private readonly buffer: WebGLBuffer | null;
  private readonly field: WebGLTexture | null;

  private fieldWidth = 1;
  private fieldHeight = 1;
  private hostWidth = 1;
  private hostHeight = 1;
  private fieldReady = false;
  private painted = false;
  private frame = 0;
  private buildSequence = 0;
  private lightOffset = { x: 0, y: 0 };

  constructor(
    host: HTMLElement,
    { tone, number }: { tone: BubblegumTone; number: string },
  ) {
    this.host = host;
    this.number = number;
    this.tone = tone;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      opacity: "0",
      transition: "opacity 180ms ease",
    });
    this.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    this.gl = gl;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let field: WebGLTexture | null = null;

    try {
      if (!gl) throw new Error("WebGL is unavailable.");
      program = createProgram(gl);
      gl.useProgram(program);

      for (const uniform of [
        "uField",
        "uTexel",
        "uLight",
        "uLightZ",
        "uDepth",
        "uHighlight",
        "uShadow",
        "uTint",
        "uGrain",
      ]) {
        this.locations[uniform] = gl.getUniformLocation(program, uniform);
      }

      const position = gl.getAttribLocation(program, "aPosition");
      const uv = gl.getAttribLocation(program, "aUV");
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0,
        ]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);

      field = gl.createTexture();
      gl.clearColor(...TONES[tone], 1);
    } catch {
      program = null;
    }

    this.program = program;
    this.buffer = buffer;
    this.field = field;
    this.ok = Boolean(gl && program && field);

    if (this.ok) this.resize();
  }

  resize() {
    if (!this.gl || !this.program || !this.field) return;
    const bounds = this.host.getBoundingClientRect();
    const dpr = Math.min(1.6, window.devicePixelRatio || 1);
    this.hostWidth = Math.max(1, bounds.width);
    this.hostHeight = Math.max(1, bounds.height);
    const canvasWidth = Math.max(1, Math.round(this.hostWidth * dpr));
    const canvasHeight = Math.max(1, Math.round(this.hostHeight * dpr));

    if (
      this.canvas.width === canvasWidth &&
      this.canvas.height === canvasHeight
    ) {
      return;
    }

    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.gl.viewport(0, 0, canvasWidth, canvasHeight);
    void this.rebuildField(dpr);
  }

  setLightFromPointer(x: number, y: number) {
    this.lightOffset = {
      x: Math.max(-1, Math.min(1, x)) * 8,
      y: Math.max(-1, Math.min(1, y)) * 5,
    };
    this.renderOnce();
  }

  resetLight() {
    this.lightOffset = { x: 0, y: 0 };
    this.renderOnce();
  }

  private async rebuildField(dpr: number) {
    if (!this.gl || !this.field) return;
    const maxWidth = 720;
    const maskWidth = Math.max(
      2,
      Math.min(maxWidth, Math.round(this.hostWidth * dpr)),
    );
    const maskHeight = Math.max(
      2,
      Math.round(maskWidth * (this.hostHeight / this.hostWidth)),
    );
    const sequence = ++this.buildSequence;
    const field = await makeEmbossField({
      number: this.number,
      blur: Math.max(1, 2.2 * dpr),
      width: maskWidth,
      height: maskHeight,
    });
    if (sequence !== this.buildSequence || !this.gl || !this.field) return;

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.field);
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      field,
    );
    this.fieldWidth = field.width;
    this.fieldHeight = field.height;
    this.fieldReady = true;
    this.renderOnce();
  }

  private renderOnce() {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render() {
    if (
      !this.gl ||
      !this.program ||
      !this.field ||
      !this.fieldReady
    ) {
      return;
    }

    const angle = ((BASE_ANGLE + this.lightOffset.x) * Math.PI) / 180;
    const altitude =
      ((BASE_ALTITUDE + this.lightOffset.y) * Math.PI) / 180;
    const tint = TONES[this.tone];

    this.gl.useProgram(this.program);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.field);
    this.gl.uniform1i(this.locations.uField, 0);
    this.gl.uniform2f(
      this.locations.uTexel,
      1 / this.fieldWidth,
      1 / this.fieldHeight,
    );
    this.gl.uniform2f(
      this.locations.uLight,
      Math.cos(angle),
      Math.sin(angle),
    );
    this.gl.uniform1f(
      this.locations.uLightZ,
      Math.max(0.25, Math.sin(altitude) + 0.3),
    );
    this.gl.uniform1f(this.locations.uDepth, DEPTH);
    this.gl.uniform1f(this.locations.uHighlight, HIGHLIGHT);
    this.gl.uniform1f(this.locations.uShadow, SHADOW);
    this.gl.uniform3f(this.locations.uTint, tint[0], tint[1], tint[2]);
    this.gl.uniform1f(this.locations.uGrain, GRAIN);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    if (!this.painted) {
      this.painted = true;
      this.canvas.style.opacity = "1";
    }
  }

  destroy() {
    this.buildSequence += 1;
    if (this.frame) window.cancelAnimationFrame(this.frame);
    if (this.gl) {
      if (this.field) this.gl.deleteTexture(this.field);
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }
}
