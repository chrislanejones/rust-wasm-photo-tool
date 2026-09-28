/* The slice of three.js the entropy post's scenes use, and nothing else.
 *
 * Same chunk-boundary reason as the worker post's copy of this file
 * (engine-in-a-worker.three.ts): figures.tsx loads it with a dynamic import
 * the first time a scene nears the viewport, so three.js is a chunk only this
 * post requests. A separate file rather than a shared one because the two
 * posts use different subsets, and the point of the file is to let Rollup drop
 * what is not named here.
 *
 * Add a class when a scene needs it. Nothing else imports "three".
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
