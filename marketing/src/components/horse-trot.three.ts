/* The horse, running its own morph-target loop, on a transparent canvas.
 *
 * A chunk boundary like `gpu-letters.three.ts`, ported from the design's
 * `horse-trot.js`. HorseTrot loads it only on a desktop pointer, only when the
 * footer nears the viewport.
 *
 * The GLB is read directly — one mesh, vertex colors, 15 morph targets, one
 * weights track — so there is no GLTFLoader. That is not only about weight:
 * GLTFLoader imports from `three`, and this scene renders through
 * `three/webgpu`, which carries its own copy of the core. Mixing the two breaks
 * the renderer's `instanceof` checks.
 */
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
  type TypedArray,
} from "three/webgpu";

type TypedCtor = { new (buf: ArrayBufferLike, off: number, len: number): TypedArray; new (len: number): TypedArray; BYTES_PER_ELEMENT: number };
const CT: Record<number, TypedCtor> = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

interface GltfAccessor { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }
interface GltfBufferView { byteOffset?: number; byteStride?: number }
interface GltfPrimitive { attributes: Record<string, number>; indices?: number; targets?: { POSITION: number }[] }
interface GltfJson {
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  meshes: { primitives: GltfPrimitive[] }[];
  animations?: { name?: string; channels: { sampler: number }[]; samplers: { input: number; output: number }[] }[];
}

function parseGlb(buf: ArrayBuffer) {
  const dv = new DataView(buf);
  let off = 12;
  let json: GltfJson | null = null;
  let bin: ArrayBuffer | null = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    off += 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off, len)));
    else if (type === 0x004e4942) bin = buf.slice(off, off + len);
    off += len;
  }
  if (!json || !bin) throw new Error("horse-trot: not a GLB with JSON and BIN chunks");
  const J = json;
  const B = bin;
  const accessor = (i: number) => {
    const a = J.accessors[i];
    const bv = J.bufferViews[a.bufferView];
    const T = CT[a.componentType];
    const n = SIZE[a.type];
    const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || 0;
    const el = T.BYTES_PER_ELEMENT;
    let arr: TypedArray;
    if (stride && stride !== n * el) {
      // Interleaved: copy element by element out of the strided view.
      arr = new T(a.count * n);
      for (let k = 0; k < a.count; k++) {
        for (let j = 0; j < n; j++) arr[k * n + j] = new T(B, start + k * stride + j * el, 1)[0];
      }
    } else if (start % el === 0) {
      arr = new T(B, start, a.count * n);
    } else {
      // A typed array view must be aligned to its element size; copy if not.
      arr = new T(B.slice(start, start + a.count * n * el), 0, a.count * n);
    }
    return new BufferAttribute(arr, n, !!a.normalized);
  };
  return { json: J, accessor };
}

export interface HorseTrotScene {
  setVisible(v: boolean): void;
  fit(): void;
  dispose(): void;
}

export function createHorseTrot(host: HTMLElement, canvas: HTMLCanvasElement, src: string): HorseTrotScene {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer: WebGPURenderer | null = null;
  let scene: Scene | null = null;
  let camera: PerspectiveCamera | null = null;
  let mixer: AnimationMixer | null = null;
  let geo: BufferGeometry | null = null;
  let mat: MeshStandardMaterial | null = null;
  const center = new Vector3();
  const size = new Vector3();
  let disposed = false;
  let visible = true;
  let raf = 0;
  let last = 0;

  const fit = () => {
    if (!renderer || !camera) return;
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    const half = Math.tan(MathUtils.degToRad(camera.fov / 2));
    // Room above for the gallop's highest frame (the ears clear the base-pose
    // box), and a little below.
    const d = Math.max((size.y / 2 + 42) / half, (size.z / 2 + 42) / (half * camera.aspect));
    // Seen from the -x side so the head (+z) leads to the right, a touch above
    // eye level, aimed slightly high so the extra room sits over the ears.
    camera.position.set(-d, center.y + d * 0.16, center.z);
    camera.lookAt(center.x, center.y + size.y * 0.18, center.z);
    camera.updateProjectionMatrix();
  };

  const tick = (now: number) => {
    raf = 0;
    if (!renderer || !scene || !camera || disposed) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (mixer && !reduced) mixer.update(dt);
    renderer.render(scene, camera);
    // Reduced motion: one still frame, then the loop stops.
    if (visible && !reduced) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (!renderer || !visible || raf || disposed) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  (async () => {
    try {
      const [buf, r] = await Promise.all([
        fetch(src).then((res) => {
          if (!res.ok) throw new Error(`horse-trot: ${src} ${res.status}`);
          return res.arrayBuffer();
        }),
        (async () => {
          const x = new WebGPURenderer({ canvas, antialias: true, alpha: true });
          await x.init();
          return x;
        })(),
      ]);
      if (disposed) {
        r.dispose();
        return;
      }
      renderer = r;
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.setClearColor(new Color(0x000000), 0);

      const { json, accessor } = parseGlb(buf);
      const prim = json.meshes[0].primitives[0];
      geo = new BufferGeometry();
      geo.setAttribute("position", accessor(prim.attributes.POSITION));
      if (prim.attributes.COLOR_0 !== undefined) geo.setAttribute("color", accessor(prim.attributes.COLOR_0));
      if (prim.indices !== undefined) geo.setIndex(accessor(prim.indices));
      geo.morphAttributes.position = (prim.targets || []).map((t) => accessor(t.POSITION));
      geo.morphTargetsRelative = true;
      geo.computeVertexNormals();
      // Bounds from the base pose only: computeBoundingBox folds every morph delta in.
      const box = new Box3().setFromBufferAttribute(geo.attributes.position as BufferAttribute);
      box.getCenter(center);
      box.getSize(size);
      mat = new MeshStandardMaterial({ vertexColors: !!geo.attributes.color, flatShading: true, roughness: 0.75, metalness: 0 });
      const mesh = new Mesh(geo, mat);

      scene = new Scene();
      scene.add(mesh);
      scene.add(new HemisphereLight(0xfff1e0, 0x3a2a22, 1.5));
      const key = new DirectionalLight(0xffffff, 2.0);
      key.position.set(-420, 380, 260);
      scene.add(key);
      camera = new PerspectiveCamera(30, 16 / 9, 1, 5000);

      const anim = json.animations?.[0];
      if (anim) {
        const s = anim.samplers[anim.channels[0].sampler];
        const times = Array.from(accessor(s.input).array as ArrayLike<number>);
        const values = Array.from(accessor(s.output).array as ArrayLike<number>);
        const clip = new AnimationClip(anim.name || "run", -1, [new NumberKeyframeTrack(".morphTargetInfluences", times, values)]);
        mixer = new AnimationMixer(mesh);
        mixer.clipAction(clip).play();
      }
      fit();
      wake();
    } catch (err) {
      // Decoration only: on failure the footer is simply the footer.
      console.warn("horse-trot: failed", err);
    }
  })();

  return {
    setVisible(v) {
      visible = v;
      if (!v) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    },
    fit() {
      fit();
      wake();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      mixer?.stopAllAction();
      geo?.dispose();
      mat?.dispose();
      renderer?.dispose();
      renderer = null;
    },
  };
}
