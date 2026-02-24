"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface NodeData {
  node: string;
  pricePerMwh: number | null;
  intervalStart: string | null;
}

// Approximate lat/lng for ERCOT hub nodes
const NODE_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  HB_NORTH:   { lat: 32.78,  lng: -96.80,  label: "North (Dallas)" },
  HB_SOUTH:   { lat: 29.42,  lng: -98.49,  label: "South (San Antonio)" },
  HB_WEST:    { lat: 31.84,  lng: -102.37, label: "West (Midland)" },
  HB_HOUSTON: { lat: 29.76,  lng: -95.37,  label: "Houston" },
};

function priceColor(price: number | null): string {
  if (price === null) return "#71717a"; // zinc — no data
  if (price < 0)   return "#8b5cf6";   // violet — negative (wind curtailment)
  if (price < 30)  return "#22d3ee";   // cyan — cheap
  if (price < 60)  return "#22c55e";   // green — moderate
  if (price < 100) return "#f59e0b";   // amber — elevated
  return "#ef4444";                    // red — expensive / spike
}

function priceLabel(price: number | null): string {
  if (price === null) return "No data";
  return `$${price.toFixed(2)}/MWh`;
}

interface NodeMapProps {
  selectedNode: string;
  onSelectNode: (node: string) => void;
}

export default function NodeMap({ selectedNode, onSelectNode }: NodeMapProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [popup, setPopup] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => r.json())
      .then((d) => setNodes(d.nodes ?? []));
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
        Add <code className="mx-1 rounded bg-zinc-800 px-1 text-cyan-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code className="rounded bg-zinc-800 px-1 text-cyan-400">.env.local</code> to enable the map.
      </div>
    );
  }

  return (
    <Map
      initialViewState={{
        longitude: -99,
        latitude: 31.2,
        zoom: 5.2,
      }}
      style={{ width: "100%", height: "100%", borderRadius: "0.75rem" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      attributionControl={false}
    >
      {nodes.map((nd) => {
        const coords = NODE_COORDS[nd.node];
        if (!coords) return null;
        const color = priceColor(nd.pricePerMwh);
        const isSelected = nd.node === selectedNode;

        return (
          <Marker
            key={nd.node}
            longitude={coords.lng}
            latitude={coords.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopup(nd.node);
              onSelectNode(nd.node);
            }}
          >
            <div
              style={{
                width: isSelected ? 22 : 16,
                height: isSelected ? 22 : 16,
                borderRadius: "50%",
                backgroundColor: color,
                border: isSelected ? "3px solid white" : "2px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
                boxShadow: isSelected ? `0 0 12px ${color}` : `0 0 6px ${color}80`,
                transition: "all 0.15s ease",
              }}
              title={`${nd.node}: ${priceLabel(nd.pricePerMwh)}`}
            />
          </Marker>
        );
      })}

      {popup && (() => {
        const nd = nodes.find((n) => n.node === popup);
        const coords = NODE_COORDS[popup];
        if (!nd || !coords) return null;
        return (
          <Popup
            longitude={coords.lng}
            latitude={coords.lat}
            anchor="bottom"
            offset={14}
            onClose={() => setPopup(null)}
            closeButton={true}
            style={{ color: "#000" }}
          >
            <div className="min-w-[130px] text-xs">
              <p className="font-semibold text-zinc-800">{NODE_COORDS[nd.node]?.label}</p>
              <p className="text-zinc-600">{nd.node}</p>
              <p
                className="mt-1 font-bold"
                style={{ color: priceColor(nd.pricePerMwh) }}
              >
                {priceLabel(nd.pricePerMwh)}
              </p>
              {nd.intervalStart && (
                <p className="mt-0.5 text-zinc-500">
                  {new Date(nd.intervalStart).toLocaleString()}
                </p>
              )}
            </div>
          </Popup>
        );
      })()}
    </Map>
  );
}
