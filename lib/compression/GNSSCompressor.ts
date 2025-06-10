interface GNSSData {
  nmea: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  hdop?: number;
  satellites?: number;
}

interface CompressionMetrics {
  buffer: Buffer;
  compressionRatio?: number;
  processingTime?: number;
}

export class GNSSCompressor {
  // Tracking previous values
  private lastLat: number | null;
  private lastLon: number | null;
  private lastAltitude: number | null;
  private lastHdop: number | null;
  private lastSatellites: number | null;
  private isInitialDataSent: boolean;
  
  // Trend tracking with exponential smoothing
  private latTrend: number;
  private lonTrend: number;
  private altitudeTrend: number;
  private alpha: number; // Smoothing factor
  
  // History arrays for trend analysis
  private shortTermHistory: number;
  private mediumTermHistory: number;
  private longTermHistory: number;
  
  private latHistory: {
    short: number[];
    medium: number[];
    long: number[];
  };
  
  private lonHistory: {
    short: number[];
    medium: number[];
    long: number[];
  };
  
  private altitudeHistory: {
    short: number[];
    medium: number[];
    long: number[];
  };
  
  // Error tracking
  private maxErrorLat: number; // Max acceptable error for latitude
  private maxErrorLon: number; // Max acceptable error for longitude
  private maxErrorAltitude: number; // Max acceptable error for altitude in meters
  
  // Run-length encoding
  private sameValueCount: number;
  private lastValueHash: string | null;
  
  // Packet management
  private packetCounter: number;
  private consecutiveSkips: number;
  private rawPacketInterval: number; // Send raw packet every 100 packets
  private lastRawPacket: number;
  
  // Quantization thresholds
  private latLonQuantization: number; // About 1 meter at the equator
  private altitudeQuantization: number; // 10cm steps
  
  // Delta encoding tables
  private latLonDeltaTable: { range: number; bits: number }[];
  private altitudeDeltaTable: { range: number; bits: number }[];
  
  // Last location for comparison
  private lastLocation: { latitude: number; longitude: number; altitude: number } | null;

  constructor() {
    // Tracking previous values
    this.lastLat = null;
    this.lastLon = null;
    this.lastAltitude = null;
    this.lastHdop = null;
    this.lastSatellites = null;
    this.isInitialDataSent = false;
    
    // Trend tracking with exponential smoothing
    this.latTrend = 0;
    this.lonTrend = 0;
    this.altitudeTrend = 0;
    this.alpha = 0.1; // Smoothing factor
    
    // History arrays for trend analysis
    this.shortTermHistory = 2;
    this.mediumTermHistory = 3;
    this.longTermHistory = 5;
    
    this.latHistory = {
      short: [],
      medium: [],
      long: []
    };
    
    this.lonHistory = {
      short: [],
      medium: [],
      long: []
    };
    
    this.altitudeHistory = {
      short: [],
      medium: [],
      long: []
    };
    
    // Error tracking
    this.maxErrorLat = 0.0002; // Max acceptable error for latitude
    this.maxErrorLon = 0.0002; // Max acceptable error for longitude
    this.maxErrorAltitude = 0.5; // Max acceptable error for altitude in meters
    
    // Run-length encoding
    this.sameValueCount = 0;
    this.lastValueHash = null;
    
    // Packet management
    this.packetCounter = 0;
    this.consecutiveSkips = 0;
    this.rawPacketInterval = 100; // Send raw packet every 100 packets
    this.lastRawPacket = 0;
    
    // Quantization thresholds
    this.latLonQuantization = 0.00001; // About 1 meter at the equator
    this.altitudeQuantization = 0.1; // 10cm steps
    
    // Delta encoding tables
    this.latLonDeltaTable = [
      { range: 0.00001, bits: 2 },  // ~1m
      { range: 0.0001, bits: 3 },   // ~10m
      { range: 0.001, bits: 4 },    // ~100m
      { range: 0.01, bits: 5 },     // ~1km
      { range: 0.1, bits: 6 },      // ~10km
      { range: 1.0, bits: 7 }       // ~100km
    ];
    
    this.altitudeDeltaTable = [
      { range: 0.1, bits: 2 },    // 10cm
      { range: 0.5, bits: 3 },    // 50cm
      { range: 1.0, bits: 4 },    // 1m
      { range: 5.0, bits: 5 },    // 5m
      { range: 10.0, bits: 6 },   // 10m
      { range: 50.0, bits: 7 }    // 50m
    ];
    
    this.lastLocation = null;
  }

  // Update history arrays and calculate trends
  private updateHistory(lat: number, lon: number, altitude: number): void {
    // Short-term history update
    if (this.latHistory.short.length >= this.shortTermHistory) {
      this.latHistory.short.shift();
      this.lonHistory.short.shift();
      this.altitudeHistory.short.shift();
    }
    this.latHistory.short.push(lat);
    this.lonHistory.short.push(lon);
    this.altitudeHistory.short.push(altitude);
    
    // Medium-term history update
    if (this.packetCounter % 2 === 0) { // Less frequent updates
      if (this.latHistory.medium.length >= this.mediumTermHistory) {
        this.latHistory.medium.shift();
        this.lonHistory.medium.shift();
        this.altitudeHistory.medium.shift();
      }
      this.latHistory.medium.push(lat);
      this.lonHistory.medium.push(lon);
      this.altitudeHistory.medium.push(altitude);
    }
    
    // Long-term history update
    if (this.packetCounter % 4 === 0) { // Even less frequent updates
      if (this.latHistory.long.length >= this.longTermHistory) {
        this.latHistory.long.shift();
        this.lonHistory.long.shift();
        this.altitudeHistory.long.shift();
      }
      this.latHistory.long.push(lat);
      this.lonHistory.long.push(lon);
      this.altitudeHistory.long.push(altitude);
    }
    
    // Update trends using exponential moving average
    if (this.lastLat !== null) {
      const latDelta = lat - this.lastLat;
      const lonDelta = lon - this.lastLon!;
      const altitudeDelta = altitude - this.lastAltitude!;
      
      this.latTrend = this.alpha * latDelta + (1 - this.alpha) * this.latTrend;
      this.lonTrend = this.alpha * lonDelta + (1 - this.alpha) * this.lonTrend;
      this.altitudeTrend = this.alpha * altitudeDelta + (1 - this.alpha) * this.altitudeTrend;
    }
  }

  // Quantize a value to reduce precision
  private quantize(value: number, step: number): number {
    return Math.round(value / step) * step;
  }

  // Calculate hash of current values for run-length encoding
  private calculateValueHash(lat: number, lon: number, altitude: number, hdop: number, satellites: number): string {
    const quantizedLat = this.quantize(lat, this.latLonQuantization);
    const quantizedLon = this.quantize(lon, this.latLonQuantization);
    const quantizedAltitude = this.quantize(altitude, this.altitudeQuantization);
    return `${quantizedLat}:${quantizedLon}:${quantizedAltitude}:${hdop}:${satellites}`;
  }

  // Parse NMEA string to extract relevant data
  private parseNMEA(nmeaString: string): any {
    // Example: "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47"
    const parts = nmeaString.split(',');
    
    // Check if it's a valid GPGGA sentence
    if (parts[0] !== '$GPGGA') {
      return null;
    }
    
    // Extract latitude
    let lat = parseFloat(parts[2].substring(0, 2)) + parseFloat(parts[2].substring(2)) / 60;
    if (parts[3] === 'S') lat = -lat;
    
    // Extract longitude
    let lon = parseFloat(parts[4].substring(0, 3)) + parseFloat(parts[4].substring(3)) / 60;
    if (parts[5] === 'W') lon = -lon;
    
    // Extract other data
    const fixType = parseInt(parts[6]);
    const satellites = parseInt(parts[7]);
    const hdop = parseFloat(parts[8]);
    const altitude = parseFloat(parts[9]);
    
    return {
      lat,
      lon,
      altitude,
      fixType,
      satellites,
      hdop
    };
  }

  // Calculate delta with error bounds
  private calculateDelta(rawDataStr: any): any {
    let data;
    try {
      // Try to parse as JSON if it's a string
      if (typeof rawDataStr === 'string') {
        data = JSON.parse(rawDataStr);
      } else {
        data = rawDataStr;
      }
    } catch (e) {
      // If it's not valid JSON, try parsing as NMEA (legacy support)
      data = this.parseNMEA(rawDataStr);
    }

    if (!data) return null;
    
    const lat = data.latitude || data.lat;
    const lon = data.longitude || data.lon;
    const altitude = data.altitude;
    const hdop = data.hdop || 1.0; // Default if not provided
    const satellites = data.satellites || 8; // Default if not provided
    
    // Calculate hash for run-length encoding
    const valueHash = this.calculateValueHash(lat, lon, altitude, hdop, satellites);
    
    // Only send raw data for the first packet or every 20 packets (configurable)
    const needsRawPacket = !this.isInitialDataSent || 
                           (this.packetCounter % 20 === 0);
    
    let result: any = {
      forceRawPacket: needsRawPacket,
      packetCounter: this.packetCounter
    };
    
    // Run-length encoding check
    if (valueHash === this.lastValueHash) {
      // Same values as before, increment counter
      this.sameValueCount++;
      // If we've had the same value for multiple times, just send RLE packet
      if (this.sameValueCount > 1) {
        result.useRLE = true;
        result.count = this.sameValueCount;
        // Skip raw packet transmission if we're using RLE
        result.forceRawPacket = false;
      }
    } else {
      // Reset counter when values change
      this.sameValueCount = 1;
      this.lastValueHash = valueHash;
    }
    
    // If not sending a raw packet and not using RLE, and we have previous values, calculate deltas
    if (!result.forceRawPacket && !result.useRLE && this.lastLat !== null) {
      // Calculate exact deltas for lossless compression
      const latDelta = lat - this.lastLat;
      const lonDelta = lon - this.lastLon!;
      const altitudeDelta = altitude - this.lastAltitude!;
      
      // Check if value is unchanged
      const isLatUnchanged = latDelta === 0;
      const isLonUnchanged = lonDelta === 0;
      const isAltUnchanged = altitudeDelta === 0;
      
      // If all values are unchanged, use a special flag
      if (isLatUnchanged && isLonUnchanged && isAltUnchanged) {
        result.allUnchanged = true;
      } else {
        // Store exact deltas for lossless compression
        result.latDelta = latDelta;
        result.lonDelta = lonDelta;
        result.altitudeDelta = altitudeDelta;
        
        // Find optimal bit lengths for encoding each delta
        result.latBits = this.findOptimalBits(latDelta, this.latLonDeltaTable);
        result.lonBits = this.findOptimalBits(lonDelta, this.latLonDeltaTable);
        result.altBits = this.findOptimalBits(altitudeDelta, this.altitudeDeltaTable);
      }
    }
    
    // Store the values regardless if it's first data point or not
    this.lastLat = lat;
    this.lastLon = lon;
    this.lastAltitude = altitude;
    this.lastHdop = hdop;
    this.lastSatellites = satellites;
    
    // Store in lastLocation format for comparison code
    this.lastLocation = {
      latitude: this.lastLat!,
      longitude: this.lastLon!,
      altitude: this.lastAltitude!
    };
    
    this.updateHistory(this.lastLat!, this.lastLon!, this.lastAltitude!);
    this.packetCounter++;
    
    return result;
  }

  // Find optimal bits for delta encoding
  private findOptimalBits(value: number, table: { range: number; bits: number }[]): number {
    const absValue = Math.abs(value);
    for (let i = 0; i < table.length; i++) {
      if (absValue <= table[i].range) {
        return table[i].bits;
      }
    }
    return 8; // Default to 8 bits if larger than any range
  }

  // Helper method to write signed values of various sizes
  private writeSignedValue(buffer: Buffer, offset: number, value: number, bytes: number): void {
    // Scale floating point values to integers for more efficient encoding
    // For lat/lon delta values, we need to be careful with scaling to avoid overflow
    let scalingFactor;
    
    if (value % 1 !== 0) { // It's a decimal number
      if (bytes === 1) {
        // For 1 byte values (-128 to 127), use a smaller scaling factor
        // For really small deltas, we can only maintain limited precision
        scalingFactor = 10000; // 0.0001 precision
      } else if (bytes === 2) {
        // For 2 byte values (-32768 to 32767)
        scalingFactor = 100000; // 0.00001 precision
      } else {
        // For 3+ byte values, we can use full precision
        scalingFactor = 1000000; // 0.000001 precision
      }
      
      // For altitude, which typically has smaller precision requirements
      if (Math.abs(value) > 1) {
        scalingFactor = Math.min(scalingFactor, 10); // 0.1 precision for altitude
      }
    } else {
      // For integer values, no scaling needed
      scalingFactor = 1;
    }
    
    // Calculate scaled value, ensuring it's within range
    let scaledValue = Math.round(value * scalingFactor);
    
    // Ensure value fits in the target byte size
    const maxValue = (1 << (8 * bytes - 1)) - 1;
    const minValue = -(1 << (8 * bytes - 1));
    
    if (scaledValue > maxValue) {
      console.warn(`Value ${value} (scaled: ${scaledValue}) exceeds max for ${bytes} bytes. Using maximum.`);
      scaledValue = maxValue;
    } else if (scaledValue < minValue) {
      console.warn(`Value ${value} (scaled: ${scaledValue}) exceeds min for ${bytes} bytes. Using minimum.`);
      scaledValue = minValue;
    }
    
    switch (bytes) {
      case 1:
        buffer.writeInt8(scaledValue, offset);
        break;
      case 2:
        buffer.writeInt16BE(scaledValue, offset);
        break;
      case 3:
        // For 3 bytes, we need to handle it specially
        // Ensure value is in 24-bit signed range: -8388608 to 8388607
        scaledValue = Math.max(-8388608, Math.min(8388607, scaledValue));
        
        // Handle negative values
        if (scaledValue < 0) {
          scaledValue = scaledValue + 16777216; // 2^24
        }
        
        const b1 = (scaledValue >> 16) & 0xFF;
        const b2 = (scaledValue >> 8) & 0xFF;
        const b3 = scaledValue & 0xFF;
        buffer.writeUInt8(b1, offset);
        buffer.writeUInt8(b2, offset + 1);
        buffer.writeUInt8(b3, offset + 2);
        break;
      case 4:
      default:
        buffer.writeInt32BE(scaledValue, offset);
        break;
    }
  }

  // Convert delta to binary with compression
  private deltaToBinary(deltaData: any): Buffer {
    if (!deltaData) return Buffer.alloc(0);
    
    // Handle Run-Length Encoding case
    if (deltaData.useRLE) {
      // RLE packet: 2 bytes (header and count)
      const buffer = Buffer.alloc(2);
      
      // Header byte: bit 0 = 0 (not raw packet), bit 7 = 1 (RLE packet)
      buffer.writeUInt8(0x80, 0);
      
      // Write count (up to 255)
      buffer.writeUInt8(Math.min(deltaData.count, 255), 1);
      
      return buffer;
    }
    
    // Handle unchanged values case (all coordinates same)
    if (deltaData.allUnchanged) {
      // Just a single byte with bit 0 = 0 (not raw) and bit 6 = 1 (all unchanged)
      const buffer = Buffer.alloc(1);
      buffer.writeUInt8(0x40, 0);
      return buffer;
    }
    
    // If raw packet is required
    if (deltaData.forceRawPacket) {
      this.isInitialDataSent = true;
      this.lastRawPacket = this.packetCounter;
      this.sameValueCount = 1; // Reset run-length counter when sending raw
      return this.rawDataToBinary({
        lat: this.lastLat!,
        lon: this.lastLon!,
        altitude: this.lastAltitude!,
        hdop: this.lastHdop!,
        satellites: this.lastSatellites!
      });
    }
    
    // If we get here, we're sending a delta-encoded packet
    // First, determine size of our delta packet
    const latBytes = Math.ceil(deltaData.latBits / 8);
    const lonBytes = Math.ceil(deltaData.lonBits / 8);
    const altBytes = Math.ceil(deltaData.altBits / 8);
    
    // Create buffer large enough to hold header + all delta values
    const bufferSize = 1 + latBytes + lonBytes + altBytes;
    const buffer = Buffer.alloc(bufferSize);
    
    // Header byte: bit 0 = 0 (not raw)
    // bits 1-2: latBytes (0-3)
    // bits 3-4: lonBytes (0-3)
    // bits 5-6: altBytes (0-3)
    let header = 0;
    header |= (latBytes << 1) & 0x06;
    header |= (lonBytes << 3) & 0x18;
    header |= (altBytes << 5) & 0x60;
    
    buffer.writeUInt8(header, 0);
    
    // Write latitude delta
    let offset = 1;
    this.writeSignedValue(buffer, offset, deltaData.latDelta, latBytes);
    offset += latBytes;
    
    // Write longitude delta
    this.writeSignedValue(buffer, offset, deltaData.lonDelta, lonBytes);
    offset += lonBytes;
    
    // Write altitude delta
    this.writeSignedValue(buffer, offset, deltaData.altitudeDelta, altBytes);
    
    return buffer;
  }

  // Convert raw data to binary format
  private rawDataToBinary(rawData: any): Buffer {
    // More efficient encoding with fewer bytes
    const lat = rawData.latitude || rawData.lat;
    const lon = rawData.longitude || rawData.lon;
    const altitude = rawData.altitude;
    
    // Extract integer and fractional parts of coordinates
    const latDeg = Math.floor(Math.abs(lat));
    // Scale down minutes to fit in 16-bit unsigned integer (0-65535)
    const latMin = (Math.abs(lat) - latDeg) * 60 * 1000; // Reduced precision to avoid overflow
    
    const lonDeg = Math.floor(Math.abs(lon));
    // Scale down minutes to fit in 16-bit unsigned integer (0-65535)
    const lonMin = (Math.abs(lon) - lonDeg) * 60 * 1000;
    
    // Scale altitude to fit in 1 byte (0-255 meters)
    // Most GNSS applications (ground-based) work within this range
    // For applications requiring higher altitudes, we would need more bytes
    const altScaled = Math.min(255, Math.max(0, Math.round(altitude)));
    
    // Create a 10-byte buffer now (was 9 before)
    const buffer = Buffer.alloc(10);
    
    // 1-byte for header and flags
    // Bit 0: raw packet flag (1)
    // Bit 1: lon sign (1 for negative, 0 for positive)
    // Bit 2: lat sign (1 for negative, 0 for positive)
    // Bit 3-7: unused now, could be used for altitude scaling or precision flags
    let header = 0x01; // Mark as raw packet
    if (lon < 0) header |= 0x02;
    if (lat < 0) header |= 0x04;
    buffer.writeUInt8(header, 0);
    
    // Encode latitude (2 bytes for degree, 2 bytes for minutes)
    buffer.writeUInt16BE(latDeg, 1);
    buffer.writeUInt16BE(Math.round(latMin) & 0xFFFF, 3);
    
    // Encode longitude (2 bytes for degree, 2 bytes for minutes)
    buffer.writeUInt16BE(lonDeg, 5);
    buffer.writeUInt16BE(Math.round(lonMin) & 0xFFFF, 7);
    
    // Encode altitude in 1 byte (0-255 meters, integer only)
    buffer.writeUInt8(altScaled, 9);
    
    return buffer;
  }

  // Main compression method
  compressData(rawData: GNSSData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    try {
      // Parse NMEA if string, or use provided coordinates
      let data;
      if (rawData.nmea) {
        data = this.parseNMEA(rawData.nmea);
        if (!data) {
          // Fallback to provided coordinates
          data = {
            lat: rawData.latitude || 0,
            lon: rawData.longitude || 0,
            altitude: rawData.altitude || 0,
            hdop: rawData.hdop || 1.0,
            satellites: rawData.satellites || 8
          };
        }
      } else {
        data = {
          lat: rawData.latitude || 0,
          lon: rawData.longitude || 0,
          altitude: rawData.altitude || 0,
          hdop: rawData.hdop || 1.0,
          satellites: rawData.satellites || 8
        };
      }
      
      // Calculate delta and get compression instructions
      const deltaData = this.calculateDelta(data);
      
      if (!deltaData) {
        return { buffer: Buffer.alloc(0) };
      }

      let compressedBuffer: Buffer;

      // If this is the first packet or we need to send raw data
      if (deltaData.forceRawPacket) {
        this.lastLat = data.lat;
        this.lastLon = data.lon;
        this.lastAltitude = data.altitude;
        this.lastHdop = data.hdop;
        this.lastSatellites = data.satellites;
        this.isInitialDataSent = true;
        
        // Convert raw data to binary format
        compressedBuffer = this.rawDataToBinary(data);
      }
      // If using run-length encoding
      else if (deltaData.useRLE) {
        // Simple RLE packet: [1-bit flag (1), 7-bit counter]
        const buffer = Buffer.alloc(1);
        buffer[0] = (1 << 7) | (deltaData.count & 0x7F);
        compressedBuffer = buffer;
      }
      // If all values are unchanged
      else if (deltaData.allUnchanged) {
        // Single byte with a special flag
        const buffer = Buffer.alloc(1);
        buffer[0] = 0xFF; // Special marker for unchanged values
        compressedBuffer = buffer;
      }
      // Convert delta values to compressed binary format
      else {
        compressedBuffer = this.deltaToBinary(deltaData);
      }
      
      const endTime = performance.now();
      
      // Return result based on showMetrics flag
      const result: CompressionMetrics = {
        buffer: compressedBuffer
      };
      
      if (showMetrics) {
        const originalSize = rawData.nmea?.length || JSON.stringify(rawData).length;
        result.compressionRatio = originalSize > 0 ? originalSize / (compressedBuffer.length || 1) : 1;
        result.processingTime = endTime - startTime;
      }
      
      return result;
    } catch (error) {
      console.error("Error in GNSS compressData:", error);
      return { buffer: Buffer.alloc(0) };
    }
  }
} 