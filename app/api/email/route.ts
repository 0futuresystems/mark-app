import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emailSchema = z.object({
  subject: z.string().min(1),
  summary: z.string().optional(),
  userId: z.string().optional(),
  auctionId: z.string().optional(),
  csv: z.string().optional(),
  links: z.array(z.string()).optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Resend API key not configured' },
        { status: 500 }
      );
    }

    if (!process.env.SYNC_TO_EMAIL) {
      return NextResponse.json(
        { error: 'Sync email not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { subject, summary, userId, auctionId, csv, links } = emailSchema.parse(body);

    // Server-enforced recipient - always send to kvvisakh@gmail.com
    const toEmail = process.env.SYNC_TO_EMAIL;

    let emailContent = '';
    
    if (summary) {
      emailContent += `${summary}\n\n`;
    }

    if (userId) {
      emailContent += `User ID: ${userId}\n`;
    }

    if (auctionId) {
      emailContent += `Auction ID: ${auctionId}\n`;
    }

    if (links && links.length > 0) {
      emailContent += '\nMedia Links:\n';
      links.forEach((link, index) => {
        emailContent += `${index + 1}. ${link}\n`;
      });
    }

    if (!emailContent.trim()) {
      emailContent = 'Mark App Export - No additional details provided.';
    }

    const emailData: {
      from: string;
      to: string[];
      subject: string;
      text: string;
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
      }>;
    } = {
      from: 'Mark App <no-reply@markapp.com>', // Update with your verified domain
      to: [toEmail],
      subject,
      text: emailContent,
    };

    // Attach CSV if provided
    if (csv) {
      emailData.attachments = [
        {
          filename: 'export.csv',
          content: csv,
          contentType: 'text/csv',
        },
      ];
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      console.error('Resend error:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
