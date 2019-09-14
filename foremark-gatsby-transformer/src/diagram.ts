// Idiomatically, we should call `wasm-bindgen` ourselves and generate binding
// code, but I was reluctant to add more complexities to this package's build
// system.
//
// Thus, we just borrow the WebAssembly module from `foremark` on NPM. It's
// a little bit hacky - yes, I know.
import {promises} from 'fs';
import {TextEncoder, TextDecoder} from 'util';

const toSvgPromise = (async () => {
    const foremarkJSPath = require.resolve('foremark/browser/foremark.js');
    const foremarkJS = await promises.readFile(foremarkJSPath, 'utf8');
    const match = foremarkJS.match(/fetch\(a\.p\+""\+\{[0-9]+:"([^"]+)"\}\[e\]\+"\.module\.wasm"\)/);
    if (!match) {
        throw new Error("Could not locate the WebAssembly module.");
    }

    const wasmName = match[1] + '.module.wasm';
    const wasmPath = require.resolve(`foremark/browser/${wasmName}`);

    const moduleBlob = await promises.readFile(wasmPath);
    const module = await ((WebAssembly as any)
        .instantiate(moduleBlob) as Promise<WebAssembly.ResultObject>);
    const wasm = (module.instance as any).exports;

    let WASM_VECTOR_LEN = 0;
    const cachedTextEncoder = new TextEncoder();
    const cachedTextDecoder = new TextDecoder();

    function passStringToWasm(arg: string): number {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = wasm.__wbindgen_malloc(buf.length);
        new Uint8Array(wasm.memory.buffer).set(buf, ptr);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    function getStringFromWasm(ptr: number, len: number): string {
        return cachedTextDecoder
            .decode(new Uint8Array(wasm.memory.buffer).subarray(ptr, ptr + len));
    }
    return (diagram: string) => {
        const ptr0 = passStringToWasm(diagram);
        const len0 = WASM_VECTOR_LEN;
        const retptr = wasm.__wbindgen_global_argument_ptr();
        try {
            wasm.to_svg(retptr, ptr0, len0);
            const mem = new Uint32Array(wasm.memory.buffer);
            const rustptr = mem[retptr / 4];
            const rustlen = mem[retptr / 4 + 1];

            const realRet = getStringFromWasm(rustptr, rustlen).slice();
            wasm.__wbindgen_free(rustptr, rustlen * 1);
            return realRet;
        } finally {
            wasm.__wbindgen_free(ptr0, len0);
        }
    };
})();

export async function toSvg(diagram: string): Promise<string> {
    const toSvg = await toSvgPromise;
    return toSvg(diagram);
}
