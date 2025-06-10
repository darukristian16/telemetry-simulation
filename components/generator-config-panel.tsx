import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

// Configuration panel for telemetry generators
export default function GeneratorConfigPanel({ 
  generatorConfigs, 
  isRunning,
  updateGeneratorConfig 
}: { 
  generatorConfigs: any;
  isRunning: boolean;
  updateGeneratorConfig: (generatorType: string, config: any) => void;
}) {
  // Create local state to track changes before applying
  const [batteryConfig, setBatteryConfig] = useState({...generatorConfigs.battery});
  const [temperatureConfig, setTemperatureConfig] = useState({...generatorConfigs.temperature});
  const [gnssConfig, setGnssConfig] = useState({...generatorConfigs.gnss});
  const [coConfig, setCoConfig] = useState({...generatorConfigs.co});
  const [no2Config, setNo2Config] = useState({...generatorConfigs.no2});
  const [so2Config, setSo2Config] = useState({...generatorConfigs.so2});

  // Apply configuration changes
  const applyBatteryConfig = () => updateGeneratorConfig('battery', batteryConfig);
  const applyTemperatureConfig = () => updateGeneratorConfig('temperature', temperatureConfig);
  const applyGnssConfig = () => updateGeneratorConfig('gnss', gnssConfig);
  const applyCoConfig = () => updateGeneratorConfig('co', coConfig);
  const applyNo2Config = () => updateGeneratorConfig('no2', no2Config);
  const applySo2Config = () => updateGeneratorConfig('so2', so2Config);

  // Reset configuration to current values
  const resetBatteryConfig = () => setBatteryConfig({...generatorConfigs.battery});
  const resetTemperatureConfig = () => setTemperatureConfig({...generatorConfigs.temperature});
  const resetGnssConfig = () => setGnssConfig({...generatorConfigs.gnss});
  const resetCoConfig = () => setCoConfig({...generatorConfigs.co});
  const resetNo2Config = () => setNo2Config({...generatorConfigs.no2});
  const resetSo2Config = () => setSo2Config({...generatorConfigs.so2});

  // Helper function for number inputs
  const handleNumberChange = (setter: Function, field: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setter((prev: any) => ({ ...prev, [field]: numValue }));
    }
  };

  return (
    <Card className="@container/card data-[slot=card]:from-primary/5 data-[slot=card]:to-card dark:data-[slot=card]:bg-card data-[slot=card]:bg-gradient-to-t data-[slot=card]:shadow-xs">
      <CardHeader>
        <CardTitle>Parameter Settings</CardTitle>
        <CardDescription>
          Adjust generation parameters for each data type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="battery">
          <TabsList className="grid grid-cols-6 mb-6">
            <TabsTrigger value="battery">Battery</TabsTrigger>
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="gnss">GNSS</TabsTrigger>
            <TabsTrigger value="co">CO</TabsTrigger>
            <TabsTrigger value="no2">NO2</TabsTrigger>
            <TabsTrigger value="so2">SO2</TabsTrigger>
          </TabsList>

          {/* Battery Configuration */}
          <TabsContent value="battery">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minVoltage">Min Voltage (V)</Label>
                  <Input 
                    id="minVoltage" 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={batteryConfig.minVoltage} 
                    onChange={(e) => handleNumberChange(setBatteryConfig, 'minVoltage', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxVoltage">Max Voltage (V)</Label>
                  <Input 
                    id="maxVoltage" 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={batteryConfig.maxVoltage} 
                    onChange={(e) => handleNumberChange(setBatteryConfig, 'maxVoltage', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="initialVoltage">Initial Voltage (V)</Label>
                  <span className="text-sm text-muted-foreground">{batteryConfig.initialVoltage || 
                    ((generatorConfigs.battery.maxVoltage - generatorConfigs.battery.minVoltage) / 2 + 
                     generatorConfigs.battery.minVoltage).toFixed(2)}</span>
                </div>
                <Slider 
                  id="initialVoltage"
                  min={batteryConfig.minVoltage} 
                  max={batteryConfig.maxVoltage}
                  step={0.1}
                  value={[batteryConfig.initialVoltage || 
                    ((generatorConfigs.battery.maxVoltage - generatorConfigs.battery.minVoltage) / 2 + 
                     generatorConfigs.battery.minVoltage)]}
                  onValueChange={(value) => setBatteryConfig(prev => ({...prev, initialVoltage: value[0]}))}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="isCharging"
                  checked={!!batteryConfig.isCharging}
                  onCheckedChange={(checked) => setBatteryConfig(prev => ({...prev, isCharging: checked}))}
                />
                <Label htmlFor="isCharging">Start in Charging State</Label>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetBatteryConfig}>Reset</Button>
                <Button onClick={applyBatteryConfig} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>

          {/* Temperature Configuration */}
          <TabsContent value="temperature">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minTemperature">Min Temperature (°C)</Label>
                  <Input 
                    id="minTemperature" 
                    type="number" 
                    step="0.5"
                    value={temperatureConfig.minTemperature} 
                    onChange={(e) => handleNumberChange(setTemperatureConfig, 'minTemperature', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTemperature">Max Temperature (°C)</Label>
                  <Input 
                    id="maxTemperature" 
                    type="number" 
                    step="0.5"
                    value={temperatureConfig.maxTemperature} 
                    onChange={(e) => handleNumberChange(setTemperatureConfig, 'maxTemperature', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="initialTemperature">Initial Temperature (°C)</Label>
                  <span className="text-sm text-muted-foreground">{temperatureConfig.initialTemperature || 
                    ((generatorConfigs.temperature.maxTemperature - generatorConfigs.temperature.minTemperature) / 2 + 
                     generatorConfigs.temperature.minTemperature).toFixed(1)}</span>
                </div>
                <Slider 
                  id="initialTemperature"
                  min={temperatureConfig.minTemperature} 
                  max={temperatureConfig.maxTemperature}
                  step={0.5}
                  value={[temperatureConfig.initialTemperature || 
                    ((generatorConfigs.temperature.maxTemperature - generatorConfigs.temperature.minTemperature) / 2 + 
                     generatorConfigs.temperature.minTemperature)]}
                  onValueChange={(value) => setTemperatureConfig(prev => ({...prev, initialTemperature: value[0]}))}
                />
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetTemperatureConfig}>Reset</Button>
                <Button onClick={applyTemperatureConfig} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>

          {/* GNSS Configuration */}
          <TabsContent value="gnss">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialLat">Initial Latitude</Label>
                  <Input 
                    id="initialLat" 
                    type="number" 
                    step="0.0001"
                    value={gnssConfig.initialLat} 
                    onChange={(e) => handleNumberChange(setGnssConfig, 'initialLat', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialLon">Initial Longitude</Label>
                  <Input 
                    id="initialLon" 
                    type="number" 
                    step="0.0001"
                    value={gnssConfig.initialLon} 
                    onChange={(e) => handleNumberChange(setGnssConfig, 'initialLon', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialAltitude">Initial Altitude (m)</Label>
                <Input 
                  id="initialAltitude" 
                  type="number" 
                  step="0.1"
                  min="0"
                  value={gnssConfig.initialAltitude} 
                  onChange={(e) => handleNumberChange(setGnssConfig, 'initialAltitude', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latVariation">Lat Variation</Label>
                  <Input 
                    id="latVariation" 
                    type="number" 
                    step="0.0001"
                    min="0"
                    max="0.01"
                    value={gnssConfig.latVariation || 0.0005} 
                    onChange={(e) => handleNumberChange(setGnssConfig, 'latVariation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lonVariation">Lon Variation</Label>
                  <Input 
                    id="lonVariation" 
                    type="number" 
                    step="0.0001"
                    min="0"
                    max="0.01"
                    value={gnssConfig.lonVariation || 0.0005} 
                    onChange={(e) => handleNumberChange(setGnssConfig, 'lonVariation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="altVariation">Alt Variation (m)</Label>
                  <Input 
                    id="altVariation" 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="10"
                    value={gnssConfig.altVariation || 0.2} 
                    onChange={(e) => handleNumberChange(setGnssConfig, 'altVariation', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetGnssConfig}>Reset</Button>
                <Button onClick={applyGnssConfig} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>

          {/* CO Sensor Configuration */}
          <TabsContent value="co">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="co_base_min">Base Min Value</Label>
                  <Input 
                    id="co_base_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={coConfig.BASE_MIN} 
                    onChange={(e) => handleNumberChange(setCoConfig, 'BASE_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="co_base_max">Base Max Value</Label>
                  <Input 
                    id="co_base_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={coConfig.BASE_MAX} 
                    onChange={(e) => handleNumberChange(setCoConfig, 'BASE_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="co_peak_min">Peak Min Value</Label>
                  <Input 
                    id="co_peak_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={coConfig.PEAK_MIN || 250} 
                    onChange={(e) => handleNumberChange(setCoConfig, 'PEAK_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="co_peak_max">Peak Max Value</Label>
                  <Input 
                    id="co_peak_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={coConfig.PEAK_MAX || 500} 
                    onChange={(e) => handleNumberChange(setCoConfig, 'PEAK_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetCoConfig}>Reset</Button>
                <Button onClick={applyCoConfig} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>

          {/* NO2 Sensor Configuration */}
          <TabsContent value="no2">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="no2_base_min">Base Min Value</Label>
                  <Input 
                    id="no2_base_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={no2Config.BASE_MIN} 
                    onChange={(e) => handleNumberChange(setNo2Config, 'BASE_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no2_base_max">Base Max Value</Label>
                  <Input 
                    id="no2_base_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={no2Config.BASE_MAX} 
                    onChange={(e) => handleNumberChange(setNo2Config, 'BASE_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="no2_peak_min">Peak Min Value</Label>
                  <Input 
                    id="no2_peak_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={no2Config.PEAK_MIN || 150} 
                    onChange={(e) => handleNumberChange(setNo2Config, 'PEAK_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no2_peak_max">Peak Max Value</Label>
                  <Input 
                    id="no2_peak_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={no2Config.PEAK_MAX || 300} 
                    onChange={(e) => handleNumberChange(setNo2Config, 'PEAK_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetNo2Config}>Reset</Button>
                <Button onClick={applyNo2Config} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>

          {/* SO2 Sensor Configuration */}
          <TabsContent value="so2">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="so2_base_min">Base Min Value</Label>
                  <Input 
                    id="so2_base_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={so2Config.BASE_MIN} 
                    onChange={(e) => handleNumberChange(setSo2Config, 'BASE_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="so2_base_max">Base Max Value</Label>
                  <Input 
                    id="so2_base_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={so2Config.BASE_MAX} 
                    onChange={(e) => handleNumberChange(setSo2Config, 'BASE_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="so2_peak_min">Peak Min Value</Label>
                  <Input 
                    id="so2_peak_min" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1000"
                    value={so2Config.PEAK_MIN || 200} 
                    onChange={(e) => handleNumberChange(setSo2Config, 'PEAK_MIN', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="so2_peak_max">Peak Max Value</Label>
                  <Input 
                    id="so2_peak_max" 
                    type="number" 
                    step="10"
                    min="0"
                    max="1023"
                    value={so2Config.PEAK_MAX || 400} 
                    onChange={(e) => handleNumberChange(setSo2Config, 'PEAK_MAX', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={resetSo2Config}>Reset</Button>
                <Button onClick={applySo2Config} disabled={isRunning}>Apply</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 