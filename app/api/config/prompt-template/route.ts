import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig, CONFIG_KEYS } from '@/lib/config';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// GET - Load current prompt template
export async function GET() {
  try {
    let template = await getConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE);

    // If no custom template, load default
    if (!template) {
      const defaultPath = path.join(process.cwd(), 'docs', 'prompt.txt');
      if (fs.existsSync(defaultPath)) {
        template = fs.readFileSync(defaultPath, 'utf-8');
      }
    }

    return NextResponse.json({ template: template || '' });
  } catch (error: any) {
    console.error('Failed to load prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to load prompt template' },
      { status: 500 }
    );
  }
}

// POST - Save prompt template
export async function POST(request: NextRequest) {
  try {
    const { template } = await request.json();

    if (typeof template !== 'string') {
      return NextResponse.json(
        { error: 'Invalid template format' },
        { status: 400 }
      );
    }

    await setConfig(CONFIG_KEYS.GEMINI_PROMPT_TEMPLATE, template);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to save prompt template' },
      { status: 500 }
    );
  }
}
