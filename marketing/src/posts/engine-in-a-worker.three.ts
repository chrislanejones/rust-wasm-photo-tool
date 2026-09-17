/* The slice of three.js the worker post's scenes use, and nothing else.
 *
 * This file is the chunk boundary. figures.tsx loads it with a dynamic
 * `import()` the first time a scene comes near the viewport, so three.js is a
 * separate chunk that only the post page ever requests — the home page, the
 * blog index and every other route never see it. The re-exports are static so
 * Rollup can drop the ~90% of three.js these scenes never touch (three's
 * package.json marks the main build side-effect free, which is what makes that
 * legal); a bare `import("three")` would hand the scenes the whole namespace
 * and the bundler no way to know which classes were used.
 *
 * Add a class here when a scene needs it. Nothing else should import "three".
 */
export {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
