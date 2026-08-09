import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { Node, Tap } from '../types';
import { parseAnyTimestamp } from '../utils/dateUtils';
import { MapPin, Clock, Calendar, LayoutGrid, Info, Compass, HelpCircle } from 'lucide-react';

interface NfcNodeHeatmapProps {
  nodes: Node[];
  taps: Tap[];
}

export const NfcNodeHeatmap: React.FC<NfcNodeHeatmapProps> = ({ nodes = [], taps = [] }) => {
  const [viewMode, setViewMode] = useState<'spatial' | 'matrix'>('spatial');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'nfc' | 'qr' | 'direct'>('all');
  const [hoveredCell, setHoveredCell] = useState<{
    label: string;
    subLabel: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const spatialSvgRef = useRef<SVGSVGElement>(null);
  const matrixSvgRef = useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // 1. ResizeObserver for responsive D3 canvas sizing
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Maintain reasonable aspect ratio
      const calculatedWidth = Math.max(width, 280);
      const calculatedHeight = Math.max(calculatedWidth * 0.6, 320);
      setDimensions({ width: calculatedWidth, height: calculatedHeight });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Filter taps by access vector
  const filteredTaps = useMemo(() => {
    return taps.filter(tap => {
      if (filterType === 'all') return true;
      return tap.access_vector === filterType;
    });
  }, [taps, filterType]);

  // Aggregate tap counts per node
  const nodeTapCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Ensure all known nodes have an entry
    nodes.forEach(n => { counts[n.id] = 0; });
    
    filteredTaps.forEach(tap => {
      if (tap.node_id) {
        counts[tap.node_id] = (counts[tap.node_id] || 0) + 1;
      }
    });
    return counts;
  }, [nodes, filteredTaps]);

  // Max tap count of a single node for normalization
  const maxTapValue = useMemo(() => {
    const values = Object.values(nodeTapCounts);
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [nodeTapCounts]);

  // 3. Render Spatial Heatmap SVG with D3
  useEffect(() => {
    if (viewMode !== 'spatial' || !spatialSvgRef.current || nodes.length === 0) return;

    const svg = d3.select(spatialSvgRef.current);
    svg.selectAll('*').remove(); // Clear previous content for clean re-renders

    const { width, height } = dimensions;
    const padding = 50;

    // Filter nodes that actually have coordinates
    const geoNodes = nodes.filter(n => typeof n.latitude === 'number' && typeof n.longitude === 'number');
    if (geoNodes.length === 0) return;

    // Get geo boundaries representing our city sector bounds
    const lats = geoNodes.map(n => n.latitude);
    const lngs = geoNodes.map(n => n.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // D3 Scale mappings to match coordinates with container dimensions
    // SVG coordinates increase downwards, so we invert latitude representation
    const xScale = d3.scaleLinear()
      .domain([minLng - 0.005, maxLng + 0.005])
      .range([padding, width - padding]);

    const yScale = d3.scaleLinear()
      .domain([minLat - 0.005, maxLat + 0.005])
      .range([height - padding, padding]);

    // D3 Density color interpolator matching Urban Hikers premium dark neon yellow aesthetic
    const colorScale = d3.scaleSequential(d3.interpolateRgbBasis([
      'rgba(34, 34, 34, 0.1)',   // Very low
      'rgba(245, 158, 11, 0.25)', // Amber/orange glow
      'rgba(255, 224, 26, 0.75)',  // Yellow glow
      '#FFE01A'                 // High intensity neon yellow
    ])).domain([0, maxTapValue]);

    // Radius scale proportional to tap count (heatmap hot spots)
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxTapValue])
      .range([10, 48]);

    // Radial gradient glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'neon-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '10')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Create container group
    const g = svg.append('g');

    // Draw background grid lines mimicking radar search mesh
    const gridCount = 6;
    for (let i = 1; i < gridCount; i++) {
      const rx = padding + (width - padding * 2) * (i / gridCount);
      const ry = padding + (height - padding * 2) * (i / gridCount);
      
      // Vertical grid line
      g.append('line')
        .attr('x1', rx)
        .attr('y1', padding)
        .attr('x2', rx)
        .attr('y2', height - padding)
        .attr('stroke', 'rgba(255, 255, 255, 0.025)')
        .attr('stroke-width', 1);

      // Horizontal grid line
      g.append('line')
        .attr('x1', padding)
        .attr('y1', ry)
        .attr('x2', width - padding)
        .attr('y2', ry)
        .attr('stroke', 'rgba(255, 255, 255, 0.025)')
        .attr('stroke-width', 1);
    }

    // Draw coordinate axis guides
    g.append('text')
      .attr('x', padding)
      .attr('y', height - 15)
      .attr('fill', 'rgba(255,255,255,0.2)')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .text(`LON_WEST: ${minLng.toFixed(4)}`);

    g.append('text')
      .attr('x', width - padding - 80)
      .attr('y', height - 15)
      .attr('fill', 'rgba(255,255,255,0.2)')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .text(`LON_EAST: ${maxLng.toFixed(4)}`);

    g.append('text')
      .attr('x', 15)
      .attr('y', padding + 10)
      .attr('fill', 'rgba(255,255,255,0.2)')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('writing-mode', 'vertical-rl')
      .text(`LAT_NORTH: ${maxLat.toFixed(4)}`);

    // Plot Heat rings representing activity density
    geoNodes.forEach(node => {
      const x = xScale(node.longitude);
      const y = yScale(node.latitude);
      const tapsCount = nodeTapCounts[node.id] || 0;
      
      if (tapsCount === 0) return; // Only draw glowing thermal coordinates for active spots

      const r = radiusScale(tapsCount);
      const thermalColor = colorScale(tapsCount);
      const sizeRatio = tapsCount / maxTapValue;

      // Concentric thermal footprint base ring (concentric contour)
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', r * 1.5)
        .attr('fill', thermalColor)
        .attr('opacity', 0.08 * sizeRatio)
        .style('filter', 'url(#neon-glow)');

      // Mid intense thermal circle
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', r * 0.8)
        .attr('fill', thermalColor)
        .attr('opacity', 0.18)
        .style('filter', 'url(#neon-glow)');

      // Core pulsing glow spot
      const core = g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', Math.max(r * 0.25, 4))
        .attr('fill', '#FFE01A')
        .attr('opacity', 0.75 + 0.25 * sizeRatio)
        .attr('stroke', '#111')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer');

      // Animate pulsing rhythm on core node depending on tap density
      const pulseSpeed = Math.max(800, 2500 - tapsCount * 120);
      const pulseAnim = () => {
        core.transition()
          .duration(pulseSpeed)
          .attr('r', Math.max(r * 0.45, 6))
          .attr('opacity', 0.4)
          .transition()
          .duration(pulseSpeed)
          .attr('r', Math.max(r * 0.25, 4))
          .attr('opacity', 0.85)
          .on('end', pulseAnim);
      };
      pulseAnim();
    });

    // Draw crisp interactive node pins on top layer
    const pinsGroup = g.append('g').attr('id', 'node-pins');

    geoNodes.forEach(node => {
      const x = xScale(node.longitude);
      const y = yScale(node.latitude);
      const tapsCount = nodeTapCounts[node.id] || 0;
      const isSelected = selectedNodeId === node.id;

      // Draw interactive hit target circle (transparent, larger for easy touch)
      pinsGroup.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 16)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', (event) => {
          d3.select(event.currentTarget.parentElement).raise(); // Bring node forward
          
          setHoveredCell({
            label: node.name,
            subLabel: `Zone: ${node.address || 'Cincinnati'}`,
            value: tapsCount,
            x: x,
            y: y - 20
          });
        })
        .on('mouseleave', () => {
          setHoveredCell(null);
        })
        .on('click', () => {
          setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
        });

      // Visually elegant micro pin circle
      pinsGroup.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', isSelected ? 8 : 4.5)
        .attr('fill', isSelected ? '#FFE01A' : tapsCount > 0 ? '#FFFFFF' : '#444444')
        .attr('stroke', '#111111')
        .attr('stroke-width', isSelected ? 2.5 : 1.5)
        .style('pointer-events', 'none')
        .style('transition', 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)');
      
      // If selected, draw connecting visual bounds crossline
      if (isSelected) {
        pinsGroup.append('line')
          .attr('x1', xScale(minLng - 0.005))
          .attr('y1', y)
          .attr('x2', xScale(maxLng + 0.005))
          .attr('y2', y)
          .attr('stroke', 'rgba(255, 224, 26, 0.35)')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-width', 0.8)
          .style('pointer-events', 'none');

        pinsGroup.append('line')
          .attr('x1', x)
          .attr('y1', yScale(minLat - 0.005))
          .attr('x2', x)
          .attr('y2', yScale(maxLat + 0.005))
          .attr('stroke', 'rgba(255, 224, 26, 0.35)')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-width', 0.8)
          .style('pointer-events', 'none');
      }
    });

  }, [viewMode, nodes, dimensions, nodeTapCounts, maxTapValue, selectedNodeId]);

  // 4. Render Grid Matrix Temporal Heatmap SVG with D3
  // Matrix format: Rows = Active Nodes, Columns = Hourly periods of day (0-23 hours grouped or directly 24 cells)
  const hourlyMatrixData = useMemo(() => {
    if (nodes.length === 0) return [];

    // Group hours into 4 major blocks for clean density visual:
    // Night (00:00 - 06:00), Morning (06:00 - 12:00), Afternoon (12:00 - 18:00), Evening (18:00 - 24:00)
    const timeBlocks = [
      { id: 'night', label: 'NIGHT [00-06]' },
      { id: 'morning', label: 'MORNING [06-12]' },
      { id: 'afternoon', label: 'AFTERNOON [12-18]' },
      { id: 'evening', label: 'EVENING [18-24]' }
    ];

    const popularNodes = nodes
      .map(n => ({ node: n, total: nodeTapCounts[n.id] || 0 }))
      .sort((a,b) => b.total - a.total)
      .slice(0, 10); // Display top 10 nodes to prevent visual pollution

    const matrix: { nodeId: string; nodeName: string; blockId: string; blockLabel: string; value: number }[] = [];

    popularNodes.forEach(({ node }) => {
      timeBlocks.forEach(block => {
        // Find taps corresponding to this node inside this block hour range
        const count = filteredTaps.filter(tap => {
          if (tap.node_id !== node.id) return false;
          const hour = parseAnyTimestamp(tap.timestamp, tap.client_timestamp).getHours();
          if (block.id === 'night') return hour >= 0 && hour < 6;
          if (block.id === 'morning') return hour >= 6 && hour < 12;
          if (block.id === 'afternoon') return hour >= 12 && hour < 18;
          return hour >= 18 && hour < 24;
        }).length;

        matrix.push({
          nodeId: node.id,
          nodeName: node.name,
          blockId: block.id,
          blockLabel: block.label,
          value: count
        });
      });
    });

    return matrix;
  }, [nodes, filteredTaps, nodeTapCounts]);

  const maxMatrixValue = useMemo(() => {
    const vals = hourlyMatrixData.map(d => d.value);
    return vals.length > 0 ? Math.max(...vals, 1) : 1;
  }, [hourlyMatrixData]);

  useEffect(() => {
    if (viewMode !== 'matrix' || !matrixSvgRef.current || hourlyMatrixData.length === 0) return;

    const svg = d3.select(matrixSvgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 40, right: 20, bottom: 40, left: 160 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Get unique nodes and time blocks in matrix layout
    const yKeys = Array.from(new Set(hourlyMatrixData.map(d => d.nodeName)));
    const xKeys = Array.from(new Set(hourlyMatrixData.map(d => d.blockLabel)));

    // D3 Band scale mapping
    const xScale = d3.scaleBand()
      .domain(xKeys)
      .range([0, chartWidth])
      .padding(0.08);

    const yScale = d3.scaleBand()
      .domain(yKeys)
      .range([0, chartHeight])
      .padding(0.08);

    // Deep modern charcoal-to-neon yellow sequential density scale
    const colorScale = d3.scaleSequential(
      d3.interpolateRgbBasis(['#1F1F1F', '#52430A', '#B5990B', '#FFE01A'])
    ).domain([0, maxMatrixValue]);

    // Render X Axis Label columns
    g.selectAll('.x-label')
      .data(xKeys)
      .enter()
      .append('text')
      .attr('class', 'x-label')
      .attr('x', d => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y', chartHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'black')
      .text(d => d);

    // Render Y Axis Label rows
    g.selectAll('.y-label')
      .data(yKeys)
      .enter()
      .append('text')
      .attr('class', 'y-label')
      .attr('x', -15)
      .attr('y', d => (yScale(d) || 0) + yScale.bandwidth() / 2 + 3)
      .attr('text-anchor', 'end')
      .attr('fill', 'rgba(255,255,255,0.85)')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(d => d.length > 20 ? `${d.slice(0, 18)}...` : d);

    // Inner Grid cells of Heat Matrix
    g.selectAll('.cell')
      .data(hourlyMatrixData)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(d.blockLabel) || 0)
      .attr('y', d => yScale(d.nodeName) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', d => d.value > 0 ? 'rgba(255,224,26,0.1)' : 'rgba(255,255,255,0.02)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.15s ease')
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget)
          .attr('stroke', '#FFE01A')
          .attr('stroke-width', 2);

        // Compute SVG coordinate relative to outer container boundaries
        const cellX = (xScale(d.blockLabel) || 0) + margin.left + xScale.bandwidth() / 2;
        const cellY = (yScale(d.nodeName) || 0) + margin.top;

        setHoveredCell({
          label: d.nodeName,
          subLabel: d.blockLabel,
          value: d.value,
          x: cellX,
          y: cellY - 12
        });
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget)
          .attr('stroke', 'transparent')
          .attr('stroke-width', 1);
        setHoveredCell(null);
      });

    // Render counts overlay directly for very active cells
    g.selectAll('.cell-text')
      .data(hourlyMatrixData.filter(d => d.value > 0 && xScale.bandwidth() > 40))
      .enter()
      .append('text')
      .attr('class', 'cell-text')
      .attr('x', d => (xScale(d.blockLabel) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => (yScale(d.nodeName) || 0) + yScale.bandwidth() / 2 + 3)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.value / maxMatrixValue > 0.6 ? '#111111' : '#FFFFFF')
      .attr('font-size', '8px')
      .attr('font-weight', 'black')
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none')
      .text(d => d.value);

  }, [viewMode, hourlyMatrixData, dimensions, maxMatrixValue]);

  // Selected node details card display
  const activeSelectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  return (
    <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
      
      {/* Visual controls and heading */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FFE01A] bg-[#FFE01A]/10 px-2.5 py-1 rounded-md">
              D3_Spatial_Intelligence
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h2 className="text-white text-xl font-black uppercase tracking-tight">
            NFC Node Tap Heatmap
          </h2>
          <p className="text-white/45 text-[11px] font-mono">
            Analyzing real-world spatial concentrations & temporal check-in velocity.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          
          {/* Access Vector Filter */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-[10px] font-mono">
            {(['all', 'nfc', 'qr', 'direct'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg font-black uppercase transition-all whitespace-nowrap cursor-pointer ${
                  filterType === type 
                    ? 'bg-[#FFE01A] text-[#111]' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Toggle Screen Mode */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-[10px] font-mono">
            <button
              onClick={() => { setViewMode('spatial'); setSelectedNodeId(null); }}
              className={`px-3.5 py-1.5 rounded-lg font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'spatial'
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass size={12} className={viewMode === 'spatial' ? 'text-black' : 'text-[#FFE01A]'} />
              Spatial
            </button>
            <button
              onClick={() => { setViewMode('matrix'); setSelectedNodeId(null); }}
              className={`px-3.5 py-1.5 rounded-lg font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid size={12} className={viewMode === 'matrix' ? 'text-black' : 'text-[#FFE01A]'} />
              Temporal
            </button>
          </div>

        </div>
      </div>

      {/* Main Canvas Container and Side Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Render Canvas Zone */}
        <div 
          ref={containerRef}
          className="lg:col-span-2 bg-[#0c0c0c] border border-white/5 rounded-2xl relative overflow-hidden flex items-center justify-center p-4 min-h-[340px]"
        >
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-white/30 font-mono text-[10px]">
              <Info size={24} className="text-[#FFE01A] mb-2" />
              PLOT_COORDINATES_ERROR: NO ACTIVE DIRECTORY NODES TO RENDER
            </div>
          ) : (
            <>
              {/* D3 Tooltip */}
              <AnimatePresence>
                {hoveredCell && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      left: hoveredCell.x,
                      top: hoveredCell.y,
                      transform: 'translate(-50%, -100%)',
                    }}
                    className="bg-[#181818] border border-[#FFE01A]/30 text-white p-3.5 rounded-xl flex flex-col gap-1 shadow-2xl pointer-events-none z-30 min-w-[150px] backdrop-blur-md"
                  >
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#FFE01A] font-mono block">
                      signal_intensity
                    </span>
                    <span className="text-[11px] font-black leading-tight uppercase truncate max-w-[160px]">
                      {hoveredCell.label}
                    </span>
                    <span className="text-[8px] font-mono text-white/45 truncate">
                      {hoveredCell.subLabel}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/5 font-mono">
                      <span className="text-xs font-black text-[#FFE01A]">
                        {hoveredCell.value}
                      </span>
                      <span className="text-[8px] text-white/40 uppercase">Check-Ins</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Spatial Projection Grid */}
              {viewMode === 'spatial' && (
                <svg
                  ref={spatialSvgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  className="max-w-full h-auto overflow-visible select-none"
                />
              )}

              {/* Temporal Grid Matrix */}
              {viewMode === 'matrix' && (
                <svg
                  ref={matrixSvgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  className="max-w-full h-auto overflow-visible select-none"
                />
              )}
            </>
          )}

          {/* Core Legend Overlay */}
          <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm border border-white/5 px-3 py-2 rounded-lg flex items-center gap-3 text-[8px] font-mono text-white/40 select-none">
            <span className="uppercase">Intensity:</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#222] rounded-xs border border-white/15" />
              <span>Low</span>
            </div>
            <div className="h-2 w-12 bg-gradient-to-r from-amber-500/30 to-[#FFE01A] rounded-sm" />
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#FFE01A] rounded-xs" />
              <span>High (Thermal Anchor)</span>
            </div>
          </div>
        </div>

        {/* Dashboard Insights Panel */}
        <div className="space-y-4">
          
          {/* Main Hot Node Leaderboard Card */}
          <div className="bg-[#0e0e0e] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
              <Clock size={14} className="text-[#FFE01A]" />
              Hot Zone Leaderboard
            </h3>

            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {nodes
                .map(n => ({ node: n, count: nodeTapCounts[n.id] || 0 }))
                .filter(n => n.count > 0)
                .sort((a,b) => b.count - a.count)
                .slice(0, 5)
                .map((item, idx) => (
                  <div 
                    key={item.node.id} 
                    onClick={() => {
                      setViewMode('spatial');
                      setSelectedNodeId(item.node.id);
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedNodeId === item.node.id 
                        ? 'bg-[#FFE01A]/10 border-[#FFE01A]/30 text-white' 
                        : 'bg-[#151515] hover:bg-[#1a1a1a] border-transparent text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-[10px] font-black font-mono text-[#FFE01A]">
                        #{idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="text-[10.5px] font-black uppercase leading-tight truncate">
                          {item.node.name}
                        </div>
                        <div className="text-[8px] font-mono text-white/35 uppercase tracking-wider">
                          {item.node.type}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] font-black font-mono text-white">
                        {item.count}
                      </span>
                      <span className="text-[7.5px] font-mono text-white/30 uppercase tracking-widest block leading-none">
                        Taps
                      </span>
                    </div>
                  </div>
                ))}

              {nodes.filter(n => (nodeTapCounts[n.id] || 0) > 0).length === 0 && (
                <div className="text-center py-6 text-white/20 text-[9px] font-mono uppercase">
                  No active signal telemetry in buffer.
                </div>
              )}
            </div>
          </div>

          {/* Selected Spot Inspector Card */}
          <div className="bg-[#0e0e0e] border border-white/5 rounded-2xl p-5 min-h-[140px] flex flex-col justify-between">
            {activeSelectedNode ? (
              <div className="space-y-3.5">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-[#FFE01A] font-mono">
                    coordinate_inspector
                  </span>
                  <button 
                    onClick={() => setSelectedNodeId(null)}
                    className="text-[8px] font-mono uppercase text-[#FFE01A] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div>
                  <h4 className="text-white text-md font-black uppercase truncate">
                    {activeSelectedNode.name}
                  </h4>
                  <p className="text-white/45 text-[9px] leading-tight mt-1">
                    {activeSelectedNode.address || 'Cincinnati Signal Station'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[9.5px] font-mono">
                  <div className="bg-white/3 p-2 rounded-lg">
                    <span className="text-white/30 block text-[7px] uppercase tracking-wider mb-0.5">LATITUDE</span>
                    <span className="text-white font-medium">{activeSelectedNode.latitude?.toFixed(5) || '39.1092'}</span>
                  </div>
                  <div className="bg-white/3 p-2 rounded-lg">
                    <span className="text-white/30 block text-[7px] uppercase tracking-wider mb-0.5">LONGITUDE</span>
                    <span className="text-white font-medium">{activeSelectedNode.longitude?.toFixed(5) || '-84.5125'}</span>
                  </div>
                </div>

                <div className="bg-white/3 p-2.5 rounded-lg text-[9px] flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFE01A]" />
                    <span className="text-white/40 uppercase">Node Activity</span>
                  </div>
                  <span className="text-[#FFE01A] font-black text-[11px]">
                    {nodeTapCounts[activeSelectedNode.id] || 0} TAPS
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-white/20 font-mono text-[9.5px] gap-2 flex-1">
                <HelpCircle size={22} className="text-white/10" />
                <span>SELECT AN NFC PIN POINT ON THE HEAT CANVAS FOR COORDINATE METRICS INSPECTION</span>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
