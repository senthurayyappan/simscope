// gifenc, behind one door. The bundler takes its ES build, with named
// exports; Node (the tests) takes its CommonJS build, which has only a default
// export. Reading the namespace works for both.

import * as ns from "gifenc";

type Codec = Pick<typeof ns, "GIFEncoder" | "quantize" | "applyPalette">;

const codec: Codec = "GIFEncoder" in ns ? ns : (ns as unknown as { default: Codec }).default;

export const { GIFEncoder, quantize, applyPalette } = codec;
