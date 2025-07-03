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

// GET /api/serial
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's serial connection
    const serialConnection = await prisma.serialConnection.findUnique({
      where: {
        userId: userId,
      },
    });

    // Get the user's command history (latest 50)
    const commandHistory = await prisma.commandHistory.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Get the quick commands (these are global for now)
    const quickCommands = await prisma.quickCommand.findMany({
      orderBy: {
        position: 'asc',
      },
    });

    return NextResponse.json({ 
      serialConnection: serialConnection || {}, 
      commandHistory: commandHistory.map(c => c.command),
      quickCommands: quickCommands
    });
  } catch (error) {
    console.error('Error fetching serial data:', error);
    return NextResponse.json({ error: 'Failed to fetch serial data' }, { status: 500 });
  }
}

// POST /api/serial
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { connected, baudRate, dataBits, stopBits, parity, lastData } = body;

    // Update or create user-specific serial connection
    const serialConnection = await prisma.serialConnection.upsert({
      where: {
        userId: userId,
      },
      update: {
        baudRate: baudRate || 9600,
        dataBits: dataBits || 8,
        stopBits: stopBits || 1,
        parity: parity || 'none',
        connected: connected !== undefined ? connected : false,
        lastData: lastData !== undefined ? lastData : '',
      },
      create: {
        userId: userId,
        baudRate: baudRate || 9600,
        dataBits: dataBits || 8,
        stopBits: stopBits || 1,
        parity: parity || 'none',
        connected: connected !== undefined ? connected : false,
        lastData: lastData !== undefined ? lastData : '',
      },
    });

    return NextResponse.json(serialConnection);
  } catch (error) {
    console.error('Error updating serial data:', error);
    return NextResponse.json({ error: 'Failed to update serial data' }, { status: 500 });
  }
}

// DELETE /api/serial
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset user's serial connection
    await prisma.serialConnection.updateMany({
      where: {
        userId: userId,
      },
      data: {
        connected: false,
        lastData: '',
      },
    });

    return NextResponse.json({ message: 'Serial data reset' });
  } catch (error) {
    console.error('Error resetting serial data:', error);
    return NextResponse.json({ error: 'Failed to reset serial data' }, { status: 500 });
  }
} 