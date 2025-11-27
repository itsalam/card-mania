export type NodeCategory = 'ui' | 'domain' | 'data' | 'infra' | 'edge' | 'future' | 'aws'

export type NodeDefinition = {
  key: string
  category: NodeCategory
  fields?: string[]
  methods?: string[]
}

export type NodeSection = {
  title: string
  category: NodeCategory
  nodes: NodeDefinition[]
}

export type LinkDefinition = {
  from: string
  to: string
}

export type LinkSection = {
  title: string
  links: LinkDefinition[]
}
