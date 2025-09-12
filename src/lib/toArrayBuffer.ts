// src/lib/toArrayBuffer.ts
export async function toArrayBuffer(input: unknown): Promise<ArrayBuffer> {
  if (!input) throw new Error("empty media");

  // 1) Blob/File
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return await input.arrayBuffer();
  }

  // 2) Response (e.g., fetch(blobUrl))
  if (typeof Response !== "undefined" && input instanceof Response) {
    if (!input.ok) throw new Error(`http ${input.status}`);
    return await input.arrayBuffer();
  }

  // 3) Strings: blob:, http(s):, data:
  if (typeof input === "string") {
    // blob: or http(s):
    if (input.startsWith("blob:") || input.startsWith("http")) {
      const r = await fetch(input);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      return await r.arrayBuffer();
    }
    // data:URL (base64)
    if (input.startsWith("data:")) {
      const base64 = input.split(",")[1] ?? "";
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }
  }

  // 4) Unknown shapes (e.g., {buffer:..., type:...})
  if (typeof input === "object" && input !== null) {
    // Common mistake: something like { dataUrl: "..." }
    // Caller should pass the inner field; surface a helpful message.
    throw new Error("unsupported media object (pass blob/file/url/dataUrl)");
  }

  throw new Error(`unsupported media: ${Object.prototype.toString.call(input)}`);
}
