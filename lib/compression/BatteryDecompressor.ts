interface BatteryData {
  voltage: number;
  current: number;
  percentage: number;
  status: string;
}

export class BatteryDecompressor {
  // State tracking (mirrors compressor state)
  private lastVoltage: number | null = null;
  private lastCurrent: number | null = null;
  private lastPercentage: number | null = null;
  private lastStatus: string | null = null;
  
  // Quantization settings (must match compressor)
  private readonly voltageQuantization = 0.001; // 1mV precision
  private readonly currentQuantization = 0.001; // 1mA precision  
  private readonly percentageQuantization = 0.1; // 0.1% precision

  constructor() {
    this.reset();
  }

  // Reset decompressor state
  reset(): void {
    this.lastVoltage = null;
    this.lastCurrent = null;
    this.lastPercentage = null;
    this.lastStatus = null;
  }

  // Main decompression method
  decompress(buffer: Buffer): BatteryData | null {
    if (!buffer || buffer.length === 0) {
      return null; // Empty buffer (RLE continuation)
    }

    try {
      const header = buffer.readUInt8(0);

      // Check packet type using header bits
      if (header & 0x01) {
        // RAW PACKET (bit 0 = 1)
        return this.decompressRawPacket(buffer);
      } else if (header & 0x80) {
        // RLE PACKET (bit 7 = 1)
        return this.decompressRLEPacket();
      } else {
        // DELTA PACKET
        return this.decompressDeltaPacket(buffer);
      }
    } catch (error) {
      console.error('Error decompressing battery data:', error);
      return null;
    }
  }

  // Decompress raw packet (variable size)
  private decompressRawPacket(buffer: Buffer): BatteryData {
    if (buffer.length < 8) {
      throw new Error('Invalid raw packet size');
    }

    const header = buffer.readUInt8(0);
    
    // Read voltage (16-bit, mV)
    const voltageInt = buffer.readUInt16BE(1);
    const voltage = voltageInt / 1000; // Convert back to volts
    
    // Read current (16-bit signed, mA) 
    const currentInt = buffer.readInt16BE(3);
    const current = currentInt / 1000; // Convert back to amps
    
    // Read percentage (16-bit, 0.1% precision)
    const percentageInt = buffer.readUInt16BE(5);
    const percentage = percentageInt / 10; // Convert back to percentage
    
    // Read status (1 byte)
    const statusByte = buffer.readUInt8(7);
    const status = statusByte === 1 ? 'Charging' : 'Discharging';

    // Update state
    this.lastVoltage = voltage;
    this.lastCurrent = current;
    this.lastPercentage = percentage;
    this.lastStatus = status;

    return {
      voltage,
      current,
      percentage,
      status
    };
  }

  // Decompress delta packet (variable size)
  private decompressDeltaPacket(buffer: Buffer): BatteryData {
    if (this.lastVoltage === null || this.lastCurrent === null || 
        this.lastPercentage === null || this.lastStatus === null) {
      throw new Error('Cannot decompress delta packet without previous state');
    }

    const header = buffer.readUInt8(0);
    
    // Extract field presence flags from header
    const hasVoltage = (header & 0x02) !== 0;   // bit 1
    const hasCurrent = (header & 0x04) !== 0;   // bit 2
    const hasPercentage = (header & 0x08) !== 0; // bit 3
    const hasStatus = (header & 0x10) !== 0;    // bit 4
    
    let offset = 1;
    let voltage = this.lastVoltage;
    let current = this.lastCurrent;
    let percentage = this.lastPercentage;
    let status = this.lastStatus;

    // Read voltage delta if present
    if (hasVoltage && offset < buffer.length) {
      const voltageDelta = buffer.readInt8(offset);
      voltage = this.lastVoltage + (voltageDelta * this.voltageQuantization);
      offset++;
    }

    // Read current delta if present
    if (hasCurrent && offset < buffer.length) {
      const currentDelta = buffer.readInt8(offset);
      current = this.lastCurrent + (currentDelta * this.currentQuantization);
      offset++;
    }

    // Read percentage delta if present
    if (hasPercentage && offset < buffer.length) {
      const percentageDelta = buffer.readInt8(offset);
      percentage = this.lastPercentage + (percentageDelta * this.percentageQuantization);
      offset++;
    }

    // Read status if present
    if (hasStatus && offset < buffer.length) {
      const statusByte = buffer.readUInt8(offset);
      status = statusByte === 1 ? 'Charging' : 'Discharging';
      offset++;
    }

    // Clamp values to valid ranges
    voltage = Math.max(0, Math.min(5, voltage));
    current = Math.max(-10, Math.min(10, current));
    percentage = Math.max(0, Math.min(100, percentage));

    // Update state
    this.lastVoltage = voltage;
    this.lastCurrent = current;
    this.lastPercentage = percentage;
    this.lastStatus = status;

    return {
      voltage,
      current,
      percentage,
      status
    };
  }

  // Decompress RLE packet (unchanged values)
  private decompressRLEPacket(): BatteryData {
    if (this.lastVoltage === null || this.lastCurrent === null || 
        this.lastPercentage === null || this.lastStatus === null) {
      throw new Error('Cannot decompress RLE packet without previous state');
    }

    // Return last known battery values
    return {
      voltage: this.lastVoltage,
      current: this.lastCurrent,
      percentage: this.lastPercentage,
      status: this.lastStatus
    };
  }

  // Get current state (for debugging)
  getState(): any {
    return {
      lastVoltage: this.lastVoltage,
      lastCurrent: this.lastCurrent,
      lastPercentage: this.lastPercentage,
      lastStatus: this.lastStatus
    };
  }
} 