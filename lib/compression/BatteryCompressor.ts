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
  private lastRawData: BatteryData;
  private maxVoltageError: number;
  private maxPercentageError: number;
  private maxCurrentError: number;
  private baseVoltageError: number;
  private basePercentageError: number;
  private baseCurrentError: number;
  private adaptiveThresholdFactor: number;
  private packetCounter: number;
  private lastFullPacket: number;
  private fullPacketInterval: number;
  private minFullPacketInterval: number;
  private maxFullPacketInterval: number;
  private successfulPredictions: number;
  private voltageModel: any;
  private percentageModel: any;
  private currentModel: any;
  private statusHistory: string[];
  private statusChangeTimeout: number;
  private lastValueHash: string;
  private sameValueCount: number;
  private rleThreshold: number;
  private skipCounter: number;
  private maxConsecutiveSkips: number;
  private quantizationLevels: any;
  private totalPredictions: number;
  private accuratePredictions: number;
  private totalBytesSaved: number;
  private totalBytesRaw: number;
  private isInitialDataSent: boolean;

  constructor() {
    // State tracking
    this.lastRawData = {
      voltage: 0,
      percentage: 0,
      current: 0,
      status: ""
    };
    
    // Error thresholds - Significantly increased for better compression
    this.maxVoltageError = 0.03;     // Reduced from 0.2V to 0.03V for higher accuracy
    this.maxPercentageError = 2.0;   // Kept at 2.0%
    this.maxCurrentError = 0.3;      // Kept at 0.3A
    
    // Adaptive error thresholds - with higher base values
    this.baseVoltageError = 0.03;    // Reduced base value for voltage error
    this.basePercentageError = 2.0;
    this.baseCurrentError = 0.3;
    this.adaptiveThresholdFactor = 1.0;
    
    // Packet counters
    this.packetCounter = 0;
    this.lastFullPacket = 0;
    this.fullPacketInterval = 120;   // Doubled from 60 to 120 packets for better compression
    
    // Adaptive full packet interval - with higher values
    this.minFullPacketInterval = 60;  // Doubled from 30 to 60
    this.maxFullPacketInterval = 180; // Doubled from 90 to 180
    this.successfulPredictions = 0;
    
    // Data models for prediction
    this.voltageModel = {
      lastValues: [0, 0, 0, 0, 0],
      trend: 0,
      acceleration: 0, // Add acceleration for second-order prediction
      cumError: 0,
      lastVariance: 0,
      lastStatus: ""
    };
    this.percentageModel = {
      lastValues: [0, 0, 0, 0, 0],
      trend: 0,
      cumError: 0,
      lastVariance: 0
    };
    this.currentModel = {
      lastValues: [0, 0, 0, 0, 0],
      trend: 0,
      cumError: 0,
      lastVariance: 0
    };
    
    // Status tracking - with less sensitivity
    this.statusHistory = ["", "", ""];
    this.statusChangeTimeout = 0;  // Counter to delay status change detection
    
    // Enhanced Run-length encoding
    this.lastValueHash = "";
    this.sameValueCount = 0;
    this.rleThreshold = 3;         // Send RLE after just 3 similar values (was 15)
    this.skipCounter = 0;          // Track consecutive skipped packets
    this.maxConsecutiveSkips = 30; // Maximum consecutive packets to skip before forcing an update
    
    // Quantization levels - increased precision for voltage
    this.quantizationLevels = {
      voltage: 0.01,      // Decreased from 0.05V to 0.01V for more precise voltage tracking
      percentage: 0.5,    // Kept at 0.5% 
      current: 0.05       // Kept at 0.05A
    };
    
    // Performance metrics
    this.totalPredictions = 0;
    this.accuratePredictions = 0;
    this.totalBytesSaved = 0;
    this.totalBytesRaw = 0;
    this.isInitialDataSent = false;
  }

  // Quantize a value to reduce precision
  private quantize(value: number, step: number): number {
    return Math.round(value / step) * step;
  }

  // Calculate variance for a model's recent values
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Update prediction models with new data
  private updateModels(data: BatteryData): void {
    // Update voltage model
    this.voltageModel.lastValues.shift();
    this.voltageModel.lastValues.push(data.voltage);
    this.voltageModel.lastVariance = this.calculateVariance(this.voltageModel.lastValues);
    
    if (this.voltageModel.lastValues[4] !== 0 && this.voltageModel.lastValues[3] !== 0) {
      // Enhanced voltage trend calculation with exponential smoothing and acceleration
      const v0 = this.voltageModel.lastValues[0];
      const v1 = this.voltageModel.lastValues[1];
      const v2 = this.voltageModel.lastValues[2];
      const v3 = this.voltageModel.lastValues[3];
      const v4 = this.voltageModel.lastValues[4];
      
      // Primary trend (first-order derivative)
      const trend1 = v4 - v3;
      const trend2 = v3 - v2;
      const trend3 = v2 - v1;
      const trend4 = v1 - v0;
      
      // Acceleration (second-order derivative)
      const accel1 = trend1 - trend2;
      const accel2 = trend2 - trend3;
      
      // Weighted average for trend prediction
      this.voltageModel.trend = 0.65 * trend1 + 
                               0.25 * trend2 + 
                               0.1 * trend3;
      
      // Store acceleration for higher order prediction
      this.voltageModel.acceleration = 0.7 * accel1 + 0.3 * accel2;
    }
    
    // Update percentage model
    this.percentageModel.lastValues.shift();
    this.percentageModel.lastValues.push(data.percentage);
    this.percentageModel.lastVariance = this.calculateVariance(this.percentageModel.lastValues);
    
    if (this.percentageModel.lastValues[4] !== 0 && this.percentageModel.lastValues[3] !== 0) {
      // Enhanced trend calculation
      this.percentageModel.trend = 0.5 * (this.percentageModel.lastValues[4] - this.percentageModel.lastValues[3]) + 
                                  0.3 * (this.percentageModel.lastValues[3] - this.percentageModel.lastValues[2]) +
                                  0.15 * (this.percentageModel.lastValues[2] - this.percentageModel.lastValues[1]) +
                                  0.05 * (this.percentageModel.lastValues[1] - this.percentageModel.lastValues[0]);
    }
    
    // Update current model
    this.currentModel.lastValues.shift();
    this.currentModel.lastValues.push(data.current);
    this.currentModel.lastVariance = this.calculateVariance(this.currentModel.lastValues);
    
    if (this.currentModel.lastValues[4] !== 0 && this.currentModel.lastValues[3] !== 0) {
      // Enhanced trend calculation
      this.currentModel.trend = 0.5 * (this.currentModel.lastValues[4] - this.currentModel.lastValues[3]) + 
                               0.3 * (this.currentModel.lastValues[3] - this.currentModel.lastValues[2]) +
                               0.15 * (this.currentModel.lastValues[2] - this.currentModel.lastValues[1]) +
                               0.05 * (this.currentModel.lastValues[1] - this.currentModel.lastValues[0]);
    }
    
    // Update status history with less sensitivity
    if (this.statusHistory[2] !== data.status) {
      if (this.statusChangeTimeout <= 0) {
        this.statusHistory.shift();
        this.statusHistory.push(data.status);
        this.statusChangeTimeout = 5; // Delay next status change detection by 5 cycles
      } else {
        // Keep the current status if within timeout period
        this.statusChangeTimeout--;
      }
    } else {
      this.statusChangeTimeout = Math.max(0, this.statusChangeTimeout - 1);
    }
  }

  // Predict next values using enhanced trend analysis and variance
  private predictNextValues(): { voltage: number; percentage: number; current: number } {
    // Use variance to adjust prediction confidence - with reduced sensitivity to variance
    const voltageVarianceWeight = Math.min(1, Math.max(0.7, 1 - (this.voltageModel.lastVariance * 10)));
    const percentageVarianceWeight = Math.min(1, Math.max(0.6, 1 - (this.percentageModel.lastVariance * 0.25)));
    const currentVarianceWeight = Math.min(1, Math.max(0.6, 1 - (this.currentModel.lastVariance * 2.5)));
    
    // Advanced voltage prediction with acceleration (second-order prediction)
    const voltageTrend = this.voltageModel.trend * voltageVarianceWeight;
    const voltageAcceleration = this.voltageModel.acceleration || 0;
    const nextVoltage = this.voltageModel.lastValues[4] + voltageTrend + (voltageAcceleration * 0.5);
    
    // Weighted prediction based on recent stability
    return {
      voltage: nextVoltage,
      percentage: this.percentageModel.lastValues[4] + (this.percentageModel.trend * percentageVarianceWeight),
      current: this.currentModel.lastValues[4] + (this.currentModel.trend * currentVarianceWeight),
    };
  }

  // Calculate value hash for run-length encoding - with increased quantization
  private calculateValueHash(data: BatteryData): string {
    const qVoltage = this.quantize(data.voltage, this.quantizationLevels.voltage);
    const qPercentage = this.quantize(data.percentage, this.quantizationLevels.percentage);
    const qCurrent = this.quantize(data.current, this.quantizationLevels.current);
    
    // Only include status in the hash if it's stable
    const statusPart = this.statusChangeTimeout <= 0 ? data.status : this.statusHistory[2];
    
    return `${qVoltage}:${qPercentage}:${qCurrent}:${statusPart}`;
  }

  // Adjust thresholds based on prediction performance
  private adjustThresholds(predictedAccurate: boolean): void {
    this.totalPredictions++;
    
    if (predictedAccurate) {
      this.accuratePredictions++;
      this.successfulPredictions++;
      
      // If we've had several successful predictions in a row, extend the full packet interval more aggressively
      if (this.successfulPredictions >= 10) {
        this.fullPacketInterval = Math.min(this.maxFullPacketInterval, this.fullPacketInterval + 10);
        this.successfulPredictions = 0;
      }
      
      // More aggressive reduction of the adaptive threshold factor if predictions are good
      this.adaptiveThresholdFactor = Math.max(0.5, this.adaptiveThresholdFactor * 0.98);
    } else {
      this.successfulPredictions = 0;
      // Reduce the full packet interval when predictions are poor - but less aggressively
      this.fullPacketInterval = Math.max(this.minFullPacketInterval, this.fullPacketInterval - 2);
      
      // Less aggressive increase of adaptive threshold factor when predictions fail
      this.adaptiveThresholdFactor = Math.min(1.3, this.adaptiveThresholdFactor * 1.03);
    }
    
    // Apply adaptive thresholds
    this.maxVoltageError = this.baseVoltageError * this.adaptiveThresholdFactor;
    this.maxPercentageError = this.basePercentageError * this.adaptiveThresholdFactor;
    this.maxCurrentError = this.baseCurrentError * this.adaptiveThresholdFactor;
  }

  // Detect if charging status may change soon - with reduced sensitivity
  private isStatusChangeImminent(): boolean {
    // Only check for status change if the timeout has elapsed
    if (this.statusChangeTimeout > 0) {
      return false;
    }
    
    // Check for significant state of charge changes that might indicate a status change
    if (this.statusHistory[2] === "Charging" && this.percentageModel.lastValues[4] >= 99.5) {
      return true;
    }
    if (this.statusHistory[2] === "Discharging" && this.percentageModel.lastValues[4] <= 5.0) {
      return true;
    }
    
    // Detect very significant changes in current that might indicate status change
    const currentTrend = Math.abs(this.currentModel.trend);
    if (currentTrend > 0.25) {  // Increased threshold from 0.05 to 0.25
      return true;
    }
    
    return false;
  }

  // Create a full data packet (8 bytes) - optimized with optional status byte
  private createFullPacket(data: BatteryData): Buffer {
    const voltageInt = Math.round(data.voltage * 1000);
    const percentageInt = Math.round(data.percentage * 10);
    const currentInt = Math.round(data.current * 1000);
    const statusByte = data.status === "Charging" ? 0x01 : 0x00;

    // Always include status for now to avoid decompressor issues
    const bufferSize = 8; // Always use 8 bytes for now
    
    const buffer = Buffer.alloc(bufferSize);
    let header = 0xF0; // Base header for full packet
    
    buffer.writeUInt8(header, 0);
    buffer.writeUInt16BE(voltageInt, 1);
    buffer.writeUInt16BE(percentageInt, 3);
    buffer.writeInt16BE(currentInt, 5);
    buffer.writeUInt8(statusByte, 7);
    
    return buffer;
  }

  // Create a run-length encoding packet (2 bytes)
  private createRLEPacket(count: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt8(0xF1, 0); // Header: RLE packet
    buffer.writeUInt8(count, 1); // Repeat count
    return buffer;
  }

  // Create a delta packet (1-4 bytes) - optimized with variable size
  private createDeltaPacket(deltas: any, status: string): Buffer {
    // Determine which deltas to include - more sensitive for voltage
    const includeVoltage = Math.abs(deltas.voltage) >= this.maxVoltageError / 5; // Increased sensitivity for voltage
    const includePercentage = Math.abs(deltas.percentage) >= this.maxPercentageError / 2.5;
    const includeCurrent = Math.abs(deltas.current) >= this.maxCurrentError / 2.5;
    
    // Calculate required bytes
    let packetSize = 1; // Start with 1 byte for header
    if (includeVoltage) packetSize += 2; // Use 2 bytes for voltage for higher precision
    if (includePercentage) packetSize += 1;
    if (includeCurrent) packetSize += 1;
    if (deltas.statusChanged) packetSize += 0; // Status is encoded in header
    
    const buffer = Buffer.alloc(packetSize);
    
    // Build header byte
    let header = 0xE0; // Base header for delta packet
    if (includeVoltage) header |= 0x01;
    if (includePercentage) header |= 0x02;
    if (includeCurrent) header |= 0x04;
    if (deltas.statusChanged) header |= 0x08;
    if (status === "Charging") header |= 0x10; // Include current status
    
    buffer.writeUInt8(header, 0);
    
    let offset = 1;
    
    // Adaptive scaling for delta values - more precise encoding for voltage
    // Write voltage delta as 16-bit value for higher precision
    if (includeVoltage) {
      const voltageDelta = deltas.voltage;
      // Use fixed high precision for voltage (0.0001V resolution)
      const scaledDelta = Math.round(voltageDelta * 10000);
      buffer.writeInt16BE(scaledDelta, offset);
      offset += 2;
    }
    
    if (includePercentage) {
      const percentageDelta = deltas.percentage;
      // Smaller values get higher precision scaling
      const scale = Math.abs(percentageDelta) < 0.5 ? 4 : 2;
      const scaledDelta = Math.min(127, Math.max(-128, Math.round(percentageDelta * scale)));
      buffer.writeInt8(scaledDelta, offset++);
    }
    
    if (includeCurrent) {
      const currentDelta = deltas.current;
      // Smaller values get higher precision scaling
      const scale = Math.abs(currentDelta) < 0.2 ? 100 : 50;
      const scaledDelta = Math.min(127, Math.max(-128, Math.round(currentDelta * scale)));
      buffer.writeInt8(scaledDelta, offset++);
    }
    
    return buffer;
  }

  // Process and compress raw data
  compressData(rawData: BatteryData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    // Update last raw data
    this.lastRawData = { ...rawData };
    this.packetCounter++;
    this.totalBytesRaw += 6; // Raw packet is 6 bytes
    
    let compressedBuffer: Buffer;
    
    // For initial packet or forced full packets, send raw data
    if (!this.isInitialDataSent || 
        this.packetCounter - this.lastFullPacket >= this.fullPacketInterval ||
        this.isStatusChangeImminent() ||
        this.skipCounter >= this.maxConsecutiveSkips) {
      
      this.lastFullPacket = this.packetCounter;
      this.isInitialDataSent = true;
      this.skipCounter = 0;
      
      // Initialize models with first data
      const initialValue = [rawData.voltage, rawData.voltage, rawData.voltage, rawData.voltage, rawData.voltage];
      this.voltageModel.lastValues = [...initialValue];
      
      const initialPercentage = [rawData.percentage, rawData.percentage, rawData.percentage, rawData.percentage, rawData.percentage];
      this.percentageModel.lastValues = [...initialPercentage];
      
      const initialCurrent = [rawData.current, rawData.current, rawData.current, rawData.current, rawData.current];
      this.currentModel.lastValues = [...initialCurrent];
      
      // Update status history
      this.statusHistory = [rawData.status, rawData.status, rawData.status];
      this.voltageModel.lastStatus = rawData.status;
      this.statusChangeTimeout = 0;
      
      // Reset error tracking
      this.voltageModel.cumError = 0;
      this.percentageModel.cumError = 0;
      this.currentModel.cumError = 0;
      
      // Return full packet
      compressedBuffer = this.createFullPacket(rawData);
    } else {
      // Check for run-length encoding opportunity - with more aggressive RLE
      const currentHash = this.calculateValueHash(rawData);
      if (currentHash === this.lastValueHash) {
        this.sameValueCount++;
        this.skipCounter++;
        
        if (this.sameValueCount < this.rleThreshold) {
          // Update models even when skipping transmission
          this.updateModels(rawData);
          this.voltageModel.lastStatus = rawData.status;
          
          // Count as accurate prediction
          this.adjustThresholds(true);
          
          // Skip transmission for repeated values
          compressedBuffer = Buffer.alloc(0);
        } else {
          // Send RLE packet after threshold repeats
          compressedBuffer = this.createRLEPacket(this.sameValueCount + 1);
          this.sameValueCount = 0;
          this.skipCounter = 0;
        }
      } else {
        this.sameValueCount = 0;
        this.lastValueHash = currentHash;
        
        // Predict values using trend model
        const predicted = this.predictNextValues();
        
        // Calculate deltas between actual and predicted
        const deltas = {
          voltage: rawData.voltage - predicted.voltage,
          percentage: rawData.percentage - predicted.percentage,
          current: rawData.current - predicted.current,
          statusChanged: rawData.status !== this.voltageModel.lastStatus && this.statusChangeTimeout <= 0
        };
        
        // Update cumulative errors
        this.voltageModel.cumError += Math.abs(deltas.voltage);
        this.percentageModel.cumError += Math.abs(deltas.percentage);
        this.currentModel.cumError += Math.abs(deltas.current);
        
        // Check if error threshold exceeded with adaptive thresholds
        const errorThresholdExceeded = 
          this.voltageModel.cumError > this.maxVoltageError ||
          this.percentageModel.cumError > this.maxPercentageError ||
          this.currentModel.cumError > this.maxCurrentError ||
          deltas.statusChanged;
        
        // Evaluate prediction accuracy
        const isPredictionAccurate = 
          Math.abs(deltas.voltage) < this.maxVoltageError / 2 &&
          Math.abs(deltas.percentage) < this.maxPercentageError / 2 &&
          Math.abs(deltas.current) < this.maxCurrentError / 2 &&
          !deltas.statusChanged;
        
        // Adjust thresholds based on prediction performance
        this.adjustThresholds(isPredictionAccurate);
        
        // If error exceeds threshold, send full packet
        if (errorThresholdExceeded) {
          this.lastFullPacket = this.packetCounter;
          this.skipCounter = 0;
          
          // Reset cumulative errors
          this.voltageModel.cumError = 0;
          this.percentageModel.cumError = 0;
          this.currentModel.cumError = 0;
          
          compressedBuffer = this.createFullPacket(rawData);
        } else {
          // Check if deltas are small enough to skip - with more permissive thresholds
          const canSkip = 
            Math.abs(deltas.voltage) < this.maxVoltageError / 8 && // Make voltage more sensitive
            Math.abs(deltas.percentage) < this.maxPercentageError / 2.5 &&
            Math.abs(deltas.current) < this.maxCurrentError / 2.5 &&
            !deltas.statusChanged;
          
          if (canSkip) {
            // Update models anyway
            this.updateModels(rawData);
            this.voltageModel.lastStatus = rawData.status;
            this.skipCounter++;
            
            // Skip transmission
            compressedBuffer = Buffer.alloc(0);
          } else {
            // Create delta packet
            compressedBuffer = this.createDeltaPacket(deltas, rawData.status);
            this.skipCounter = 0;
            
            // Update models
            this.updateModels(rawData);
            this.voltageModel.lastStatus = rawData.status;
          }
        }
      }
    }
    
    const endTime = performance.now();
    this.totalBytesSaved += 6 - compressedBuffer.length;
    
    // Return result based on showMetrics flag
    const result: CompressionMetrics = {
      buffer: compressedBuffer
    };
    
    if (showMetrics) {
      const originalSize = JSON.stringify(rawData).length;
      result.compressionRatio = originalSize > 0 ? originalSize / (compressedBuffer.length || 1) : 1;
      result.processingTime = endTime - startTime;
    }
    
    return result;
  }

  // Get overall compression statistics
  getCompressionStats(): { totalRatio: number; accuracy: number } {
    const totalRatio = this.totalBytesRaw > 0 ? this.totalBytesRaw / (this.totalBytesRaw - this.totalBytesSaved) : 1;
    const accuracy = this.totalPredictions > 0 ? (this.accuratePredictions / this.totalPredictions) * 100 : 0;
    
    return {
      totalRatio: totalRatio,
      accuracy: accuracy
    };
  }
} 