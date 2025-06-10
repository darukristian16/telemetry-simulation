"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { FullPageContent, SidebarProvider } from "@/components/ui/sidebar"
import { useTelemetryGenerator } from "@/hooks/use-telemetry-generator"
import GeneratorConfigPanel from "@/components/generator-config-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function Page() {
  const {
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
  } = useTelemetryGenerator();

  return (
    <FullPageContent>
      <SidebarProvider
        style={
          {
            "--sidebar-width": 0,
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
          <div className="flex flex-col gap-4 px-4 lg:px-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Telemetry Data Generator</h1>
            </div>
            
            <Tabs defaultValue="terminal" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="terminal">Generator Terminal</TabsTrigger>
                <TabsTrigger value="config">Configure Parameters</TabsTrigger>
              </TabsList>
              
              <TabsContent value="terminal" className="mt-0 space-y-4">
                <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                  <Card className="@container/card">
                    <CardHeader>
                      <CardTitle>Control Panel</CardTitle>
                      <CardDescription>
                        Start or stop the telemetry data generation
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="default"
                          onClick={startGeneration}
                          disabled={isRunning}
                        >
                          Start
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={stopGeneration}
                          disabled={!isRunning}
                        >
                          Stop
                        </Button>
                        <Button 
                          variant="secondary"
                          onClick={resetTerminal}
                        >
                          Reset Terminal
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="@container/card mt-4">
                    <CardHeader>
                      <CardTitle>Data Generators</CardTitle>
                      <CardDescription>
                        Select which data generators to enable
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="battery"
                            checked={selectedGenerators.battery} 
                            onCheckedChange={() => toggleGenerator('battery')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="battery">Battery</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="temperature"
                            checked={selectedGenerators.temperature} 
                            onCheckedChange={() => toggleGenerator('temperature')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="temperature">Temperature</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="gnss"
                            checked={selectedGenerators.gnss} 
                            onCheckedChange={() => toggleGenerator('gnss')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="gnss">GNSS</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="co"
                            checked={selectedGenerators.co} 
                            onCheckedChange={() => toggleGenerator('co')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="co">CO</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="no2"
                            checked={selectedGenerators.no2} 
                            onCheckedChange={() => toggleGenerator('no2')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="no2">NO₂</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="so2"
                            checked={selectedGenerators.so2} 
                            onCheckedChange={() => toggleGenerator('so2')}
                            disabled={isRunning}
                          />
                          <Label htmlFor="so2">SO₂</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="@container/card mt-4">
                    <CardHeader>
                      <CardTitle>Terminal Output</CardTitle>
                      <CardDescription>
                        Real-time data generation results
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div 
                        ref={terminalRef}
                        className="bg-black border border-[var(--border)] rounded-md p-4 h-[400px] font-mono text-sm overflow-y-auto"
                      >
                        {terminalOutput.map((line, i) => (
                          <div key={i} className="text-green-400 whitespace-pre-wrap">
                            {line}
                          </div>
                        ))}
                        {isRunning && (
                          <div className="inline-block h-4 w-2 bg-green-400 animate-pulse mb-0.5"></div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="config" className="mt-0">
                <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
                  <Card className="@container/card mb-4">
                    <CardHeader>
                      <CardTitle>Generator Configuration</CardTitle>
                      <CardDescription>
                        Customize how the telemetry data is generated
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2">Configure the parameters for each data generator. Changes will be applied when you click the Apply button.</p>
                      <p className="text-yellow-500 font-medium mb-4">Note: You must stop the generator before applying changes.</p>
                    </CardContent>
                  </Card>
                  
                  <GeneratorConfigPanel 
                    generatorConfigs={generatorConfigs}
                    isRunning={isRunning}
                    updateGeneratorConfig={updateGeneratorConfig}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarProvider>
    </FullPageContent>
  )
}
