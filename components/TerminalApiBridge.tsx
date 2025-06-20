import { Button } from "@/components/ui/button"
import { Play, Square } from "lucide-react"
import { useTerminalApi } from "@/lib/hooks/useTerminalApi"

interface TerminalApiBridgeProps {
  apiEndpoint: string;
  readInterval?: number;
}

export function TerminalApiBridge({ apiEndpoint, readInterval = 1000 }: TerminalApiBridgeProps) {
  const { isReading, startReading, stopReading } = useTerminalApi(apiEndpoint, readInterval);

  return (
    <div className="flex items-center space-x-4">
      <Button
        onClick={isReading ? stopReading : startReading}
        variant={isReading ? "destructive" : "default"}
        className="min-w-32"
      >
        {isReading ? (
          <>
            <Square className="mr-2 h-4 w-4" />
            Stop Reading
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Start Reading
          </>
        )}
      </Button>
      
      <div className="text-sm text-slate-400">
        API Bridge: <span className={isReading ? "text-green-400" : "text-slate-400"}>
          {isReading ? "Reading" : "Stopped"}
        </span>
      </div>
    </div>
  );
} 