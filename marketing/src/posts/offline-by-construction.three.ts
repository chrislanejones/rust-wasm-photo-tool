/* The slice of three.js "The network went down. The work stayed on the
 * device." uses, and nothing else. Same chunk-boundary technique as
 * engine-in-a-worker.three.ts — see that file for why this is a barrel of
 * static re-exports rather than a bare `import("three")`.
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
  Vector3,
  WebGLRenderer,
} from "three";
