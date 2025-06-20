import { NextRequest, NextResponse } from 'next/server';
import { useSerialStore } from '@/lib/store';

// GET handler - returns raw serial port data
export async function GET(request: NextRequest) {
  try {
    const { terminalContent } = useSerialStore.getState();
    
    // Return the raw terminal content
    return NextResponse.json({
      data: terminalContent
    }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch serial port data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch serial port data' }, 
      { status: 500 }
    );
  }
} 