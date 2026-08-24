import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Entity } from '../types';
import { ENTITY_TYPE_META } from '../types';

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
}

export function GraphView({ entities, selectedId, onSelect }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || entities.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Build nodes
    const nodes: GraphNode[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      icon: e.icon,
    }));

    // Build links from relationIds
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = [];
    entities.forEach((e) => {
      e.relationIds.forEach((targetId) => {
        if (nodeIds.has(targetId)) {
          links.push({ source: e.id, target: targetId });
        }
      });
    });

    // Container group for zoom/pan
    const g = svg.append('g');

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
    const node = g.selectAll('.graph-node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circle
    node.append('circle')
      .attr('r', (d) => d.id === selectedId ? 28 : 22)
      .attr('fill', (d) => ENTITY_TYPE_META[d.type as keyof typeof ENTITY_TYPE_META]?.color || '#94a3b8')
      .attr('stroke', (d) => d.id === selectedId ? '#fff' : 'none')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85);

    // Node icon (emoji)
    node.append('text')
      .attr('dy', '0.35em')
      .style('font-size', '16px')
      .text((d) => d.icon);

    // Node label
    node.append('text')
      .attr('dy', '2.5em')
      .style('font-size', '11px')
      .style('fill', '#94a3b8')
      .text((d) => d.name.length > 8 ? d.name.slice(0, 7) + '…' : d.name);

    // Click handler
    node.on('click', (_event, d) => {
      onSelect(d.id);
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

    return () => {
      simulation.stop();
    };
  }, [entities, selectedId, onSelect]);

  return (
    <svg ref={svgRef} className="w-full h-full" />
  );
}
