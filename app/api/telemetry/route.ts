import { PrismaClient } from '@prisma/client';
import { getPacketErrorRate } from '@/lib/channel-models'; // Import our new engine

const prisma = new PrismaClient();

// Define realistic packet sizes for your analysis
const PACKET_SIZES = {
  Uncompressed: 112, // Based on a typical full telemetry payload
  Compressed: 18,    // Based on a realistic 6x compression ratio
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('environment') as 'LOS' | 'NLOS' | null;
  const distance = searchParams.get('distance');
  const dataMode = searchParams.get('dataMode') as 'Uncompressed' | 'Compressed' | null;

  // If simulation parameters are present, run the channel model
  if (environment && distance && dataMode) {
    const simulationParams = {
      environment,
      distance: parseFloat(distance),
      packetSizeBytes: PACKET_SIZES[dataMode],
    };

    const per = getPacketErrorRate(simulationParams);

    // Simulate the packet loss
    if (Math.random() < per) {
      // Return a specific status code (204 No Content) to indicate a simulated loss.
      // The frontend will know not to count this as a successful reception.
      return new Response(null, { status: 204 });
    }
  }

  // If not simulating or if the packet survives, proceed with the original logic
  return new Response(JSON.stringify({ message: "No simulation parameters provided." }), { status: 200 });
}

export async function POST(req: Request) {
  // The POST handler for receiving data from the simulation script remains unchanged.
  const { gnss, battery, temperature, gas } = await req.json();
  try {
    const newTelemetry = await prisma.telemetry.create({
      data: { gnss, battery, temperature, gas },
    });
    return new Response(JSON.stringify(newTelemetry), { status: 201 });
  } catch (error) {
    console.error("Failed to create telemetry data:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), { status: 500 });
  }
}
// import { NextRequest, NextResponse } from 'next/server';
// import { useSerialStore } from '@/lib/store';

// // GET handler - returns raw serial port data
// export async function GET(request: NextRequest) {
//   try {
//     const { terminalContent } = useSerialStore.getState();
    
//     // Return the raw terminal content
//     return NextResponse.json({
//       data: terminalContent
//     }, { status: 200 });
//   } catch (error) {
//     console.error('Failed to fetch serial port data:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch serial port data' }, 
//       { status: 500 }
//     );
//   }
// } 