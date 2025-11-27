import type { LinkDefinition, LinkSection, NodeDefinition, NodeSection } from './types'

export const nodeSections: NodeSection[] = [
  {
    title: 'UI',
    category: 'ui',
    nodes: [
      {
        key: 'ListCard (UI)',
        category: 'ui',
        fields: ['card: Card', 'isWishlisted: boolean'],
        methods: ['render()', 'onPress()', 'toggleWishlist()'],
      },
      {
        key: 'ExpandableCard (UI)',
        category: 'ui',
        fields: ['items: Card[]', 'isOpen: boolean'],
        methods: ['render()', 'toggle()', 'renderItem()'],
      },
    ],
  },
  {
    title: 'Domain',
    category: 'domain',
    nodes: [
      {
        key: 'Card',
        category: 'domain',
        fields: ['id: string', 'name: string', 'set: string', 'prices: Price[]'],
        methods: ['getDisplayPrice(): number', 'thumbnail(): ImageRef'],
      },
      {
        key: 'Collection',
        category: 'domain',
        fields: ['id: string', 'ownerId: string', 'cards: Card[]'],
        methods: ['addCard(cardId)', 'removeCard(cardId)'],
      },
      {
        key: 'Wishlist',
        category: 'domain',
        fields: ['id: string', 'userId: string', 'items: CardRef[]'],
        methods: ['toggle(cardId)', 'isWishlisted(cardId)'],
      },
    ],
  },
  {
    title: 'Data',
    category: 'data',
    nodes: [
      {
        key: 'CardRepository',
        category: 'data',
        fields: ['client: SupabaseClient'],
        methods: ['fetchCard(id)', 'fetchRecent(userId)', 'search(params)'],
      },
      {
        key: 'CollectionRepository',
        category: 'data',
        fields: ['client: SupabaseClient'],
        methods: ['listByUser(userId)', 'upsert(payload)', 'remove(id)'],
      },
      {
        key: 'WishlistRepository',
        category: 'data',
        fields: ['client: SupabaseClient'],
        methods: ['toggle(cardId)', 'list(userId)'],
      },
    ],
  },
  {
    title: 'Infra',
    category: 'infra',
    nodes: [
      {
        key: 'SupabaseClient',
        category: 'infra',
        fields: ['auth', 'rest', 'storage'],
        methods: ['from(table)', 'rpc(name, args)', 'storage.from(bucket)'],
      },
    ],
  },
  {
    title: 'Edge/Adapters',
    category: 'edge',
    nodes: [
      {
        key: 'PricingService',
        category: 'edge',
        fields: ['priceApiUrl: string'],
        methods: ['fetchPrices(cardId)', 'cachePrices(cardId)'],
      },
      {
        key: 'ImageProxy',
        category: 'edge',
        fields: ['baseUrl: string'],
        methods: ['thumbnail(cardId)', 'full(cardId)'],
      },
    ],
  },
  {
    title: 'AWS Integrations',
    category: 'aws',
    nodes: [
      {
        key: 'AWS S3 (Assets Cache)',
        category: 'aws',
        fields: ['bucket: card-media-cache', 'policy: public-read'],
        methods: ['putObject(cardId)', 'getObject(cardId)'],
      },
      {
        key: 'CloudFront CDN',
        category: 'aws',
        fields: ['domain: cdn.cardmania.app', 'cache: image/proxy'],
        methods: ['serve(object)', 'invalidate(path)'],
      },
      {
        key: 'AWS Lambda (Edge Fn)',
        category: 'aws',
        fields: ['runtime: node18', 'role: media-proxy'],
        methods: ['transformImage(request)', 'signUrl(key)'],
      },
      {
        key: 'Amazon MQ / SQS (Events)',
        category: 'aws',
        fields: ['queues: pricing-jobs', 'dlq: pricing-dlq'],
        methods: ['enqueue(job)', 'retry(job)'],
      },
    ],
  },
  {
    title: 'Future',
    category: 'future',
    nodes: [
      {
        key: 'Future: OffersService',
        category: 'future',
        fields: ['edgeFn: string'],
        methods: ['listOffers(cardId)', 'createOffer(payload)'],
      },
    ],
  },
]

export const linkSections: LinkSection[] = [
  {
    title: 'Data + UI',
    links: [
      { from: 'ListCard (UI)', to: 'CardRepository' },
      { from: 'ListCard (UI)', to: 'WishlistRepository' },
      { from: 'ListCard (UI)', to: 'PricingService' },
      { from: 'ExpandableCard (UI)', to: 'CardRepository' },
    ],
  },
  {
    title: 'Domain',
    links: [
      { from: 'Collection', to: 'Card' },
      { from: 'Wishlist', to: 'Card' },
      { from: 'Card', to: 'PricingService' },
      { from: 'Card', to: 'ImageProxy' },
    ],
  },
  {
    title: 'Supabase',
    links: [
      { from: 'CardRepository', to: 'SupabaseClient' },
      { from: 'CollectionRepository', to: 'SupabaseClient' },
      { from: 'WishlistRepository', to: 'SupabaseClient' },
    ],
  },
  {
    title: 'AWS Edge / Media',
    links: [
      { from: 'ImageProxy', to: 'CloudFront CDN' },
      { from: 'CloudFront CDN', to: 'AWS S3 (Assets Cache)' },
      { from: 'AWS Lambda (Edge Fn)', to: 'AWS S3 (Assets Cache)' },
      { from: 'PricingService', to: 'Amazon MQ / SQS (Events)' },
      { from: 'Amazon MQ / SQS (Events)', to: 'AWS Lambda (Edge Fn)' },
    ],
  },
  {
    title: 'Future',
    links: [
      { from: 'Future: OffersService', to: 'SupabaseClient' },
      { from: 'ListCard (UI)', to: 'Future: OffersService' },
    ],
  },
]

export const nodes: NodeDefinition[] = nodeSections.flatMap((section) => section.nodes)
export const links: LinkDefinition[] = linkSections.flatMap((section) => section.links)
