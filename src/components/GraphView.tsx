import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Entity } from '../types';
import { ENTITY_TYPE_META, isImageIcon } from '../types';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  icon: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphViewProps {
  entities: Entity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
}

/** Distance in px below which a drag gesture counts as a click */
const DRAG_TOLERANCE = 3;

export function GraphView({ entities, selectedId, onSelect, onPositionChange }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const entitiesRef = useRef(entities);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onPositionChangeRef = useRef(onPositionChange);

  useEffect(() => {
    entitiesRef.current = entities;
    selectedIdRef.current = selectedId;
    onSelectRef.current = onSelect;
    onPositionChangeRef.current = onPositionChange;
  });

  /** Only a structural change (nodes, edges, labels) requires rebuilding the graph */
  const structureKey = useMemo(
    () => entities.map((e) => `${e.id}|${e.name}|${e.type}|${e.icon}|${e.relationIds.join(',')}`).join('\n'),
    [entities]
  );

  /** Pinned positions are applied to the running simulation instead of rebuilding it */
  const positionKey = useMemo(
    () => entities.map((e) => `${e.id}|${e.position ? `${e.position.x},${e.position.y}` : ''}`).join('\n'),
    [entities]
  );

  useEffect(() => {
    const currentEntities = entitiesRef.current;
    if (!svgRef.current || currentEntities.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Build nodes — use saved positions if available
    const nodes: GraphNode[] = currentEntities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      icon: e.icon,
      x: e.position?.x,
      y: e.position?.y,
      fx: e.position?.x,
      fy: e.position?.y,
    }));

    // Build links from relationIds
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = [];
    currentEntities.forEach((e) => {
      e.relationIds.forEach((targetId) => {
        if (nodeIds.has(targetId)) {
          links.push({ source: e.id, target: targetId });
        }
      });
    });

    // Container group for zoom/pan
    const g = svg.append('g');

    // Defs for clip paths (circular crop for image icons)
    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'node-icon-clip')
      .append('circle').attr('r', 16);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Links
    const link = g.selectAll('.graph-link')
      .data(links)
      .enter().append('line')
      .attr('class', 'graph-link');

    // Nodes
    let dragMoved = false;
    const node = g.selectAll<SVGGElement, GraphNode>('.graph-node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (_event, d) => {
          dragMoved = false;
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          if (!dragMoved && Math.hypot(event.x - d.fx!, event.y - d.fy!) < DRAG_TOLERANCE) return;
          if (!dragMoved) {
            dragMoved = true;
            simulation.alphaTarget(0.3).restart();
          }
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (!dragMoved) {
            // Treated as a click: select instead of persisting a position
            onSelectRef.current(d.id);
            return;
          }
          // Keep fx/fy set so node stays in place
          onPositionChangeRef.current?.(d.id, d.x!, d.y!);
        })
      );
    nodeSelRef.current = node;
    nodesRef.current = nodes;

    // Node circle
    node.append('circle')
      .attr('class', 'graph-node-circle')
      .attr('r', (d) => d.id === selectedIdRef.current ? 28 : 22)
      .attr('fill', (d) => ENTITY_TYPE_META[d.type as keyof typeof ENTITY_TYPE_META]?.color || '#94a3b8')
      .attr('stroke', (d) => d.id === selectedIdRef.current ? '#fff' : 'none')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85);

    // Node icon (emoji or image)
    node.each(function (d) {
      const g = d3.select(this);
      if (isImageIcon(d.icon)) {
        g.append('image')
          .attr('href', d.icon)
          .attr('x', -16)
          .attr('y', -16)
          .attr('width', 32)
          .attr('height', 32)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('clip-path', 'url(#node-icon-clip)');
      } else {
        g.append('text')
          .attr('dy', '0.35em')
          .style('font-size', '16px')
          .style('text-anchor', 'middle')
          .text(d.icon);
      }
    });

    // Node label
    node.append('text')
      .attr('dy', '2.5em')
      .style('font-size', '11px')
      .style('fill', '#94a3b8')
      .text((d) => d.name.length > 8 ? d.name.slice(0, 7) + '…' : d.name);

    // Click handler
    node.on('click', (_event, d) => {
      onSelectRef.current(d.id);
    });

    // Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as GraphNode).x!)
          .attr('y1', (d) => (d.source as GraphNode).y!)
          .attr('x2', (d) => (d.target as GraphNode).x!)
          .attr('y2', (d) => (d.target as GraphNode).y!);
        node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      nodeSelRef.current = null;
      nodesRef.current = [];
      simulationRef.current = null;
    };
  }, [structureKey]);

  // Pin/unpin nodes when saved positions change (e.g. "reset layout" clears them)
  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;
    const positions = new Map(entitiesRef.current.map((e) => [e.id, e.position]));
    let changed = false;
    nodesRef.current.forEach((n) => {
      const p = positions.get(n.id);
      const fx = p ? p.x : null;
      const fy = p ? p.y : null;
      if ((n.fx ?? null) !== fx || (n.fy ?? null) !== fy) {
        n.fx = fx;
        n.fy = fy;
        changed = true;
      }
    });
    if (changed) simulation.alpha(0.6).restart();
  }, [positionKey]);

  // Highlight the selected node without rebuilding the graph
  useEffect(() => {
    nodeSelRef.current?.select<SVGCircleElement>('.graph-node-circle')
      .attr('r', (d) => d.id === selectedId ? 28 : 22)
      .attr('stroke', (d) => d.id === selectedId ? '#fff' : 'none');
  }, [selectedId, structureKey]);

  return (
    <svg ref={svgRef} className="w-full h-full" />
  );
}
