import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod4";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";

const Body = z.object({
  auctionId: z.string().min(1),
  lotId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive(),
});

const R2Schema = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

const ALLOWED = new Set([
  "image/jpeg","image/png","image/webp",
  "audio/m4a","audio/mp4","audio/aac","audio/mpeg","audio/wav",
]);
const MAX_BYTES = 25 * 1024 * 1024;

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function extFrom(name: string) {
  const i = name.lastIndexOf(".");
  return i > -1 ? name.slice(i + 1).toLowerCase() : "bin";
}

export async function OPTIONS() {
  return new Response(null, { 
    status: 200, 
    headers: { 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Headers": "content-type", 
      "Access-Control-Allow-Methods": "POST,OPTIONS" 
    } 
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { auctionId, lotId, filename, contentType, contentLength } = Body.parse(body);

    if (!ALLOWED.has(contentType)) {
      return Response.json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" }, { status: 400 });
    }
    if (contentLength > MAX_BYTES) {
      return Response.json({ ok: false, error: "TOO_LARGE" }, { status: 413 });
    }

    // TODO: replace with real user id extraction
    const userId = "me"; // e.g., read from auth/session
    const safeName = sanitizeName(filename);
    const key = `u/${userId}/a/${auctionId}/l/${lotId}/${crypto.randomUUID()}.${extFrom(safeName)}`;

    const env = R2Schema.parse(process.env);
    const s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true
    });

    const cmd = new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 }); // seconds

    return Response.json({
      ok: true,
      url,
      method: "PUT",
      headers: { "Content-Type": contentType, "Content-Length": String(contentLength) },
      key,
    }, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err: any) {
    return Response.json({ ok: false, error: err?.message ?? "SIGN_ERROR" }, { status: 500 });
  }
}

