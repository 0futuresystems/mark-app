import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting: simple in-memory tracking (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Server-side image processing with sharp
async function processImageForAPI(base64Data: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Only = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    const buffer = Buffer.from(base64Only, "base64");

    // Resize and compress with sharp
    const processedBuffer = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 75,
        progressive: true,
      })
      .toBuffer();

    return processedBuffer.toString("base64");
  } catch (error) {
    console.error("Error processing image with sharp:", error);
    // Fallback to original if processing fails
    return base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
  }
}

// Validate base64 image and check size
function validateImage(base64Data: string): {
  valid: boolean;
  error?: string;
  sizeKB?: number;
} {
  try {
    // Remove data URL prefix if present
    const base64Only = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");

    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Only)) {
      return { valid: false, error: "Invalid base64 format" };
    }

    const buffer = Buffer.from(base64Only, "base64");
    const sizeKB = buffer.length / 1024;

    // Check size limit (5MB per image)
    if (sizeKB > 5 * 1024) {
      return { valid: false, error: "Image too large (max 5MB)" };
    }

    return { valid: true, sizeKB };
  } catch (error) {
    return { valid: false, error: "Invalid image data" };
  }
}

// Convert blob to base64 for OpenAI API
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Simplified OCR implementation - skip OCR for now to avoid worker issues
async function extractTextFromImage(base64Data: string): Promise<string> {
  // OCR disabled temporarily due to Next.js worker compatibility issues
  // The vision model is very capable of reading text in images anyway
  return "";
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Try again in an hour." },
        { status: 429 },
      );
    }

    // Parse request body with size limit
    let body;
    try {
      const text = await request.text();
      if (text.length > 20 * 1024 * 1024) {
        // 20MB limit
        return NextResponse.json(
          { success: false, error: "Request too large" },
          { status: 413 },
        );
      }
      body = JSON.parse(text);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one image is required" },
        { status: 400 },
      );
    }

    // Validate and process up to 2 images for cost efficiency
    const selectedImages = images.slice(0, 2);
    const imageContents = [];
    let totalSizeKB = 0;
    let ocrText = "";

    for (const imageData of selectedImages) {
      try {
        // Validate image
        const validation = validateImage(imageData);
        if (!validation.valid) {
          return NextResponse.json(
            { success: false, error: `Invalid image: ${validation.error}` },
            { status: 400 },
          );
        }

        totalSizeKB += validation.sizeKB || 0;

        // Check total payload size
        if (totalSizeKB > 10 * 1024) {
          // 10MB total limit
          return NextResponse.json(
            { success: false, error: "Total image size too large (max 10MB)" },
            { status: 413 },
          );
        }

        // Process image with sharp
        const processedBase64 = await processImageForAPI(imageData);

        imageContents.push({
          type: "image_url" as const,
          image_url: {
            url: `data:image/jpeg;base64,${processedBase64}`,
            detail: "low" as const, // Use low detail to reduce cost
          },
        });

        // Extract OCR text from the first image (placeholder)
        if (imageContents.length === 1) {
          ocrText = await extractTextFromImage(processedBase64);
        }
      } catch (error) {
        console.error("Error processing image:", error);
        return NextResponse.json(
          { success: false, error: "Failed to process image" },
          { status: 500 },
        );
      }
    }

    if (imageContents.length === 0) {
      return NextResponse.json(
        { success: false, error: "Could not process any images" },
        { status: 500 },
      );
    }

    // Prepare the prompt
    const textContent = {
      type: "text" as const,
      text: `Produce a JSON object with the following keys only:
    - title: <= 70 characters, no emojis. Be specific (brand/model/material/era if known).
    - summary: 2–3 natural sentences describing what it is, typical use, and perceived quality/condition. If electronic, mention power/functional status if visible or "untested". Avoid any pricing or guarantees.
    - description_bullets: 4–6 concise bullets covering:
      • maker/brand/model (use OCR if present; do NOT invent),
      • material(s),
      • style/era (best estimate; say "unknown" if unsure),
      • condition notes (honest, visible wear; call out rust, chips, tears, fraying, yellowing, etc.),
      • notable defects/missing parts,
      • estimated size if visible ("approx.").
      For electronics/garage/household items, also address cords, batteries, included accessories, and safety considerations when visible.
    - keywords: 8–12 SEO keywords, comma-separated (include synonyms and variants; no private info, no prices).

    Visible marks/logos from OCR (may be empty): ${ocrText || "none detected"}
    Context: Mixed online auction listings (antiques, vintage, old electronics, household, and garage items).

    Rules:
    - Base all details on visible cues or the provided OCR only. If not visible, say "unknown" or "untested" rather than guessing.
    - Keep language neutral and factual; no salesy claims, no valuations, no authenticity guarantees.
    - Output strictly as JSON. Do not include any prose outside the JSON.`,
    };

    const userContent = [textContent, ...imageContents];

    // Call OpenAI API with structured output
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are an expert auction cataloger for antiques & vintage items. Be conservative: if unsure, say "unknown". Never invent maker names or dates. Keep language clear, neutral, and buyer-friendly.',
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseText);
      throw new Error("AI returned invalid JSON format");
    }

    // Validate the response structure
    if (
      !parsedResponse.title ||
      !parsedResponse.description_bullets ||
      !parsedResponse.keywords ||
      !parsedResponse.caution
    ) {
      console.error("Invalid response structure:", parsedResponse);
      throw new Error("AI response missing required fields");
    }

    // Validate data types
    if (
      typeof parsedResponse.title !== "string" ||
      !Array.isArray(parsedResponse.description_bullets) ||
      typeof parsedResponse.keywords !== "string" ||
      typeof parsedResponse.caution !== "string"
    ) {
      throw new Error("AI response has incorrect field types");
    }

    return NextResponse.json({
      success: true,
      data: parsedResponse,
    });
  } catch (error) {
    console.error("Error in generate-description API:", error);

    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: "OpenAI rate limit reached. Please try again later.",
          },
          { status: 429 },
        );
      }
      if (error.status === 400) {
        return NextResponse.json(
          { success: false, error: "Invalid request to AI service." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { success: false, error: "AI service error. Please try again." },
        { status: 502 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
