import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/serial
export async function GET() {
  try {
    // Get the most recent serial connection
    const serialConnection = await prisma.serialConnection.findFirst({
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Get the command history (latest 50)
    const commandHistory = await prisma.commandHistory.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Get the quick commands, ordered by position
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
    const body = await request.json();
    const { connected, baudRate, dataBits, stopBits, parity, lastData } = body;

    // Update or create serial connection
    const serialConnection = await prisma.serialConnection.upsert({
      where: {
        id: 1, // We'll always use ID 1 for simplicity
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
        id: 1,
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
export async function DELETE() {
  try {
    // Reset serial connection
    await prisma.serialConnection.updateMany({
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