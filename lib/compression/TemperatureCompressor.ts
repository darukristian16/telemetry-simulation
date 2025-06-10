// Temperature data interface
interface TemperatureData {
  temperature: number;
  voltage: number;
}

// Compression result interface (consistent with other compressors)
interface CompressionMetrics {
  buffer: Buffer;
  compressionRatio?: number;
  processingTime?: number;
}

export class TemperatureCompressor {
  // Simple state tracking
  private lastTemperature: number | null = null;
  private sameCount: number = 0;
  private packetCounter: number = 0;
  
  // Quantization settings
  private readonly quantizationStep = 0.1; // 0.1°C precision
  
  // Variable-length delta encoding table
  private readonly deltaTable = [
    { range: 0.2, bits: 2 },  // ±0.2°C with 2 bits (4 values)
    { range: 0.5, bits: 3 },  // ±0.5°C with 3 bits (8 values)
    { range: 1.0, bits: 4 },  // ±1.0°C with 4 bits (16 values)
    { range: 2.0, bits: 6 }   // ±2.0°C with 6 bits (64 values)
  ];
  
  // RLE settings
  private readonly maxRLECount = 127; // 7-bit counter
  
  constructor() {
    // Initialize state
    this.reset();
  }
  
  // Reset compressor state
  reset(): void {
    this.lastTemperature = null;
    this.sameCount = 0;
    this.packetCounter = 0;
  }
  
  // Quantize temperature to reduce precision and improve compression
  private quantize(temperature: number): number {
    return Math.round(temperature / this.quantizationStep) * this.quantizationStep;
  }
  
  // Find optimal bits for delta encoding
  private findOptimalBits(delta: number): number {
    const absDelta = Math.abs(delta);
    
    for (const entry of this.deltaTable) {
      if (absDelta <= entry.range) {
        return entry.bits;
      }
    }
    
    // If delta is too large, force raw packet
    return -1;
  }
  
  // Create delta packet (1 byte)
  private createDeltaPacket(delta: number, bits: number): Buffer {
    const buffer = Buffer.alloc(1);
    
    // Encode delta value in the specified number of bits
    const maxVal = (1 << bits) - 1;
    const halfRange = 1 << (bits - 1);
    
    // Convert delta to quantized steps
    const steps = Math.round(delta / this.quantizationStep);
    
    // Encode as unsigned value with bias
    let encoded = Math.max(0, Math.min(maxVal, steps + halfRange));
    
    // Pack: [2-bit size indicator][6-bit delta value]
    const sizeIndicator = Math.min(3, Math.floor((bits - 2) / 2)); // 0-3 for 2,3,4,6 bits
    buffer.writeUInt8((sizeIndicator << 6) | (encoded & 0x3F), 0);
    
    return buffer;
  }
  
  // Create raw packet (2 bytes)
  private createRawPacket(temperature: number): Buffer {
    const buffer = Buffer.alloc(2);
    
    // Encode temperature as: [1-bit raw flag][15-bit temp×10]
    // Temperature range: 0-3276.7°C (should cover all realistic cases)
    const tempInt = Math.round(Math.max(0, Math.min(32767, temperature * 10)));
    
    // Set raw flag (bit 15) and temperature value (bits 0-14)
    buffer.writeUInt16BE(0x8000 | tempInt, 0);
    
    return buffer;
  }
  
  // Create RLE packet (1 byte)
  private createRLEPacket(count: number): Buffer {
    const buffer = Buffer.alloc(1);
    
    // Encode as: [1-bit RLE flag][7-bit count]
    // RLE flag = 0, Raw flag = 1, Delta packets have neither flag set in MSB
    const clampedCount = Math.max(1, Math.min(this.maxRLECount, count));
    buffer.writeUInt8(0x40 | clampedCount, 0); // 0x40 = RLE flag in bit 6
    
    return buffer;
  }
  
  // Main compression method
  compressData(rawData: TemperatureData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    try {
      // Extract and quantize temperature
      const temperature = this.quantize(rawData.temperature);
      
      // First packet - send raw
      if (this.lastTemperature === null) {
        this.lastTemperature = temperature;
        this.packetCounter++;
        
        const buffer = this.createRawPacket(temperature);
        return this.createResult(buffer, rawData, showMetrics, startTime);
      }
      
      // Check for same value (RLE opportunity)
      if (Math.abs(temperature - this.lastTemperature) < this.quantizationStep / 2) {
        this.sameCount++;
        
        // Send RLE packet when we have enough repetitions
        if (this.sameCount === 1) {
          // First repeat - send RLE packet
          const buffer = this.createRLEPacket(this.sameCount);
          this.packetCounter++;
          return this.createResult(buffer, rawData, showMetrics, startTime);
        } else if (this.sameCount < this.maxRLECount) {
          // Continue RLE run - don't send packet
          return this.createResult(Buffer.alloc(0), rawData, showMetrics, startTime);
        } else {
          // Reset RLE when max count reached
          this.sameCount = 0;
          const buffer = this.createRLEPacket(this.maxRLECount);
          this.packetCounter++;
          return this.createResult(buffer, rawData, showMetrics, startTime);
        }
      }
      
      // Reset RLE counter
      this.sameCount = 0;
      
      // Calculate delta
      const delta = temperature - this.lastTemperature;
      const requiredBits = this.findOptimalBits(delta);
      
      // Update state
      this.lastTemperature = temperature;
      this.packetCounter++;
      
      let buffer: Buffer;
      
      if (requiredBits === -1) {
        // Delta too large - send raw packet
        buffer = this.createRawPacket(temperature);
      } else {
        // Send delta packet
        buffer = this.createDeltaPacket(delta, requiredBits);
      }
      
      return this.createResult(buffer, rawData, showMetrics, startTime);
      
    } catch (error) {
      console.error("Error in TemperatureCompressor:", error);
      // Return raw packet as fallback
      const fallbackBuffer = this.createRawPacket(rawData.temperature || 25.0);
      return this.createResult(fallbackBuffer, rawData, showMetrics, startTime);
    }
  }
  
  // Create result object with optional metrics
  private createResult(
    buffer: Buffer, 
    rawData: TemperatureData, 
    showMetrics: boolean, 
    startTime: number
  ): CompressionMetrics {
    const result: CompressionMetrics = { buffer };
    
    if (showMetrics && buffer.length > 0) {
      // Calculate original size (JSON representation of temperature + voltage)
      const originalSize = JSON.stringify({
        temperature: rawData.temperature,
        voltage: rawData.voltage
      }).length;
      
      const compressedSize = buffer.length;
      result.compressionRatio = originalSize > 0 ? originalSize / compressedSize : 1;
      result.processingTime = performance.now() - startTime;
    }
    
    return result;
  }
  
  // Get compression statistics
  getStats(): { packetsProcessed: number } {
    return {
      packetsProcessed: this.packetCounter
    };
  }
} 