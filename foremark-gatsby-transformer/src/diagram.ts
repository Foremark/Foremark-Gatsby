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
    const lTextEncoder = typeof TextEncoder === 'undefined' ? require('util').TextEncoder : TextEncoder;
    let cachedTextEncoder = new lTextEncoder('utf-8');
    const cachedTextDecoder = new TextDecoder();

    const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
        ? function (arg: any, view: any) {
        return cachedTextEncoder.encodeInto(arg, view);
    }
        : function (arg: any, view: any) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    });

    let cachegetUint8Memory0: Uint8Array | null = null;
    function getUint8Memory0() {
        if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
            cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachegetUint8Memory0;
    }

    let cachegetInt32Memory0: Int32Array | null = null;
    function getInt32Memory0() {
        if (cachegetInt32Memory0 === null || cachegetInt32Memory0.buffer !== wasm.memory.buffer) {
            cachegetInt32Memory0 = new Int32Array(wasm.memory.buffer);
        }
        return cachegetInt32Memory0;
    }

    function passStringToWasm0(arg: string, malloc: Function, realloc: Function) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length);
            getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len);

        const mem = getUint8Memory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }

        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3);
            const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
            const ret = encodeString(arg, view);

            offset += ret.written;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    function getStringFromWasm0(ptr: number, len: number): string {
        return cachedTextDecoder
            .decode(new Uint8Array(wasm.memory.buffer).subarray(ptr, ptr + len));
    }
    return (diagram: string) => {
        let r0: number = 0;
        let r1: number = 0;
        try {
            const ptr0 = passStringToWasm0(diagram, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
            const len0 = WASM_VECTOR_LEN;
            wasm.to_svg(8, ptr0, len0);
            r0 = getInt32Memory0()[8 / 4 + 0];
            r1 = getInt32Memory0()[8 / 4 + 1];
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_export_2(r0, r1);
        }
    };
})();

export async function toSvg(diagram: string): Promise<string> {
    const toSvg = await toSvgPromise;
    return toSvg(diagram);
}
