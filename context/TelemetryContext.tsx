"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { BatteryCompressor } from '../lib/compression/BatteryCompressor';
import { GNSSCompressor } from '../lib/compression/GNSSCompressor';
import { TemperatureCompressor } from '../lib/compression/TemperatureCompressor';
import { GasSensorCompressor } from '../lib/compression/GasSensorCompressor';
import { useSerialStore } from '../lib/store';



// Battery data generator class that simulates real-time battery readings
class BatteryDataGenerator {
    constructor(config: {
        voltage?: number;
        percentage?: number;
        current?: number;
        status?: string;
    } = {}) {
        // Initialize with user-provided values or defaults
        this.voltage = config.voltage || 3.7; // Initial voltage in volts (typical Li-ion)
        this.percentage = config.percentage || 75.0; // Initial battery percentage
        this.current = config.current || 0.5; // Initial current in amps (positive = charging, negative = discharging)
        this.status = config.status || "Discharging"; // Battery status: "Charging" or "Discharging"
        
        // Realistic variance ranges for simulation
        this.voltageVariance = 0.01; // 10mV variations (more realistic for Li-ion)
        this.percentageVariance = 0.3; // 0.3% random variations
        this.currentVariance = 0.05; // 50mA variations
        
        // More realistic trend direction for battery behavior
        this.voltageTrend = this.status === "Charging" ? 0.002 : -0.002; // 2mV per update
        this.percentageTrend = this.status === "Charging" ? 0.3 : -0.2; // 0.3%/update charge, -0.2%/update discharge
        this.currentTrend = 0; // Neutral trend for current
        this.chargeCounter = 0; // Counter to track when to simulate charging/discharging changes
        

    }
    
    // Generate random variation within range
    getVariation(range: number): number {
        return (Math.random() * 2 - 1) * range;
    }
    
    // Generate realistic battery raw data
    generateRawData() {
        const oldPercentage = this.percentage;
        const oldVoltage = this.voltage;
        const oldCurrent = this.current;
        const oldStatus = this.status;
        
        // Apply trends with random variations
        this.voltage += this.voltageTrend + this.getVariation(this.voltageVariance);
        this.percentage += this.percentageTrend + this.getVariation(this.percentageVariance);
        this.current += this.currentTrend + this.getVariation(this.currentVariance);
        
        // Ensure values stay within realistic bounds
        this.voltage = Math.max(3.0, Math.min(4.2, this.voltage));
        this.percentage = Math.max(0, Math.min(100, this.percentage));
        
        // Auto-adjust current sign based on status
        if (this.status === "Charging" && this.current < 0) {
            this.current = Math.abs(this.current);
        } else if (this.status === "Discharging" && this.current > 0) {
            this.current = -Math.abs(this.current);
        }
        
        // Randomly switch between charging/discharging occasionally
        this.chargeCounter++;
        if (this.chargeCounter > 20 && Math.random() < 0.08) { // Increased probability from 0.05 to 0.08
            if (this.status === "Charging") {
                this.status = "Discharging";
                this.currentTrend = -0.02;
                this.voltageTrend = -0.002;
                this.percentageTrend = -0.2; // Discharge 0.2% per update
                this.current = -Math.abs(this.current); // Make current negative for discharging

            } else {
                this.status = "Charging";
                this.currentTrend = 0.02;
                this.voltageTrend = 0.002;
                this.percentageTrend = 0.3; // Charge 0.3% per update
                this.current = Math.abs(this.current); // Make current positive for charging

            }
            this.chargeCounter = 0;
        }
        
        // Handle edge cases
        if (this.percentage <= 5 && this.status === "Discharging") {
            // Near empty - slow down discharge
            this.percentageTrend = -0.05;

        } else if (this.percentage >= 95 && this.status === "Charging") {
            // Near full - slow down charge
            this.percentageTrend = 0.1;

        }
        
        // Return formatted data
        const result = {
            voltage: parseFloat(this.voltage.toFixed(3)),
            percentage: parseFloat(this.percentage.toFixed(1)),
            current: parseFloat(this.current.toFixed(3)),
            status: this.status
        };
        

        
        return result;
    }

    // Properties for TypeScript
    private voltage: number;
    private percentage: number;
    private current: number;
    private status: string;
    private voltageVariance: number;
    private percentageVariance: number;
    private currentVariance: number;
    private voltageTrend: number;
    private percentageTrend: number;
    private currentTrend: number;
    private chargeCounter: number;
}

// LM35 Temperature data generator class that simulates real-time temperature readings
class LM35TemperatureGenerator {
    constructor(config: {
        currentTemperature?: number;
    } = {}) {
        // Define temperature limits - 0°C to 150°C range
        this.minTemperature = 0.0;   // Minimum realistic temperature (°C)
        this.maxTemperature = 150.0; // Maximum realistic temperature (°C)

        // Initialize temperature with user input or default
        this.currentTemperature = config.currentTemperature || 25.0; // Start with user's input
        this.baselineTemperature = this.currentTemperature; // Store baseline for spike recovery

        // Compute initial voltage
        this.voltage = this.temperatureToVoltage(this.currentTemperature);

        // Temperature spike system
        this.spikePhase = 'none';    // Current spike phase: 'none', 'rising', 'sustained', 'decaying'
        this.targetSpikeTemp = 0;    // Target spike temperature (°C)
        this.activeSpike = 0;        // Current spike magnitude (°C)
        this.risePhaseCounter = 0;   // Counter for exponential rise phase
        this.risePhaseDuration = 0;  // Duration of rise phase (2-3 seconds)
        this.spikeDuration = 0;      // Remaining sustained phase duration (updates)
        this.spikeInitialDuration = 0; // Initial duration for reference
        this.decayRate = 0.85;       // Decay rate (multiplier per update, 0.85 = 15% reduction per second)
    }

    // Convert temperature to LM35 voltage
    temperatureToVoltage(temperature: number): number {
        return parseFloat((temperature / 100).toFixed(3)); // Voltage = Temperature/100
    }

    // Generate random number within range
    getRandomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    // Generate random integer within range
    getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Random boolean with likelihood percentage
    getRandomBool(likelihood: number): boolean {
        return Math.random() * 100 < likelihood;
    }

    // Generate random variation within range
    getRandomChange(): number {
        return (Math.random() - 0.5) * 1.0; // Random change between -0.5 and +0.5
    }

    // Simulate temperature changes including spikes
    simulate() {
        // Handle temperature spike phases
        if (this.spikePhase === 'rising') {
            // PHASE 1: Exponential rise to target temperature
            this.risePhaseCounter++;
            
            // Calculate exponential rise progress (0 to 1)
            const progress = this.risePhaseCounter / this.risePhaseDuration;
            
            // Exponential rise using sinh function
            const exponentialFactor = (Math.sinh(progress * 2)) / Math.sinh(2);
            
            // Set current spike based on exponential progress
            this.activeSpike = this.targetSpikeTemp * exponentialFactor;
            
            // Check if rise phase is complete
            if (this.risePhaseCounter >= this.risePhaseDuration) {
                this.spikePhase = 'sustained';
                this.activeSpike = this.targetSpikeTemp; // Ensure we reach exact target
            }
        } else if (this.spikePhase === 'sustained') {
            // PHASE 2: Sustained high temperature with small fluctuations
            const spikeFluctuation = this.getRandomChange() * 0.5; // Small changes around spike level
            this.activeSpike += spikeFluctuation;
            
            // Keep spike within reasonable bounds around target
            const minSpike = this.targetSpikeTemp - 3; // Allow 3°C below target
            const maxSpike = this.targetSpikeTemp + 3; // Allow 3°C above target
            this.activeSpike = Math.max(minSpike, Math.min(maxSpike, this.activeSpike));
            
            this.spikeDuration--;
            
            // When sustained phase ends, enter decay phase
            if (this.spikeDuration <= 0) {
                this.spikePhase = 'decaying';
            }
        } else if (this.spikePhase === 'decaying') {
            // PHASE 3: Gradual decay back to baseline
            this.activeSpike *= this.decayRate; // Reduce by 15% each update
            
            // When spike magnitude becomes very small, end decay phase
            if (this.activeSpike < 0.5) {
                this.activeSpike = 0;
                this.spikePhase = 'none';
            }
        } else {
            // PHASE 0: Normal operation - check for new temperature spike
            const spikeChance = this.getRandomFloat(5, 10);
            if (this.getRandomBool(spikeChance)) {
                // Initialize new temperature spike
                this.targetSpikeTemp = this.getRandomFloat(20, 50); // +20°C to +50°C target
                this.spikeInitialDuration = this.getRandomInt(8, 25); // 8-25 seconds sustained duration
                this.spikeDuration = this.spikeInitialDuration;
                this.risePhaseDuration = this.getRandomInt(2, 4); // 2-4 seconds rise time
                this.risePhaseCounter = 0;
                this.activeSpike = 0; // Start from baseline
                this.spikePhase = 'rising';
            }
        }

        // Generate small random temperature fluctuation for baseline
        let tempChange = this.getRandomChange();

        // Update baseline temperature with small changes
        this.baselineTemperature += tempChange; // Smaller baseline changes
        
        // Apply temperature limits to baseline
        this.baselineTemperature = Math.max(
            this.minTemperature, 
            Math.min(this.maxTemperature - 50, this.baselineTemperature) // Leave room for spikes
        );

        // Calculate current temperature: baseline + spike effect
        this.currentTemperature = this.baselineTemperature + this.activeSpike;
        
        // Ensure final temperature stays within absolute limits
        this.currentTemperature = Math.max(
            this.minTemperature, 
            Math.min(this.maxTemperature, this.currentTemperature)
        );

        // Update voltage based on current temperature
        this.voltage = this.temperatureToVoltage(this.currentTemperature);
    }

    // Generate real-time temperature and voltage output
    generateRawData() {
        this.simulate();
        return {
            voltage: this.voltage,
            temperature: parseFloat(this.currentTemperature.toFixed(2))
        };
    }

    // Properties for TypeScript
    private minTemperature: number;
    private maxTemperature: number;
    private currentTemperature: number;
    private baselineTemperature: number;
    private voltage: number;
    private spikePhase: 'none' | 'rising' | 'sustained' | 'decaying';
    private targetSpikeTemp: number;
    private activeSpike: number;
    private risePhaseCounter: number;
    private risePhaseDuration: number;
    private spikeDuration: number;
    private spikeInitialDuration: number;
    private decayRate: number;
}

// GNSS Data Generator class that simulates real-time GPS readings with NMEA format
class GNSSDataGenerator {
    constructor(config: {
        currentLat?: number;
        currentLon?: number;
        currentAltitude?: number;
    } = {}) {
        // Initialize realistic starting position with user inputs or defaults
        this.currentLat = config.currentLat || -6.890582045572037; // Latitude (°) Bandung, Indonesia
        this.currentLon = config.currentLon || 107.6110135724158; // Longitude (°) Bandung, Indonesia
        this.currentAltitude = config.currentAltitude || 10.0; // Altitude in meters
        this.hdop = 0.9; // Initial HDOP value
        this.satellites = this.getRandomInt(6, 12); // Number of satellites
        this.fixType = 1; // 1 = GPS fix
    }

    // Helper function for random integers
    getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Helper function for random floats
    getRandomFloat(min: number, max: number, decimals: number): number {
        return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
    }

    // Simulate smooth movement (small latitude/longitude changes)
    simulateMovement() {
        this.currentLat += this.getRandomFloat(-0.0005, 0.0005, 6);
        this.currentLon += this.getRandomFloat(-0.0005, 0.0005, 6);
        this.currentAltitude += this.getRandomFloat(-0.2, 0.2, 1);

        // Slight fluctuation in HDOP and satellite count
        this.hdop = this.getRandomFloat(0.5, 1.5, 1);
        this.satellites = this.getRandomInt(6, 12);
    }

    // Convert Latitude & Longitude to NMEA format
    formatNMEA(value: number, directionPositive: string, directionNegative: string): string {
        let degrees = Math.floor(Math.abs(value));
        let minutes = (Math.abs(value) - degrees) * 60;
        let direction = value >= 0 ? directionPositive : directionNegative;
        
        // Determine if this is longitude (3 digits) or latitude (2 digits) based on direction
        const isLongitude = directionPositive === 'E' || directionNegative === 'W';
        
        if (isLongitude) {
            // Longitude: DDDMM.MMM format (3 digits for degrees)
            return `${degrees.toString().padStart(3, '0')}${minutes.toFixed(3).padStart(6, '0')},${direction}`;
        } else {
            // Latitude: DDMM.MMM format (2 digits for degrees)  
            return `${degrees.toString().padStart(2, '0')}${minutes.toFixed(3).padStart(6, '0')},${direction}`;
        }
    }

    // Compute XOR checksum for NMEA data
    computeChecksum(sentence: string): string {
        let checksum = sentence.split('').reduce((acc, char) => acc ^ char.charCodeAt(0), 0);
        return checksum.toString(16).toUpperCase().padStart(2, '0');
    }

    // Generate NMEA GNSS data
    generateRawData() {
        this.simulateMovement(); // Update GNSS values

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

        // Return both NMEA string and parsed coordinates
        return {
            nmea: `${rawData}*${checksum}`,
            latitude: this.currentLat,
            longitude: this.currentLon,
            altitude: this.currentAltitude,
            hdop: this.hdop,
            satellites: this.satellites
        };
    }

    // Properties for TypeScript
    private currentLat: number;
    private currentLon: number;
    private currentAltitude: number;
    private hdop: number;
    private satellites: number;
    private fixType: number;
}

// Gas Sensor Data Generator class that simulates realistic gas sensor readings
class GasSensorDataGenerator {
    constructor(gasType: 'CO' | 'NO2' | 'SO2', config: {
        currentBase?: number;
        [key: string]: any;
    } = {}) {
        // Set gas type
        this.gasType = gasType;
        
        // Get gas-specific configuration
        this.CONFIG = { ...this.getGasSpecificConfig(gasType), ...config };
        
        // Set base value from user input or gas-specific default
        if (config.currentBase !== undefined) {
            this.CONFIG.BASE_VALUE = config.currentBase;
        }

        this.state = {
            baseValue: this.CONFIG.BASE_VALUE,
            activePeak: 0,
            peakDuration: 0,
            timeStep: 0,
            lastValue: null,
            trend: 0,
            trendStrength: 0.6, // Increased from 0.2 for more dynamic trends
            plateauDuration: 0,
            peakInitialDuration: 0
        };
    }

    // Gas-specific configurations with realistic ranges
    private getGasSpecificConfig(gasType: 'CO' | 'NO2' | 'SO2') {
        switch (gasType) {
            case 'CO': // Carbon Monoxide (ppm)
                return {
                    BASE_VALUE: 5,           // Safe baseline 5 ppm
                    MIN_VALUE: 0,            // Minimum possible value
                    MAX_VALUE: 150,          // Maximum sensor range
                    SAFE_RANGE: { min: 0, max: 9 },         // 0-9 ppm: Safe
                    CAUTION_RANGE: { min: 10, max: 35 },    // 10-35 ppm: Caution
                    DANGER_RANGE: { min: 36, max: 100 },    // 36-100 ppm: Dangerous
                    LETHAL_RANGE: { min: 101, max: 150 },   // 100+ ppm: Life-threatening
                    BASE_DRIFT: 0.8,         // Increased drift for more variation
                    FLUCTUATION_AMPLITUDE: 6, // Increased fluctuations
                    FLUCTUATION_PERIOD: 30,  // Faster cycles (30 seconds)
                    PEAK_PROBABILITY: 5,     // Increased pollution events
                    NOISE_RANGE: 1.5,        // Increased noise
                    PEAK_MIN: 8,             // Smaller but more frequent pollution events
                    PEAK_MAX: 25,            // Smaller but more frequent pollution events
                    PEAK_DURATION: { min: 5, max: 15 }, // Shorter peaks
                    PLATEAU_PROBABILITY: 5,  // Reduced plateau (more dynamic)
                    PLATEAU_DURATION: { min: 1, max: 3 } // Shorter plateaus
                };
            
            case 'NO2': // Nitrogen Dioxide (ppb)
                return {
                    BASE_VALUE: 25,          // Safe baseline 25 ppb
                    MIN_VALUE: 0,            // Minimum possible value
                    MAX_VALUE: 1200,         // Maximum sensor range
                    SAFE_RANGE: { min: 0, max: 50 },        // 0-50 ppb: Safe
                    CAUTION_RANGE: { min: 51, max: 200 },   // 51-200 ppb: Caution
                    DANGER_RANGE: { min: 201, max: 1000 },  // 201-1000 ppb: Dangerous
                    LETHAL_RANGE: { min: 1001, max: 1200 }, // 1000+ ppb: Life-threatening
                    BASE_DRIFT: 3,           // Increased drift
                    FLUCTUATION_AMPLITUDE: 15, // Increased fluctuations
                    FLUCTUATION_PERIOD: 40,  // Faster cycles
                    PEAK_PROBABILITY: 6,     // Increased pollution events
                    NOISE_RANGE: 4,          // Increased noise
                    PEAK_MIN: 20,            // Smaller but more frequent events
                    PEAK_MAX: 80,            // Smaller but more frequent events
                    PEAK_DURATION: { min: 4, max: 12 }, // Shorter peaks
                    PLATEAU_PROBABILITY: 3,  // Reduced plateau
                    PLATEAU_DURATION: { min: 1, max: 2 } // Shorter plateaus
                };
            
            case 'SO2': // Sulfur Dioxide (ppb)
                return {
                    BASE_VALUE: 20,          // Safe baseline 20 ppb
                    MIN_VALUE: 0,            // Minimum possible value
                    MAX_VALUE: 800,          // Maximum sensor range
                    SAFE_RANGE: { min: 0, max: 50 },        // 0-50 ppb: Safe
                    CAUTION_RANGE: { min: 51, max: 200 },   // 51-200 ppb: Caution
                    DANGER_RANGE: { min: 201, max: 500 },   // 201-500 ppb: Dangerous
                    LETHAL_RANGE: { min: 501, max: 800 },   // 500+ ppb: Life-threatening
                    BASE_DRIFT: 2.5,         // Increased drift
                    FLUCTUATION_AMPLITUDE: 12, // Increased fluctuations
                    FLUCTUATION_PERIOD: 35,  // Faster cycles
                    PEAK_PROBABILITY: 4,     // Increased pollution events
                    NOISE_RANGE: 3,          // Increased noise
                    PEAK_MIN: 15,            // Smaller but more frequent events
                    PEAK_MAX: 60,            // Smaller but more frequent events
                    PEAK_DURATION: { min: 6, max: 18 }, // Shorter peaks
                    PLATEAU_PROBABILITY: 4,  // Reduced plateau
                    PLATEAU_DURATION: { min: 1, max: 3 } // Shorter plateaus
                };
        }
    }

    // Generate random number within range
    getRandomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    // Generate random integer within range
    getRandomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Generate normal distribution approximation
    getNormalDistribution(mean: number, dev: number): number {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return Math.max(-dev, Math.min(dev, z0 * dev + mean));
    }

    // Random boolean with likelihood
    getRandomBool(likelihood: number): boolean {
        return Math.random() * 100 < likelihood;
    }

    // Clamp value within gas-specific range
    clampValue(value: number): number {
        return Math.min(this.CONFIG.MAX_VALUE, Math.max(this.CONFIG.MIN_VALUE, Math.round(value)));
    }

    // Get danger level based on gas type and value
    getDangerLevel(value: number): 'Safe' | 'Caution' | 'Dangerous' | 'Life-threatening' {
        if (value >= this.CONFIG.LETHAL_RANGE.min) return 'Life-threatening';
        if (value >= this.CONFIG.DANGER_RANGE.min) return 'Dangerous';
        if (value >= this.CONFIG.CAUTION_RANGE.min) return 'Caution';
        return 'Safe';
    }

    // Generate sensor value with gas-specific behavior
    generateSensorValue(): number {
        // Check for plateau behavior (static value periods)
        if (this.state.plateauDuration && this.state.plateauDuration > 0) {
            this.state.plateauDuration--;
            return this.state.lastValue || this.CONFIG.BASE_VALUE;
        }
        
        // Base value drift (gas-specific)
        if (this.getRandomBool(60)) { // Increased from 30% to 60% for more frequent changes
            this.state.baseValue += this.getNormalDistribution(0, this.CONFIG.BASE_DRIFT);
        }
        
        this.state.baseValue = this.clampValue(this.state.baseValue);

        // Environmental fluctuations (gas-specific amplitude and period)
        const fluctuation = this.CONFIG.FLUCTUATION_AMPLITUDE * 
            Math.sin(2 * Math.PI * this.state.timeStep / this.CONFIG.FLUCTUATION_PERIOD);
        this.state.timeStep = (this.state.timeStep + 1) % this.CONFIG.FLUCTUATION_PERIOD;

        // Gas pollution events (gas-specific peaks)
        let peakEffect = 0;
        if (this.state.peakDuration > 0) {
            const normalizedTime = 1 - (this.state.peakDuration / this.state.peakInitialDuration);
            peakEffect = this.state.activePeak * (1 - Math.pow(2 * normalizedTime - 1, 2));
            this.state.peakDuration--;
        } else if (this.getRandomBool(this.CONFIG.PEAK_PROBABILITY)) {
            this.state.activePeak = this.getRandomFloat(this.CONFIG.PEAK_MIN, this.CONFIG.PEAK_MAX);
            this.state.peakInitialDuration = this.getRandomInt(this.CONFIG.PEAK_DURATION.min, this.CONFIG.PEAK_DURATION.max);
            this.state.peakDuration = this.state.peakInitialDuration;
        }

        // Add trend-based movement (increased influence)
        if (this.state.lastValue !== null) {
            this.state.trend = (1 - this.state.trendStrength) * this.state.trend + 
                              this.state.trendStrength * this.getRandomFloat(-1, 1);
        }
        
        // Create plateaus for better compression (reduced frequency)
        if (this.state.lastValue !== null && this.getRandomBool(this.CONFIG.PLATEAU_PROBABILITY)) {
            this.state.plateauDuration = this.getRandomInt(this.CONFIG.PLATEAU_DURATION.min, this.CONFIG.PLATEAU_DURATION.max);
            return this.state.lastValue;
        }

        // Combine components with gas-specific noise (increased trend influence)
        const noise = this.getRandomBool(70) ? 0 : this.getRandomFloat(-this.CONFIG.NOISE_RANGE, this.CONFIG.NOISE_RANGE); // More frequent noise
        const trendComponent = this.state.lastValue !== null ? this.state.trend * 4 : 0; // Increased from 2 to 4
        const rawValue = this.state.baseValue + fluctuation + peakEffect + noise + trendComponent;
        const finalValue = this.clampValue(rawValue);
        
        // Store last value
        this.state.lastValue = finalValue;
        
        return finalValue;
    }

    // Generate raw data (sensor value)
    generateRawData() {
        const sensorValue = this.generateSensorValue();
        return { sensorValue };
    }

    // Properties for TypeScript
    private gasType: 'CO' | 'NO2' | 'SO2';
    private CONFIG: any;
    private state: {
        baseValue: number;
        activePeak: number;
        peakDuration: number;
        timeStep: number;
        lastValue: number | null;
        trend: number;
        trendStrength: number;
        plateauDuration: number;
        peakInitialDuration: number;
    };
}

// Define compression settings structure
export interface CompressionSettings {
  enabled: boolean;     // Enable/disable compression
  showMetrics: boolean; // Show compression metrics in UI
}

// Define the telemetry data structure (conditional based on compression setting)
export interface TelemetryData {
  // GNSS Data (always present as NMEA string or compressed)
  gnss?: string;           // NMEA string when raw, Base64 compressed when compression enabled
  
  // Sensor Data (conditional)
  temperature?: number;       // Only when compression disabled
  temperatureBuffer?: any; // Only when compression enabled (Buffer) - legacy
  temp?: string;           // Only when compression enabled (Base64)
  
  coLevel?: number;          // Only when compression disabled
  no2Level?: number;         // Only when compression disabled
  so2Level?: number;         // Only when compression disabled
  coBuffer?: any;         // Only when compression enabled (Buffer) - legacy
  no2Buffer?: any;        // Only when compression enabled (Buffer) - legacy
  so2Buffer?: any;        // Only when compression enabled (Buffer) - legacy
  co?: string;             // Only when compression enabled (Base64)
  no2?: string;            // Only when compression enabled (Base64)
  so2?: string;            // Only when compression enabled (Base64)
  
  // Battery Data (conditional)
  voltage?: number;          // Only when compression disabled
  current?: number;          // Only when compression disabled
  batteryPercentage?: number; // Only when compression disabled
  batteryStatus?: string;     // Only when compression disabled
  batteryBuffer?: any;     // Only when compression enabled (Buffer) - legacy
  batt?: string;           // Only when compression enabled (Base64)
  
  // System Data (always present - but field names change with compression)
  ts?: number;             // Only when compression enabled (timestamp)
  
  // Latency tracking (for uncompressed data)
  transmissionTimestamp?: number; // When data was transmitted (Date.now())
  processingLatency?: number;     // Time from transmission to processing (ms)
  
  // Compression Data (optional - only populated when compression is enabled and metrics are shown)
  compressionMetrics?: {
    compressionRatio: number;
    processingTime: number;
  };
}

// Define the context interface
interface TelemetryContextType {
  telemetryData: TelemetryData;
  setTelemetryData: React.Dispatch<React.SetStateAction<TelemetryData>>;
  isSimulating: boolean;
  setIsSimulating: React.Dispatch<React.SetStateAction<boolean>>;
  simulationSettings: {
    latitude: string;
    longitude: string;
    altitude: string;
    temperature: string;
    coLevel: string;
    no2Level: string;
    so2Level: string;
    voltage: string;
    current: string;
    batteryPercentage: string;
    batteryStatus: string;
  };
  setSimulationSettings: React.Dispatch<React.SetStateAction<{
    latitude: string;
    longitude: string;
    altitude: string;
    temperature: string;
    coLevel: string;
    no2Level: string;
    so2Level: string;
    voltage: string;
    current: string;
    batteryPercentage: string;
    batteryStatus: string;
  }>>;
  compressionSettings: CompressionSettings;
  setCompressionSettings: React.Dispatch<React.SetStateAction<CompressionSettings>>;
  startSimulation: () => void;
  stopSimulation: () => void;
  resetSimulation: () => void;
}

// Default values
const defaultTelemetryData: TelemetryData = {
  gnss: "$GPGGA,000000,0653.4349,S,10736.6608,E,1,8,0.9,100.0,M,,M,,*5C", // Bandung, Indonesia
  temperature: 25,
  coLevel: 1.2,
  no2Level: 100,
  so2Level: 10,
  voltage: 25,
  current: 1.5,
  batteryPercentage: 100,
  batteryStatus: "Discharging"
};

const defaultSimulationSettings = {
  latitude: '-6.890582045572037', // Bandung, Indonesia
  longitude: '107.6110135724158', // Bandung, Indonesia
  altitude: '100',
  temperature: '25',
  coLevel: '1.2',
  no2Level: '100',
  so2Level: '10',
  voltage: '25',
  current: '1.5',
  batteryPercentage: '100',
  batteryStatus: 'Discharging',
};

const defaultCompressionSettings: CompressionSettings = {
  enabled: false,       // Disabled by default
  showMetrics: true     // Show metrics by default
};

// Create the context
const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

// Create a provider component
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [telemetryData, setTelemetryData] = useState<TelemetryData>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastTransmittedTimestamp, setLastTransmittedTimestamp] = useState(0);
  const [lastTransmittedSequence, setLastTransmittedSequence] = useState(0);
  const executionGuardRef = useRef<string | null>(null); // Prevent double execution
  
  // Simulation settings state
  const [simulationSettings, setSimulationSettings] = useState({
    latitude: '-6.890582045572037',
    longitude: '107.6110135724158',
    altitude: '100',
    temperature: '25',
    coLevel: '1.2',
    no2Level: '100',
    so2Level: '10',
    voltage: '25',
    current: '1.5',
    batteryPercentage: '100',
    batteryStatus: 'Discharging',
  });
  const [compressionSettings, setCompressionSettings] = useState<CompressionSettings>(defaultCompressionSettings);
  const [simulationInterval, setSimulationInterval] = useState<NodeJS.Timeout | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [batteryGenerator, setBatteryGenerator] = useState<BatteryDataGenerator | null>(null);
  const [temperatureGenerator, setTemperatureGenerator] = useState<LM35TemperatureGenerator | null>(null);
  const [gnssGenerator, setGnssGenerator] = useState<GNSSDataGenerator | null>(null);
  const [coGenerator, setCoGenerator] = useState<GasSensorDataGenerator | null>(null);
  const [no2Generator, setNo2Generator] = useState<GasSensorDataGenerator | null>(null);
  const [so2Generator, setSo2Generator] = useState<GasSensorDataGenerator | null>(null);
  const [batteryCompressor, setBatteryCompressor] = useState<BatteryCompressor | null>(null);
  const [gnssCompressor, setGnssCompressor] = useState<GNSSCompressor | null>(null);
  const [temperatureCompressor, setTemperatureCompressor] = useState<TemperatureCompressor | null>(null);
  const [coCompressor, setCoCompressor] = useState<GasSensorCompressor | null>(null);
  const [no2Compressor, setNo2Compressor] = useState<GasSensorCompressor | null>(null);
  const [so2Compressor, setSo2Compressor] = useState<GasSensorCompressor | null>(null);
  
  // Auto-transmission state
  const [autoTransmissionInterval, setAutoTransmissionInterval] = useState<NodeJS.Timeout | null>(null);

  // Function to generate random fluctuations
  const addNoise = (value: number, magnitude: number = 0.05): number => {
    const noise = (Math.random() - 0.5) * 2 * magnitude * value;
    return value + noise;
  };

  // Auto-transmission function (simplified and more reliable)
  const transmitTelemetryAutomatically = async (data: TelemetryData) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Get session-specific state instead of shared store
      const { getSessionState } = require('@/lib/store');
      const sessionState = getSessionState();
      const port = sessionState.port;
      
      // Enhanced port validation
      if (!port) {
        stopSimulation();
        return;
      }
      
      if (!port.writable) {
        stopSimulation();
        return;
      }
      
      // Get current timestamp to avoid duplicate transmissions
      const currentTimestamp = data.ts || Date.now();
      
      if (currentTimestamp <= lastTransmittedTimestamp) {
        return;
      }
      
      let writer = null;
      try {
        writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        
        // Set transmission timestamp at the exact moment before writing to serial port
        const transmissionTimestamp = Date.now();
        const dataWithTimestamp = {
          ...data,
          transmissionTimestamp: transmissionTimestamp
        };
        
        const jsonData = JSON.stringify(dataWithTimestamp) + '\n';
        const encodedData = encoder.encode(jsonData);
        

        
        await writer.write(encodedData);
        
        setLastTransmittedTimestamp(currentTimestamp);
        setLastTransmittedSequence(0); // Reset sequence tracking
        
      } finally {
        if (writer) {
          try {
            writer.releaseLock();
          } catch (lockError) {

          }
        }
      }
      
    } catch (error: any) {
      // Stop simulation and show error
      stopSimulation();
      
      // Show alert after a brief delay to avoid blocking
      setTimeout(() => {
        alert('Serial transmission failed. Simulation stopped.');
      }, 100);
    }
  };

  // Function to update telemetry data with realistic variations
  const updateTelemetryData = () => {
    // Generate unique call ID to prevent double execution in React Strict Mode
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setTelemetryData(prev => {
      // Guard against double execution in React Strict Mode
      if (executionGuardRef.current === callId) {
        return prev; // Return previous data without changes
      }
      executionGuardRef.current = callId;
      
      // Generate consistent timestamp for this data update
      const currentTimestamp = Date.now();
      
      // Enhanced duplicate check using timestamp
      if (currentTimestamp <= lastTransmittedTimestamp) {
        return prev; // Return previous data without changes
      }
      
      // Calculate flight time
      const flightTime = (currentTimestamp - startTime) / 1000;
      
      // Use GNSS generator for realistic GPS data
      const gnssData = gnssGenerator?.generateRawData() || {
        nmea: `$GPGGA,000000,0653.4349,S,10736.6608,E,1,8,0.9,${parseFloat(simulationSettings.altitude) || 100}.0,M,,M,,*5C`,
        latitude: parseFloat(simulationSettings.latitude) || -6.890582045572037,
        longitude: parseFloat(simulationSettings.longitude) || 107.6110135724158,
        altitude: parseFloat(simulationSettings.altitude) || 100
      };
      

      
      // Use battery generator for realistic battery data
      const batteryData = batteryGenerator?.generateRawData() || {
        voltage: prev.voltage || parseFloat(simulationSettings.voltage) || 25,
        current: prev.current || parseFloat(simulationSettings.current) || 1.5,
        percentage: prev.batteryPercentage || parseFloat(simulationSettings.batteryPercentage) || 100,
        status: prev.batteryStatus || simulationSettings.batteryStatus || "Discharging"
      };
      

      

      
      // Use temperature generator for realistic temperature data
      const temperatureData = temperatureGenerator?.generateRawData() || {
        temperature: prev.temperature || parseFloat(simulationSettings.temperature) || 25
      };

      // Use gas sensor generators for realistic gas sensor data
      const coData = coGenerator?.generateRawData() || { 
        sensorValue: prev.coLevel || parseFloat(simulationSettings.coLevel) || 1.2 
      };
      const no2Data = no2Generator?.generateRawData() || { 
        sensorValue: prev.no2Level || parseFloat(simulationSettings.no2Level) || 100 
      };
      const so2Data = so2Generator?.generateRawData() || { 
        sensorValue: prev.so2Level || parseFloat(simulationSettings.so2Level) || 10 
      };
      
      // Check compression setting and create appropriate data structure
      if (compressionSettings.enabled) {
        // COMPRESSION ENABLED: Store compressed buffers
        let totalCompressionRatio = 0;
        let totalProcessingTime = 0;
        let compressorCount = 0;
        
        // Ensure compressors are available - create on-demand if needed
        const ensuredBatteryCompressor = batteryCompressor || new BatteryCompressor();
        const ensuredGnssCompressor = gnssCompressor || new GNSSCompressor();
        const ensuredTemperatureCompressor = temperatureCompressor || new TemperatureCompressor();
        const ensuredCoCompressor = coCompressor || new GasSensorCompressor('CO');
        const ensuredNo2Compressor = no2Compressor || new GasSensorCompressor('NO2');
        const ensuredSo2Compressor = so2Compressor || new GasSensorCompressor('SO2');
        
        // Compress battery data
        let batteryBuffer: any = Buffer.alloc(0);
        if (ensuredBatteryCompressor) {
          const batteryRawData = {
            voltage: batteryData.voltage,
            current: batteryData.current,
            percentage: batteryData.percentage,
            status: batteryData.status
          };
          

          
          const compressionResult = ensuredBatteryCompressor.compressData(batteryRawData, compressionSettings.showMetrics);
          batteryBuffer = compressionResult.buffer;
          
          console.log('🔋 TelemetryContext: Battery compression result:', {
            bufferLength: batteryBuffer.length,
            bufferHex: batteryBuffer.toString('hex'),
            compressionRatio: compressionResult.compressionRatio
          });
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += compressionResult.compressionRatio || 1;
            totalProcessingTime += compressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        // Compress GNSS data
        let gnssBuffer: any = Buffer.alloc(0);
        if (ensuredGnssCompressor) {
          const gnssRawData = {
            nmea: (gnssData as any).nmea || '',
            latitude: gnssData.latitude,
            longitude: gnssData.longitude,
            altitude: gnssData.altitude,
            hdop: (gnssData as any).hdop || 1.0,
            satellites: (gnssData as any).satellites || 8
          };
          
          const gnssCompressionResult = ensuredGnssCompressor.compressData(gnssRawData, compressionSettings.showMetrics);
          gnssBuffer = gnssCompressionResult.buffer;
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += gnssCompressionResult.compressionRatio || 1;
            totalProcessingTime += gnssCompressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        // Compress temperature data
        let temperatureBuffer: any = Buffer.alloc(0);
        if (ensuredTemperatureCompressor) {
          const temperatureRawData = {
            temperature: temperatureData.temperature,
            voltage: ('voltage' in temperatureData) ? temperatureData.voltage : temperatureData.temperature / 100
          };
          
          const tempCompressionResult = ensuredTemperatureCompressor.compressData(temperatureRawData, compressionSettings.showMetrics);
          temperatureBuffer = tempCompressionResult.buffer;
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += tempCompressionResult.compressionRatio || 1;
            totalProcessingTime += tempCompressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        // Compress gas sensor data
        let coBuffer: any = Buffer.alloc(0);
        let no2Buffer: any = Buffer.alloc(0);
        let so2Buffer: any = Buffer.alloc(0);
        
        if (ensuredCoCompressor) {
          const coRawData = { sensorValue: coData.sensorValue };
          const coCompressionResult = ensuredCoCompressor.compressData(coRawData, compressionSettings.showMetrics);
          coBuffer = coCompressionResult.buffer;
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += coCompressionResult.compressionRatio || 1;
            totalProcessingTime += coCompressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        if (ensuredNo2Compressor) {
          const no2RawData = { sensorValue: no2Data.sensorValue };
          const no2CompressionResult = ensuredNo2Compressor.compressData(no2RawData, compressionSettings.showMetrics);
          no2Buffer = no2CompressionResult.buffer;
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += no2CompressionResult.compressionRatio || 1;
            totalProcessingTime += no2CompressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        if (ensuredSo2Compressor) {
          const so2RawData = { sensorValue: so2Data.sensorValue };
          const so2CompressionResult = ensuredSo2Compressor.compressData(so2RawData, compressionSettings.showMetrics);
          so2Buffer = so2CompressionResult.buffer;
          
          if (compressionSettings.showMetrics) {
            totalCompressionRatio += so2CompressionResult.compressionRatio || 1;
            totalProcessingTime += so2CompressionResult.processingTime || 0;
            compressorCount++;
          }
        }
        
        // Create the compressed data structure with Base64 encoding for minimal size
        const compressedData = {
          // Compressed buffers as Base64 strings (much more compact than JSON Buffer format)
          gnss: gnssBuffer.toString('base64'),
          temp: temperatureBuffer.toString('base64'),
          co: coBuffer.toString('base64'),
          no2: no2Buffer.toString('base64'),
          so2: so2Buffer.toString('base64'),
          batt: batteryBuffer.toString('base64'),
          
          // System data (unchanged but with shorter field names)
          ts: currentTimestamp
        };
        
        // Calculate realistic compression metrics based on full JSON size
        let compressionMetrics;
        if (compressionSettings.showMetrics) {
          // Calculate the size of uncompressed JSON that would be transmitted (excluding timestamp)
          const uncompressedData = {
            gnss: (gnssData as any).nmea || '',
            temperature: temperatureData.temperature,
            coLevel: coData.sensorValue,
            no2Level: no2Data.sensorValue,
            so2Level: so2Data.sensorValue,
            voltage: batteryData.voltage,
            current: batteryData.current,
            batteryPercentage: batteryData.percentage,
            batteryStatus: batteryData.status
          };
          
          // Calculate compressed data size (excluding timestamp)
          const compressedDataForCalculation = {
            gnss: compressedData.gnss,
            temp: compressedData.temp,
            co: compressedData.co,
            no2: compressedData.no2,
            so2: compressedData.so2,
            batt: compressedData.batt
          };
          
          // Calculate actual JSON string sizes for transmission (excluding timestamp)
          const uncompressedSize = JSON.stringify(uncompressedData).length;
          const compressedSize = JSON.stringify(compressedDataForCalculation).length;
          
                     compressionMetrics = {
             compressionRatio: uncompressedSize > 0 ? uncompressedSize / compressedSize : 1,
             processingTime: totalProcessingTime
           };
        }
        
        // Add compression metrics to the result if enabled
        if (compressionMetrics) {
          (compressedData as any).compressionMetrics = compressionMetrics;
        }
                  
          // Auto-transmit compressed data
        transmitTelemetryAutomatically(compressedData);
        return compressedData;
        
      } else {
        // COMPRESSION DISABLED: Store raw values
        const rawData = {
          // Raw GNSS data in NMEA format
          gnss: (gnssData as any).nmea || '',
          
          // Raw sensor data
          temperature: temperatureData.temperature,
          coLevel: coData.sensorValue,
          no2Level: no2Data.sensorValue,
          so2Level: so2Data.sensorValue,
          
          // Raw battery data
          voltage: batteryData.voltage,
          current: batteryData.current,
          batteryPercentage: batteryData.percentage,
          batteryStatus: batteryData.status
          
          // Note: transmissionTimestamp will be set precisely when transmitting
        };
        

                  
          // Auto-transmit raw data immediately (no delay to minimize latency)
        transmitTelemetryAutomatically(rawData);
        return rawData;
      }
    });
  };

  // Start simulation (requires serial connection)
  const startSimulation = () => {
    if (isSimulating) return;
    
    // Check if serial connection is available
    if (typeof window !== 'undefined') {
      const { useSerialStore, getSessionState } = require('@/lib/store');
      const { isConnected } = useSerialStore.getState();
      const sessionState = getSessionState();
      const port = sessionState.port;
      
      if (!isConnected || !port || (!port.readable && !port.writable)) {
        alert('Please connect to a serial device before starting simulation.');
        return;
      }
    }
    
    // Initialize battery generator with user's input values
    const generator = new BatteryDataGenerator({
      voltage: parseFloat(simulationSettings.voltage),
      percentage: parseFloat(simulationSettings.batteryPercentage),
      current: parseFloat(simulationSettings.current),
      status: simulationSettings.batteryStatus
    });
    
    // Test generate one sample to verify it's working
    const testData = generator.generateRawData();
    


    // Initialize temperature generator with user's input values
    const tempGenerator = new LM35TemperatureGenerator({
      currentTemperature: parseFloat(simulationSettings.temperature)
    });

    // Initialize GNSS generator with user's input values
    const gnssGen = new GNSSDataGenerator({
      currentLat: parseFloat(simulationSettings.latitude),
      currentLon: parseFloat(simulationSettings.longitude),
      currentAltitude: parseFloat(simulationSettings.altitude)
    });

    // Initialize gas sensor generators with user's input values
    const coGen = new GasSensorDataGenerator('CO', {
      currentBase: parseFloat(simulationSettings.coLevel)
    });

    const no2Gen = new GasSensorDataGenerator('NO2', {
      currentBase: parseFloat(simulationSettings.no2Level)
    });

    const so2Gen = new GasSensorDataGenerator('SO2', {
      currentBase: parseFloat(simulationSettings.so2Level)
    });

    // Initialize compressors if compression is enabled
    let batteryComp = null;
    let gnssComp = null;
    let tempComp = null;
    let coComp = null;
    let no2Comp = null;
    let so2Comp = null;
    
    if (compressionSettings.enabled) {
      batteryComp = new BatteryCompressor();
      gnssComp = new GNSSCompressor();
      tempComp = new TemperatureCompressor();
      coComp = new GasSensorCompressor('CO');
      no2Comp = new GasSensorCompressor('NO2');
      so2Comp = new GasSensorCompressor('SO2');
    }

    
    // Set all generators in state
    setBatteryGenerator(generator);
    setTemperatureGenerator(tempGenerator);
    setGnssGenerator(gnssGen);
    setCoGenerator(coGen);
    setNo2Generator(no2Gen);
    setSo2Generator(so2Gen);
    setBatteryCompressor(batteryComp);
    setGnssCompressor(gnssComp);
    setTemperatureCompressor(tempComp);
    setCoCompressor(coComp);
    setNo2Compressor(no2Comp);
    setSo2Compressor(so2Comp);
    
    // Initialize telemetry data with simulation settings
    setTelemetryData({
      gnss: `$GPGGA,000000,0653.4349,S,10736.6608,E,1,8,0.9,${parseFloat(simulationSettings.altitude) || 100}.0,M,,M,,*5C`, // Bandung, Indonesia
      temperature: parseFloat(simulationSettings.temperature),
      coLevel: parseFloat(simulationSettings.coLevel),
      no2Level: parseFloat(simulationSettings.no2Level),
      so2Level: parseFloat(simulationSettings.so2Level),
      voltage: parseFloat(simulationSettings.voltage),
      current: parseFloat(simulationSettings.current),
      batteryPercentage: parseFloat(simulationSettings.batteryPercentage),
      batteryStatus: simulationSettings.batteryStatus
    });
    
    setStartTime(Date.now());
    setIsSimulating(true);
    
    // Use setTimeout to ensure state updates are applied before starting interval
    setTimeout(() => {
      const interval = setInterval(updateTelemetryData, 1000); // 1000ms = 1Hz update rate
      setSimulationInterval(interval);
    }, 100); // Small delay to ensure React state updates are processed
  };

  // Stop simulation
  const stopSimulation = () => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationInterval(null);
    }
    
    // Also stop auto-transmission
    if (autoTransmissionInterval) {
      clearInterval(autoTransmissionInterval);
      setAutoTransmissionInterval(null);
    }
    
    setIsSimulating(false);
  };

  // Reset simulation
  const resetSimulation = () => {
    stopSimulation();
    setSimulationSettings(defaultSimulationSettings);
    setTelemetryData({}); // Clear data instead of setting defaults
    setLastTransmittedTimestamp(0);
    setLastTransmittedSequence(0);
    setBatteryGenerator(null);
    setTemperatureGenerator(null);
    setGnssGenerator(null);
    setCoGenerator(null);
    setNo2Generator(null);
    setSo2Generator(null);
    setBatteryCompressor(null);
    setGnssCompressor(null);
    setTemperatureCompressor(null);
    setCoCompressor(null);
    setNo2Compressor(null);
    setSo2Compressor(null);
  };

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
      if (autoTransmissionInterval) {
        clearInterval(autoTransmissionInterval);
      }
    };
  }, [simulationInterval, autoTransmissionInterval]);

  return (
    <TelemetryContext.Provider
      value={{
        telemetryData,
        setTelemetryData,
        isSimulating,
        setIsSimulating,
        simulationSettings,
        setSimulationSettings,
        compressionSettings,
        setCompressionSettings,
        startSimulation,
        stopSimulation,
        resetSimulation
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

// Custom hook to use the telemetry context
export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
} 