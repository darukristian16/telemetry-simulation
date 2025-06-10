// Gas sensor data interface
interface GasSensorData {
  sensorValue: number;
}

// Compression result interface (consistent with other compressors)
interface CompressionMetrics {
  buffer: Buffer;
  compressionRatio?: number;
  processingTime?: number;
}

// Gas sensor types
type SensorType = 'CO' | 'NO2' | 'SO2';

// Sensor-specific configuration
interface SensorConfig {
  quantizationStep: number;
  deltaTable: { range: number; bits: number }[];
  maxValue: number; // Maximum expected sensor value
}

export class GasSensorCompressor {
  // Simple state tracking
  private lastValue: number | null = null;
  private sameCount: number = 0;
  private packetCounter: number = 0;
  
  // Sensor-specific settings
  private readonly sensorType: SensorType;
  private readonly config: SensorConfig;
  
  // RLE settings
  private readonly maxRLECount = 127; // 7-bit counter
  
  constructor(sensorType: SensorType) {
    this.sensorType = sensorType;
    this.config = this.getSensorConfig(sensorType);
    this.reset();
  }
  
  // Get sensor-specific configuration
  private getSensorConfig(sensorType: SensorType): SensorConfig {
    switch (sensorType) {
      case 'CO':
        return {
          quantizationStep: 1, // 1 ppm precision
          maxValue: 1023, // 10-bit ADC range
          deltaTable: [
            { range: 2, bits: 2 },   // ±2 ppm with 2 bits
            { range: 5, bits: 3 },   // ±5 ppm with 3 bits
            { range: 10, bits: 4 },  // ±10 ppm with 4 bits
            { range: 25, bits: 5 },  // ±25 ppm with 5 bits
            { range: 50, bits: 6 }   // ±50 ppm with 6 bits
          ]
        };
      
      case 'NO2':
        return {
          quantizationStep: 1, // 1 unit precision
          maxValue: 1023, // 10-bit ADC range
          deltaTable: [
            { range: 3, bits: 2 },   // ±3 units with 2 bits
            { range: 8, bits: 3 },   // ±8 units with 3 bits
            { range: 15, bits: 4 },  // ±15 units with 4 bits
            { range: 30, bits: 5 },  // ±30 units with 5 bits
            { range: 60, bits: 6 }   // ±60 units with 6 bits
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
  
  // Reset compressor state
  reset(): void {
    this.lastValue = null;
    this.sameCount = 0;
    this.packetCounter = 0;
  }
  
  // Quantize sensor value to reduce precision and improve compression
  private quantize(value: number): number {
    return Math.round(value / this.config.quantizationStep) * this.config.quantizationStep;
  }
  
  // Find optimal bits for delta encoding
  private findOptimalBits(delta: number): number {
    const absDelta = Math.abs(delta);
    
    for (const entry of this.config.deltaTable) {
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
    const steps = Math.round(delta / this.config.quantizationStep);
    
    // Encode as unsigned value with bias
    let encoded = Math.max(0, Math.min(maxVal, steps + halfRange));
    
    // Pack: [2-bit size indicator][6-bit delta value]
    const sizeIndicator = Math.min(3, Math.floor((bits - 2) / 2)); // 0-3 for 2,3,4,6 bits
    buffer.writeUInt8((sizeIndicator << 6) | (encoded & 0x3F), 0);
    
    return buffer;
  }
  
  // Create raw packet (2 bytes)
  private createRawPacket(sensorValue: number): Buffer {
    const buffer = Buffer.alloc(2);
    
    // Encode sensor value as: [1-bit raw flag][15-bit sensor value]
    // Clamp sensor value to 15-bit range (0-32767)
    const valueInt = Math.round(Math.max(0, Math.min(32767, sensorValue)));
    
    // Set raw flag (bit 15) and sensor value (bits 0-14)
    buffer.writeUInt16BE(0x8000 | valueInt, 0);
    
    return buffer;
  }
  
  // Create RLE packet (1 byte)
  private createRLEPacket(count: number): Buffer {
    const buffer = Buffer.alloc(1);
    
    // Encode as: [1-bit RLE flag in bit 6][7-bit count]
    const clampedCount = Math.max(1, Math.min(this.maxRLECount, count));
    buffer.writeUInt8(0x40 | clampedCount, 0); // 0x40 = RLE flag in bit 6
    
    return buffer;
  }
  
  // Main compression method
  compressData(rawData: GasSensorData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    try {
      // Extract and quantize sensor value
      const sensorValue = this.quantize(rawData.sensorValue);
      
      // First packet - send raw
      if (this.lastValue === null) {
        this.lastValue = sensorValue;
        this.packetCounter++;
        
        const buffer = this.createRawPacket(sensorValue);
        return this.createResult(buffer, rawData, showMetrics, startTime);
      }
      
      // Check for same value (RLE opportunity)
      if (Math.abs(sensorValue - this.lastValue) < this.config.quantizationStep / 2) {
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
      const delta = sensorValue - this.lastValue;
      const requiredBits = this.findOptimalBits(delta);
      
      // Update state
      this.lastValue = sensorValue;
      this.packetCounter++;
      
      let buffer: Buffer;
      
      if (requiredBits === -1) {
        // Delta too large - send raw packet
        buffer = this.createRawPacket(sensorValue);
      } else {
        // Send delta packet
        buffer = this.createDeltaPacket(delta, requiredBits);
      }
      
      return this.createResult(buffer, rawData, showMetrics, startTime);
      
    } catch (error) {
      console.error(`Error in ${this.sensorType}SensorCompressor:`, error);
      // Return raw packet as fallback
      const fallbackBuffer = this.createRawPacket(rawData.sensorValue || 0);
      return this.createResult(fallbackBuffer, rawData, showMetrics, startTime);
    }
  }
  
  // Create result object with optional metrics
  private createResult(
    buffer: Buffer, 
    rawData: GasSensorData, 
    showMetrics: boolean, 
    startTime: number
  ): CompressionMetrics {
    const result: CompressionMetrics = { buffer };
    
    if (showMetrics && buffer.length > 0) {
      // Calculate original size (JSON representation of sensor value)
      const originalSize = JSON.stringify({
        sensorValue: rawData.sensorValue
      }).length;
      
      const compressedSize = buffer.length;
      result.compressionRatio = originalSize > 0 ? originalSize / compressedSize : 1;
      result.processingTime = performance.now() - startTime;
    }
    
    return result;
  }
  
  // Get compression statistics
  getStats(): { 
    sensorType: SensorType;
    packetsProcessed: number;
  } {
    return {
      sensorType: this.sensorType,
      packetsProcessed: this.packetCounter
    };
  }
} 