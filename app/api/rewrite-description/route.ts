import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const requestSchema = z.object({
  originalDescription: z.string(),
  transcript: z.string().min(1, 'Transcript cannot be empty'),
  lotMeta: z.object({
    lotNumber: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    const { originalDescription, transcript, lotMeta } = validatedData;

    // Use configured model or default to gpt-4o-mini
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

    const systemPrompt = `You are an expert auction cataloger. Your task is to improve lot descriptions by incorporating details from the seller's voice note. Follow these strict rules:

RULES:
1. Keep a clear title
2. Use 4-6 bullets: maker (if known), material, era/style (best estimate), size (approx.), condition notes, notable defects
3. Follow with 2-3 short sentences on use/fit/quality
4. Only correct or add details from the transcript - do not invent information
5. When the voice note conflicts with the original description, prefer the voice note
6. If unsure about any detail, use "unknown/unspecified"
7. Keep tone concise and objective
8. IMPORTANT: Generate updated keywords (8-12 SEO keywords, comma-separated) that reflect the final description after incorporating voice note changes

OUTPUT FORMAT:
Respond with valid JSON only:
{
  "rewrittenDescription": "<improved description following the format above>",
  "keywords": "<8-12 updated SEO keywords, comma-separated, reflecting the final description>",
  "changeSummary": "<2-3 short lines explaining what was changed/added from the voice note>"
}`;

    const userPrompt = `Original description:
"${originalDescription}"

Voice note transcript:
"${transcript}"

Lot number: ${lotMeta.lotNumber}

Please rewrite the description incorporating details from the voice note.`;

    try {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Low temperature for consistent, factual output
        max_tokens: 1000,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', responseText);
        throw new Error('Invalid response format from AI');
      }

      // Validate the response structure
      if (!parsedResponse.rewrittenDescription || !parsedResponse.changeSummary || !parsedResponse.keywords) {
        throw new Error('Invalid response structure from AI');
      }

      return NextResponse.json({
        rewrittenDescription: parsedResponse.rewrittenDescription,
        keywords: parsedResponse.keywords,
        changeSummary: parsedResponse.changeSummary,
      });

    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError);
      
      if (openaiError?.status === 400) {
        return NextResponse.json(
          { error: 'Could not process the description and voice note together' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to rewrite description' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Rewrite description API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}