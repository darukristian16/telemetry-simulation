interface TemperatureData {
  temperature: number;
  voltage: number;
}

export class TemperatureDecompressor {
  // State tracking (mirrors compressor state)
  private lastTemperature: number | null = null;
  
  // Quantization settings (must match compressor)
  private readonly quantizationStep = 0.1; // 0.1°C precision

  constructor() {
    this.reset();
  }

  // Reset decompressor state
  reset(): void {
    this.lastTemperature = null;
  }

  // Main decompression method
  decompress(buffer: Buffer): TemperatureData | null {
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
      console.error('Error decompressing temperature data:', error);
      return null;
    }
  }

  // Decompress raw packet (2 bytes)
  private decompressRawPacket(buffer: Buffer): TemperatureData {
    if (buffer.length < 2) {
      throw new Error('Invalid raw packet size');
    }

    // Read 15-bit temperature value (bit 15 is raw flag)
    const value = buffer.readUInt16BE(0) & 0x7FFF;
    const temperature = value / 10; // Convert back from integer

    // Update state
    this.lastTemperature = temperature;

    return {
      temperature,
      voltage: temperature / 100 // LM35 formula: voltage = temperature/100
    };
  }

  // Decompress delta packet (1 byte)
  private decompressDeltaPacket(buffer: Buffer): TemperatureData {
    if (this.lastTemperature === null) {
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
    const temperatureDelta = signedDelta * this.quantizationStep;

    // Apply delta to get new temperature
    const temperature = this.lastTemperature + temperatureDelta;

    // Update state
    this.lastTemperature = temperature;

    return {
      temperature,
      voltage: temperature / 100 // LM35 formula
    };
  }

  // Decompress RLE packet (unchanged values)
  private decompressRLEPacket(): TemperatureData {
    if (this.lastTemperature === null) {
      throw new Error('Cannot decompress RLE packet without previous state');
    }

    // Return last known temperature
    return {
      temperature: this.lastTemperature,
      voltage: this.lastTemperature / 100
    };
  }

  // Get current state (for debugging)
  getState(): any {
    return {
      lastTemperature: this.lastTemperature
    };
  }
} 