/**
 * Compact storage for embedding vectors: little-endian float32, base64 encoded.
 * The encoding is exact for vectors that came from a float32 model output.
 */

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function encodeVector(vector: ArrayLike<number>): string {
  const bytes = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    bytes.writeFloatLE(vector[i], i * 4);
  }
  return bytes.toString('base64');
}

/** Decodes a vector of exactly `dimensions` values, or returns null if the text is not one. */
export function decodeVector(
  text: string,
  dimensions: number
): Float32Array | null {
  if (!BASE64.test(text) || text.length % 4 !== 0) {
    return null;
  }
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length !== dimensions * 4) {
    return null;
  }
  const vector = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = bytes.readFloatLE(i * 4);
  }
  return vector;
}
