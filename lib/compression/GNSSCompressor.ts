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
  // State tracking
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private lastAltitude: number | null = null;
  private packetCounter: number = 0;
  private sameValueCount: number = 0;
  
  // Compression settings - simplified and more reliable
  private readonly latLonPrecision = 1000000; // 6 decimal places precision
  private readonly altitudePrecision = 10; // 0.1 meter precision
  private readonly maxDeltaLatLon = 0.001; // ~111 meters max delta (fits in 1 byte)
  private readonly maxDeltaAltitude = 25.0; // 25 meters max delta (fits in 1 byte)
  private readonly rawPacketInterval = 10; // Send raw packet every 10 packets for resync

  constructor() {
    this.reset();
  }

  reset(): void {
    this.lastLat = null;
    this.lastLon = null;
    this.lastAltitude = null;
    this.packetCounter = 0;
    this.sameValueCount = 0;
  }

  // Parse NMEA string and extract coordinates
  private parseNMEA(nmeaString: string): any {
    if (!nmeaString || !nmeaString.startsWith('$GPGGA')) {
      return null;
    }

    try {
      const parts = nmeaString.split(',');
      if (parts.length < 15) return null;
      
      // Parse latitude (format: DDMM.MMM,N/S)
      const latStr = parts[2];
      const latDir = parts[3];
      let latitude = 0;
      if (latStr && latDir) {
        const degrees = parseInt(latStr.substring(0, 2));
        const minutes = parseFloat(latStr.substring(2));
        latitude = degrees + minutes / 60;
        if (latDir === 'S') latitude = -latitude;
      }
      
      // Parse longitude (format: DDDMM.MMM,E/W)
      const lonStr = parts[4];
      const lonDir = parts[5];
      let longitude = 0;
      if (lonStr && lonDir) {
        const degrees = parseInt(lonStr.substring(0, 3));
        const minutes = parseFloat(lonStr.substring(3));
        longitude = degrees + minutes / 60;
        if (lonDir === 'W') longitude = -longitude;
      }
      
      // Parse altitude (format: NNN.N,M)
      const altStr = parts[9];
      const altitude = altStr ? parseFloat(altStr) : 0;
      
      return { lat: latitude, lon: longitude, altitude };
    } catch (error) {
      console.error('Error parsing NMEA string:', error);
      return null;
    }
  }

  // Create raw packet (12 bytes fixed size)
  private createRawPacket(lat: number, lon: number, altitude: number): Buffer {
    const buffer = Buffer.alloc(12);
    
    // Header byte: 0x01 = raw packet
    buffer.writeUInt8(0x01, 0);
    
    // Latitude (4 bytes signed, scaled by 1,000,000 for 6 decimal precision)
    const latScaled = Math.round(lat * this.latLonPrecision);
    buffer.writeInt32BE(latScaled, 1);
    
    // Longitude (4 bytes signed, scaled by 1,000,000 for 6 decimal precision)
    const lonScaled = Math.round(lon * this.latLonPrecision);
    buffer.writeInt32BE(lonScaled, 5);
    
    // Altitude (2 bytes unsigned, scaled by 10 for 0.1m precision, max 6553.5m)
    const altScaled = Math.max(0, Math.min(65535, Math.round(altitude * this.altitudePrecision)));
    buffer.writeUInt16BE(altScaled, 9);
    
    // Reserved byte for future use
    buffer.writeUInt8(0x00, 11);
    
    console.log('📦 GNSS Raw packet created:', {
      lat, lon, altitude,
      latScaled, lonScaled, altScaled,
      bufferHex: buffer.toString('hex')
    });
      
      return buffer;
    }
    
  // Create delta packet (4 bytes fixed size)
  private createDeltaPacket(latDelta: number, lonDelta: number, altDelta: number): Buffer {
    const buffer = Buffer.alloc(4);
    
    // Header byte: 0x00 = delta packet
    buffer.writeUInt8(0x00, 0);
    
    // Scale deltas to fit in signed bytes (-128 to +127)
    // Latitude delta: scale by 10000 (max ±0.0127 degrees = ~1.4km)
    const latDeltaScaled = Math.max(-127, Math.min(127, Math.round(latDelta * 10000)));
    buffer.writeInt8(latDeltaScaled, 1);
    
    // Longitude delta: scale by 10000 (max ±0.0127 degrees = ~1.4km)
    const lonDeltaScaled = Math.max(-127, Math.min(127, Math.round(lonDelta * 10000)));
    buffer.writeInt8(lonDeltaScaled, 2);
    
    // Altitude delta: scale by 10 (max ±12.7 meters)
    const altDeltaScaled = Math.max(-127, Math.min(127, Math.round(altDelta * 10)));
    buffer.writeInt8(altDeltaScaled, 3);
    
    console.log('📦 GNSS Delta packet created:', {
      latDelta, lonDelta, altDelta,
      latDeltaScaled, lonDeltaScaled, altDeltaScaled,
      bufferHex: buffer.toString('hex')
    });
    
    return buffer;
  }

  // Create skip packet (1 byte)
  private createSkipPacket(): Buffer {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(0xFF, 0); // 0xFF = skip packet (no changes)
    
    console.log('📦 GNSS Skip packet created');
    return buffer;
  }

  // Main compression method
  compressData(rawData: GNSSData, showMetrics: boolean = false): CompressionMetrics {
    const startTime = performance.now();
    
    try {
      // Parse input data
      let data;
      if (rawData.nmea) {
        data = this.parseNMEA(rawData.nmea);
        if (!data) {
          // Fallback to provided coordinates
          data = {
            lat: rawData.latitude || 0,
            lon: rawData.longitude || 0,
            altitude: rawData.altitude || 0
          };
        }
      } else {
        data = {
          lat: rawData.latitude || 0,
          lon: rawData.longitude || 0,
          altitude: rawData.altitude || 0
        };
      }

      console.log('📍 GNSS compression input:', {
        lat: data.lat,
        lon: data.lon,
        altitude: data.altitude,
        packetCounter: this.packetCounter
      });

      this.packetCounter++;
      let compressedBuffer: Buffer;

      // Force raw packet every N packets for resync, or if first packet
      if (this.lastLat === null || this.packetCounter % this.rawPacketInterval === 0) {
        console.log('📦 Sending raw packet (first packet or resync)');
        compressedBuffer = this.createRawPacket(data.lat, data.lon, data.altitude);
        
        // Update state
        this.lastLat = data.lat;
        this.lastLon = data.lon;
        this.lastAltitude = data.altitude;
        this.sameValueCount = 0;
      } else {
        // Calculate deltas
        const latDelta = data.lat - this.lastLat!;
        const lonDelta = data.lon - this.lastLon!;
        const altDelta = data.altitude - this.lastAltitude!;

        console.log('📏 GNSS deltas:', { latDelta, lonDelta, altDelta });

        // Check if values are unchanged (within precision tolerance)
        const latUnchanged = Math.abs(latDelta) < (1 / this.latLonPrecision);
        const lonUnchanged = Math.abs(lonDelta) < (1 / this.latLonPrecision);
        const altUnchanged = Math.abs(altDelta) < (1 / this.altitudePrecision);

        if (latUnchanged && lonUnchanged && altUnchanged) {
          // No significant changes
          this.sameValueCount++;
          if (this.sameValueCount <= 3) {
            console.log('📦 Sending skip packet (no changes)');
            compressedBuffer = this.createSkipPacket();
          } else {
            // After 3 skips, send raw packet to ensure sync
            console.log('📦 Sending raw packet (resync after skips)');
            compressedBuffer = this.createRawPacket(data.lat, data.lon, data.altitude);
            this.sameValueCount = 0;
          }
        } else {
          // Check if deltas are small enough for delta encoding
          const deltasFitInByte = 
            Math.abs(latDelta) <= this.maxDeltaLatLon &&
            Math.abs(lonDelta) <= this.maxDeltaLatLon &&
            Math.abs(altDelta) <= this.maxDeltaAltitude;

          if (deltasFitInByte) {
            console.log('📦 Sending delta packet');
            compressedBuffer = this.createDeltaPacket(latDelta, lonDelta, altDelta);
            this.sameValueCount = 0;
          } else {
            // Deltas too large, send raw packet
            console.log('📦 Sending raw packet (deltas too large)');
            compressedBuffer = this.createRawPacket(data.lat, data.lon, data.altitude);
            this.sameValueCount = 0;
          }

          // Update state
          this.lastLat = data.lat;
          this.lastLon = data.lon;
          this.lastAltitude = data.altitude;
        }
      }
      
      const endTime = performance.now();
      
      // Return result
      const result: CompressionMetrics = {
        buffer: compressedBuffer
      };
      
      if (showMetrics) {
        const originalSize = rawData.nmea?.length || JSON.stringify(rawData).length;
        result.compressionRatio = originalSize > 0 ? originalSize / (compressedBuffer.length || 1) : 1;
        result.processingTime = endTime - startTime;
      }
      
      console.log('✅ GNSS compression completed:', {
        inputSize: rawData.nmea?.length || JSON.stringify(rawData).length,
        outputSize: compressedBuffer.length,
        compressionRatio: result.compressionRatio?.toFixed(2)
      });
      
      return result;
    } catch (error) {
      console.error("❌ Error in GNSS compression:", error);
      return { buffer: Buffer.alloc(0) };
    }
  }
} 