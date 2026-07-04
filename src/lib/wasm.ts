import init, * as breathe from '../../wasm/pkg/breathe_wasm';

export type Breathe = typeof breathe;

let memory: WebAssembly.Memory | null = null;

export async function initWasm(): Promise<Breathe> {
  const out = await init();
  memory = out.memory;
  return breathe;
}

export function wasmMemory(): WebAssembly.Memory {
  if (!memory) throw new Error('wasm not initialized');
  return memory;
}
