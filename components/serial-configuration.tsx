"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSerialStore, getSessionState } from "@/lib/store"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCcw, Save, FileJson, Cpu, Network, Radio, Shield } from "lucide-react"

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function SerialConfiguration() {
  const { isConnected } = useSerialStore();
  const [isApplyingConfig, setIsApplyingConfig] = useState(false);
  const [applyStatus, setApplyStatus] = useState("");

  const write = async (command: string) => {
    const sessionState = getSessionState();
    const port = sessionState.port;
    if (!port || !port.writable) {
      console.error('Port not available for writing');
      return;
    }
    
    try {
      const writer = port.writable.getWriter();
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(command);
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    } catch (error) {
      console.error('Error writing to serial port:', error);
    }
  };
  
  // State hooks for all configuration options
  const [operatingMode, setOperatingMode] = useState("Master");
  const [baudRate, setBaudRate] = useState("115200");
  const [flowControl, setFlowControl] = useState(false);
  const [rs485Mode, setRs485Mode] = useState(false);
  const [networkType, setNetworkType] = useState("Point to Point (P2P)");
  const [modemType, setModemType] = useState("900MHz FHSS");
  const [networkID, setNetworkID] = useState("1234567890");
  const [unitAddress, setUnitAddress] = useState("1");
  const [destinationAddress, setDestinationAddress] = useState("2");
  const [transmitPower, setTransmitPower] = useState(30);
  const [linkRate, setLinkRate] = useState("19.2");
  const [rfChannel, setRfChannel] = useState("0");
  const [tdmaMode, setTdmaMode] = useState(false);
  const [aesEncryption, setAesEncryption] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [callSign, setCallSign] = useState("");

  const handleApplyConfiguration = async () => {
    if (!isConnected) {
      alert("Please connect to a serial device first");
      return;
    }

    setIsApplyingConfig(true);

    const baudRateMap: { [key: string]: number } = {
        "1200": 0, "2400": 1, "4800": 2, "9600": 3,
        "19200": 4, "38400": 5, "57600": 6, "115200": 7, "230400": 8
    };

    const linkRateMap: { [key: string]: number } = {
        "4.8": 0, "9.6": 1, "19.2": 2, "38.4": 3, "57.6": 4
    };

    const operatingModeMap: { [key: string]: number } = {
        "Master": 0, "Repeater": 1, "Slave": 2
    };

    const networkTypeMap: { [key: string]: number } = {
        "Point to Multipoint (PMP)": 0, "Point to Point (P2P)": 1
    };

    const modemTypeMap: { [key: string]: number } = {
        "400MHz NB": 0, "900MHz FHSS": 1, "2.4GHz": 2
    };
    
    try {
        // Step 1: Enter Command Mode
        setApplyStatus("Entering Command Mode...");
        await delay(1000); // Guard time
        await write("+++");
        await delay(1000); // Guard time

        // Step 2: Send Configuration Commands
        setApplyStatus("Sending Commands...");
        const commands = [
            `ATS101=${operatingModeMap[operatingMode]}`, `ATS102=${baudRateMap[baudRate]}`, `AT&K${flowControl ? "3" : "0"}`,
            `ATS142=${rs485Mode ? "1" : "0"}`, `ATS133=${networkTypeMap[networkType]}`, `ATS128=${modemTypeMap[modemType]}`,
            `ATS104=${networkID}`, `ATS105=${unitAddress}`, `ATS140=${destinationAddress}`, `ATS108=${transmitPower}`,
            `ATS103=${linkRateMap[linkRate]}`, `ATS125=${rfChannel}`, `ATS224=${tdmaMode ? "1" : "0"}`, `ATS145=${aesEncryption ? "1" : "0"}`,
            `ATS146=${encryptionKey}`, `ATS228=${callSign}`
        ];

        for (const cmd of commands) {
            await write(cmd + "\r\n");
            await delay(100); // Small delay between commands
        }

        // Step 3: Save Configuration
        setApplyStatus("Saving Configuration...");
        await write("AT&W\r\n");
        await delay(500);

        // Step 4: Exit Command Mode
        setApplyStatus("Returning to Data Mode...");
        await write("ATO\r\n");
        await delay(500);

    } catch (error) {
        console.error("Failed to apply configuration:", error);
        alert("An error occurred while applying the configuration.");
    } finally {
        setIsApplyingConfig(false);
        setApplyStatus("");
    }
  };

  const handleFactoryReset = async () => {
    if (isConnected) {
      if (confirm("Are you sure you want to reset to factory defaults?")) {
        await write("AT&F\r\n");
      }
    } else {
      alert("Please connect to a serial device first");
    }
  };

  const handleExportJSON = () => {
    const config = {
      systemConfig: { operatingMode, baudRate, flowControl, rs485Mode },
      networkConfig: { networkType, modemType, networkID, unitAddress, destinationAddress },
      rfSettings: { transmitPower, linkRate, rfChannel, tdmaMode },
      security: { aesEncryption, encryptionKey, callSign }
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radio-configuration.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic System Configuration */}
        <Card className="bg-[#1E293B] border-slate-700 text-white shadow-md">
          <CardHeader className="px-4 py-2 border-b border-slate-700/50 bg-slate-800/50">
            <CardTitle className="text-lg font-bold text-white flex items-center">
              <Cpu className="h-5 w-5 mr-2 text-blue-400" />
              Basic System Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 py-3">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center">
                Operating Mode <span className="ml-2 text-xs text-blue-400">(ATS101)</span>
              </label>
              <Select value={operatingMode} onValueChange={setOperatingMode}>
                <SelectTrigger className="w-full bg-[#0F172A] border-slate-700 text-white h-9 ring-offset-slate-900 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Master">Master</SelectItem>
                  <SelectItem value="Slave">Slave</SelectItem>
                  <SelectItem value="Repeater">Repeater</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center">
                Serial Baud Rate <span className="ml-2 text-xs text-blue-400">(ATS102)</span>
              </label>
              <Select value={baudRate} onValueChange={setBaudRate}>
                <SelectTrigger className="w-full bg-[#0F172A] border-slate-700 text-white h-9 ring-offset-slate-900 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="1200">1200 bps</SelectItem>
                  <SelectItem value="2400">2400 bps</SelectItem>
                  <SelectItem value="4800">4800 bps</SelectItem>
                  <SelectItem value="9600">9600 bps</SelectItem>
                  <SelectItem value="19200">19200 bps</SelectItem>
                  <SelectItem value="38400">38400 bps</SelectItem>
                  <SelectItem value="57600">57600 bps</SelectItem>
                  <SelectItem value="115200">115200 bps</SelectItem>
                  <SelectItem value="230400">230400 bps</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="flex items-center space-x-2 bg-[#0F172A] p-2 rounded-md">
                <Checkbox id="flow-control" checked={flowControl} onCheckedChange={(checked) => setFlowControl(checked as boolean)} className="border-slate-600 data-[state=checked]:bg-blue-600 h-4 w-4" />
                <label htmlFor="flow-control" className="text-sm font-medium text-slate-300 flex items-center">
                  Flow Control <span className="ml-1 text-xs text-blue-400">(AT&K)</span>
                </label>
              </div>
              <div className="flex items-center space-x-2 bg-[#0F172A] p-2 rounded-md">
                <Checkbox id="rs485-mode" checked={rs485Mode} onCheckedChange={(checked) => setRs485Mode(checked as boolean)} className="border-slate-600 data-[state=checked]:bg-blue-600 h-4 w-4" />
                <label htmlFor="rs485-mode" className="text-sm font-medium text-slate-300 flex items-center">
                  RS485 Mode <span className="ml-1 text-xs text-blue-400">(ATS142)</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Network Configuration */}
        <Card className="bg-[#1E293B] border-slate-700 text-white shadow-md">
          <CardHeader className="px-4 py-2 border-b border-slate-700/50 bg-slate-800/50">
            <CardTitle className="text-lg font-bold text-white flex items-center">
              <Network className="h-5 w-5 mr-2 text-blue-400" />
              Network Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 py-3">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center">
                Network Type <span className="ml-2 text-xs text-blue-400">(ATS133)</span>
              </label>
              <Select value={networkType} onValueChange={setNetworkType}>
                <SelectTrigger className="w-full bg-[#0F172A] border-slate-700 text-white h-9 ring-offset-slate-900 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Point to Multipoint (PMP)">Point to Multipoint (PMP)</SelectItem>
                  <SelectItem value="Point to Point (P2P)">Point to Point (P2P)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center">
                Modem Type <span className="ml-2 text-xs text-blue-400">(ATS128)</span>
              </label>
              <Select value={modemType} onValueChange={setModemType}>
                <SelectTrigger className="w-full bg-[#0F172A] border-slate-700 text-white h-9 ring-offset-slate-900 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="400MHz NB">400MHz NB</SelectItem>
                  <SelectItem value="900MHz FHSS">900MHz FHSS</SelectItem>
                  <SelectItem value="2.4GHz">2.4GHz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 flex items-center">
                  Network ID <span className="ml-1 text-xs text-blue-400">(ATS104)</span>
                </label>
                <Input placeholder="10-digit number" value={networkID} onChange={(e) => setNetworkID(e.target.value)} className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9 ring-offset-slate-900 focus-visible:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300 flex items-center">
                    Unit Address <span className="ml-1 text-xs text-blue-400">(ATS105)</span>
                  </label>
                  <Input placeholder="e.g., 1" value={unitAddress} onChange={(e) => setUnitAddress(e.target.value)} className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9 ring-offset-slate-900 focus-visible:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300 flex items-center">
                    Destination Address <span className="ml-1 text-xs text-blue-400">(ATS140)</span>
                  </label>
                  <Input placeholder="e.g., 2" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9 ring-offset-slate-900 focus-visible:ring-blue-500" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* RF Settings Card */}
        <Card className="bg-[#1E293B] border-slate-700 text-white shadow-md">
            <CardHeader className="px-4 py-2 border-b border-slate-700/50 bg-slate-800/50">
                <CardTitle className="text-lg font-bold text-white flex items-center">
                <Radio className="h-5 w-5 mr-2 text-blue-400" />
                RF Settings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-3">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-300 flex items-center">
                        Transmit Power (Fixed)
                        <span className="ml-2 text-xs text-blue-400">(ATS108)</span>
                    </label>
                    <div className="bg-[#0F172A] p-2 rounded-md text-center font-bold text-lg">
                        30 dBm
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center">
                        Link Rate <span className="ml-1 text-xs text-blue-400">(ATS103)</span>
                        </label>
                        <Select value={linkRate} onValueChange={setLinkRate}>
                        <SelectTrigger className="w-full bg-[#0F172A] border-slate-700 text-white h-9 ring-offset-slate-900 focus:ring-blue-500">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="4.8">4.8 kbps</SelectItem>
                            <SelectItem value="9.6">9.6 kbps</SelectItem>
                            <SelectItem value="19.2">19.2 kbps</SelectItem>
                            <SelectItem value="38.4">38.4 kbps</SelectItem>
                            <SelectItem value="57.6">57.6 kbps</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center">
                        RF Channel <span className="ml-1 text-xs text-blue-400">(ATS125)</span>
                        </label>
                        <Input placeholder="Channel number" value={rfChannel} onChange={(e) => setRfChannel(e.target.value)} className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9 ring-offset-slate-900 focus-visible:ring-blue-500" />
                    </div>
                </div>
                <div className="flex items-center space-x-2 bg-[#0F172A] p-2 rounded-md mt-1">
                <Checkbox id="tdma-mode" checked={tdmaMode} onCheckedChange={(checked) => setTdmaMode(checked as boolean)} disabled={networkType === "Point to Point (P2P)"} className="border-slate-600 data-[state=checked]:bg-blue-600 h-4 w-4" />
                <label htmlFor="tdma-mode" className="text-sm font-medium text-slate-300 flex items-center">
                    TDMA Mode <span className="ml-1 text-xs text-blue-400">(ATS224)</span>
                </label>
                </div>
            </CardContent>
        </Card>
        {/* Security & Encryption Card */}
        <Card className="bg-[#1E293B] border-slate-700 text-white shadow-md">
            <CardHeader className="px-4 py-2 border-b border-slate-700/50 bg-slate-800/50">
                <CardTitle className="text-lg font-bold text-white flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-400" />
                Security & Encryption
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-3">
                <div className="flex items-center space-x-2 bg-[#0F172A] p-2 rounded-md">
                <Checkbox id="aes-encryption" checked={aesEncryption} disabled className="border-slate-600 data-[state=checked]:bg-blue-600 h-4 w-4" />
                <label htmlFor="aes-encryption" className="text-sm font-medium text-slate-300 flex items-center">
                    AES Encryption (Unsupported) <span className="ml-1 text-xs text-blue-400">(ATS145)</span>
                </label>
                </div>
                <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 flex items-center">
                    Encryption Key <span className="ml-1 text-xs text-blue-400">(ATS146)</span>
                </label>
                <Input placeholder="Unsupported by device firmware" type="text" value={encryptionKey} disabled className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9" />
                </div>
                <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300 flex items-center">
                    Call Sign ID <span className="ml-1 text-xs text-blue-400">(ATS228)</span>
                </label>
                <Input placeholder="Call sign identifier" value={callSign} onChange={(e) => setCallSign(e.target.value)} className="bg-[#0F172A] border-slate-700 text-white placeholder:text-slate-500 h-9 ring-offset-slate-900 focus-visible:ring-blue-500" />
                </div>
            </CardContent>
        </Card>
      </div>
      {/* Command Preview & Buttons */}
      <div className="mt-3 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1E293B] p-3 rounded-lg border border-slate-700 shadow-md">
        <div className="text-white text-sm w-full md:w-auto">
          <div className="text-slate-400 mb-1">AT command preview:</div>
          <div className="bg-[#0F172A] px-3 py-2 rounded-md border border-slate-700 font-mono text-blue-400 max-w-full overflow-x-auto whitespace-nowrap">
            ATS101={operatingMode === "Master" ? "0" : operatingMode === "Repeater" ? "1" : "2"}, ATS102={baudRate}, ATS103={linkRate}...
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
          <Button onClick={handleFactoryReset} variant="destructive" className="bg-red-600 hover:bg-red-700 h-9 text-sm rounded-md">
            <RefreshCcw className="h-4 w-4 mr-2" /> Factory Reset
          </Button>
          <Button onClick={handleExportJSON} variant="destructive" className="bg-gray-700 hover:bg-gray-600 h-9 text-sm rounded-md">
            <FileJson className="h-4 w-4 mr-2" /> Export JSON
          </Button>
          <Button onClick={handleApplyConfiguration} variant="default" className="bg-blue-600 hover:bg-blue-700 h-9 text-sm rounded-md" disabled={isApplyingConfig}>
            {isApplyingConfig ? (
                <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {applyStatus}
                </>
            ) : (
                <>
                    <Save className="h-4 w-4 mr-2" /> Apply Configuration
                </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}