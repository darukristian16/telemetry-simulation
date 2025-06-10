"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TelemetryDashboard() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 px-4 lg:px-6">
      <div className="w-full lg:w-3/4 h-full overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle>Live Location</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center">
            <div className="text-muted-foreground">Location data will appear here</div>
          </CardContent>
        </Card>
      </div>
      <div className="w-full lg:w-1/4 flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">Temperature data will appear here</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gas Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">Gas sensor data will appear here</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">System status data will appear here</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 