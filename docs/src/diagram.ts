import type { Diagram } from 'gojs'
import { links, nodes } from './data.js'
import type { NodeCategory } from './types.js'

declare const go: typeof import('gojs')

const fillByCategory: Record<NodeCategory, string> = {
  ui: '#DCE7FF',
  domain: '#E6FFF5',
  data: '#FFF5E5',
  infra: '#FFE3ED',
  edge: '#F3E8FF',
  future: '#E8E9FF',
  aws: '#DBEAFE',
}

const createDiagram = () => {
  if (!('go' in window)) {
    console.error('GoJS failed to load from CDN.')
    return
  }
  console.log('??')
  const $ = go.GraphObject.make
  const diagram: Diagram = $(go.Diagram, 'diagram', {
    layout: $(go.LayeredDigraphLayout, {
      direction: 90,
      layerSpacing: 70,
      columnSpacing: 40,
      aggressiveOption: go.LayeredDigraphLayout.AggressiveMore,
    }),
    'undoManager.isEnabled': false,
  })

  diagram.nodeTemplate = $(
    go.Node,
    'Auto',
    $(
      go.Shape,
      'RoundedRectangle',
      {
        stroke: '#92A4C8',
        strokeWidth: 1.5,
        fill: '#DCE7FF',
        portId: '',
        fromLinkable: true,
        toLinkable: true,
        cursor: 'pointer',
      },
      new go.Binding('fill', 'category', (cat: NodeCategory) => fillByCategory[cat] || '#E9F0FF')
    ),
    $(
      go.Panel,
      'Table',
      $(
        go.TextBlock,
        {
          row: 0,
          margin: new go.Margin(10, 10, 4, 10),
          font: '600 14px "Inter", "Montserrat", sans-serif',
          stroke: '#0F172A',
          wrap: go.TextBlock.WrapFit,
          maxLines: 3,
        },
        new go.Binding('text', 'key')
      ),
      $(
        go.TextBlock,
        {
          row: 1,
          margin: new go.Margin(0, 10, 4, 10),
          font: '600 12px "Inter", "Montserrat", sans-serif',
          stroke: '#4B5563',
        },
        new go.Binding('text', 'category', (cat: NodeCategory) => cat.toUpperCase())
      ),
      $(
        go.TextBlock,
        {
          row: 2,
          margin: new go.Margin(4, 10, 4, 10),
          font: '12px "Inter", sans-serif',
          stroke: '#0F172A',
        },
        new go.Binding('text', 'fields', (fields?: string[]) =>
          (fields || []).map((f) => `+ ${f}`).join('\n')
        )
      ),
      $(
        go.TextBlock,
        {
          row: 3,
          margin: new go.Margin(4, 10, 10, 10),
          font: '12px "Inter", sans-serif',
          stroke: '#0F172A',
        },
        new go.Binding('text', 'methods', (methods?: string[]) =>
          (methods || []).map((m) => `# ${m}`).join('\n')
        )
      )
    )
  )

  diagram.linkTemplate = $(
    go.Link,
    {
      routing: go.Link.Orthogonal,
      corner: 8,
      toShortLength: 6,
    },
    $(go.Shape, { strokeWidth: 1.6, stroke: '#CBD5E1' }),
    $(go.Shape, { toArrow: 'Standard', fill: '#CBD5E1', stroke: '#CBD5E1' })
  )

  diagram.model = new go.GraphLinksModel(nodes, links)
}

window.addEventListener('DOMContentLoaded', createDiagram)
