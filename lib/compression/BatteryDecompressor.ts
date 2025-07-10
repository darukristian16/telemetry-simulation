interface BatteryData {
  voltage: number;
  current: number;
  percentage: number;
  status: string;
}

export class BatteryDecompressor {
  // Enhanced state tracking
  private lastVoltage: number | null = null;
  private lastCurrent: number | null = null;
  private lastPercentage: number | null = null;
  private lastStatus: string | null = null;
  
  // Compression settings (must match compressor)
  private readonly voltagePrecision = 100; // 0.01V precision
  private readonly currentPrecision = 100; // 0.01A precision 
  private readonly percentagePrecision = 20; // 0.05% precision

  constructor() {
    this.reset();
  }

  reset(): void {
    this.lastVoltage = null;
    this.lastCurrent = null;
    this.lastPercentage = null;
    this.lastStatus = null;
    console.log('🔋 BatteryDecompressor reset - conservative mode');
  }

  // Decompress skip packet (0 bytes)
  private decompressSkipPacket(): BatteryData | null {
    if (this.lastVoltage === null || this.lastCurrent === null || 
        this.lastPercentage === null || this.lastStatus === null) {
      console.error('❌ Battery: Skip packet received without previous data');
      return null;
    }

    console.log('📦 Battery: Skip packet decompressed (0 bytes) - using last values:', {
      voltage: this.lastVoltage,
      current: this.lastCurrent,
      percentage: this.lastPercentage,
      status: this.lastStatus
    });

    return {
      voltage: this.lastVoltage,
      current: this.lastCurrent,
      percentage: this.lastPercentage,
      status: this.lastStatus
    };
  }

  // Decompress compact raw packet (5 bytes)
  private decompressRawPacket(buffer: Buffer): BatteryData | null {
    if (buffer.length !== 5) {
      console.error('❌ Battery: Invalid raw packet size:', buffer.length, 'expected 5 bytes');
      return null;
    }

    const headerByte = buffer[0];
    if (headerByte < 0xF8) {
      console.error('❌ Battery: Invalid raw packet header:', headerByte.toString(16));
      return null;
    }

    try {
      // Extract status from header
      let status = 'Unknown';
      switch (headerByte) {
        case 0xF8: status = 'Discharging'; break;
        case 0xFA: status = 'Charging'; break;
        case 0xFC: status = 'Full'; break;
        case 0xFE: status = 'Unknown'; break;
        default: status = 'Unknown'; break;
      }

      // Extract voltage (1 byte, 0.01V precision, 3.0-5.55V range)
      const voltageScaled = buffer.readUInt8(1);
      const voltage = 3.0 + (voltageScaled / 100);
      
      // Extract current (1 byte signed, 0.02A precision, ±2.55A range)
      const currentScaled = buffer.readInt8(2);
      const current = currentScaled / 50;
      
      // Extract percentage (2 bytes, 0.05% precision)
      const percentageScaled = buffer.readUInt16BE(3);
      const percentage = percentageScaled / this.percentagePrecision;

      console.log('📦 Battery: Compact raw packet decompressed (5 bytes):', {
        headerByte: `0x${headerByte.toString(16)}`,
        voltageScaled, voltage: voltage.toFixed(2),
        currentScaled, current: current.toFixed(3),
        percentageScaled, percentage: percentage.toFixed(2),
        status,
        bufferHex: buffer.toString('hex')
      });

      // Update state
      this.lastVoltage = voltage;
      this.lastCurrent = current;
      this.lastPercentage = percentage;
      this.lastStatus = status;

      return { voltage, current, percentage, status };
      
    } catch (error) {
      console.error('❌ Battery: Error decompressing raw packet:', error);
      return null;
    }
  }

  // Decompress efficient delta packet (2 bytes)
  private decompressDeltaPacket(buffer: Buffer): BatteryData | null {
    if (buffer.length !== 2) {
      console.error('❌ Battery: Invalid delta packet size:', buffer.length, 'expected 2 bytes');
      return null;
    }

    if (this.lastVoltage === null || this.lastCurrent === null || 
        this.lastPercentage === null || this.lastStatus === null) {
      console.error('❌ Battery: Delta packet received without previous data');
      return null;
    }

    try {
      const header = buffer.readUInt8(0);
      
      // Extract voltage delta (5 bits, stored as 0-31)
      const vDeltaRaw = header & 0x1F;
      const vDeltaScaled = vDeltaRaw - 16; // Convert back to -16 to +15
      const voltageDelta = vDeltaScaled / this.voltagePrecision;
      
      // Extract current delta (2 bits for scale)
      const cDeltaBits = (header >> 5) & 0x03;
      let currentDelta = 0;
      switch (cDeltaBits) {
        case 0: currentDelta = 0; break; // No change
        case 1: currentDelta = 0.02; break; // Small positive change
        case 2: currentDelta = -0.02; break; // Small negative change
        case 3: currentDelta = 0.05; break; // Large change (approximated)
      }
      
      // Extract status changed flag
      const statusChanged = (header & 0x80) !== 0;
      
      // Extract percentage delta (second byte)
      const pDeltaScaled = buffer.readInt8(1);
      const percentageDelta = pDeltaScaled / this.percentagePrecision;

      console.log('📦 Battery: Efficient delta packet decompressed (2 bytes):', {
        header: `0x${header.toString(16)}`,
        statusChanged,
        vDeltaRaw, vDeltaScaled, voltageDelta: voltageDelta.toFixed(4),
        cDeltaBits, currentDelta: currentDelta.toFixed(3),
        pDeltaScaled, percentageDelta: percentageDelta.toFixed(3),
        bufferHex: buffer.toString('hex')
      });

      // Apply deltas
      const voltage = this.lastVoltage + voltageDelta;
      const current = this.lastCurrent + currentDelta;
      const percentage = this.lastPercentage + percentageDelta;

      // Status doesn't change in delta packets (status changes use raw packets)
      const status = this.lastStatus;

      console.log('🔋 Battery: Delta result:', {
        previous: { 
          voltage: this.lastVoltage.toFixed(2), 
          current: this.lastCurrent.toFixed(3), 
          percentage: this.lastPercentage.toFixed(2), 
          status: this.lastStatus 
        },
        deltas: { 
          voltageDelta: voltageDelta.toFixed(4), 
          currentDelta: currentDelta.toFixed(3), 
          percentageDelta: percentageDelta.toFixed(3) 
        },
        result: { 
          voltage: voltage.toFixed(2), 
          current: current.toFixed(3), 
          percentage: percentage.toFixed(2), 
          status 
        }
      });

      // Update state
      this.lastVoltage = voltage;
      this.lastCurrent = current;
      this.lastPercentage = percentage;
      this.lastStatus = status;

      return { voltage, current, percentage, status };
      
    } catch (error) {
      console.error('❌ Battery: Error decompressing delta packet:', error);
      return null;
    }
  }

  // Main decompression method
  decompressData(buffer: Buffer): BatteryData | null {
    if (!buffer) {
      console.error('❌ Battery: Null buffer');
      return null;
    }

    console.log('📦 Battery: Decompressing buffer (conservative mode):', {
      length: buffer.length,
      hex: buffer.toString('hex'),
      firstByte: buffer.length > 0 ? `0x${buffer[0].toString(16)}` : 'N/A'
    });

    try {
      if (buffer.length === 0) {
        // Skip packet (0 bytes)
        return this.decompressSkipPacket();
      } else if (buffer.length === 2) {
        // Efficient delta packet (2 bytes)
        return this.decompressDeltaPacket(buffer);
      } else if (buffer.length === 5 && buffer[0] >= 0xF8) {
        // Compact raw packet (5 bytes with 0xF8-0xFF header)
        return this.decompressRawPacket(buffer);
      } else {
        console.error('❌ Battery: Unknown packet format:', {
          length: buffer.length,
          firstByte: buffer[0]?.toString(16),
          hex: buffer.toString('hex')
        });
        return null;
      }
    } catch (error) {
      console.error('❌ Battery: Decompression error:', error);
      return null;
    }
  }
} 