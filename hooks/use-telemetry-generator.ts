import { useState, useEffect, useRef } from "react";

// Import our JavaScript generators instead of TypeScript versions
const {
  BatteryDataGenerator,
  TemperatureDataGenerator,
  GNSSDataGenerator,
  createGasGenerators
} = require("@/lib/generators");

interface GeneratorSelections {
  battery: boolean;
  temperature: boolean;
  gnss: boolean;
  co: boolean;
  no2: boolean;
  so2: boolean;
}

// Configuration interfaces for each generator
interface BatteryConfig {
  minVoltage?: number;
  maxVoltage?: number;
  initialVoltage?: number;
  initialCurrent?: number;
  isCharging?: boolean;
}

interface TemperatureConfig {
  minTemperature?: number;
  maxTemperature?: number;
  initialTemperature?: number;
}

interface GNSSConfig {
  initialLat?: number;
  initialLon?: number;
  initialAltitude?: number;
  initialHdop?: number;
  initialSatellites?: number;
  initialFixType?: number;
  latVariation?: number;
  lonVariation?: number;
  altVariation?: number;
}

interface GasConfig {
  BASE_MIN?: number;
  BASE_MAX?: number;
  BASE_DRIFT?: number;
  FLUCTUATION_AMPLITUDE?: number;
  FLUCTUATION_PERIOD?: number;
  PEAK_PROBABILITY?: number;
  NOISE_RANGE?: number;
  PEAK_MIN?: number;
  PEAK_MAX?: number;
  PEAK_DURATION?: { min: number; max: number };
}

interface GeneratorConfigs {
  battery: BatteryConfig;
  temperature: TemperatureConfig;
  gnss: GNSSConfig;
  co: GasConfig;
  no2: GasConfig;
  so2: GasConfig;
}

export function useTelemetryGenerator() {
  // Generator instances
  const [generators, setGenerators] = useState<any>(null);
  
  // Terminal output
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Generator state
  const [isRunning, setIsRunning] = useState(false);
  const [interval, setIntervalState] = useState<NodeJS.Timeout | null>(null);
  const [selectedGenerators, setSelectedGenerators] = useState<GeneratorSelections>({
    battery: true,
    temperature: true,
    gnss: true,
    co: true,
    no2: true,
    so2: true
  });

  // Configuration state
  const [generatorConfigs, setGeneratorConfigs] = useState<GeneratorConfigs>({
    battery: {
      minVoltage: 3.0,
      maxVoltage: 4.2
    },
    temperature: {
      minTemperature: 20.0,
      maxTemperature: 40.0
    },
    gnss: {
      initialLat: 40.7128,
      initialLon: -74.0060,
      initialAltitude: 10.0
    },
    co: {
      BASE_MIN: 200,
      BASE_MAX: 400
    },
    no2: {
      BASE_MIN: 100,
      BASE_MAX: 250
    },
    so2: {
      BASE_MIN: 150,
      BASE_MAX: 350
    }
  });

  // Initialize generators
  useEffect(() => {
    const batteryGen = new BatteryDataGenerator(generatorConfigs.battery);
    const tempGen = new TemperatureDataGenerator(generatorConfigs.temperature);
    const gnssGen = new GNSSDataGenerator(generatorConfigs.gnss);
    const gasGens = createGasGenerators({
      CO: generatorConfigs.co,
      NO2: generatorConfigs.no2,
      SO2: generatorConfigs.so2
    });

    setGenerators({
      battery: batteryGen,
      temperature: tempGen,
      gnss: gnssGen,
      gas: gasGens
    });

    // Initial terminal message
    setTerminalOutput([
      "// Telemetry Data Generator",
      "// Ready to start..."
    ]);

    // Cleanup on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Update generator configs when they change
  const updateGeneratorConfig = (generatorType: string, config: any) => {
    // Stop generation if running
    if (isRunning) {
      stopGeneration();
    }

    // Update configuration state
    setGeneratorConfigs(prev => {
      const newConfigs = { ...prev };
      
      // Update the specific generator config
      switch (generatorType) {
        case 'battery':
          newConfigs.battery = { ...prev.battery, ...config };
          break;
        case 'temperature':
          newConfigs.temperature = { ...prev.temperature, ...config };
          break;
        case 'gnss':
          newConfigs.gnss = { ...prev.gnss, ...config };
          break;
        case 'co':
          newConfigs.co = { ...prev.co, ...config };
          break;
        case 'no2':
          newConfigs.no2 = { ...prev.no2, ...config };
          break;
        case 'so2':
          newConfigs.so2 = { ...prev.so2, ...config };
          break;
      }
      
      return newConfigs;
    });

    // Apply changes to generator instances
    if (generators) {
      if (generatorType === 'battery' && generators.battery) {
        generators.battery.updateConfig(config);
        addToTerminal(`Battery config updated: ${JSON.stringify(config)}`);
      } 
      else if (generatorType === 'temperature' && generators.temperature) {
        generators.temperature.updateConfig(config);
        addToTerminal(`Temperature config updated: ${JSON.stringify(config)}`);
      } 
      else if (generatorType === 'gnss' && generators.gnss) {
        generators.gnss.updateConfig(config);
        addToTerminal(`GNSS config updated: ${JSON.stringify(config)}`);
      } 
      else if (generatorType === 'co' && generators.gas && generators.gas.CO) {
        generators.gas.CO.updateConfig(config);
        addToTerminal(`CO sensor config updated: ${JSON.stringify(config)}`);
      } 
      else if (generatorType === 'no2' && generators.gas && generators.gas.NO2) {
        generators.gas.NO2.updateConfig(config);
        addToTerminal(`NO2 sensor config updated: ${JSON.stringify(config)}`);
      } 
      else if (generatorType === 'so2' && generators.gas && generators.gas.SO2) {
        generators.gas.SO2.updateConfig(config);
        addToTerminal(`SO2 sensor config updated: ${JSON.stringify(config)}`);
      }
    }
  };

  // Start data generation
  const startGeneration = () => {
    if (isRunning || !generators) return;
    
    addToTerminal("Starting data generation...");
    
    const intervalId = setInterval(() => {
      const timestamp = new Date().toISOString();
      
      // Generate data from selected generators
      if (selectedGenerators.battery) {
        const batteryData = generators.battery.generateData();
        addToTerminal(`RAW: ${JSON.stringify(batteryData)}`);
      }
      
      if (selectedGenerators.temperature) {
        const tempData = generators.temperature.generateData();
        addToTerminal(`RAW: ${JSON.stringify(tempData)}`);
      }
      
      if (selectedGenerators.gnss) {
        const gnssData = generators.gnss.generateData();
        addToTerminal(`RAW: ${JSON.stringify(gnssData)}`);
      }
      
      if (selectedGenerators.co) {
        const coData = generators.gas.CO.generateData();
        addToTerminal(`RAW: ${JSON.stringify(coData)}`);
      }
      
      if (selectedGenerators.no2) {
        const no2Data = generators.gas.NO2.generateData();
        addToTerminal(`RAW: ${JSON.stringify(no2Data)}`);
      }
      
      if (selectedGenerators.so2) {
        const so2Data = generators.gas.SO2.generateData();
        addToTerminal(`RAW: ${JSON.stringify(so2Data)}`);
      }
    }, 1000);
    
    setIntervalState(intervalId);
    setIsRunning(true);
  };

  // Stop data generation
  const stopGeneration = () => {
    if (!isRunning || !interval) return;
    
    clearInterval(interval);
    setIntervalState(null);
    setIsRunning(false);
    
    addToTerminal("Data generation stopped.");
  };

  // Reset terminal
  const resetTerminal = () => {
    setTerminalOutput([
      "// Telemetry Data Generator",
      "// Terminal reset. Ready to start..."
    ]);
  };

  // Add message to terminal
  const addToTerminal = (message: string) => {
    setTerminalOutput(prev => {
      // Keep only the last 100 lines to prevent excessive memory usage
      const newOutput = [...prev, message];
      if (newOutput.length > 100) {
        return newOutput.slice(-100);
      }
      return newOutput;
    });
  };

  // Toggle generator selection
  const toggleGenerator = (generator: keyof GeneratorSelections) => {
    setSelectedGenerators(prev => ({
      ...prev,
      [generator]: !prev[generator]
    }));
  };

  return {
    terminalOutput,
    terminalRef,
    isRunning,
    selectedGenerators,
    generatorConfigs,
    startGeneration,
    stopGeneration,
    resetTerminal,
    toggleGenerator,
    updateGeneratorConfig
  };
} 