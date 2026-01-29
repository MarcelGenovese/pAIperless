import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// GET - Load default prompt template from docs/prompt.txt
export async function GET() {
  try {
    const defaultPath = path.join(process.cwd(), 'docs', 'prompt.txt');

    if (!fs.existsSync(defaultPath)) {
      return NextResponse.json(
        { error: 'Default prompt template not found' },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(defaultPath, 'utf-8');

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Failed to load default prompt template:', error);
    return NextResponse.json(
      { error: 'Failed to load default prompt template' },
      { status: 500 }
    );
  }
}
