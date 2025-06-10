// Import required libraries
// Note: using pure JavaScript versions instead of TypeScript
// to maintain compatibility with the provided generator files

// Chance.js for random data generation
const Chance = require('chance');
const chance = new Chance();

// Battery Data Generator
class BatteryDataGenerator {
    constructor(config = {}) {
        this.minVoltage = config.minVoltage || 3.0;  // Minimum voltage (0%)
        this.maxVoltage = config.maxVoltage || 4.2;  // Maximum voltage (100%)
        this.voltage = config.initialVoltage || chance.floating({ min: 3.3, max: 4.2, fixed: 3 }); // Initial voltage
        this.percentage = this.voltageToPercentage(this.voltage); // Initial percentage
        this.current = config.initialCurrent || 0; // Initial current in amperes (A)
        this.isCharging = config.isCharging || false; // Track if the battery is charging
    }

    // Convert voltage to percentage (linear approximation)
    voltageToPercentage(voltage) {
        return parseFloat(((voltage - this.minVoltage) / (this.maxVoltage - this.minVoltage) * 100).toFixed(1));
    }

    // Simulate current based on charging/discharging state
    simulate() {
        if (this.isCharging) {
            // Charging: current is negative (e.g., -1.5A)
            this.current = -chance.floating({ min: 0.5, max: 2.0, fixed: 2 });
            this.voltage += chance.floating({ min: 0, max: 0.01, fixed: 3 }); // Simulate small changes
        } else {
            // Discharging: current is positive (e.g., 1.2A)
            this.current = chance.floating({ min: 0.1, max: 2.0, fixed: 2 });
            this.voltage += chance.floating({ min: -0.01, max: 0, fixed: 3 }); // Simulate small changes
        }
    }

    // Update voltage, percentage, and current
    update() {
        // Simulate charging/discharging state
        if (this.percentage <= 20 && !this.isCharging) {
            this.isCharging = true; // Start charging if battery is low
        } else if (this.percentage >= 95 && this.isCharging) {
            this.isCharging = false; // Stop charging if battery is full
        }

        // Simulate current and voltage
        this.simulate();
        // Update voltage and percentage
        this.voltage = Math.min(this.maxVoltage, Math.max(this.minVoltage, this.voltage)); // Clamp voltage
        this.percentage = this.voltageToPercentage(this.voltage); // Update percentage
    }

    // Generate data for compatibility with existing telemetry page
    generateData() {
        this.update();
        return {
            id: 0, // For compatibility with prisma models
            voltage: parseFloat(this.voltage.toFixed(3)), // Voltage with 3 decimal places
            percentage: parseFloat(this.percentage.toFixed(1)), // Percentage with 1 decimal place
            current: parseFloat(this.current.toFixed(2)), // Current with 2 decimal places
            status: this.isCharging ? "Charging" : "Discharging", // Charging/discharging status
            timestamp: new Date()
        };
    }
    
    // Update configuration
    updateConfig(config = {}) {
        if (config.minVoltage !== undefined) this.minVoltage = config.minVoltage;
        if (config.maxVoltage !== undefined) this.maxVoltage = config.maxVoltage;
        if (config.isCharging !== undefined) this.isCharging = config.isCharging;
        
        // Recalculate percentage based on new min/max values
        this.percentage = this.voltageToPercentage(this.voltage);
    }
}

// Temperature Data Generator
class TemperatureDataGenerator {
    constructor(config = {}) {
        // Define temperature limits
        this.minTemperature = config.minTemperature || 20.0; // Minimum realistic temperature (°C)
        this.maxTemperature = config.maxTemperature || 40.0; // Maximum realistic temperature (°C)
         
        // Initialize temperature
        this.currentTemperature = config.initialTemperature || chance.floating({ min: 25.0, max: 30.0, fixed: 2 }); // Start within normal room temperature
         
        // Compute initial voltage
        this.voltage = this.temperatureToVoltage(this.currentTemperature);
    }

    // Convert temperature to LM35 voltage
    temperatureToVoltage(temperature) {
        return parseFloat((temperature / 100).toFixed(3)); // Voltage = Temperature/100
    }

    // Simulate temperature changes
    simulate() {
        // Generate small random temperature fluctuation
        let tempChange = chance.floating({ min: -0.5, max: 0.5, fixed: 2 });
        
        // Apply change while keeping temperature within limits
        this.currentTemperature = Math.max(this.minTemperature, 
            Math.min(this.maxTemperature, this.currentTemperature + tempChange));
        
        // Update voltage based on new temperature
        this.voltage = this.temperatureToVoltage(this.currentTemperature);
    }

    // Generate data for compatibility with existing telemetry page
    generateData() {
        this.simulate();
        
        return {
            id: 0, // For compatibility with prisma models
            voltage: this.voltage,
            temperature: this.currentTemperature,
            timestamp: new Date()
        };
    }
    
    // Update configuration
    updateConfig(config = {}) {
        if (config.minTemperature !== undefined) this.minTemperature = config.minTemperature;
        if (config.maxTemperature !== undefined) this.maxTemperature = config.maxTemperature;
        if (config.currentTemperature !== undefined) this.currentTemperature = config.currentTemperature;
        
        // Update voltage based on new temperature if set
        if (config.currentTemperature !== undefined) {
            this.voltage = this.temperatureToVoltage(this.currentTemperature);
        }
    }
}

// GNSS Data Generator
class GNSSDataGenerator {
    constructor(config = {}) {
        // Initialize realistic starting position
        this.currentLat = config.initialLat || 40.7128; // Latitude (°)
        this.currentLon = config.initialLon || -74.0060; // Longitude (°)
        this.currentAltitude = config.initialAltitude || 10.0; // Altitude in meters
        this.hdop = config.initialHdop || 0.9; // Initial HDOP value
        this.satellites = config.initialSatellites || chance.integer({ min: 6, max: 12 }); // Number of satellites
        this.fixType = config.initialFixType || 1; // 1 = GPS fix
        
        // Movement simulation parameters
        this.latVariation = config.latVariation || 0.0005;
        this.lonVariation = config.lonVariation || 0.0005;
        this.altVariation = config.altVariation || 0.2;
    }

    // Simulate smooth movement (small latitude/longitude changes)
    simulateMovement() {
        this.currentLat += chance.floating({ min: -this.latVariation, max: this.latVariation, fixed: 6 });
        this.currentLon += chance.floating({ min: -this.lonVariation, max: this.lonVariation, fixed: 6 });
        this.currentAltitude += chance.floating({ min: -this.altVariation, max: this.altVariation, fixed: 1 });

        // Slight fluctuation in HDOP and satellite count
        this.hdop = chance.floating({ min: 0.5, max: 1.5, fixed: 1 });
        this.satellites = chance.integer({ min: 6, max: 12 });
    }

    // Convert Latitude & Longitude to NMEA format
    formatNMEA(value, directionPositive, directionNegative) {
        let degrees = Math.floor(Math.abs(value));
        let minutes = (Math.abs(value) - degrees) * 60;
        let direction = value >= 0 ? directionPositive : directionNegative;
        return `${degrees}${minutes.toFixed(3)},${direction}`;
    }

    // Compute XOR checksum for NMEA data
    computeChecksum(sentence) {
        let checksum = 0;
        for (let i = 0; i < sentence.length; i++) {
            checksum ^= sentence.charCodeAt(i);
        }
        return checksum.toString(16).toUpperCase().padStart(2, '0');
    }

    // Generate data for compatibility with existing telemetry page
    generateData() {
        this.simulateMovement();
        
        // Get UTC time in HHMMSS format
        let now = new Date();
        let utcTime = now.getUTCHours().toString().padStart(2, '0') +
                      now.getUTCMinutes().toString().padStart(2, '0') +
                      now.getUTCSeconds().toString().padStart(2, '0');

        // Format Latitude & Longitude
        let latitude = this.formatNMEA(this.currentLat, "N", "S");
        let longitude = this.formatNMEA(this.currentLon, "E", "W");

        // Construct raw NMEA sentence (without checksum)
        let rawData = `$GPGGA,${utcTime},${latitude},${longitude},${this.fixType},${this.satellites},${this.hdop},${this.currentAltitude.toFixed(1)},M,,M,,`;
        
        // Calculate checksum
        let checksum = this.computeChecksum(rawData);
        
        return {
            id: 0, // For compatibility with prisma models
            latitude: this.currentLat,
            longitude: this.currentLon,
            altitude: this.currentAltitude,
            hdop: this.hdop,
            satellites: this.satellites,
            fixType: this.fixType,
            rawNMEA: `${rawData}*${checksum}`,
            timestamp: new Date()
        };
    }
    
    // Update configuration
    updateConfig(config = {}) {
        if (config.currentLat !== undefined) this.currentLat = config.currentLat;
        if (config.currentLon !== undefined) this.currentLon = config.currentLon;
        if (config.currentAltitude !== undefined) this.currentAltitude = config.currentAltitude;
        if (config.satellites !== undefined) this.satellites = config.satellites;
        if (config.fixType !== undefined) this.fixType = config.fixType;
        if (config.hdop !== undefined) this.hdop = config.hdop;
        if (config.latVariation !== undefined) this.latVariation = config.latVariation;
        if (config.lonVariation !== undefined) this.lonVariation = config.lonVariation;
        if (config.altVariation !== undefined) this.altVariation = config.altVariation;
    }
}

// Gas Sensor Data Generator
class GasSensorDataGenerator {
    constructor(sensorType = 'CO', customConfig = {}) {
        this.sensorType = sensorType;
        
        // Default configuration based on sensor type
        const DEFAULT_CONFIGS = {
            CO: {
                BASE_MIN: 200,
                BASE_MAX: 400,
                BASE_DRIFT: 0.2,
                FLUCTUATION_AMPLITUDE: 30,
                FLUCTUATION_PERIOD: 40,
                PEAK_PROBABILITY: 5,
                NOISE_RANGE: 2,
                PEAK_MIN: 250,
                PEAK_MAX: 500,
                PEAK_DURATION: { min: 10, max: 30 }
            },
            NO2: {
                BASE_MIN: 100,
                BASE_MAX: 250,
                BASE_DRIFT: 0.3,
                FLUCTUATION_AMPLITUDE: 20,
                FLUCTUATION_PERIOD: 50,
                PEAK_PROBABILITY: 3,
                NOISE_RANGE: 1.5,
                PEAK_MIN: 150,
                PEAK_MAX: 300,
                PEAK_DURATION: { min: 5, max: 20 }
            },
            SO2: {
                BASE_MIN: 150,
                BASE_MAX: 350,
                BASE_DRIFT: 0.25,
                FLUCTUATION_AMPLITUDE: 25,
                FLUCTUATION_PERIOD: 45,
                PEAK_PROBABILITY: 4,
                NOISE_RANGE: 2.5,
                PEAK_MIN: 200,
                PEAK_MAX: 400,
                PEAK_DURATION: { min: 8, max: 25 }
            }
        };
        
        // Merge custom config with defaults
        this.CONFIG = { ...DEFAULT_CONFIGS[sensorType], ...customConfig };

        this.state = {
            baseValue: chance.floating({ min: this.CONFIG.BASE_MIN, max: this.CONFIG.BASE_MAX }),
            activePeak: 0,
            peakDuration: 0,
            peakInitialDuration: 0,
            timeStep: 0
        };
    }

    // Clamp value between 0 and 1023
    clampValue(value) {
        return Math.min(1023, Math.max(0, Math.round(value)));
    }

    // Generate sensor value
    generateSensorValue() {
        // Base value drift
        this.state.baseValue += chance.normal({
            mean: 0,
            dev: this.CONFIG.BASE_DRIFT,
            min: -this.CONFIG.BASE_DRIFT,
            max: this.CONFIG.BASE_DRIFT
        });
        this.state.baseValue = this.clampValue(this.state.baseValue);

        // Environmental fluctuations
        const fluctuation = this.CONFIG.FLUCTUATION_AMPLITUDE * 
            Math.sin(2 * Math.PI * this.state.timeStep / this.CONFIG.FLUCTUATION_PERIOD);
        this.state.timeStep = (this.state.timeStep + 1) % this.CONFIG.FLUCTUATION_PERIOD;

        // Gas peak detection and decay
        let peakEffect = 0;
        if (this.state.peakDuration > 0) {
            peakEffect = this.state.activePeak * (this.state.peakDuration / this.state.peakInitialDuration);
            this.state.peakDuration--;
        } else if (chance.bool({ likelihood: this.CONFIG.PEAK_PROBABILITY })) {
            this.state.activePeak = chance.floating({ 
                min: this.CONFIG.PEAK_MIN, 
                max: this.CONFIG.PEAK_MAX,
                fixed: 2
            });
            this.state.peakInitialDuration = chance.integer({ 
                min: this.CONFIG.PEAK_DURATION.min, 
                max: this.CONFIG.PEAK_DURATION.max 
            });
            this.state.peakDuration = this.state.peakInitialDuration;
        }

        // Combine components with sensor noise
        const noise = chance.floating({ 
            min: -this.CONFIG.NOISE_RANGE, 
            max: this.CONFIG.NOISE_RANGE,
            fixed: 2
        });
        
        const rawValue = this.state.baseValue + fluctuation + peakEffect + noise;
        return this.clampValue(rawValue);
    }

    // Generate data for compatibility with existing telemetry page
    generateData() {
        return {
            id: 0, // For compatibility with prisma models
            sensorType: this.sensorType,
            sensorValue: this.generateSensorValue(),
            timestamp: new Date()
        };
    }
    
    // Update configuration
    updateConfig(config = {}) {
        // Update any config properties that were provided
        Object.keys(config).forEach(key => {
            if (this.CONFIG[key] !== undefined) {
                this.CONFIG[key] = config[key];
            }
        });
        
        // If we're updating base ranges, also reset the base value
        if (config.BASE_MIN !== undefined || config.BASE_MAX !== undefined) {
            this.state.baseValue = chance.floating({ 
                min: this.CONFIG.BASE_MIN, 
                max: this.CONFIG.BASE_MAX 
            });
        }
    }
}

// Factory function to create all three gas generators
function createGasGenerators(config = {}) {
    return {
        CO: new GasSensorDataGenerator('CO', config.CO || {}),
        NO2: new GasSensorDataGenerator('NO2', config.NO2 || {}),
        SO2: new GasSensorDataGenerator('SO2', config.SO2 || {})
    };
}

// Export all generators
module.exports = {
    BatteryDataGenerator,
    TemperatureDataGenerator,
    GNSSDataGenerator,
    GasSensorDataGenerator,
    createGasGenerators
}; 