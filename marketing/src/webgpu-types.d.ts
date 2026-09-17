// Minimal ambient WebGPU declarations — ONLY what `CubeLetters.tsx` touches.
//
// The right answer is `pnpm add -D @webgpu/types`: it is types-only, adds zero
// runtime bytes, and is maintained by the spec authors. The app crate made the
// same call for the same reason and wrote down why (app/src/lib/webgpu/
// webgpu-types.d.ts) — a dependency taken to unblock one file at one moment
// tends to outlive the moment. Swapping to the real package is a one-line
// tsconfig change plus deleting this file.
//
// ⚠️ This is the RENDER surface. The app's shim covers compute only — it says
// so in its own header, "no render pipeline, no textures" — so it could not be
// reused here even if the two packages shared files, which they do not.
//
// Deliberately partial. If you reach for something not listed, add it here
// with the same narrowness rather than widening a type to `any`.

interface GPUSupportedLimits {
  readonly maxTextureDimension2D: number;
}

interface GPUShaderModule {
  readonly __brand: "GPUShaderModule";
}

interface GPUBuffer {
  destroy(): void;
}

interface GPUBindGroupLayout {
  readonly __brand: "GPUBindGroupLayout";
}

interface GPUBindGroup {
  readonly __brand: "GPUBindGroup";
}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUTextureView {
  readonly __brand: "GPUTextureView";
}

interface GPUTexture {
  createView(): GPUTextureView;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, group: GPUBindGroup): void;
  setVertexBuffer(slot: number, buffer: GPUBuffer): void;
  draw(vertexCount: number, instanceCount?: number): void;
  end(): void;
}

interface GPUCommandBuffer {
  readonly __brand: "GPUCommandBuffer";
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: {
    colorAttachments: {
      view: GPUTextureView;
      clearValue?: { r: number; g: number; b: number; a: number };
      loadOp: "clear" | "load";
      storeOp: "store" | "discard";
    }[];
  }): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, offset: number, data: BufferSource): void;
  submit(buffers: GPUCommandBuffer[]): void;
}

interface GPUDevice {
  readonly limits: GPUSupportedLimits;
  readonly queue: GPUQueue;
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  createRenderPipeline(descriptor: {
    layout: "auto";
    vertex: {
      module: GPUShaderModule;
      entryPoint: string;
      buffers?: {
        arrayStride: number;
        stepMode?: "vertex" | "instance";
        attributes: { shaderLocation: number; offset: number; format: string }[];
      }[];
    };
    fragment?: {
      module: GPUShaderModule;
      entryPoint: string;
      targets: { format: string }[];
    };
    primitive?: { topology: "triangle-list" };
  }): GPURenderPipeline;
  createBuffer(descriptor: { size: number; usage: number }): GPUBuffer;
  createBindGroup(descriptor: {
    layout: GPUBindGroupLayout;
    entries: { binding: number; resource: { buffer: GPUBuffer } }[];
  }): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
  destroy(): void;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): string;
}

interface GPUCanvasContext {
  configure(configuration: {
    device: GPUDevice;
    format: string;
    alphaMode?: "opaque" | "premultiplied";
  }): void;
  getCurrentTexture(): GPUTexture;
}

declare const GPUBufferUsage: {
  readonly VERTEX: number;
  readonly UNIFORM: number;
  readonly COPY_DST: number;
};

interface Navigator {
  readonly gpu?: GPU;
}

interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}
