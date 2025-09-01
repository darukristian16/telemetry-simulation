"use client";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Select, SelectItem, SelectContent } from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Play, Square, TestTube2 } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

function SimulationControlPanel() {
  const { simulationState, setSimulationState, startRun, stopRun } = useSimulation();
  const handleEnvironmentChange = (value: 'LOS' | 'NLOS') => setSimulationState(p => ({ ...p, environment: value }));
  const handleDistanceChange = (value: number[]) => setSimulationState(p => ({ ...p, distance: value[0] }));
  const handleDataModeChange = (checked: boolean) => setSimulationState(p => ({ ...p, dataMode: checked ? 'Compressed' : 'Uncompressed' }));

  return (
    <Card className="col-span-full border-sky-500/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <TestTube2 className="h-6 w-6 text-sky-500" />
          <CardTitle>Simulation Control Panel</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6 gap-4 w-full">
            {/* Environment Switch */}
            <div className="flex flex-col items-center justify-center rounded-md border p-4 min-w-[220px]">
              <Label htmlFor="environment">Environment</Label>
              <div className="flex items-center space-x-2 mt-2">
                <span>LOS</span>
                <Switch
                  id="environment"
                  checked={simulationState.environment === 'NLOS'}
                  onCheckedChange={(checked) => handleEnvironmentChange(checked ? 'NLOS' : 'LOS')}
                  disabled={simulationState.isRunning}
                />
                <span>NLOS</span>
              </div>
            </div>
            {/* Distance Slider */}
            <div className="flex flex-col flex-[2] min-w-[200px]">
              <div className="flex items-center justify-between">
                <Label htmlFor="distance">Distance</Label>
                <span className="text-xs text-muted-foreground">{simulationState.distance} km</span>
              </div>
              <Slider id="distance" min={0.5} max={20} step={0.5} value={[simulationState.distance]} onValueChange={handleDistanceChange} disabled={simulationState.isRunning} />
            </div>
            {/* Data Mode Switch */}
            <div className="flex flex-col items-center justify-center rounded-md border p-4 min-w-[220px]">
              <Label htmlFor="data-mode">Data Mode</Label>
              <div className="flex items-center space-x-2 mt-2">
                <span>Uncompressed</span>
                <Switch id="data-mode" checked={simulationState.dataMode === 'Compressed'} onCheckedChange={handleDataModeChange} disabled={simulationState.isRunning} />
                <span>Compressed</span>
              </div>
            </div>
            {/* Single Start/Stop Button */}
            <div className="flex flex-col items-stretch min-w-[140px] w-full md:w-auto">
              {simulationState.isRunning ? (
                <Button onClick={stopRun} className="w-full" variant="destructive">
                  <Square className="mr-2 h-4 w-4" /> Stop Run
                </Button>
              ) : (
                <Button onClick={startRun} className="w-full bg-green-600 hover:bg-green-700">
                  <Play className="mr-2 h-4 w-4" /> Start Run
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SimulationControlPanel;
