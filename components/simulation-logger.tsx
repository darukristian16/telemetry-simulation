import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useSimulation } from '@/context/SimulationContext';
import { useLogger } from '@/context/LoggingContext';

export function SimulationLogger() {
    const { simulationState } = useSimulation();
    const { logStats } = useLogger();

    const elapsedTime = simulationState.isRunning && simulationState.runStartTime
        ? ((Date.now() - simulationState.runStartTime) / 1000).toFixed(1)
        : '0.0';

    const per = logStats.packetsSent > 0
        ? (((logStats.packetsSent - logStats.packetsReceived) / logStats.packetsSent) * 100).toFixed(2)
        : '0.00';

    const goodput = simulationState.isRunning && simulationState.runStartTime
        ? ((logStats.bytesReceived * 8) / (Date.now() - simulationState.runStartTime) * 1000 / 1024).toFixed(2) // kbps
        : '0.00';
    
    const avgLatency = logStats.latencies.length > 0
        ? (logStats.latencies.reduce((a, b) => a + b, 0) / logStats.latencies.length).toFixed(0)
        : '0';

    const exportToCsv = () => {
        const headers = "Metric,Value\n";
        const rows = [
            `Environment,${simulationState.environment}`,
            `Distance (km),${simulationState.distance}`,
            `Data Mode,${simulationState.dataMode}`,
            `Run Duration (s),${elapsedTime}`,
            `Packets Sent,${logStats.packetsSent}`,
            `Packets Received,${logStats.packetsReceived}`,
            `Packet Error Rate (%),${per}`,
            `Goodput (kbps),${goodput}`,
            `Average Latency (ms),${avgLatency}`,
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `simulation_run_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle>Live Simulation Results</CardTitle>
                <CardDescription>
                    KPIs for the current run. Press Stop before exporting.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-2 rounded-lg bg-slate-800">
                        <p className="text-sm text-slate-400">Elapsed Time</p>
                        <p className="text-2xl font-bold">{elapsedTime}s</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-800">
                        <p className="text-sm text-slate-400">Goodput</p>
                        <p className="text-2xl font-bold">{goodput} kbps</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-800">
                        <p className="text-sm text-slate-400">Packet Error Rate</p>
                        <p className="text-2xl font-bold">{per}%</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-800">
                        <p className="text-sm text-slate-400">Avg. Latency</p>
                        <p className="text-2xl font-bold">{avgLatency} ms</p>
                    </div>
                </div>
                <Button onClick={exportToCsv} disabled={simulationState.isRunning} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Export Run Data as CSV
                </Button>
            </CardContent>
        </Card>
    );
}
