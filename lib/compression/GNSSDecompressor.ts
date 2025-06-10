interface GNSSData {
  latitude: number;
  longitude: number;
  altitude: number;
  hdop?: number;
  satellites?: number;
}

export class GNSSDecompressor {
  // State tracking (mirrors compressor state)
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private lastAltitude: number | null = null;
  private lastHdop: number | null = null;
  private lastSatellites: number | null = null;
  
  // Quantization thresholds (must match compressor)
  private readonly latLonQuantization = 0.00001; // About 1 meter at the equator
  private readonly altitudeQuantization = 0.1; // 10cm steps

  constructor() {
    this.reset();
  }

  // Reset decompressor state
  reset(): void {
    this.lastLat = null;
    this.lastLon = null;
    this.lastAltitude = null;
    this.lastHdop = null;
    this.lastSatellites = null;
  }

  // Main decompression method
  decompress(buffer: Buffer): GNSSData | null {
    if (!buffer || buffer.length === 0) {
      return null; // Empty buffer (RLE continuation)
    }

    try {
      const header = buffer.readUInt8(0);

      // Check packet type using header bits
      if (header & 0x01) {
        // RAW PACKET (bit 0 = 1)
        return this.decompressRawPacket(buffer);
      } else if (header === 0xFF) {
        // UNCHANGED VALUES PACKET
        return this.decompressUnchangedPacket();
      } else if (header & 0x40) {
        // RLE PACKET (bit 6 = 1) 
        return this.decompressRLEPacket();
      } else {
        // DELTA PACKET (bit 0 = 0)
        return this.decompressDeltaPacket(buffer);
      }
    } catch (error) {
      console.error('Error decompressing GNSS data:', error);
      return null;
    }
  }

  // Decompress raw packet format (10 bytes)
  private decompressRawPacket(buffer: Buffer): GNSSData {
    if (buffer.length < 10) {
      throw new Error('Invalid raw packet size');
    }

    const header = buffer.readUInt8(0);
    const latSign = (header & 0x04) ? -1 : 1;
    const lonSign = (header & 0x02) ? -1 : 1;

    // Read coordinate components
    const latDeg = buffer.readUInt16BE(1);
    const latMin = buffer.readUInt16BE(3);
    const lonDeg = buffer.readUInt16BE(5);
    const lonMin = buffer.readUInt16BE(7);
    const altitude = buffer.readUInt8(9);

    // Convert back to decimal degrees
    const latitude = latSign * (latDeg + latMin / (60 * 1000));
    const longitude = lonSign * (lonDeg + lonMin / (60 * 1000));

    // Update state
    this.lastLat = latitude;
    this.lastLon = longitude;
    this.lastAltitude = altitude;
    this.lastHdop = 1.0; // Default values for raw packets
    this.lastSatellites = 8;

    return {
      latitude,
      longitude,
      altitude,
      hdop: this.lastHdop,
      satellites: this.lastSatellites
    };
  }

  // Decompress delta packet
  private decompressDeltaPacket(buffer: Buffer): GNSSData {
    if (this.lastLat === null || this.lastLon === null || this.lastAltitude === null) {
      throw new Error('Cannot decompress delta packet without previous state');
    }

    const header = buffer.readUInt8(0);

    // Extract byte sizes from header bits
    const latBytes = (header >> 1) & 0x03;  // bits 1-2
    const lonBytes = (header >> 3) & 0x03;  // bits 3-4
    const altBytes = (header >> 5) & 0x03;  // bits 5-6

    // Read delta values
    let offset = 1;
    const latDelta = this.readSignedValue(buffer, offset, latBytes);
    offset += latBytes;
    const lonDelta = this.readSignedValue(buffer, offset, lonBytes);
    offset += lonBytes;
    const altDelta = this.readSignedValue(buffer, offset, altBytes);

    // Apply deltas with quantization
    const latitude = this.lastLat + (latDelta * this.latLonQuantization);
    const longitude = this.lastLon + (lonDelta * this.latLonQuantization);
    const altitude = this.lastAltitude + (altDelta * this.altitudeQuantization);

    // Update state
    this.lastLat = latitude;
    this.lastLon = longitude;
    this.lastAltitude = altitude;

    return {
      latitude,
      longitude,
      altitude,
      hdop: this.lastHdop || 1.0,
      satellites: this.lastSatellites || 8
    };
  }

  // Decompress RLE packet (unchanged values)
  private decompressRLEPacket(): GNSSData {
    if (this.lastLat === null || this.lastLon === null || this.lastAltitude === null) {
      throw new Error('Cannot decompress RLE packet without previous state');
    }

    // Return last known values
    return {
      latitude: this.lastLat,
      longitude: this.lastLon,
      altitude: this.lastAltitude,
      hdop: this.lastHdop || 1.0,
      satellites: this.lastSatellites || 8
    };
  }

  // Decompress unchanged values packet
  private decompressUnchangedPacket(): GNSSData {
    return this.decompressRLEPacket(); // Same logic
  }

  // Read signed value from buffer
  private readSignedValue(buffer: Buffer, offset: number, bytes: number): number {
    if (bytes === 0 || offset + bytes > buffer.length) {
      return 0;
    }

    let value = 0;
    
    // Read bytes in big-endian order
    for (let i = 0; i < bytes; i++) {
      value = (value << 8) | buffer.readUInt8(offset + i);
    }

    // Convert to signed value
    const signBit = 1 << (bytes * 8 - 1);
    if (value & signBit) {
      // Negative number - convert from two's complement
      value = value - (1 << (bytes * 8));
    }

    return value;
  }

  // Get current state (for debugging)
  getState(): any {
    return {
      lastLat: this.lastLat,
      lastLon: this.lastLon,
      lastAltitude: this.lastAltitude,
      lastHdop: this.lastHdop,
      lastSatellites: this.lastSatellites
    };
  }
} 