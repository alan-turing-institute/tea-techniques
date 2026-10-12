import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertCatalogueSnapshot,
  CATALOGUE_SNAPSHOT,
} from '../scripts/qwen3-onnx.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const graph = Buffer.from('the snapshot graph');
const expected = {
  graphSha256: createHash('sha256').update(graph).digest('hex'),
  dataBytes: 8,
};

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcpfree-snapshot-'));
});
afterEach(() => fs.rm(dir, { recursive: true }));

async function snapshot(files: { graph: Buffer; dataBytes: number }) {
  await fs.writeFile(path.join(dir, 'model.onnx'), files.graph);
  await fs.writeFile(
    path.join(dir, 'model.onnx_data'),
    Buffer.alloc(files.dataBytes)
  );
}

describe('Qwen3 snapshot check', () => {
  it('accepts the pinned snapshot', async () => {
    await snapshot({ graph, dataBytes: 8 });
    await expect(
      assertCatalogueSnapshot(dir, expected)
    ).resolves.toBeUndefined();
  });

  it('refuses a graph from another revision', async () => {
    await snapshot({ graph: Buffer.from('another graph'), dataBytes: 8 });
    await expect(assertCatalogueSnapshot(dir, expected)).rejects.toThrow(
      'SHA-256 differs'
    );
  });

  it('refuses weights of another size', async () => {
    await snapshot({ graph, dataBytes: 9 });
    await expect(assertCatalogueSnapshot(dir, expected)).rejects.toThrow(
      'the pinned snapshot'
    );
  });

  it('records a SHA-256 and a size for the pinned revision', () => {
    expect(CATALOGUE_SNAPSHOT.graphSha256).toMatch(SHA256_HEX);
    expect(CATALOGUE_SNAPSHOT.dataBytes).toBeGreaterThan(1e10);
  });
});
