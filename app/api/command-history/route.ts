import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/command-history
export async function GET() {
  try {
    const commandHistory = await prisma.commandHistory.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json(commandHistory);
  } catch (error) {
    console.error('Error fetching command history:', error);
    return NextResponse.json({ error: 'Failed to fetch command history' }, { status: 500 });
  }
}

// POST /api/command-history
export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const newCommand = await prisma.commandHistory.create({
      data: {
        command,
      },
    });

    return NextResponse.json(newCommand);
  } catch (error) {
    console.error('Error saving command:', error);
    return NextResponse.json({ error: 'Failed to save command' }, { status: 500 });
  }
}

// DELETE /api/command-history
export async function DELETE() {
  try {
    await prisma.commandHistory.deleteMany({});
    return NextResponse.json({ message: 'Command history cleared' });
  } catch (error) {
    console.error('Error clearing command history:', error);
    return NextResponse.json({ error: 'Failed to clear command history' }, { status: 500 });
  }
} 