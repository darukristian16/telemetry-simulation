import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Helper function to check authentication
async function isAuthenticated(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

// GET /api/quick-commands
export async function GET(request: NextRequest) {
  try {
    if (!await isAuthenticated(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (!await isAuthenticated(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, command, position } = body;

    if (!label || !command) {
      return NextResponse.json({ error: 'Label and command are required' }, { status: 400 });
    }

    const quickCommand = await prisma.quickCommand.create({
      data: {
        label: label.trim(),
        command: command.trim(),
        position: position || 0,
      },
    });

    return NextResponse.json(quickCommand);
  } catch (error) {
    console.error('Error creating quick command:', error);
    return NextResponse.json({ error: 'Failed to create quick command' }, { status: 500 });
  }
}

// PUT /api/quick-commands
export async function PUT(request: NextRequest) {
  try {
    if (!await isAuthenticated(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, label, command, position } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const quickCommand = await prisma.quickCommand.update({
      where: { id },
      data: {
        ...(label && { label: label.trim() }),
        ...(command && { command: command.trim() }),
        ...(position !== undefined && { position }),
      },
    });

    return NextResponse.json(quickCommand);
  } catch (error) {
    console.error('Error updating quick command:', error);
    return NextResponse.json({ error: 'Failed to update quick command' }, { status: 500 });
  }
}

// DELETE /api/quick-commands
export async function DELETE(request: NextRequest) {
  try {
    if (!await isAuthenticated(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.quickCommand.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: 'Quick command deleted' });
  } catch (error) {
    console.error('Error deleting quick command:', error);
    return NextResponse.json({ error: 'Failed to delete quick command' }, { status: 500 });
  }
} 