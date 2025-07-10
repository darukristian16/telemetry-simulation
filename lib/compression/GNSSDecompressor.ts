interface GNSSData {
  latitude: number;
  longitude: number;
  altitude: number;
  hdop?: number;
  satellites?: number;
}

export class GNSSDecompressor {
  // State tracking
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private lastAltitude: number | null = null;
  
  // Decompression settings - match compressor
  private readonly latLonPrecision = 1000000; // 6 decimal places precision
  private readonly altitudePrecision = 10; // 0.1 meter precision

  constructor() {
    this.reset();
  }

  reset(): void {
    this.lastLat = null;
    this.lastLon = null;
    this.lastAltitude = null;
  }

  // Decompress raw packet (12 bytes)
  private decompressRawPacket(buffer: Buffer): GNSSData | null {
    if (buffer.length < 12) {
      console.error('❌ GNSS raw packet too short:', buffer.length);
      return null;
    }

    try {
      // Extract latitude (4 bytes signed, scaled by 1,000,000)
      const latScaled = buffer.readInt32BE(1);
      const lat = latScaled / this.latLonPrecision;
      
      // Extract longitude (4 bytes signed, scaled by 1,000,000)
      const lonScaled = buffer.readInt32BE(5);
      const lon = lonScaled / this.latLonPrecision;
      
      // Extract altitude (2 bytes unsigned, scaled by 10)
      const altScaled = buffer.readUInt16BE(9);
      const altitude = altScaled / this.altitudePrecision;

      console.log('📦 GNSS Raw packet decompressed:', {
        latScaled, lonScaled, altScaled,
        lat, lon, altitude
      });

      // Update state
      this.lastLat = lat;
      this.lastLon = lon;
      this.lastAltitude = altitude;

      return { latitude: lat, longitude: lon, altitude };
    } catch (error) {
      console.error('❌ Error decompressing GNSS raw packet:', error);
      return null;
    }
  }

  // Decompress delta packet (4 bytes)
  private decompressDeltaPacket(buffer: Buffer): GNSSData | null {
    if (buffer.length < 4) {
      console.error('❌ GNSS delta packet too short:', buffer.length);
      return null;
    }

    if (this.lastLat === null || this.lastLon === null || this.lastAltitude === null) {
      console.error('❌ GNSS delta packet received without previous raw packet');
      return null;
    }

    try {
      // Extract deltas
      const latDeltaScaled = buffer.readInt8(1);
      const lonDeltaScaled = buffer.readInt8(2);
      const altDeltaScaled = buffer.readInt8(3);

      // Convert back to actual deltas
      const latDelta = latDeltaScaled / 10000;
      const lonDelta = lonDeltaScaled / 10000;
      const altDelta = altDeltaScaled / 10;

      console.log('📦 GNSS Delta packet decompressed:', {
        latDeltaScaled, lonDeltaScaled, altDeltaScaled,
        latDelta, lonDelta, altDelta
      });

      // Apply deltas to get current values
      const lat = this.lastLat + latDelta;
      const lon = this.lastLon + lonDelta;
      const altitude = this.lastAltitude + altDelta;

      console.log('📍 GNSS Delta result:', {
        previousLat: this.lastLat,
        previousLon: this.lastLon,
        previousAlt: this.lastAltitude,
        currentLat: lat,
        currentLon: lon,
        currentAlt: altitude
      });

      // Update state
      this.lastLat = lat;
      this.lastLon = lon;
      this.lastAltitude = altitude;

      return { latitude: lat, longitude: lon, altitude };
    } catch (error) {
      console.error('❌ Error decompressing GNSS delta packet:', error);
      return null;
    }
  }

  // Decompress skip packet (1 byte)
  private decompressSkipPacket(): GNSSData | null {
    if (this.lastLat === null || this.lastLon === null || this.lastAltitude === null) {
      console.error('❌ GNSS skip packet received without previous data');
      return null;
    }

    console.log('📦 GNSS Skip packet - returning last values:', {
      lat: this.lastLat,
      lon: this.lastLon,
      altitude: this.lastAltitude
    });

    // Return last known values
    return { 
      latitude: this.lastLat, 
      longitude: this.lastLon, 
      altitude: this.lastAltitude 
    };
  }

  // Main decompression method
  decompressData(buffer: Buffer): GNSSData | null {
    if (!buffer || buffer.length === 0) {
      console.error('❌ GNSS decompression: empty buffer');
      return null;
    }

    try {
      const headerByte = buffer.readUInt8(0);
      
      console.log('📦 GNSS decompression header:', {
        headerByte: headerByte.toString(16),
        bufferLength: buffer.length,
        bufferHex: buffer.toString('hex')
      });

      // Determine packet type based on header
      if (headerByte === 0x01) {
        // Raw packet
        console.log('📦 Processing GNSS raw packet');
        return this.decompressRawPacket(buffer);
      } else if (headerByte === 0x00) {
        // Delta packet
        console.log('📦 Processing GNSS delta packet');
        return this.decompressDeltaPacket(buffer);
      } else if (headerByte === 0xFF) {
        // Skip packet
        console.log('📦 Processing GNSS skip packet');
        return this.decompressSkipPacket();
      } else {
        console.error('❌ Unknown GNSS packet type:', headerByte.toString(16));
        return null;
      }
    } catch (error) {
      console.error('❌ Error in GNSS decompression:', error);
      return null;
    }
  }
} 