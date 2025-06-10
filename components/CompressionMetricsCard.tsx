"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TelemetryData } from '@/context/TelemetryContext';

interface CompressionMetricsCardProps {
  telemetryData: TelemetryData;
}

export function CompressionMetricsCard({ telemetryData }: CompressionMetricsCardProps) {
  if (!telemetryData.compressionMetrics) {
    return null;
  }

  const metrics = telemetryData.compressionMetrics;

  // Helper function to get compression status color
  const getCompressionStatusColor = (ratio: number) => {
    if (ratio >= 10) return "bg-green-500";
    if (ratio >= 5) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Helper function to get compression status text
  const getCompressionStatusText = (ratio: number) => {
    if (ratio >= 10) return "Excellent";
    if (ratio >= 5) return "Good";
    return "Fair";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Compression Metrics
          <Badge variant="outline" className="ml-2">
            Real-time
          </Badge>
        </CardTitle>
        <CardDescription>
          Unified compression performance across all sensors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compression Ratio */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Compression Ratio</span>
            <span className="text-2xl font-bold text-blue-600">
              {metrics.compressionRatio.toFixed(2)}:1
            </span>
          </div>
          <div className="flex justify-center">
            <Badge 
              variant="secondary" 
              className={`${getCompressionStatusColor(metrics.compressionRatio)} text-white border-0 px-4 py-1`}
            >
              {getCompressionStatusText(metrics.compressionRatio)} Compression
            </Badge>
          </div>
        </div>

        {/* Processing Time */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Processing Time</span>
            <span className="text-2xl font-bold text-green-600">
              {metrics.processingTime.toFixed(2)}ms
            </span>
          </div>
          <div className="flex justify-center">
            <Badge variant="outline" className="text-gray-600">
              {metrics.processingTime < 1 ? 'Ultra Fast' : 
               metrics.processingTime < 5 ? 'Fast' : 
               metrics.processingTime < 10 ? 'Normal' : 'Slow'} Processing
            </Badge>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="pt-4 border-t">
          <div className="text-center text-sm text-gray-600">
            Data compressed by {((metrics.compressionRatio - 1) / metrics.compressionRatio * 100).toFixed(1)}% 
            in {metrics.processingTime.toFixed(2)}ms
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 