"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCw } from "lucide-react";
import { useTelemetry } from "@/context/TelemetryContext";
import { SiteHeader } from "@/components/site-header";
import { AppSidebar } from "@/components/app-sidebar";
import {
  FullPageContent,
  SidebarProvider
} from "@/components/ui/sidebar";
import { useSerialStore } from "@/lib/store";
import { UnifiedSerialConnection } from "@/components/unified-serial-connection";
import { CompressionMetricsCard } from "@/components/CompressionMetricsCard";
import { DataStructureDebugger } from "@/components/DataStructureDebugger";

// Helper component for input fields
interface SimulationInputProps {
  label: string;
  id: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
}

function SimulationInput({ label, id, type = "text", value, onChange, placeholder, step, min, max, required = false, disabled = false }: SimulationInputProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-300">
        {label}
      </label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// Helper component for select fields
interface SimulationSelectProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

function SimulationSelect({ label, id, value, onChange, options, disabled = false }: SimulationSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-300">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Helper component for toggle/checkbox fields
interface SimulationToggleProps {
  label: string;
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  description?: string;
}

function SimulationToggle({ label, id, checked, onChange, disabled = false, description }: SimulationToggleProps) {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        />
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      </div>
      {description && (
        <p className="text-xs text-gray-500 ml-7">{description}</p>
      )}
    </div>
  );
}

// Connect Status Wrapper Component
function ConnectStatusWrapper() {
  return <UnifiedSerialConnection />;
}

export default function TelemetryPage() {
  // Use the telemetry context
  const {
    simulationSettings,
    setSimulationSettings,
    compressionSettings,
    setCompressionSettings,
    isSimulating,
    startSimulation,
    stopSimulation,
    resetSimulation,
    telemetryData
  } = useTelemetry();
  
  // Check serial connection status
  const { isConnected, port } = useSerialStore();

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSimulationSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle select changes
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSimulationSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle compression settings changes
  const handleCompressionToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCompressionSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  return (
    <FullPageContent>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 48)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <SiteHeader />
        <AppSidebar variant="inset" />
        <div style={{ 
          marginLeft: 0, 
          marginTop: "var(--header-height)",
          padding: "1.5rem",
          flex: "1 1 auto",
          overflow: "auto",
          backgroundColor: "#0F172A"
        }}>
          <>
            <ConnectStatusWrapper />
            <div className="mt-6">
              {/* Controls Card - Full Width */}
              <div className="rounded-lg bg-gray-800 p-6 shadow-lg">
                <h1 className="mb-6 text-xl font-semibold text-white">Simulation Controls</h1>

                {/* GPS Simulation Group */}
                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-700 pb-2 text-lg font-medium text-white">GPS Simulation</h2>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <SimulationInput 
                      label="Latitude" 
                      id="latitude" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.latitude} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="Longitude" 
                      id="longitude" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.longitude} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="Altitude (m)" 
                      id="altitude" 
                      type="number" 
                      value={simulationSettings.altitude} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                  </div>
                </section>

                {/* Sensor Data Group */}
                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-700 pb-2 text-lg font-medium text-white">Sensor Data</h2>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <SimulationInput 
                      label="Temperature (°C)" 
                      id="temperature" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.temperature} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="CO Level (PPM)" 
                      id="coLevel" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.coLevel} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="NO₂ Level (PPM)" 
                      id="no2Level" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.no2Level} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="SO₂ Level (PPM)" 
                      id="so2Level" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.so2Level} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                  </div>
                </section>

                {/* Battery Status Group */}
                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-700 pb-2 text-lg font-medium text-white">Battery Status</h2>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <SimulationInput 
                      label="Voltage (V)" 
                      id="voltage" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.voltage} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationInput 
                      label="Current (A)" 
                      id="current" 
                      type="number" 
                      step="any" 
                      value={simulationSettings.current} 
                      onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                      <SimulationInput 
                        label="Battery Percentage" 
                        id="batteryPercentage" 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={simulationSettings.batteryPercentage} 
                        onChange={handleInputChange} 
                      disabled={isSimulating} 
                    />
                    <SimulationSelect
                      label="Battery Status" 
                      id="batteryStatus"
                      value={simulationSettings.batteryStatus}
                      onChange={handleSelectChange}
                      options={[
                        { value: 'Charging', label: 'Charging' },
                        { value: 'Discharging', label: 'Discharging' }
                      ]}
                        disabled={isSimulating} 
                      />
                    </div>
                </section>

                {/* Compression Settings Group */}
                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-700 pb-2 text-lg font-medium text-white">Data Compression</h2>
                  <div className="space-y-4">
                    <SimulationToggle
                      label="Enable Compression"
                      id="enabled"
                      checked={compressionSettings.enabled}
                      onChange={handleCompressionToggle}
                      disabled={isSimulating}
                      description="Compress telemetry data before sending to terminal"
                    />
                    <SimulationToggle
                      label="Show Compression Metrics"
                      id="showMetrics"
                      checked={compressionSettings.showMetrics}
                      onChange={handleCompressionToggle}
                      disabled={isSimulating}
                      description="Display compression ratio and performance statistics"
                    />
                  </div>
                </section>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-700 pt-6">
                  <Button
                    onClick={startSimulation}
                    disabled={isSimulating || !isConnected || !port || (!port.readable && !port.writable)}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    Start Simulation
                  </Button>
                  <Button
                    onClick={stopSimulation}
                    disabled={!isSimulating}
                    variant="secondary"
                    className="flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                  <Button
                    onClick={resetSimulation}
                    disabled={isSimulating}
                    variant="outline"
                    className="flex items-center gap-2 rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
                  >
                    <RotateCw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Testing Components - Only show when simulation is running */}
              {isSimulating && (
                <div className="mt-6 space-y-6">
                  {/* Data Structure Monitor */}
                  <DataStructureDebugger />
                  
                  {/* Compression Metrics */}
                  <CompressionMetricsCard telemetryData={telemetryData} />
                </div>
              )}
            </div>
                      </>
        </div>
      </SidebarProvider>
    </FullPageContent>
  );
} 