import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/wav', 'audio/mp4'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(webm|mp3|m4a|wav|mp4)$/i)) {
      return NextResponse.json(
        { error: 'Unsupported audio format. Please use WebM, MP3, M4A, WAV, or MP4.' },
        { status: 400 }
      );
    }

    // Check file size (25MB limit for Whisper)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Use configured model or default to whisper-1
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: model,
        language: 'en', // Force English for consistent output
      });

      if (!transcription.text || transcription.text.trim().length === 0) {
        return NextResponse.json(
          { error: "Couldn't hear that clearly—try again with clearer audio" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        transcript: transcription.text,
        lang: 'en',
        confidence: 1.0 // Whisper doesn't provide confidence scores
      });

    } catch (whisperError: any) {
      console.error('Whisper transcription error:', whisperError);
      
      if (whisperError?.status === 400) {
        return NextResponse.json(
          { error: "Couldn't process that audio file—try again with a different recording" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Couldn't hear that clearly—try again" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Transcribe API error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio file' },
      { status: 500 }
    );
  }
}