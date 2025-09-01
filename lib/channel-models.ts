// =================================================================================
// FILE: /lib/channel-models.ts
// DESC: This file contains the academic core of the simulation. It implements
// standard telecommunication models to predict signal loss and fading
// for both LOS and NLOS environments. It is pure TypeScript and has no
// dependencies on React or any UI components.
// =================================================================================

// --- Simulation & P400 Radio Parameters ---
// These constants are based on your provided P400 configuration and general assumptions.
const P400_PARAMS = {
    TRANSMIT_POWER_DBM: 30,      // S108=30 -> 1 Watt
    ANTENNA_GAIN_DBI: 2.15,      // Assuming a standard dipole antenna for both UAV and Ground Station
    FREQUENCY_MHZ: 915,          // Center of the 900 MHz ISM band used by the P400
    RECEIVER_SENSITIVITY_DBM: -108, // Based on P400 manual for 172.8 kbps link rate
    NOISE_FIGURE_DB: 5,          // A typical value for a good quality receiver
};

// Thermal noise floor in dBm for a typical channel bandwidth at room temperature
const THERMAL_NOISE_DBM = -114;

// --- 1. Path Loss Models (Large-Scale Fading) ---

/**
 * Calculates path loss in a Line-of-Sight (LOS) environment using the Log-distance model.
 * This is a practical, empirical model used for real-world LOS links.
 * @param distanceKm - The distance between the transmitter and receiver in kilometers.
 * @returns The path loss in dB.
 */
function calculateLogDistancePathLoss(distanceKm: number): number {
    const pathLossExponent = 2.5; // A realistic value for UAV-to-ground LOS, between free space (2) and with ground reflections (3)
    const referenceDistanceKm = 0.1; // 100 meters
    // Path loss at the reference distance for 915 MHz
    const referencePathLossDb = 20 * Math.log10(referenceDistanceKm) + 20 * Math.log10(P400_PARAMS.FREQUENCY_MHZ) + 32.45;

    if (distanceKm <= referenceDistanceKm) {
        return referencePathLossDb;
    }

    return referencePathLossDb + 10 * pathLossExponent * Math.log10(distanceKm / referenceDistanceKm);
}

/**
 * Calculates path loss in a Non-Line-of-Sight (NLOS) urban environment using the COST-231 Hata model.
 * This is an academic and industry standard for urban propagation modeling.
 * @param distanceKm - The distance in kilometers.
 * @returns The path loss in dB.
 */
function calculateCost231HataPathLoss(distanceKm: number): number {
    const f = P400_PARAMS.FREQUENCY_MHZ;
    const hb = 20; // Base station (ground station) antenna height in meters. A reasonable assumption.
    const hm = 100; // Mobile (UAV) antenna height in meters.

    // Correction factor for mobile antenna height for a medium city
    const a_hm = (1.1 * Math.log10(f) - 0.7) * hm - (1.56 * Math.log10(f) - 0.8);

    // COST-231 Hata formula for urban environments
    const pathLossDb = 46.3 + 33.9 * Math.log10(f)
                     - 13.82 * Math.log10(hb)
                     - a_hm
                     + (44.9 - 6.55 * Math.log10(hb)) * Math.log10(distanceKm)
                     + 3; // Correction factor for dense urban (like Bandung)

    return pathLossDb;
}


// --- 2. Fading Models (Small-Scale Fading) ---

/**
 * Applies a Rician fading model to a signal.
 * This simulates an LOS environment with one dominant signal path and multiple weaker reflections.
 * @param averageSignalPowerDb - The average signal power calculated from the path loss model.
 * @returns The instantaneous signal power in dB after fading.
 */
function applyRicianFading(averageSignalPowerDb: number): number {
    const K = 8; // Rician K-factor. A higher K means a stronger dominant signal (typical for good LOS).
    const s = Math.sqrt(K / (K + 1)); // Non-centrality parameter
    const sigma = 1 / Math.sqrt(2 * (K + 1));

    // Generate two standard Gaussian random variables
    const u1 = Math.random();
    const u2 = Math.random();
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

    const x = s + sigma * z1;
    const y = sigma * z2;

    // The Rician envelope
    const envelope = Math.sqrt(x * x + y * y);
    const fadingDb = 20 * Math.log10(envelope);

    return averageSignalPowerDb + fadingDb;
}

/**
 * Applies a Rayleigh fading model to a signal.
 * This simulates a dense NLOS environment with no dominant signal path.
 * @param averageSignalPowerDb - The average signal power from the path loss model.
 * @returns The instantaneous signal power in dB after deep fading.
 */
function applyRayleighFading(averageSignalPowerDb: number): number {
    // Generate two standard Gaussian random variables
    const u1 = Math.random();
    const u2 = Math.random();
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

    // The Rayleigh envelope
    const envelope = Math.sqrt(z1 * z1 + z2 * z2) / Math.sqrt(2);
    const fadingDb = 20 * Math.log10(envelope);

    return averageSignalPowerDb + fadingDb;
}


// --- 3. BER and PER Calculation ---

/**
 * Approximates the Bit Error Rate (BER) from Signal-to-Noise Ratio (SNR) for GFSK modulation.
 * This uses a simplified Q-function approximation, which is standard for this type of analysis.
 * @param snrDb - The instantaneous Signal-to-Noise Ratio in dB.
 * @returns The Bit Error Rate (a probability from 0 to 1).
 */
function calculateBerFromSnr(snrDb: number): number {
    const snrLinear = 10 ** (snrDb / 10);
    // For non-coherent FSK, BER is approximately 0.5 * exp(-SNR / 2)
    const ber = 0.5 * Math.exp(-snrLinear / 2);
    return Math.max(0, Math.min(1, ber)); // Clamp between 0 and 1
}

/**
 * Calculates the Packet Error Rate (PER) from the Bit Error Rate (BER).
 * @param ber - The Bit Error Rate.
 * @param packetSizeBytes - The total size of the packet in bytes.
 * @returns The Packet Error Rate (a probability from 0 to 1).
 */
function calculatePerFromBer(ber: number, packetSizeBytes: number): number {
    const packetSizeBits = packetSizeBytes * 8;
    // The probability of a packet being successful is (1 - BER) ^ packetSize.
    // The probability of it failing is 1 minus that.
    const per = 1 - Math.pow(1 - ber, packetSizeBits);
    return per;
}


// --- 4. The Main Engine Function ---

interface SimulationParams {
    environment: 'LOS' | 'NLOS';
    distance: number; // in km
    packetSizeBytes: number;
}

/**
 * The main exported function that orchestrates the entire channel simulation.
 * It takes the high-level simulation parameters and returns the final predicted Packet Error Rate.
 * @param params - The simulation parameters from the control panel.
 * @returns The probability (0 to 1) that a packet will be lost under these conditions.
 */
export function getPacketErrorRate(params: SimulationParams): number {
    // Step 1: Calculate large-scale path loss based on environment
    const pathLossDb = params.environment === 'LOS'
        ? calculateLogDistancePathLoss(params.distance)
        : calculateCost231HataPathLoss(params.distance);

    // Step 2: Calculate the average received signal power (RSSI)
    const averageRssi = P400_PARAMS.TRANSMIT_POWER_DBM
                      + P400_PARAMS.ANTENNA_GAIN_DBI * 2 // Tx and Rx antenna
                      - pathLossDb;

    // Step 3: Apply the appropriate small-scale fading model
    const instantaneousRssi = params.environment === 'LOS'
        ? applyRicianFading(averageRssi)
        : applyRayleighFading(averageRssi);

    // Step 4: Calculate the total noise at the receiver
    const noiseFloorDb = THERMAL_NOISE_DBM + P400_PARAMS.NOISE_FIGURE_DB;

    // Step 5: Calculate the instantaneous Signal-to-Noise Ratio (SNR)
    const snrDb = instantaneousRssi - noiseFloorDb;

    // If the signal is below the receiver's sensitivity, it's an automatic failure.
    if (instantaneousRssi < P400_PARAMS.RECEIVER_SENSITIVITY_DBM) {
        return 1.0; // 100% packet loss
    }

    // Step 6: Calculate BER from SNR
    const ber = calculateBerFromSnr(snrDb);

    // Step 7: Calculate final PER from BER and packet size
    const per = calculatePerFromBer(ber, params.packetSizeBytes);

    return per;
}
