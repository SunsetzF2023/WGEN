import type { Entity } from '../types';

interface Match {
  start: number;
  end: number;
  entityId: string;
  entityName: string;
}

/**
 * Scans rendered HTML text nodes for entity names and wraps them in
 * clickable <span class="entity-link" data-entity-id="..."> elements.
 *
 * - Longest entity names are matched first (so "天曌帝洲" beats "帝洲")
 * - Text inside <code>, <pre>, <a> tags is skipped
 * - Self-references (entity's own name in its own description) are skipped
 * - Overlapping matches are resolved greedily (first/longest wins)
 */
export function linkifyHtml(html: string, entities: Entity[], selfEntityId?: string): string {
  if (entities.length === 0) return html;

  // Build sorted entity list — longest name first for greedy matching
  const sorted = entities
    .filter((e) => e.name.length >= 2 && e.id !== selfEntityId)
    .sort((a, b) => b.name.length - a.name.length);

  if (sorted.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      // Skip code blocks, pre-formatted text, and existing links
      if (tag === 'CODE' || tag === 'PRE' || tag === 'A') {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip if inside an entity-link already
      if (parent.classList?.contains('entity-link')) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent && node.textContent.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent!;
    const matches: Match[] = [];

    for (let i = 0; i < text.length; i++) {
      // Try matching entity names at this position (longest first)
      for (const entity of sorted) {
        if (text.substring(i, i + entity.name.length) === entity.name) {
          matches.push({
            start: i,
            end: i + entity.name.length,
            entityId: entity.id,
            entityName: entity.name,
          });
          break; // first match is the longest due to sorting
        }
      }
    }

    if (matches.length === 0) continue;

    // Remove overlapping matches — keep first (greedy left-to-right)
    const nonOverlapping: Match[] = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.end;
      }
    }

    // Rebuild the text node with entity-link spans
    const fragment = doc.createDocumentFragment();
    let lastIdx = 0;
    for (const m of nonOverlapping) {
      if (m.start > lastIdx) {
        fragment.appendChild(doc.createTextNode(text.substring(lastIdx, m.start)));
      }
      const span = doc.createElement('span');
      span.className = 'entity-link';
      span.setAttribute('data-entity-id', m.entityId);
      span.textContent = m.entityName;
      fragment.appendChild(span);
      lastIdx = m.end;
    }
    if (lastIdx < text.length) {
      fragment.appendChild(doc.createTextNode(text.substring(lastIdx)));
    }

    textNode.parentNode!.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}
