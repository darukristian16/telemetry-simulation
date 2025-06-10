interface GasSensorData {
  sensorValue: number;
}

type SensorType = 'CO' | 'NO2' | 'SO2';

interface SensorConfig {
  quantizationStep: number;
  deltaTable: { range: number; bits: number }[];
  maxValue: number;
}

export class GasSensorDecompressor {
  // State tracking (mirrors compressor state)
  private lastValue: number | null = null;
  
  // Sensor configuration
  private readonly sensorType: SensorType;
  private readonly config: SensorConfig;

  constructor(sensorType: SensorType) {
    this.sensorType = sensorType;
    this.config = this.getSensorConfig(sensorType);
    this.reset();
  }

  // Get sensor-specific configuration (must match compressor)
  private getSensorConfig(sensorType: SensorType): SensorConfig {
    switch (sensorType) {
      case 'CO':
        return {
          quantizationStep: 0.1, // 0.1 unit precision
          maxValue: 1023, // 10-bit ADC range
          deltaTable: [
            { range: 0.2, bits: 2 },  // ±0.2 units with 2 bits
            { range: 0.5, bits: 3 },  // ±0.5 units with 3 bits
            { range: 1.0, bits: 4 },  // ±1.0 units with 4 bits
            { range: 2.0, bits: 5 },  // ±2.0 units with 5 bits
            { range: 5.0, bits: 6 }   // ±5.0 units with 6 bits
          ]
        };
      
      case 'NO2':
        return {
          quantizationStep: 1, // 1 unit precision
          maxValue: 1023, // 10-bit ADC range
          deltaTable: [
            { range: 2, bits: 2 },   // ±2 units with 2 bits
            { range: 5, bits: 3 },   // ±5 units with 3 bits
            { range: 10, bits: 4 },  // ±10 units with 4 bits
            { range: 15, bits: 5 },  // ±15 units with 5 bits
            { range: 30, bits: 6 }   // ±30 units with 6 bits
          ]
        };
      
      case 'SO2':
        return {
          quantizationStep: 1, // 1 unit precision
          maxValue: 1023, // 10-bit ADC range
          deltaTable: [
            { range: 1, bits: 2 },   // ±1 unit with 2 bits
            { range: 3, bits: 3 },   // ±3 units with 3 bits
            { range: 7, bits: 4 },   // ±7 units with 4 bits
            { range: 15, bits: 5 },  // ±15 units with 5 bits
            { range: 30, bits: 6 }   // ±30 units with 6 bits
          ]
        };
      
      default:
        throw new Error(`Unknown sensor type: ${sensorType}`);
    }
  }

  // Reset decompressor state
  reset(): void {
    this.lastValue = null;
  }

  // Main decompression method
  decompress(buffer: Buffer): GasSensorData | null {
    if (!buffer || buffer.length === 0) {
      return null; // Empty buffer (RLE continuation)
    }

    try {
      const firstByte = buffer.readUInt8(0);

      // Check packet type using header bits
      if (firstByte & 0x80) {
        // RAW PACKET (bit 7 = 1)
        return this.decompressRawPacket(buffer);
      } else if (firstByte & 0x40) {
        // RLE PACKET (bit 6 = 1)
        return this.decompressRLEPacket();
      } else {
        // DELTA PACKET
        return this.decompressDeltaPacket(buffer);
      }
    } catch (error) {
      console.error(`Error decompressing ${this.sensorType} sensor data:`, error);
      return null;
    }
  }

  // Decompress raw packet (2 bytes)
  private decompressRawPacket(buffer: Buffer): GasSensorData {
    if (buffer.length < 2) {
      throw new Error('Invalid raw packet size');
    }

    // Read 15-bit sensor value (bit 15 is raw flag)
    const sensorValue = buffer.readUInt16BE(0) & 0x7FFF;

    // Update state
    this.lastValue = sensorValue;

    return { sensorValue };
  }

  // Decompress delta packet (1 byte)
  private decompressDeltaPacket(buffer: Buffer): GasSensorData {
    if (this.lastValue === null) {
      throw new Error('Cannot decompress delta packet without previous state');
    }

    const firstByte = buffer.readUInt8(0);

    // Extract size indicator and delta value
    const sizeIndicator = (firstByte >> 6) & 0x03;  // bits 6-7
    const deltaValue = firstByte & 0x3F;            // bits 0-5

    // Determine bit count from size indicator
    const bitCounts = [2, 3, 4, 6];
    const bits = bitCounts[sizeIndicator];

    // Convert back to signed delta
    const halfRange = 1 << (bits - 1);
    const signedDelta = deltaValue - halfRange;
    const sensorDelta = signedDelta * this.config.quantizationStep;

    // Apply delta to get new sensor value
    const sensorValue = Math.max(0, Math.min(this.config.maxValue, this.lastValue + sensorDelta));

    // Update state
    this.lastValue = sensorValue;

    return { sensorValue };
  }

  // Decompress RLE packet (unchanged values)
  private decompressRLEPacket(): GasSensorData {
    if (this.lastValue === null) {
      throw new Error('Cannot decompress RLE packet without previous state');
    }

    // Return last known sensor value
    return { sensorValue: this.lastValue };
  }

  // Get current state (for debugging)
  getState(): any {
    return {
      sensorType: this.sensorType,
      lastValue: this.lastValue
    };
  }
} 