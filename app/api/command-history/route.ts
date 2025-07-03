import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Helper function to get user ID from session
async function getUserId(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return null;
  }
  
  // Get user ID from database to ensure it exists
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true }
  });
  
  return user?.id || null;
}

// GET /api/command-history
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const commandHistory = await prisma.commandHistory.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to last 50 commands
    });

    return NextResponse.json(commandHistory.map(c => c.command));
  } catch (error) {
    console.error('Error fetching command history:', error);
    return NextResponse.json({ error: 'Failed to fetch command history' }, { status: 500 });
  }
}

// POST /api/command-history
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { command } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Invalid command' }, { status: 400 });
    }

    // Create new command history entry for the user
    const commandHistory = await prisma.commandHistory.create({
      data: {
        userId: userId,
        command: command.trim(),
      },
    });

    return NextResponse.json(commandHistory);
  } catch (error) {
    console.error('Error adding command to history:', error);
    return NextResponse.json({ error: 'Failed to add command to history' }, { status: 500 });
  }
}

// DELETE /api/command-history
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear all command history for the user
    await prisma.commandHistory.deleteMany({
      where: {
        userId: userId,
      },
    });

    return NextResponse.json({ message: 'Command history cleared' });
  } catch (error) {
    console.error('Error clearing command history:', error);
    return NextResponse.json({ error: 'Failed to clear command history' }, { status: 500 });
  }
} 