import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface SimulationState {
  environment: 'LOS' | 'NLOS';
  distance: number;
  dataMode: 'Uncompressed' | 'Compressed';
  isRunning: boolean;
  runStartTime: number | null;
}

interface SimulationContextType {
  simulationState: SimulationState;
  setSimulationState: React.Dispatch<React.SetStateAction<SimulationState>>;
  startRun: () => void;
  stopRun: () => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [simulationState, setSimulationState] = useState<SimulationState>({
    environment: 'LOS',
    distance: 1,
    dataMode: 'Uncompressed',
    isRunning: false,
    runStartTime: null,
  });
  const startRun = () => setSimulationState(p => ({ ...p, isRunning: true, runStartTime: Date.now() }));
  const stopRun = () => setSimulationState(p => ({ ...p, isRunning: false }));
  return (
    <SimulationContext.Provider value={{ simulationState, setSimulationState, startRun, stopRun }}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within a SimulationProvider');
  return context;
};
