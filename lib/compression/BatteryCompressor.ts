interface BatteryData {
  voltage: number;
  current: number;
  percentage: number;
  status: string;
}

interface CompressionMetrics {
  buffer: Buffer;
  compressionRatio?: number;
  processingTime?: number;
}

export class BatteryCompressor {
  // Improved compression state tracking
  private lastVoltage: number | null = null;
  private lastCurrent: number | null = null;
  private lastPercentage: number | null = null;
  private lastStatus: string | null = null;
  private packetCounter = 0;
  private skipCount = 0;
  private stableCount = 0; // Track stability for adaptive compression
  
  // Enhanced compression settings for higher ratios
  private readonly voltagePrecision = 100; // 0.01V precision
  private readonly currentPrecision = 100; // 0.01A precision 
  private readonly percentagePrecision = 20; // 0.05% precision
  private readonly rawPacketInterval = 40; // Send raw every 40 packets (more frequent sync)
  private readonly maxSkips = 8; // Conservative skips for better change detection
  private readonly maxStableSkips = 15; // Conservative stable skips

  constructor() {
    this.reset();
  }

  reset(): void {
    this.lastVoltage = null;
    this.lastCurrent = null;
    this.lastPercentage = null;
    this.lastStatus = null;
    this.packetCounter = 0;
    this.skipCount = 0;
    this.stableCount = 0;
    console.log('🔋 BatteryCompressor reset - conservative compression mode');
  }

  // Create skip packet (0 bytes) - infinite compression ratio
  private createSkipPacket(): Buffer {
    console.log('📦 Battery: Skip packet (0 bytes) - ∞:1 compression');
    return Buffer.alloc(0);
  }

  // Create compact raw packet (5 bytes) - reliable format
  private createRawPacket(data: BatteryData): Buffer {
    const buffer = Buffer.alloc(5);
    
    // Header: 0xF8-0xFF = raw packet marker with status encoded
    // 0xF8 = Discharging, 0xFA = Charging, 0xFC = Full, 0xFE = Unknown
    let headerByte = 0xF8; // Default to Discharging
    switch (data.status.toLowerCase()) {
      case 'charging': headerByte = 0xFA; break;
      case 'full': headerByte = 0xFC; break;
      case 'unknown': headerByte = 0xFE; break;
      default: headerByte = 0xF8; // discharging
    }
    buffer.writeUInt8(headerByte, 0);
    
    // Voltage: 1 byte, 0.01V precision, 3.0-5.55V range
    const voltageScaled = Math.max(0, Math.min(255, Math.round((data.voltage - 3.0) * 100)));
    buffer.writeUInt8(voltageScaled, 1);
    
    // Current: 1 byte signed, 0.02A precision, ±2.55A range
    const currentScaled = Math.max(-127, Math.min(127, Math.round(data.current * 50)));
    buffer.writeInt8(currentScaled, 2);
    
    // Percentage: 2 bytes, 0.05% precision for small changes
    const percentageScaled = Math.max(0, Math.min(65535, Math.round(data.percentage * this.percentagePrecision)));
    buffer.writeUInt16BE(percentageScaled, 3);

    console.log('📦 Battery: Compact raw packet (5 bytes):', {
      voltage: data.voltage,
      voltageScaled: `${voltageScaled} (${(3.0 + voltageScaled/100).toFixed(2)}V)`,
      current: data.current,
      currentScaled: `${currentScaled} (${(currentScaled/50).toFixed(3)}A)`,
      percentage: data.percentage,
      percentageScaled: `${percentageScaled} (${(percentageScaled/this.percentagePrecision).toFixed(2)}%)`,
      status: data.status,
      headerByte: `0x${headerByte.toString(16)}`,
      bufferHex: buffer.toString('hex')
    });

    return buffer;
  }

  // Create efficient delta packet (2 bytes) - good compression
  private createDeltaPacket(voltageDelta: number, currentDelta: number, percentageDelta: number, statusChanged: boolean, newStatus?: string): Buffer {
    const buffer = Buffer.alloc(2);
    
    // First byte: SCCVVVVV (S=status changed, CC=current delta scale, VVVVV=voltage delta)
    let header = 0;
    
    // Voltage delta: 5 bits, -0.16V to +0.15V in 0.01V steps
    const vDeltaScaled = Math.max(-16, Math.min(15, Math.round(voltageDelta * this.voltagePrecision)));
    header |= (vDeltaScaled + 16) & 0x1F; // Store as 0-31
    
    // Current delta: 2 bits for scale
    let cDeltaBits = 0;
    const absCurrent = Math.abs(currentDelta);
    if (absCurrent < 0.01) {
      cDeltaBits = 0; // No change
    } else if (absCurrent < 0.05) {
      cDeltaBits = currentDelta > 0 ? 1 : 2; // Small change ±0.01-0.05A
    } else {
      cDeltaBits = 3; // Large change (approximated)
    }
    header |= (cDeltaBits << 5);
    
    // Status changed flag
    if (statusChanged) {
      header |= 0x80;
    }
    
    buffer.writeUInt8(header, 0);
    
    // Second byte: percentage delta
    const pDeltaScaled = Math.max(-127, Math.min(127, Math.round(percentageDelta * this.percentagePrecision)));
    buffer.writeInt8(pDeltaScaled, 1);
    
    console.log('📦 Battery: Efficient delta packet (2 bytes):', {
      deltas: { 
        voltageDelta: voltageDelta.toFixed(3), 
        currentDelta: currentDelta.toFixed(3), 
        percentageDelta: percentageDelta.toFixed(2) 
      },
      scaled: { vDeltaScaled, cDeltaBits, pDeltaScaled },
      statusChanged,
      header: `0x${header.toString(16)}`,
      bufferHex: buffer.toString('hex')
    });
    
    return buffer;
  }

  // Get adaptive thresholds based on stability
  private getAdaptiveThresholds() {
    // More conservative thresholds to ensure small changes are detected
    const stabilityFactor = Math.min(this.stableCount / 20, 1.5); // Up to 1.5x more aggressive
    
    return {
      voltage: 0.005 + (stabilityFactor * 0.005), // 5mV to 12.5mV
      current: 0.010 + (stabilityFactor * 0.010), // 10mA to 25mA  
      percentage: 0.08 + (stabilityFactor * 0.04), // 0.08% to 0.14% - much more conservative
    };
  }

  // Main compression method with conservative optimization
  compressData(rawData: BatteryData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    try {
      console.log('🔋 Battery compression input (conservative mode):', {
        ...rawData,
        packetCounter: this.packetCounter,
        skipCount: this.skipCount,
        stableCount: this.stableCount,
        isFirstPacket: this.lastVoltage === null
      });

      this.packetCounter++;
      let compressedBuffer: Buffer;

      // Force raw packet for first packet or periodic sync
      if (this.lastVoltage === null || this.packetCounter % this.rawPacketInterval === 0) {
        console.log('📦 Sending compact raw packet (first/periodic)');
        compressedBuffer = this.createRawPacket(rawData);
        
        // Update state
        this.lastVoltage = rawData.voltage;
        this.lastCurrent = rawData.current;
        this.lastPercentage = rawData.percentage;
        this.lastStatus = rawData.status;
        this.skipCount = 0;
        this.stableCount = 0;
        
        console.log('🔋 State initialized/updated:', {
          voltage: this.lastVoltage,
          current: this.lastCurrent,
          percentage: this.lastPercentage,
          status: this.lastStatus
        });
      } else {
        // Calculate deltas
        const voltageDelta = rawData.voltage - this.lastVoltage!;
        const currentDelta = rawData.current - this.lastCurrent!;
        const percentageDelta = rawData.percentage - this.lastPercentage!;
        const statusChanged = rawData.status !== this.lastStatus;

        console.log('📏 Battery deltas (conservative mode):', { 
          voltageDelta: voltageDelta.toFixed(3), 
          currentDelta: currentDelta.toFixed(3), 
          percentageDelta: percentageDelta.toFixed(3), 
          statusChanged
        });

        // Get adaptive thresholds
        const thresholds = this.getAdaptiveThresholds();
        
        // Conservative change detection
        const voltageUnchanged = Math.abs(voltageDelta) < thresholds.voltage;
        const currentUnchanged = Math.abs(currentDelta) < thresholds.current;
        const percentageUnchanged = Math.abs(percentageDelta) < thresholds.percentage;

        console.log('🔋 Battery change detection (adaptive):', {
          voltageUnchanged: `${voltageUnchanged} (${Math.abs(voltageDelta).toFixed(4)}V vs ${thresholds.voltage.toFixed(3)}V)`,
          currentUnchanged: `${currentUnchanged} (${Math.abs(currentDelta).toFixed(3)}A vs ${thresholds.current.toFixed(3)}A)`,
          percentageUnchanged: `${percentageUnchanged} (${Math.abs(percentageDelta).toFixed(3)}% vs ${thresholds.percentage.toFixed(3)}%)`,
          overallUnchanged: voltageUnchanged && currentUnchanged && percentageUnchanged && !statusChanged,
          stableCount: this.stableCount,
          thresholds
        });

        if (voltageUnchanged && currentUnchanged && percentageUnchanged && !statusChanged) {
          // No significant changes - use skip packet
          this.skipCount++;
          this.stableCount++;
          
          const maxSkipsAllowed = this.stableCount > 10 ? this.maxStableSkips : this.maxSkips;
          
          console.log('🔋 No significant changes, skipCount:', this.skipCount, 'maxAllowed:', maxSkipsAllowed);
          
          if (this.skipCount <= maxSkipsAllowed) {
            console.log('📦 Sending skip packet (excellent compression)');
            compressedBuffer = this.createSkipPacket();
          } else {
            // Force raw packet after too many skips
            console.log('📦 Sending raw packet (sync after many skips)');
            compressedBuffer = this.createRawPacket(rawData);
            this.skipCount = 0;
            this.stableCount = 0;
            
            // Update state
            this.lastVoltage = rawData.voltage;
            this.lastCurrent = rawData.current;
            this.lastPercentage = rawData.percentage;
            this.lastStatus = rawData.status;
          }
        } else {
          console.log('🔋 Significant changes detected');
          this.stableCount = 0; // Reset stability counter
          
          // Check if deltas fit in delta packet ranges
          const voltageOk = Math.abs(voltageDelta) <= 0.15;
          const currentOk = Math.abs(currentDelta) <= 0.8;
          const percentageOk = Math.abs(percentageDelta) <= 6.35;

          console.log('🔋 Delta packet feasibility:', {
            voltageOk: `${voltageOk} (${Math.abs(voltageDelta).toFixed(3)}V <= 0.15V)`,
            currentOk: `${currentOk} (${Math.abs(currentDelta).toFixed(3)}A <= 0.8A)`,
            percentageOk: `${percentageOk} (${Math.abs(percentageDelta).toFixed(2)}% <= 6.35%)`
          });

          if (voltageOk && currentOk && percentageOk) {
            // Use efficient delta packet (2 bytes)
            console.log('📦 Sending efficient delta packet (2 bytes)');
            compressedBuffer = this.createDeltaPacket(voltageDelta, currentDelta, percentageDelta, statusChanged, rawData.status);
            this.skipCount = 0;
          } else {
            // Deltas too large, send raw packet
            console.log('📦 Sending raw packet (deltas too large)');
            compressedBuffer = this.createRawPacket(rawData);
            this.skipCount = 0;
          }

          // Update state
          this.lastVoltage = rawData.voltage;
          this.lastCurrent = rawData.current;
          this.lastPercentage = rawData.percentage;
          this.lastStatus = rawData.status;
        }
      }

      const endTime = performance.now();
      const result: CompressionMetrics = { buffer: compressedBuffer };
      
      if (showMetrics) {
        const originalSize = JSON.stringify(rawData).length;
        result.compressionRatio = originalSize / (compressedBuffer.length || 0.1);
        result.processingTime = endTime - startTime;
      }
      
      const packetType = compressedBuffer.length === 0 ? 'skip' : 
                        compressedBuffer.length === 2 ? 'delta' :
                        compressedBuffer.length === 5 ? 'raw' : 'unknown';
      
      console.log('✅ Battery compression completed (conservative mode):', {
        inputSize: JSON.stringify(rawData).length,
        outputSize: compressedBuffer.length,
        compressionRatio: result.compressionRatio?.toFixed(2),
        packetType,
        percentageDetected: this.lastPercentage !== null ? 
          Math.abs(rawData.percentage - this.lastPercentage) >= this.getAdaptiveThresholds().percentage : 'first packet',
        stableCount: this.stableCount
      });
      
      return result;
      
    } catch (error) {
      console.error("❌ Error in Battery compression:", error);
      return { buffer: Buffer.alloc(0) };
    }
  }
} 