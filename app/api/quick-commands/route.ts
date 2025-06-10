import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/quick-commands
export async function GET() {
  try {
    const quickCommands = await prisma.quickCommand.findMany({
      orderBy: {
        position: 'asc',
      },
    });

    return NextResponse.json(quickCommands);
  } catch (error) {
    console.error('Error fetching quick commands:', error);
    return NextResponse.json({ error: 'Failed to fetch quick commands' }, { status: 500 });
  }
}

// POST /api/quick-commands
export async function POST(request: NextRequest) {
  try {
    const { label, command, position } = await request.json();

    if (!label || !command) {
      return NextResponse.json({ error: 'Label and command are required' }, { status: 400 });
    }

    const newQuickCommand = await prisma.quickCommand.create({
      data: {
        label,
        command,
        position: position || 0,
      },
    });

    return NextResponse.json(newQuickCommand);
  } catch (error) {
    console.error('Error creating quick command:', error);
    return NextResponse.json({ error: 'Failed to create quick command' }, { status: 500 });
  }
}

// PUT /api/quick-commands
export async function PUT(request: NextRequest) {
  try {
    const { id, label, command, position } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Command ID is required' }, { status: 400 });
    }

    const updatedQuickCommand = await prisma.quickCommand.update({
      where: {
        id: id,
      },
      data: {
        label: label,
        command: command,
        position: position,
      },
    });

    return NextResponse.json(updatedQuickCommand);
  } catch (error) {
    console.error('Error updating quick command:', error);
    return NextResponse.json({ error: 'Failed to update quick command' }, { status: 500 });
  }
}

// DELETE /api/quick-commands/:id
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'Command ID is required' }, { status: 400 });
    }

    await prisma.quickCommand.delete({
      where: {
        id: id,
      },
    });

    return NextResponse.json({ message: 'Quick command deleted' });
  } catch (error) {
    console.error('Error deleting quick command:', error);
    return NextResponse.json({ error: 'Failed to delete quick command' }, { status: 500 });
  }
} 