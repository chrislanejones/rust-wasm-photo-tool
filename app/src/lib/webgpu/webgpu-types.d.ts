// Minimal ambient WebGPU declarations — ONLY what `detect.ts` and `gpuBlur.ts`
// actually touch.
//
// The right answer is `pnpm add -D @webgpu/types` and a `"types"` entry in
// tsconfig: it is types-only, adds zero runtime bytes, and is maintained by the
// spec authors. That is a dependency decision, and this arrived as a
// time-boxed Phase 0 spike behind a default-off flag — taking a dependency to
// beat a deadline is how spikes become architecture by accident. So the spike
// carries its own narrow surface, and swapping to the real package is a
// one-line change plus deleting this file. Recorded in ADR-030.
//
// Deliberately partial: no render pipeline, no textures, no query sets. If you
// find yourself widening this file rather than deleting it, that is the signal
// to take the dependency instead.

interface GPUSupportedLimits {
  readonly maxTextureDimension2D: number;
  readonly maxComputeWorkgroupSizeX: number;
  readonly maxStorageBufferBindingSize: number;
}

interface GPUAdapterInfo {
  readonly vendor?: string;
  readonly architecture?: string;
}

interface GPUBuffer {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}

interface GPUQueue {
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUCommandBuffer { readonly __brand?: "GPUCommandBuffer" }
interface GPUShaderModule { readonly __brand?: "GPUShaderModule" }
interface GPUBindGroup { readonly __brand?: "GPUBindGroup" }
interface GPUBindGroupLayout { readonly __brand?: "GPUBindGroupLayout" }

interface GPUComputePassEncoder {
  setPipeline(p: GPUComputePipeline): void;
  setBindGroup(index: number, group: GPUBindGroup): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GPUComputePipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUCommandEncoder {
  beginComputePass(): GPUComputePassEncoder;
  copyBufferToBuffer(
    src: GPUBuffer, srcOffset: number,
    dst: GPUBuffer, dstOffset: number,
    size: number,
  ): void;
  finish(): GPUCommandBuffer;
}

interface GPUDevice {
  readonly queue: GPUQueue;
  createBuffer(d: { size: number; usage: number; mappedAtCreation?: boolean }): GPUBuffer;
  createShaderModule(d: { code: string }): GPUShaderModule;
  createComputePipeline(d: {
    layout: "auto";
    compute: { module: GPUShaderModule; entryPoint: string };
  }): GPUComputePipeline;
  createBindGroup(d: {
    layout: GPUBindGroupLayout;
    entries: Array<{ binding: number; resource: { buffer: GPUBuffer } }>;
  }): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
  destroy(): void;
}

interface GPUAdapter {
  readonly limits: GPUSupportedLimits;
  readonly info?: GPUAdapterInfo;
  requestDevice(): Promise<GPUDevice>;
}

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}

interface Navigator {
  readonly gpu?: GPU;
}

declare const GPUBufferUsage: {
  readonly STORAGE: number;
  readonly UNIFORM: number;
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
  readonly MAP_READ: number;
};

declare const GPUMapMode: {
  readonly READ: number;
};
